import { useState, useEffect } from "react";
import type { Settings as SettingsType, AIProvider, TTSVoice } from "@/shared/types";
import { getSettings, saveSettings } from "@/shared/storage";
import { getTodayKey } from "@/shared/utils/date";
import { AI_PROVIDERS } from "@/shared/api/claude";

const PROVIDER_KEYS = Object.keys(AI_PROVIDERS) as AIProvider[];

export function Settings() {
  const [nytApiKey, setNytApiKey] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [provider, setProvider] = useState<AIProvider>("kimi");
  const [model, setModel] = useState("");
  const [articleCount, setArticleCount] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [listeningCount, setListeningCount] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [ttsApiKey, setTtsApiKey] = useState("");
  const [ttsVoice, setTtsVoice] = useState<TTSVoice>("nova");
  const [saved, setSaved] = useState(false);
  const [showNytKey, setShowNytKey] = useState(false);
  const [showAiKey, setShowAiKey] = useState(false);
  const [showTtsKey, setShowTtsKey] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      if (s) {
        setNytApiKey(s.nytApiKey);
        setArticleCount(s.dailyArticleCount);
        setListeningCount(s.dailyListeningCount ?? 2);
        setTtsApiKey(s.ttsApiKey ?? "");
        setTtsVoice(s.ttsVoice ?? "nova");
        if (s.aiProvider) {
          setProvider(s.aiProvider.provider);
          setAiApiKey(s.aiProvider.apiKey);
          setModel(s.aiProvider.model);
        } else {
          // migrate from old settings
          setAiApiKey(s.claudeApiKey);
          setProvider("kimi");
          setModel(AI_PROVIDERS.kimi.defaultModel);
        }
      }
    });
  }, []);

  function handleProviderChange(newProvider: AIProvider) {
    setProvider(newProvider);
    setModel(AI_PROVIDERS[newProvider].defaultModel);
  }

  async function handleSave() {
    const existing = await getSettings();
    await saveSettings({
      nytApiKey,
      claudeApiKey: aiApiKey, // backward compat
      aiProvider: {
        provider,
        apiKey: aiApiKey,
        model,
      },
      ttsApiKey,
      ttsVoice,
      dailyArticleCount: articleCount,
      dailyListeningCount: listeningCount,
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

  const currentProvider = AI_PROVIDERS[provider];

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="space-y-6">
        {/* NYT API Key */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            NYT API Key
          </label>
          <div className="relative">
            <input
              type={showNytKey ? "text" : "password"}
              value={nytApiKey}
              onChange={(e) => setNytApiKey(e.target.value)}
              placeholder="Enter your NYT API key"
              className="w-full px-4 py-2 pr-16 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowNytKey(!showNytKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
            >
              {showNytKey ? "Hide" : "Show"}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Get one at developer.nytimes.com
          </p>
        </div>

        {/* AI Provider Section */}
        <div className="bg-gray-50 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">AI Model</h2>

          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Provider
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PROVIDER_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => handleProviderChange(key)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                    provider === key
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-200 text-gray-700 hover:border-blue-300"
                  }`}
                >
                  {AI_PROVIDERS[key].label}
                </button>
              ))}
            </div>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {currentProvider.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key
            </label>
            <div className="relative">
              <input
                type={showAiKey ? "text" : "password"}
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder={`Enter your ${currentProvider.label} API key`}
                className="w-full px-4 py-2 pr-16 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <button
                type="button"
                onClick={() => setShowAiKey(!showAiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
              >
                {showAiKey ? "Hide" : "Show"}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Get one at {currentProvider.helpUrl}
            </p>
          </div>
        </div>

        {/* TTS Settings */}
        <div className="bg-gray-50 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">
            Listening Audio (Text-to-Speech)
          </h2>
          <p className="text-sm text-gray-500 -mt-2">
            Uses OpenAI TTS API for high-quality audio in listening practices.
            Falls back to browser speech if not configured.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              OpenAI TTS API Key
            </label>
            <div className="relative">
              <input
                type={showTtsKey ? "text" : "password"}
                value={ttsApiKey}
                onChange={(e) => setTtsApiKey(e.target.value)}
                placeholder="Enter your OpenAI API key for TTS"
                className="w-full px-4 py-2 pr-16 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <button
                type="button"
                onClick={() => setShowTtsKey(!showTtsKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
              >
                {showTtsKey ? "Hide" : "Show"}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Get one at platform.openai.com — uses the same OpenAI key if you
              already have one
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Voice
            </label>
            <select
              value={ttsVoice}
              onChange={(e) => setTtsVoice(e.target.value as TTSVoice)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {(
                ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const
              ).map((v) => (
                <option key={v} value={v}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Daily Articles */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Daily Articles
          </label>
          <select
            value={articleCount}
            onChange={(e) =>
              setArticleCount(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)
            }
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "article" : "articles"} per day
              </option>
            ))}
          </select>
        </div>

        {/* Daily Listening Practices */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Daily Listening Practices
          </label>
          <select
            value={listeningCount}
            onChange={(e) =>
              setListeningCount(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)
            }
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "practice" : "practices"} per day
              </option>
            ))}
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
