import type { DailyRecord, Settings, StreakData } from "@/shared/types";
import { getTodayKey, getYesterday } from "@/shared/utils/date";

// Set up daily reset alarm
chrome.runtime.onInstalled.addListener(() => {
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
    chrome.action.setBadgeText({ text: "4" });
    chrome.action.setBadgeBackgroundColor({ color: "#EF4444" });
    return;
  }

  let remaining = 0;
  if (!record.reading.completed) remaining++;
  if (!record.writing.completed) remaining++;
  if (!record.vocabulary.completed) remaining++;
  if (!record.speaking.completed) remaining++;

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
