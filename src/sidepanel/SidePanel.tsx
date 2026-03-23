import { useState, useEffect } from "react";
import type { DailyRecord, VocabularyEntry } from "@/shared/types";
import {
  getOrCreateTodayRecord,
  saveDailyRecord,
  getVocabulary,
  getStreak,
  saveStreak,
} from "@/shared/storage";
import { updateStreak } from "@/shared/utils/scoring";

interface PendingExplain {
  word: string;
  status: "loading" | "done" | "error";
  explanation: string | null;
  error: string | null;
}

export function SidePanel() {
  const [record, setRecord] = useState<DailyRecord | null>(null);
  const [recentWords, setRecentWords] = useState<VocabularyEntry[]>([]);
  const [streakCount, setStreakCount] = useState(0);
  const [explain, setExplain] = useState<PendingExplain | null>(null);

  useEffect(() => {
    loadData();

    // Load pending explanation
    chrome.storage.local.get("pendingExplain", (r) => {
      if (r.pendingExplain) setExplain(r.pendingExplain as PendingExplain);
    });

    // Listen for explanation updates
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.pendingExplain) {
        setExplain((changes.pendingExplain.newValue as PendingExplain) ?? null);
      }
    };
    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }, []);

  async function loadData() {
    const r = await getOrCreateTodayRecord();
    setRecord(r);
    const vocab = await getVocabulary();
    setRecentWords(vocab.slice(0, 5));
    const streak = await getStreak();
    setStreakCount(streak.current);
  }

  async function checkIn(task: "vocabulary" | "speaking") {
    if (!record) return;
    const updated = {
      ...record,
      [task]: { completed: true, checkedInAt: new Date().toISOString() },
    };
    setRecord(updated);
    await saveDailyRecord(updated);

    const streak = await getStreak();
    const newStreak = updateStreak(streak, updated);
    if (newStreak !== streak) {
      await saveStreak(newStreak);
      setStreakCount(newStreak.current);
    }
  }

  function clearExplain() {
    setExplain(null);
    chrome.storage.local.remove("pendingExplain");
  }

  if (!record) {
    return <div className="p-4 text-gray-500">Loading...</div>;
  }

  const tasks = [
    { key: "reading" as const, label: "Reading", done: record.reading.completed },
    { key: "writing" as const, label: "Writing", done: record.writing.completed },
    { key: "vocabulary" as const, label: "Vocabulary", done: record.vocabulary.completed },
    { key: "speaking" as const, label: "Speaking", done: record.speaking.completed },
  ];

  return (
    <div className="p-4 min-h-screen bg-gray-50">
      {/* Explanation section */}
      {explain && (
        <div className="bg-white rounded-lg border border-blue-200 p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-blue-600">{explain.word}</h2>
            <button
              onClick={clearExplain}
              className="text-gray-400 hover:text-gray-600 text-lg"
            >
              ×
            </button>
          </div>
          {explain.status === "loading" && (
            <p className="text-gray-400 italic">Explaining...</p>
          )}
          {explain.status === "error" && (
            <p className="text-red-500">{explain.error}</p>
          )}
          {explain.status === "done" && explain.explanation && (
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {explain.explanation}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h1 className="font-bold text-gray-900">English Tracker</h1>
        <span className="text-sm text-blue-600 font-medium">
          {streakCount} day streak
        </span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase mb-2">
          Today
        </h2>
        {tasks.map((t) => (
          <div
            key={t.key}
            className="flex items-center justify-between py-1.5"
          >
            <span
              className={`text-sm ${t.done ? "text-green-700" : "text-gray-700"}`}
            >
              {t.done ? "✓" : "○"} {t.label}
            </span>
            {!t.done && (t.key === "vocabulary" || t.key === "speaking") && (
              <button
                onClick={() => checkIn(t.key)}
                className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Check In
              </button>
            )}
          </div>
        ))}
      </div>

      {recentWords.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase mb-2">
            Recent Words
          </h2>
          {recentWords.map((w) => (
            <div key={w.id} className="py-1.5 border-b border-gray-100 last:border-0">
              <span className="text-sm font-medium text-gray-900">
                {w.word}
              </span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() =>
          chrome.tabs.create({
            url: chrome.runtime.getURL("src/newtab/index.html"),
          })
        }
        className="w-full mt-4 py-2 text-sm text-blue-600 hover:text-blue-800 text-center"
      >
        Open Full Dashboard →
      </button>
    </div>
  );
}
