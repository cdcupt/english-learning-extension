import { useState, useEffect } from "react";
import type { Settings as SettingsType } from "@/shared/types";
import { getSettings, saveSettings } from "@/shared/storage";
import { getTodayKey } from "@/shared/utils/date";

export function Settings() {
  const [nytApiKey, setNytApiKey] = useState("");
  const [claudeApiKey, setClaudeApiKey] = useState("");
  const [articleCount, setArticleCount] = useState<1 | 2>(2);
  const [paused, setPaused] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      if (s) {
        setNytApiKey(s.nytApiKey);
        setClaudeApiKey(s.claudeApiKey);
        setArticleCount(s.dailyArticleCount);
        setPaused(s.paused ?? false);
      }
    });
  }, []);

  async function handleSave() {
    const existing = await getSettings();
    await saveSettings({
      nytApiKey,
      claudeApiKey,
      dailyArticleCount: articleCount,
      installedDate: existing?.installedDate ?? getTodayKey(),
      paused,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleExport() {
    const data = await chrome.storage.local.get(null);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `english-tracker-export-${getTodayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="space-y-6">
        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4">
          <div>
            <h2 className="font-semibold text-gray-900">Extension Active</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {paused
                ? "Paused — no API calls or reminders"
                : "Running — tracking your daily tasks"}
            </p>
          </div>
          <button
            onClick={() => setPaused(!paused)}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              paused ? "bg-gray-300" : "bg-green-500"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                paused ? "translate-x-0" : "translate-x-5"
              }`}
            />
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            NYT API Key
          </label>
          <input
            type="password"
            value={nytApiKey}
            onChange={(e) => setNytApiKey(e.target.value)}
            placeholder="Enter your NYT API key"
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Get one at developer.nytimes.com
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Claude API Key
          </label>
          <input
            type="password"
            value={claudeApiKey}
            onChange={(e) => setClaudeApiKey(e.target.value)}
            placeholder="Enter your Anthropic API key"
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Get one at console.anthropic.com
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Daily Articles
          </label>
          <select
            value={articleCount}
            onChange={(e) =>
              setArticleCount(Number(e.target.value) as 1 | 2)
            }
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={1}>1 article per day</option>
            <option value={2}>2 articles per day</option>
          </select>
        </div>

        <button
          onClick={handleSave}
          className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {saved ? "✓ Saved" : "Save Settings"}
        </button>

        <hr className="border-gray-200" />

        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Data</h2>
          <button
            onClick={handleExport}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            Export All Data (JSON)
          </button>
        </div>
      </div>
    </div>
  );
}
