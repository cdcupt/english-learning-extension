import { useState, useEffect, useRef } from "react";
import type { Settings as SettingsType, AIProvider, TTSVoice, TTSProvider, BytedanceVoice, ReadingSource } from "@/shared/types";
import { getSettings, saveSettings } from "@/shared/storage";
import { getTodayKey } from "@/shared/utils/date";
import { AI_PROVIDERS } from "@/shared/api/claude";
import { exportConfig, importConfig, mergeSettings, type ConfigMode } from "@/shared/configExport";

const PROVIDER_KEYS = Object.keys(AI_PROVIDERS) as AIProvider[];

export function Settings() {
  const [nytApiKey, setNytApiKey] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [provider, setProvider] = useState<AIProvider>("kimi");
  const [model, setModel] = useState("");
  const [articleCount, setArticleCount] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [listeningCount, setListeningCount] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [ttsProvider, setTtsProvider] = useState<TTSProvider>("openai");
  const [ttsApiKey, setTtsApiKey] = useState("");
  const [ttsVoice, setTtsVoice] = useState<TTSVoice>("nova");
  const [bytedanceAppId, setBytedanceAppId] = useState("");
  const [bytedanceToken, setBytedanceToken] = useState("");
  const [bytedanceCluster, setBytedanceCluster] = useState("volcano_tts");
  const [bytedanceVoice, setBytedanceVoice] = useState<BytedanceVoice>("en_female_dacey_uranus_bigtts");
  const [bytedanceAsrCluster, setBytedanceAsrCluster] = useState("volc.seedasr.sauc.duration");
  const [speakingCount, setSpeakingCount] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [readingSource, setReadingSource] = useState<ReadingSource>("nyt_mixed");
  const [paused, setPaused] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showNytKey, setShowNytKey] = useState(false);
  const [showAiKey, setShowAiKey] = useState(false);
  const [showTtsKey, setShowTtsKey] = useState(false);
  const [showBytedanceToken, setShowBytedanceToken] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      if (s) {
        setNytApiKey(s.nytApiKey);
        setArticleCount(s.dailyArticleCount);
        setListeningCount(s.dailyListeningCount ?? 2);
        setTtsProvider(s.ttsProvider ?? "openai");
        setTtsApiKey(s.ttsApiKey ?? "");
        setTtsVoice(s.ttsVoice ?? "nova");
        setBytedanceAppId(s.bytedanceAppId ?? "");
        setBytedanceToken(s.bytedanceToken ?? "");
        setBytedanceCluster(s.bytedanceCluster ?? "volcano_tts");
        const validVoices = ["en_female_dacey_uranus_bigtts", "BV001_streaming", "BV002_streaming", "BV503_streaming", "BV504_streaming"];
        const savedVoice = s.bytedanceVoice ?? "";
        setBytedanceVoice(validVoices.includes(savedVoice) ? savedVoice as BytedanceVoice : "en_female_dacey_uranus_bigtts");
        setBytedanceAsrCluster(s.bytedanceAsrCluster ?? "volc.seedasr.sauc.duration");
        setSpeakingCount(s.dailySpeakingCount ?? 2);
        setReadingSource(s.readingSource ?? "nyt_mixed");
        setPaused(s.paused ?? false);
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
      ttsProvider,
      ttsApiKey,
      ttsVoice,
      bytedanceAppId,
      bytedanceToken,
      bytedanceCluster,
      bytedanceVoice,
      bytedanceAsrCluster,
      dailyArticleCount: articleCount,
      dailyListeningCount: listeningCount,
      dailySpeakingCount: speakingCount,
      readingSource,
      installedDate: existing?.installedDate ?? getTodayKey(),
      paused,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // --- Config sharing state ---
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<"export-share" | "export-backup" | "import">("export-share");
  const [modalPassword, setModalPassword] = useState("");
  const [modalConfirmPassword, setModalConfirmPassword] = useState("");
  const [modalError, setModalError] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [configMessage, setConfigMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const pendingFileRef = useRef<File | null>(null);

  function openModal(action: "export-share" | "export-backup" | "import") {
    setModalAction(action);
    setModalPassword("");
    setModalConfirmPassword("");
    setModalError("");
    setModalLoading(false);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setModalPassword("");
    setModalConfirmPassword("");
    setModalError("");
  }

  function showConfigMessage(type: "success" | "error", text: string) {
    setConfigMessage({ type, text });
    setTimeout(() => setConfigMessage(null), 3000);
  }

  function handleImportFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    pendingFileRef.current = file;
    e.target.value = "";
    openModal("import");
  }

  async function handleModalConfirm() {
    if (modalPassword.length < 4) {
      setModalError("Password must be at least 4 characters");
      return;
    }
    if (modalAction !== "import" && modalPassword !== modalConfirmPassword) {
      setModalError("Passwords do not match");
      return;
    }

    setModalLoading(true);
    setModalError("");

    try {
      if (modalAction === "export-share" || modalAction === "export-backup") {
        const mode: ConfigMode = modalAction === "export-share" ? "share" : "backup";
        const blob = await exportConfig(mode, modalPassword);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `english-tracker-${mode}-${getTodayKey()}.elc`;
        a.click();
        URL.revokeObjectURL(url);
        closeModal();
        showConfigMessage("success", `Config exported for ${mode}`);
      } else {
        const file = pendingFileRef.current;
        if (!file) {
          setModalError("No file selected");
          setModalLoading(false);
          return;
        }
        const { settings: imported, mode } = await importConfig(file, modalPassword);
        const existing = await getSettings();
        if (!existing) {
          setModalError("No existing settings found — save settings first");
          setModalLoading(false);
          return;
        }
        const merged = mergeSettings(existing, imported, mode);
        await saveSettings(merged);
        pendingFileRef.current = null;
        closeModal();
        showConfigMessage("success", `Config imported (${mode} mode) — reload to see changes`);
        // Reload form state
        window.location.reload();
      }
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Operation failed");
      setModalLoading(false);
    }
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
            High-quality audio for listening practices. Falls back to browser
            speech if not configured.
          </p>

          {/* TTS Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              TTS Provider
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { key: "openai" as TTSProvider, label: "OpenAI TTS" },
                  { key: "bytedance" as TTSProvider, label: "ByteDance OpenSpeech" },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTtsProvider(key)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                    ttsProvider === key
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-200 text-gray-700 hover:border-blue-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* OpenAI TTS Config */}
          {ttsProvider === "openai" && (
            <>
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
                  Get one at platform.openai.com — uses the same OpenAI key if
                  you already have one
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
            </>
          )}

          {/* ByteDance OpenSpeech Config */}
          {ttsProvider === "bytedance" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  App ID
                </label>
                <input
                  type="text"
                  value={bytedanceAppId}
                  onChange={(e) => setBytedanceAppId(e.target.value)}
                  placeholder="Enter your Volcengine App ID"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Access Token
                </label>
                <div className="relative">
                  <input
                    type={showBytedanceToken ? "text" : "password"}
                    value={bytedanceToken}
                    onChange={(e) => setBytedanceToken(e.target.value)}
                    placeholder="Enter your Volcengine access token"
                    className="w-full px-4 py-2 pr-16 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowBytedanceToken(!showBytedanceToken)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    {showBytedanceToken ? "Hide" : "Show"}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Get credentials at console.volcengine.com/speech/app
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cluster
                </label>
                <input
                  type="text"
                  value={bytedanceCluster}
                  onChange={(e) => setBytedanceCluster(e.target.value)}
                  placeholder="volcano_tts"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Found in your Volcengine console, e.g. volcano_tts,
                  volcano_mega_tts, volcano_icl
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Voice
                </label>
                <select
                  value={bytedanceVoice}
                  onChange={(e) => setBytedanceVoice(e.target.value as BytedanceVoice)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {(
                    [
                      { value: "en_female_dacey_uranus_bigtts", label: "Dacey (English Female - TTS 2.0)" },
                      { value: "BV504_streaming", label: "Jackson (English Male - V1)" },
                      { value: "BV503_streaming", label: "Ariana (English Female - V1)" },
                      { value: "BV001_streaming", label: "General Female (Chinese - V1)" },
                      { value: "BV002_streaming", label: "General Male (Chinese - V1)" },
                    ] as const
                  ).map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ASR Resource ID (Speech Recognition)
                </label>
                <input
                  type="text"
                  value={bytedanceAsrCluster}
                  onChange={(e) => setBytedanceAsrCluster(e.target.value)}
                  placeholder="volc.seedasr.sauc.duration"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <p className="text-xs text-gray-400 mt-1">
                  V3 bigmodel resource ID for speaking practice (e.g. volc.bigasr.auc)
                </p>
              </div>
            </>
          )}
        </div>

        {/* Reading Source */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reading Source
          </label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: "nyt_mixed" as ReadingSource, label: "NYT + AI" },
              { key: "ai_only" as ReadingSource, label: "AI Only" },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setReadingSource(key)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                  readingSource === key
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-gray-200 text-gray-700 hover:border-blue-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {readingSource === "nyt_mixed"
              ? "Real NYT articles with optional AI-generated extras"
              : "All articles are AI-generated (no NYT API key needed)"}
          </p>
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

        {/* Daily Speaking Practices */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Daily Speaking Practices
          </label>
          <select
            value={speakingCount}
            onChange={(e) =>
              setSpeakingCount(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)
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

        {/* Data & Sharing */}
        <div className="bg-gray-50 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Data & Sharing</h2>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => openModal("export-share")}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              Share Config
            </button>
            <button
              onClick={() => openModal("export-backup")}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-800 transition-colors"
            >
              Full Backup
            </button>
            <label className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors cursor-pointer">
              Import
              <input
                ref={importFileRef}
                type="file"
                accept=".elc"
                className="hidden"
                onChange={handleImportFileSelect}
              />
            </label>
          </div>

          <p className="text-xs text-gray-400">
            Share strips API keys for safe distribution. Full Backup includes everything. Both are encrypted.
          </p>

          {configMessage && (
            <p className={`text-sm ${configMessage.type === "error" ? "text-red-600" : "text-green-600"}`}>
              {configMessage.text}
            </p>
          )}
        </div>
      </div>

      {/* Password Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4 space-y-4">
            <h3 className="font-semibold text-gray-900">
              {modalAction === "import" ? "Enter password to decrypt" : "Set a password to encrypt"}
            </h3>
            <p className="text-sm text-gray-500">
              {modalAction === "import"
                ? "Enter the password that was used when this config was exported."
                : "You'll need this password to import the config later."}
            </p>

            <div>
              <input
                type="password"
                value={modalPassword}
                onChange={(e) => setModalPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleModalConfirm()}
              />
            </div>

            {modalAction !== "import" && (
              <div>
                <input
                  type="password"
                  value={modalConfirmPassword}
                  onChange={(e) => setModalConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => e.key === "Enter" && handleModalConfirm()}
                />
              </div>
            )}

            {modalError && (
              <p className="text-sm text-red-600">{modalError}</p>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={closeModal}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleModalConfirm}
                disabled={modalLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {modalLoading ? "Processing..." : modalAction === "import" ? "Import" : "Export"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
