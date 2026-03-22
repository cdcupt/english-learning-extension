import { useState, useEffect } from "react";
import type { DailyRecord, Settings } from "@/shared/types";
import { getSettings, saveSettings, getOrCreateTodayRecord } from "@/shared/storage";
import { completedTaskCount } from "@/shared/utils/scoring";

export function Popup() {
  const [paused, setPaused] = useState(false);
  const [record, setRecord] = useState<DailyRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadState();
  }, []);

  async function loadState() {
    const settings = await getSettings();
    setPaused(settings?.paused ?? false);
    const r = await getOrCreateTodayRecord();
    setRecord(r);
    setLoading(false);
  }

  async function togglePause() {
    const settings = await getSettings();
    const newPaused = !paused;
    setPaused(newPaused);
    await saveSettings({
      nytApiKey: settings?.nytApiKey ?? "",
      claudeApiKey: settings?.claudeApiKey ?? "",
      dailyArticleCount: settings?.dailyArticleCount ?? 2,
      installedDate: settings?.installedDate ?? new Date().toISOString().slice(0, 10),
      paused: newPaused,
    });
  }

  function openDashboard() {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/newtab/index.html") });
  }

  if (loading) {
    return (
      <div className="w-72 p-4 text-center text-gray-500 text-sm">
        Loading...
      </div>
    );
  }

  const completed = record ? completedTaskCount(record) : 0;

  return (
    <div className="w-72 p-4 bg-white">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-bold text-gray-900 text-base">English Tracker</h1>
        <button
          onClick={togglePause}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            paused ? "bg-gray-300" : "bg-green-500"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              paused ? "translate-x-0" : "translate-x-5"
            }`}
          />
        </button>
      </div>

      {paused ? (
        <div className="text-center py-4">
          <p className="text-gray-500 text-sm">Extension is paused</p>
          <p className="text-gray-400 text-xs mt-1">
            No API calls or reminders while paused
          </p>
        </div>
      ) : (
        <>
          <div className="text-center mb-4">
            <span className="text-2xl font-bold text-blue-600">
              {completed}/4
            </span>
            <p className="text-gray-500 text-xs mt-1">tasks completed today</p>
          </div>

          {record && (
            <div className="space-y-1.5 mb-4">
              {(
                [
                  { label: "Reading", done: record.reading.completed },
                  { label: "Writing", done: record.writing.completed },
                  { label: "Vocabulary", done: record.vocabulary.completed },
                  { label: "Speaking", done: record.speaking.completed },
                ] as const
              ).map(({ label, done }) => (
                <div
                  key={label}
                  className="flex items-center justify-between text-sm"
                >
                  <span className={done ? "text-green-700" : "text-gray-700"}>
                    {done ? "✓" : "○"} {label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <button
        onClick={openDashboard}
        className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
      >
        Open Dashboard
      </button>
    </div>
  );
}
