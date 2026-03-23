// Inject styles
const style = document.createElement("style");
style.textContent = `
.elt-explain-popup {
  position: fixed;
  z-index: 2147483647;
  max-width: 400px;
  min-width: 280px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  padding: 16px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  color: #1f2937;
}
.elt-explain-popup .elt-word {
  font-weight: 700;
  font-size: 16px;
  color: #2563eb;
  margin-bottom: 8px;
}
.elt-explain-popup .elt-loading {
  color: #9ca3af;
  font-style: italic;
}
.elt-explain-popup .elt-error {
  color: #ef4444;
}
.elt-explain-popup .elt-content {
  white-space: pre-wrap;
}
.elt-explain-popup .elt-close {
  position: absolute;
  top: 8px;
  right: 12px;
  background: none;
  border: none;
  font-size: 18px;
  color: #9ca3af;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}
.elt-explain-popup .elt-close:hover {
  color: #374151;
}
`;
document.head.appendChild(style);

// Listen for messages from background service worker
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "explain-selection") {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!text) {
      sendResponse({ text: null });
      return;
    }

    // Get surrounding context
    const anchor = selection!.anchorNode;
    const context =
      anchor?.parentElement?.textContent?.slice(0, 500) ?? text;

    sendResponse({ text, context });
  }

  if (msg.type === "show-explanation") {
    showPopup(msg.word, msg.explanation, msg.error);
  }
});

function showPopup(word: string, explanation?: string, error?: string) {
  // Remove existing popup
  document.querySelector(".elt-explain-popup")?.remove();

  const popup = document.createElement("div");
  popup.className = "elt-explain-popup";

  // Position near the selection
  const selection = window.getSelection();
  let top = 100;
  let left = 100;
  if (selection && !selection.isCollapsed) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    top = rect.bottom + window.scrollY + 8;
    left = rect.left + window.scrollX;
    // Keep popup within viewport
    if (left + 400 > window.innerWidth) {
      left = window.innerWidth - 420;
    }
    // Convert to fixed positioning
    top = rect.bottom + 8;
  }

  popup.style.top = `${Math.min(top, window.innerHeight - 300)}px`;
  popup.style.left = `${Math.max(10, left)}px`;

  const closeBtn = document.createElement("button");
  closeBtn.className = "elt-close";
  closeBtn.textContent = "\u00d7";
  closeBtn.onclick = () => popup.remove();
  popup.appendChild(closeBtn);

  const wordEl = document.createElement("div");
  wordEl.className = "elt-word";
  wordEl.textContent = word;
  popup.appendChild(wordEl);

  if (error) {
    const errorEl = document.createElement("div");
    errorEl.className = "elt-error";
    errorEl.textContent = error;
    popup.appendChild(errorEl);
  } else if (explanation) {
    const contentEl = document.createElement("div");
    contentEl.className = "elt-content";
    contentEl.textContent = explanation;
    popup.appendChild(contentEl);
  } else {
    const loadingEl = document.createElement("div");
    loadingEl.className = "elt-loading";
    loadingEl.textContent = "Explaining...";
    popup.appendChild(loadingEl);
  }

  document.body.appendChild(popup);

  // Close on click outside
  function handleClickOutside(e: MouseEvent) {
    if (!popup.contains(e.target as Node)) {
      popup.remove();
      document.removeEventListener("click", handleClickOutside);
    }
  }
  setTimeout(() => document.addEventListener("click", handleClickOutside), 100);
}
