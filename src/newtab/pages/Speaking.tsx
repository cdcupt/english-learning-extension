import { useState, useEffect, useRef } from "react";
import type {
  DailyRecord,
  SpeakingPrompt,
  SpeakingPracticeResult,
  SpeakingDayData,
  ConnectedSpeechAnnotation,
  ConnectedSpeechType,
} from "@/shared/types";
import {
  generateSpeakingPrompt,
  evaluatePronunciation,
  recognizeSpeechBytedance,
  generateSpeechAudio,
  generateBytedanceSpeechAudio,
} from "@/shared/api/claude";
import {
  getSettings,
  getSpeakingDayData,
  saveSpeakingDayData,
} from "@/shared/storage";
import { getTodayKey } from "@/shared/utils/date";

interface Props {
  record: DailyRecord;
  onUpdate: (updater: (r: DailyRecord) => DailyRecord) => Promise<void>;
  visible?: boolean;
  externalPrompt?: { text: string; topic: string } | null;
  onExternalPromptConsumed?: () => void;
}

type SpeakingState =
  | "idle"
  | "generating"
  | "practice"
  | "recording"
  | "evaluating"
  | "result";

const ANNOTATION_COLORS: Record<ConnectedSpeechType, { bg: string; text: string; label: string }> = {
  linking: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", label: "Linking" },
  elision: { bg: "bg-red-50 border-red-200", text: "text-red-700", label: "Elision" },
  assimilation: { bg: "bg-purple-50 border-purple-200", text: "text-purple-700", label: "Assimilation" },
  reduction: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", label: "Reduction" },
  contraction: { bg: "bg-green-50 border-green-200", text: "text-green-700", label: "Contraction" },
  intrusion: { bg: "bg-teal-50 border-teal-200", text: "text-teal-700", label: "Intrusion" },
};

export function Speaking({ record, onUpdate, visible, externalPrompt, onExternalPromptConsumed }: Props) {
  const [state, setState] = useState<SpeakingState>("idle");
  const [targetCount, setTargetCount] = useState(2);
  const [currentPrompt, setCurrentPrompt] = useState<SpeakingPrompt | null>(null);
  const [referenceAudioUrl, setReferenceAudioUrl] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<SpeakingPracticeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [hoveredAnnotation, setHoveredAnnotation] = useState<number | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [dayData, setDayData] = useState<SpeakingDayData | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStoppedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webSpeechRef = useRef<any>(null);
  const webSpeechTranscriptRef = useRef("");
  const recordingModeRef = useRef<"bytedance" | "webspeech">("bytedance");

  const completedCount = record.speaking?.practicesCompleted ?? 0;
  const isTaskDone = record.speaking?.completed ?? false;

  useEffect(() => {
    getSettings().then((s) => {
      if (s?.dailySpeakingCount) setTargetCount(s.dailySpeakingCount);
    });
    getSpeakingDayData(getTodayKey()).then((d) => setDayData(d ?? null));
  }, [visible]);

  // Handle external prompt from Writing (corrected article speaking practice)
  useEffect(() => {
    if (!externalPrompt || !visible) return;

    async function loadExternalPrompt() {
      const prompt: SpeakingPrompt = {
        id: crypto.randomUUID(),
        topic: externalPrompt!.topic,
        scenario: "Read your corrected article aloud to practice pronunciation and fluency.",
        text: externalPrompt!.text,
        annotations: [],
        difficulty: "intermediate",
      };
      setCurrentPrompt(prompt);
      setCurrentResult(null);
      setError(null);

      // Save prompt to day data
      const today = getTodayKey();
      const data = (await getSpeakingDayData(today)) ?? { date: today, prompts: [], results: [] };
      data.prompts.push(prompt);
      await saveSpeakingDayData(data);
      setDayData({ ...data });

      await generateReferenceAudio(prompt.text);
      setState("practice");
      onExternalPromptConsumed?.();
    }

    loadExternalPrompt();
  }, [externalPrompt, visible]);

  // Cleanup audio URLs on unmount
  useEffect(() => {
    return () => {
      if (referenceAudioUrl) URL.revokeObjectURL(referenceAudioUrl);
    };
  }, [referenceAudioUrl]);

  // Cleanup recording timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function generateReferenceAudio(text: string) {
    const ttsSettings = await getSettings();
    const ttsProvider = ttsSettings?.ttsProvider ?? "openai";
    let audioUrl: string | null = null;

    if (ttsProvider === "bytedance") {
      const appId = ttsSettings?.bytedanceAppId?.trim();
      const token = ttsSettings?.bytedanceToken?.trim();
      if (appId && token) {
        setGeneratingAudio(true);
        try {
          audioUrl = await generateBytedanceSpeechAudio(
            text, appId, token,
            ttsSettings?.bytedanceVoice || "en_female_dacey_uranus_bigtts", 1
          );
        } catch (e) {
          console.warn("ByteDance TTS failed:", e);
        }
        setGeneratingAudio(false);
      }
    } else {
      const ttsKey =
        ttsSettings?.ttsApiKey ||
        (ttsSettings?.aiProvider?.provider === "openai" ? ttsSettings.aiProvider.apiKey : null);
      if (ttsKey) {
        setGeneratingAudio(true);
        try {
          audioUrl = await generateSpeechAudio(text, ttsKey, ttsSettings?.ttsVoice || "nova");
        } catch (e) {
          console.warn("OpenAI TTS failed:", e);
        }
        setGeneratingAudio(false);
      }
    }

    setReferenceAudioUrl(audioUrl);
  }

  async function handleGenerate() {
    setState("generating");
    setError(null);
    setCurrentResult(null);
    try {
      const settings = await getSettings();
      const aiKey = settings?.aiProvider?.apiKey || settings?.claudeApiKey;
      if (!aiKey) {
        setError("Please set your AI API key in Settings first.");
        setState("idle");
        return;
      }

      const promptResult = await generateSpeakingPrompt();
      const prompt: SpeakingPrompt = {
        id: crypto.randomUUID(),
        ...promptResult,
      };
      setCurrentPrompt(prompt);
      await generateReferenceAudio(prompt.text);

      // Save prompt to day data
      const today = getTodayKey();
      const dayData = (await getSpeakingDayData(today)) ?? { date: today, prompts: [], results: [] };
      dayData.prompts.push(prompt);
      await saveSpeakingDayData(dayData);

      setState("practice");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate practice");
      setState("idle");
    }
  }

  function handlePlayReference() {
    if (!currentPrompt) return;

    if (isPlaying) {
      if (audioRef.current) audioRef.current.pause();
      else speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    if (referenceAudioUrl) {
      const audio = new Audio(referenceAudioUrl);
      audio.playbackRate = 0.9; // slightly slow for learning
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => setIsPlaying(false);
      audioRef.current = audio;
      setIsPlaying(true);
      audio.play();
    } else {
      const utterance = new SpeechSynthesisUtterance(currentPrompt.text);
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      setIsPlaying(true);
      speechSynthesis.speak(utterance);
    }
  }

  async function handleStartRecording() {
    setError(null);
    // Always use Web Speech API for recognition — ByteDance streaming ASR (v3)
    // requires WebSocket with custom headers which browsers cannot do.
    // ByteDance is still used for TTS (reference audio playback).
    startWebSpeechRecording();
  }

  function startWebSpeechRecording() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setError("Speech recognition not supported in this browser. Please configure ByteDance ASR in Settings.");
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      webSpeechTranscriptRef.current = "";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let finalTranscript = "";
        let interimTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + " ";
          } else {
            interimTranscript += event.results[i][0].transcript + " ";
          }
        }
        // Use final results if available, otherwise keep interim as fallback
        webSpeechTranscriptRef.current = finalTranscript.trim() || interimTranscript.trim();
        console.log("[Web Speech] Result: final=", JSON.stringify(finalTranscript.trim()), "interim=", JSON.stringify(interimTranscript.trim()));
      };

      recognition.onend = () => {
        console.log("[Web Speech] Recognition ended. Transcript:", JSON.stringify(webSpeechTranscriptRef.current));
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        console.warn("[Web Speech] Error:", event.error);
        if (event.error === "not-allowed") {
          setError("Microphone permission denied. Please allow microphone access.");
          setState("practice");
        }
      };

      webSpeechRef.current = recognition;
      recordingModeRef.current = "webspeech";
      recognition.start();
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
      setState("recording");
    } catch (e) {
      setError("Failed to start speech recognition. Please check your microphone.");
    }
  }

  async function handleStopRecording() {
    if (!currentPrompt) return;

    setState("evaluating");

    let transcription = "";

    if (recordingModeRef.current === "webspeech") {
      // Stop Web Speech API recognition
      if (webSpeechRef.current) {
        webSpeechRef.current.stop();
        // Wait for final results to come in after stop
        await new Promise((resolve) => setTimeout(resolve, 800));
        transcription = webSpeechTranscriptRef.current;
        webSpeechRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } else {
      // Stop MediaRecorder for ByteDance ASR
      if (!mediaRecorderRef.current) return;
      mediaRecorderRef.current.stop();

      // Wait for onstop callback to confirm all chunks are collected
      while (!recordingStoppedRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

      try {
        const settings = await getSettings();
        const appId = settings?.bytedanceAppId?.trim();
        const token = settings?.bytedanceToken?.trim();
        const asrCluster = settings?.bytedanceAsrCluster?.trim();

        if (appId && token) {
          // Convert blob to base64 in chunks (safe for large audio files)
          const arrayBuffer = await audioBlob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binaryStr = "";
          for (let i = 0; i < bytes.length; i += 8192) {
            binaryStr += String.fromCharCode.apply(null, Array.from(bytes.slice(i, i + 8192)));
          }
          const base64 = btoa(binaryStr);
          transcription = await recognizeSpeechBytedance(
            base64,
            appId,
            token,
            settings?.bytedanceAsrCluster || "volc.seedasr.sauc.duration",
            "webm"
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to process recording");
        setState("practice");
        return;
      }
    }

    try {
      if (!transcription.trim()) {
        setError("Could not recognize any speech. Please try speaking more clearly.");
        setState("practice");
        return;
      }

      // AI evaluation
      const evalResult = await evaluatePronunciation(currentPrompt.text, transcription);
      const combinedScore = Math.round(evalResult.accuracyScore * 0.6 + evalResult.fluencyScore * 0.4);

      const result: SpeakingPracticeResult = {
        promptId: currentPrompt.id,
        targetText: currentPrompt.text,
        userTranscription: transcription,
        score: combinedScore,
        feedback: evalResult,
        practicedAt: new Date().toISOString(),
      };

      setCurrentResult(result);

      // Save result
      const today = getTodayKey();
      const dayData = (await getSpeakingDayData(today)) ?? { date: today, prompts: [], results: [] };
      dayData.results.push(result);
      await saveSpeakingDayData(dayData);
      setDayData({ ...dayData });

      // Update daily record — count unique prompts with results (retries don't add to count)
      const uniquePromptIds = new Set(dayData.results.map((r) => r.promptId));
      const newCompleted = uniquePromptIds.size;
      const allDone = newCompleted >= targetCount;
      // Average the best score per prompt (retries don't drag down the average)
      const bestScoreByPrompt = new Map<string, number>();
      for (const r of dayData.results) {
        const prev = bestScoreByPrompt.get(r.promptId) ?? 0;
        if (r.score > prev) bestScoreByPrompt.set(r.promptId, r.score);
      }
      const bestScores = [...bestScoreByPrompt.values()];
      const avgScore = Math.round(bestScores.reduce((a, b) => a + b, 0) / bestScores.length);

      await onUpdate((r) => ({
        ...r,
        speaking: {
          completed: allDone,
          checkedInAt: new Date().toISOString(),
          practicesCompleted: newCompleted,
          averageScore: avgScore,
        },
      }));

      setState("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to evaluate pronunciation");
      setState("practice");
    }
  }

  function handleNext() {
    setCurrentPrompt(null);
    setCurrentResult(null);
    if (referenceAudioUrl) URL.revokeObjectURL(referenceAudioUrl);
    setReferenceAudioUrl(null);
    setState("idle");
  }

  // Render annotated text with color-coded connected speech marks
  function renderAnnotatedText(text: string, annotations: ConnectedSpeechAnnotation[]) {
    if (!annotations.length) return <span>{text}</span>;

    const sorted = [...annotations].sort((a, b) => a.startIndex - b.startIndex);
    const segments: React.ReactElement[] = [];
    let lastIndex = 0;

    sorted.forEach((ann, i) => {
      // Plain text before this annotation
      if (ann.startIndex > lastIndex) {
        segments.push(<span key={`plain-${i}`}>{text.slice(lastIndex, ann.startIndex)}</span>);
      }

      const colors = ANNOTATION_COLORS[ann.type] ?? ANNOTATION_COLORS.linking;
      segments.push(
        <span
          key={`ann-${i}`}
          className={`relative inline-block px-0.5 rounded border ${colors.bg} ${colors.text} font-medium cursor-help transition-all`}
          onMouseEnter={() => setHoveredAnnotation(i)}
          onMouseLeave={() => setHoveredAnnotation(null)}
        >
          {text.slice(ann.startIndex, ann.endIndex)}
          {hoveredAnnotation === i && (
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-50 normal-case font-normal">
              <span className="block font-semibold text-yellow-300 mb-1">{colors.label}</span>
              <span className="block mb-1">
                &ldquo;{ann.written}&rdquo; → &ldquo;{ann.spoken}&rdquo;
              </span>
              <span className="block text-gray-300">{ann.explanation}</span>
              <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
            </span>
          )}
        </span>
      );

      lastIndex = ann.endIndex;
    });

    // Remaining text after last annotation
    if (lastIndex < text.length) {
      segments.push(<span key="plain-end">{text.slice(lastIndex)}</span>);
    }

    return <>{segments}</>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Speaking Practice</h1>
        <span className="text-sm text-gray-500">
          {completedCount}/{targetCount} completed
        </span>
      </div>

      {/* Task done banner */}
      {isTaskDone && state === "idle" && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center mb-6">
          <span className="text-green-600 text-xl font-bold">&#10003;</span>
          <p className="text-green-700 font-medium mt-2">
            All speaking practices completed for today!
          </p>
          {record.speaking.averageScore != null && (
            <p className="text-green-600 text-sm mt-1">
              Average score: {record.speaking.averageScore}/100
            </p>
          )}
          <button
            onClick={handleGenerate}
            className="mt-4 px-5 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors"
          >
            + Practice More
          </button>
        </div>
      )}

      {/* Idle state */}
      {state === "idle" && !isTaskDone && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-600 mb-2">
            Practice speaking with AI-generated passages.
          </p>
          <p className="text-sm text-gray-400 mb-6">
            Read the passage aloud, then get feedback on your pronunciation.
          </p>

          <button
            onClick={handleGenerate}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Start Practice {completedCount + 1}
          </button>
          {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
        </div>
      )}

      {/* Practice History */}
      {state === "idle" && dayData && dayData.prompts.length > 0 && (
        <div className="mt-6 space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Today's Practices</h2>
          {dayData.prompts.slice(-5).map((prompt, i) => {
            const results = dayData.results.filter((r) => r.promptId === prompt.id);
            const bestScore = results.length > 0 ? Math.max(...results.map((r) => r.score)) : null;
            const lastResult = results.length > 0 ? results[results.length - 1] : null;
            return (
              <div key={prompt.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-400 uppercase">{prompt.topic}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        prompt.difficulty === "beginner" ? "bg-green-100 text-green-700"
                        : prompt.difficulty === "advanced" ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                      }`}>{prompt.difficulty}</span>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-2">{prompt.text.substring(0, 100)}...</p>
                    {lastResult && (
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span>Best: <strong className={bestScore! >= 80 ? "text-green-600" : bestScore! >= 60 ? "text-blue-600" : "text-amber-600"}>{bestScore}/100</strong></span>
                        <span>Attempts: {results.length}</span>
                      </div>
                    )}
                  </div>
                  {lastResult && (
                    <button
                      onClick={() => {
                        setCurrentPrompt(prompt);
                        setCurrentResult(lastResult);
                        setError(null);
                        setState("result");
                      }}
                      className="shrink-0 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      Review
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      setCurrentPrompt(prompt);
                      setCurrentResult(null);
                      setReferenceAudioUrl(null);
                      setError(null);
                      setState("practice");
                      await generateReferenceAudio(prompt.text);
                    }}
                    className="shrink-0 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    Practice
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Generating */}
      {state === "generating" && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="animate-pulse">
            <p className="text-gray-500">
              {generatingAudio ? "Generating reference audio..." : "Generating speaking prompt..."}
            </p>
          </div>
        </div>
      )}

      {/* Practice state — show annotated text and controls */}
      {(state === "practice" || state === "recording") && currentPrompt && (
        <div className="space-y-4">
          {state === "practice" && (
            <button
              onClick={() => {
                setCurrentPrompt(null);
                setCurrentResult(null);
                if (referenceAudioUrl) URL.revokeObjectURL(referenceAudioUrl);
                setReferenceAudioUrl(null);
                setState("idle");
              }}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              &larr; Back to list
            </button>
          )}
          {/* Prompt card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                {currentPrompt.topic}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                currentPrompt.difficulty === "beginner"
                  ? "bg-green-100 text-green-700"
                  : currentPrompt.difficulty === "advanced"
                  ? "bg-red-100 text-red-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}>
                {currentPrompt.difficulty}
              </span>
            </div>
            <p className="text-sm text-gray-500 mb-4">{currentPrompt.scenario}</p>

            {/* Passage */}
            <div className="bg-gray-50 rounded-lg p-5 mb-4 max-h-64 overflow-y-auto">
              <p className="text-base leading-loose text-gray-900">
                {currentPrompt.text}
              </p>
            </div>

            {/* Reference audio playback */}
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={handlePlayReference}
                disabled={state === "recording"}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  isPlaying
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                } disabled:opacity-30`}
              >
                {isPlaying ? "Stop" : "Listen to Reference"}
              </button>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                referenceAudioUrl
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-600"
              }`}>
                {referenceAudioUrl ? "HD Audio" : "Browser TTS"}
              </span>
            </div>

            {/* Recording controls */}
            {state === "practice" && (
              <button
                onClick={handleStartRecording}
                className="w-full py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <span className="w-3 h-3 rounded-full bg-white" />
                Start Recording
              </button>
            )}

            {state === "recording" && (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-3 py-3 bg-red-50 rounded-lg border border-red-200">
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-700 font-medium">
                    Recording... {recordingTime}s
                  </span>
                </div>
                <button
                  onClick={handleStopRecording}
                  className="w-full py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-medium"
                >
                  Stop & Evaluate
                </button>
              </div>
            )}
          </div>

          {/* Tips */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-700">
              Tip: Listen to the reference audio first, then record yourself reading the passage naturally.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Evaluating */}
      {state === "evaluating" && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="animate-pulse">
            <p className="text-gray-500">Analyzing your pronunciation...</p>
          </div>
        </div>
      )}

      {/* Result state */}
      {state === "result" && currentPrompt && currentResult && (
        <div className="space-y-4">
          {/* Score overview */}
          <div className={`rounded-xl border p-6 ${
            currentResult.score >= 80
              ? "bg-green-50 border-green-200"
              : currentResult.score >= 60
              ? "bg-blue-50 border-blue-200"
              : "bg-amber-50 border-amber-200"
          }`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">Your Score</h2>
              <span className={`text-3xl font-bold ${
                currentResult.score >= 80
                  ? "text-green-600"
                  : currentResult.score >= 60
                  ? "text-blue-600"
                  : "text-amber-600"
              }`}>
                {currentResult.score}/100
              </span>
            </div>
            <div className="flex gap-4 text-sm mb-3">
              <span className="text-gray-600">
                Accuracy: <strong>{currentResult.feedback.accuracyScore}</strong>
              </span>
              <span className="text-gray-600">
                Fluency: <strong>{currentResult.feedback.fluencyScore}</strong>
              </span>
            </div>
            <p className="text-sm text-gray-700">{currentResult.feedback.overallComment}</p>
          </div>

          {/* Comparison */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Comparison</h3>
            <div className="space-y-3">
              <div>
                <span className="text-xs font-medium text-gray-400 uppercase">Target</span>
                <p className="text-sm text-gray-800 mt-1">{currentPrompt.text}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-400 uppercase">You said</span>
                <p className="text-sm text-gray-800 mt-1">
                  {currentResult.userTranscription || <em className="text-gray-400">No speech detected</em>}
                </p>
              </div>
            </div>
          </div>

          {/* Pronunciation notes */}
          {currentResult.feedback.pronunciationNotes.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Pronunciation Notes</h3>
              <div className="space-y-3">
                {currentResult.feedback.pronunciationNotes.map((note, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3">
                    <span className="text-sm font-medium text-gray-900">{note.word}</span>
                    <p className="text-sm text-gray-600 mt-1">{note.issue}</p>
                    <p className="text-sm text-blue-600 mt-1">{note.suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setCurrentResult(null);
                setError(null);
                setState("practice");
              }}
              className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Try Again
            </button>
            {!isTaskDone ? (
              <button
                onClick={handleNext}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Next ({completedCount}/{targetCount})
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Back to List
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

