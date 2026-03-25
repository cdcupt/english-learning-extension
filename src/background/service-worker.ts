import type { DailyRecord, StreakData, Settings, AIProvider } from "@/shared/types";
import { getTodayKey, getYesterday } from "@/shared/utils/date";

// Open dashboard in new tab on icon click
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("src/newtab/index.html") });
});

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "explain-word",
    title: "Explain \"%s\"",
    contexts: ["selection"],
  });


  chrome.alarms.create("dailyReset", {
    when: getNextMidnight(),
    periodInMinutes: 24 * 60,
  });
  updateBadge();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "dailyReset") {
    if (await isPaused()) return;
    await finalizePreviousDay();
    await updateBadge();
  }
});

// Update badge when storage changes
chrome.storage.local.onChanged.addListener(() => {
  updateBadge();
});

async function isPaused(): Promise<boolean> {
  const result = await chrome.storage.local.get("settings");
  const settings = result["settings"] as Settings | undefined;
  return settings?.paused ?? false;
}

async function updateBadge() {
  if (await isPaused()) {
    chrome.action.setBadgeText({ text: "||" });
    chrome.action.setBadgeBackgroundColor({ color: "#9CA3AF" });
    return;
  }

  const today = getTodayKey();
  const result = await chrome.storage.local.get(`day:${today}`);
  const record = result[`day:${today}`] as DailyRecord | undefined;

  if (!record) {
    chrome.action.setBadgeText({ text: "5" });
    chrome.action.setBadgeBackgroundColor({ color: "#EF4444" });
    return;
  }

  let remaining = 0;
  if (!record.reading.completed) remaining++;
  if (!record.writing.completed) remaining++;
  if (!record.vocabulary.completed) remaining++;
  if (!record.speaking.completed) remaining++;
  if (!(record.listening?.completed)) remaining++;

  if (remaining === 0) {
    chrome.action.setBadgeText({ text: "✓" });
    chrome.action.setBadgeBackgroundColor({ color: "#22C55E" });
  } else {
    chrome.action.setBadgeText({ text: String(remaining) });
    chrome.action.setBadgeBackgroundColor({ color: "#EF4444" });
  }
}

async function finalizePreviousDay() {
  const yesterday = getYesterday();
  const result = await chrome.storage.local.get([
    `day:${yesterday}`,
    "streak",
  ]);
  const record = result[`day:${yesterday}`] as DailyRecord | undefined;
  const streak = (result["streak"] as StreakData | undefined) ?? {
    current: 0,
    longest: 0,
    lastPerfectDate: null,
  };

  if (!record) return;

  const complete =
    record.reading.completed &&
    record.writing.completed &&
    record.vocabulary.completed &&
    record.speaking.completed;

  if (complete) {
    const gap = streak.lastPerfectDate
      ? Math.round(
          (new Date(yesterday).getTime() -
            new Date(streak.lastPerfectDate).getTime()) /
            86400000
        )
      : 0;

    const newCurrent =
      !streak.lastPerfectDate || gap === 1 ? streak.current + 1 : 1;

    await chrome.storage.local.set({
      streak: {
        current: newCurrent,
        longest: Math.max(newCurrent, streak.longest),
        lastPerfectDate: yesterday,
      },
    });
  } else if (streak.lastPerfectDate !== yesterday) {
    await chrome.storage.local.set({
      streak: { ...streak, current: 0 },
    });
  }

  // Prune articles older than 30 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const allKeys = await chrome.storage.local.get(null);
  const keysToRemove = Object.keys(allKeys).filter((k) => {
    if (!k.startsWith("articles:")) return false;
    const date = k.replace("articles:", "");
    return new Date(date) < cutoff;
  });
  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }
}

function getNextMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  return midnight.getTime();
}

// Handle save-vocab message from injected popup
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "save-vocab") {
    const id = crypto.randomUUID();
    const today = getTodayKey();
    chrome.storage.local.get("vocab", (result) => {
      const vocab = (result.vocab ?? []) as Array<Record<string, unknown>>;
      vocab.unshift({
        id,
        word: msg.word,
        sentence: "",
        explanation: msg.explanation,
        articleId: "",
        addedDate: today,
        reviewCount: 0,
        lastReviewed: null,
        mastered: false,
      });
      chrome.storage.local.set({ vocab });
    });
  }
});

// Show floating popup on page via scripting API
function showFloatingPopup(tabId: number, word: string, content: string, isError = false) {
  chrome.scripting.executeScript({
    target: { tabId },
    args: [word, content, isError],
    func: (word: string, content: string, isError: boolean) => {
      document.querySelector("#elt-explain-popup")?.remove();

      if (!document.querySelector("#elt-styles")) {
        const s = document.createElement("style");
        s.id = "elt-styles";
        s.textContent = `
          #elt-explain-popup {
            position: fixed; z-index: 2147483647; max-width: 420px; min-width: 300px;
            background: #fff; border: 1px solid #e0e0e0; border-radius: 12px;
            box-shadow: 0 12px 32px rgba(0,0,0,0.18); padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 14px; line-height: 1.7; color: #1f2937; overflow-y: auto; max-height: 70vh;
          }
          #elt-explain-popup .elt-drag-handle {
            cursor: grab; user-select: none; padding-bottom: 8px; margin-bottom: 8px;
            border-bottom: 1px solid #f0f0f0; font-size: 11px; color: #b0b0b0; text-align: center;
          }
          #elt-explain-popup .elt-drag-handle:active { cursor: grabbing; }
          #elt-explain-popup .elt-word { font-weight: 700; font-size: 18px; color: #2563eb; margin-bottom: 12px; }
          #elt-explain-popup .elt-loading { color: #9ca3af; font-style: italic; }
          #elt-explain-popup .elt-error { color: #ef4444; }
          #elt-explain-popup .elt-content { white-space: pre-wrap; margin-bottom: 12px; }
          #elt-explain-popup .elt-close {
            position: absolute; top: 10px; right: 14px; background: none; border: none;
            font-size: 20px; color: #9ca3af; cursor: pointer; padding: 0; line-height: 1;
          }
          #elt-explain-popup .elt-close:hover { color: #374151; }
          #elt-explain-popup .elt-save-btn {
            display: inline-block; padding: 6px 16px; background: #2563eb; color: #fff;
            border: none; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 500;
          }
          #elt-explain-popup .elt-save-btn:hover { background: #1d4ed8; }
          #elt-explain-popup .elt-saved { color: #22c55e; font-size: 13px; font-weight: 500; }
        `;
        document.head.appendChild(s);
      }

      const popup = document.createElement("div");
      popup.id = "elt-explain-popup";

      const sel = window.getSelection();
      let top = 100, left = 100;
      if (sel && !sel.isCollapsed) {
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        top = rect.bottom + 10;
        left = rect.left;
        if (left + 420 > window.innerWidth) left = window.innerWidth - 440;
        if (top + 300 > window.innerHeight) top = rect.top - 310;
      }
      popup.style.top = Math.max(10, top) + "px";
      popup.style.left = Math.max(10, left) + "px";

      // Drag handle
      const dragHandle = document.createElement("div");
      dragHandle.className = "elt-drag-handle";
      dragHandle.textContent = "\u2261 drag to move";
      popup.appendChild(dragHandle);

      let isDragging = false, dragOffX = 0, dragOffY = 0;
      dragHandle.addEventListener("mousedown", (e: MouseEvent) => {
        isDragging = true;
        dragOffX = e.clientX - popup.getBoundingClientRect().left;
        dragOffY = e.clientY - popup.getBoundingClientRect().top;
        e.preventDefault();
      });
      document.addEventListener("mousemove", (e: MouseEvent) => {
        if (!isDragging) return;
        popup.style.left = (e.clientX - dragOffX) + "px";
        popup.style.top = (e.clientY - dragOffY) + "px";
      });
      document.addEventListener("mouseup", () => { isDragging = false; });

      const closeBtn = document.createElement("button");
      closeBtn.className = "elt-close";
      closeBtn.textContent = "\u00d7";
      closeBtn.onclick = () => popup.remove();
      popup.appendChild(closeBtn);

      const wordEl = document.createElement("div");
      wordEl.className = "elt-word";
      wordEl.textContent = word;
      popup.appendChild(wordEl);

      const contentEl = document.createElement("div");
      contentEl.className = isError ? "elt-error" : (content === "Explaining..." ? "elt-loading" : "elt-content");
      contentEl.textContent = content;
      popup.appendChild(contentEl);

      // Show "Add to Vocabulary" button when explanation is ready (not loading, not error)
      if (!isError && content !== "Explaining...") {
        const saveBtn = document.createElement("button");
        saveBtn.className = "elt-save-btn";
        saveBtn.textContent = "+ Add to Vocabulary";
        saveBtn.onclick = () => {
          chrome.runtime.sendMessage({
            type: "save-vocab",
            word,
            explanation: content,
          });
          saveBtn.remove();
          const saved = document.createElement("span");
          saved.className = "elt-saved";
          saved.textContent = "\u2713 Saved to vocabulary";
          popup.appendChild(saved);
        };
        popup.appendChild(saveBtn);
      }

      document.body.appendChild(popup);

      setTimeout(() => {
        document.addEventListener("click", function h(e: MouseEvent) {
          if (!popup.contains(e.target as Node)) {
            popup.remove();
            document.removeEventListener("click", h);
          }
        });
      }, 200);
    },
  }).catch((e) => console.error("[Explain] Cannot inject into this page:", e));
}

// Show a brief notification on page
function showNotification(tabId: number, message: string, isError = false) {
  chrome.scripting.executeScript({
    target: { tabId },
    args: [message, isError],
    func: (msg: string, isErr: boolean) => {
      document.querySelector("#elt-notify")?.remove();
      const el = document.createElement("div");
      el.id = "elt-notify";
      el.textContent = msg;
      Object.assign(el.style, {
        position: "fixed", top: "20px", right: "20px", zIndex: "2147483647",
        padding: "12px 20px", borderRadius: "8px", fontSize: "14px", fontWeight: "500",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        color: "#fff", background: isErr ? "#ef4444" : "#22c55e",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      });
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 2500);
    },
  }).catch(() => {});
}

// Context menu handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  const tabId = tab.id;
  const selectedText = info.selectionText?.trim();
  if (!selectedText) return;

  if (info.menuItemId !== "explain-word") return;

  // Show loading floating popup
  showFloatingPopup(tabId, selectedText, "Explaining...");

  // Get API key
  const settingsResult = await chrome.storage.local.get("settings");
  const settings = settingsResult.settings as Settings | undefined;
  const aiConfig = settings?.aiProvider ?? (settings?.claudeApiKey
    ? { provider: "kimi" as AIProvider, apiKey: settings.claudeApiKey, model: "moonshot-v1-8k" }
    : null);

  if (!aiConfig?.apiKey) {
    showFloatingPopup(tabId, selectedText, "Please set your AI API key in Settings.", true);
    return;
  }

  const systemPrompt = `You are an English tutor helping a Chinese-speaking learner.
When explaining a word or phrase, include:
1. Chinese translation (中文翻译)
2. English definition
3. Meaning in context
4. 2 example sentences
Keep it concise — under 200 words.`;
  const userMessage = `Explain this word/phrase: "${selectedText}"\n\nContext from page: "${info.selectionText}"`;

  try {
    let explanation: string;

    if (aiConfig.provider === "claude") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": aiConfig.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: aiConfig.model,
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`API error: ${res.status} - ${err}`);
      }
      const data = await res.json();
      explanation = data.content?.[0]?.text ?? "No explanation available.";
    } else {
      const endpoints: Record<string, string> = {
        kimi: "https://api.moonshot.ai/v1/chat/completions",
        openai: "https://api.openai.com/v1/chat/completions",
        deepseek: "https://api.deepseek.com/chat/completions",
        gemini: "https://generativelanguage.googleapis.com/v1beta/chat/completions",
      };
      const endpoint = endpoints[aiConfig.provider] ?? endpoints.kimi;

      const url = aiConfig.provider === "gemini"
        ? `${endpoint}?key=${aiConfig.apiKey}`
        : endpoint;

      const headers: Record<string, string> = { "content-type": "application/json" };
      if (aiConfig.provider !== "gemini") {
        headers["Authorization"] = `Bearer ${aiConfig.apiKey}`;
      }

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: aiConfig.model,
          max_tokens: 1024,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`API error: ${res.status} - ${err}`);
      }
      const data = await res.json();
      explanation = data.choices?.[0]?.message?.content ?? "No explanation available.";
    }

    showFloatingPopup(tabId, selectedText, explanation);
  } catch (e) {
    showFloatingPopup(tabId, selectedText, e instanceof Error ? e.message : "Failed to get explanation", true);
  }
});
