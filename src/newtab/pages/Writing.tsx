import { useState, useEffect, useRef } from "react";
import type { DailyRecord, WritingFeedback, WritingEntry, SpeakingPracticeResult } from "@/shared/types";
import {
  getSettings,
  saveWritingEntry,
  getWritingIndex,
  getWritingEntry,
  getSpeakingDayData,
  saveSpeakingDayData,
} from "@/shared/storage";
import {
  reviewWriting,
  evaluatePronunciation,
  generateSpeechAudio,
  generateBytedanceSpeechAudio,
} from "@/shared/api/claude";
import { getRandomTopic } from "@/shared/constants";
import { v4 as uuid } from "uuid";
import { getTodayKey } from "@/shared/utils/date";

interface Props {
  record: DailyRecord;
  onUpdate: (updater: (r: DailyRecord) => DailyRecord) => Promise<void>;
}

type PageState =
  | "list"
  | "writing"
  | "submitting"
  | "feedback"
  | "recording"
  | "evaluating"
  | "speaking-result";

export function Writing({ record, onUpdate }: Props) {
  const [state, setState] = useState<PageState>("list");
  const [topic, setTopic] = useState(getRandomTopic);
  const [content, setContent] = useState("");
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
  const [currentTopic, setCurrentTopic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [todayEntries, setTodayEntries] = useState<WritingEntry[]>([]);

  // Speaking state
  const [referenceAudioUrl, setReferenceAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [speakingResult, setSpeakingResult] = useState<SpeakingPracticeResult | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webSpeechRef = useRef<any>(null);
  const webSpeechTranscriptRef = useRef("");

  const isWritingDone = record.writing?.completed ?? false;
  const isSpeakingDone = record.speaking?.completed ?? false;
  const isAllDone = isWritingDone && isSpeakingDone;

  useEffect(() => {
    loadTodayEntries();
  }, []);

  useEffect(() => {
    return () => {
      if (referenceAudioUrl) URL.revokeObjectURL(referenceAudioUrl);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [referenceAudioUrl]);

  async function loadTodayEntries() {
    const index = await getWritingIndex();
    const today = getTodayKey();
    const todayItems = index.filter((item) => item.date === today);
    const entries: WritingEntry[] = [];
    for (const item of todayItems) {
      const entry = await getWritingEntry(item.id);
      if (entry) entries.push(entry);
    }
    setTodayEntries(entries);
  }

  const wordCount = content
    .trim()
    .split(/\s+/)
    .filter((w) => w).length;

  function handleStartNew() {
    const newTopic = getRandomTopic();
    setTopic(newTopic);
    setContent("");
    setFeedback(null);
    setSpeakingResult(null);
    setReferenceAudioUrl(null);
    setError(null);
    setState("writing");
  }

  async function handleSubmit() {
    if (wordCount < 10) return;

    setState("submitting");
    setError(null);

    try {
      const settings = await getSettings();
      const aiKey = settings?.aiProvider?.apiKey || settings?.claudeApiKey;
      if (!aiKey) {
        setError("Please set your AI API key in Settings.");
        setState("writing");
        return;
      }

      const result = await reviewWriting(aiKey, topic, content);
      setFeedback(result);
      setCurrentTopic(topic);

      const writingId = uuid();
      await saveWritingEntry({
        id: writingId,
        date: getTodayKey(),
        topic,
        content,
        wordCount,
        feedback: result,
        submittedAt: new Date().toISOString(),
      });

      await onUpdate((r) => ({
        ...r,
        writing: { completed: true, writingId },
      }));

      await loadTodayEntries();

      // Auto-generate reference audio for the corrected text
      if (result.correctedText) {
        generateReferenceAudio(result.correctedText);
      }

      setState("feedback");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to review");
      setState("writing");
    }
  }

  function handleReview(entry: WritingEntry) {
    setFeedback(entry.feedback);
    setCurrentTopic(entry.topic);
    setContent(entry.content);
    setSpeakingResult(null);
    setReferenceAudioUrl(null);
    if (entry.feedback?.correctedText) {
      generateReferenceAudio(entry.feedback.correctedText);
    }
    setState("feedback");
  }

  // --- Speaking helpers ---

  async function generateReferenceAudio(text: string) {
    const settings = await getSettings();
    const ttsProvider = settings?.ttsProvider ?? "openai";
    let audioUrl: string | null = null;

    setGeneratingAudio(true);
    try {
      if (ttsProvider === "bytedance") {
        const appId = settings?.bytedanceAppId?.trim();
        const token = settings?.bytedanceToken?.trim();
        if (appId && token) {
          audioUrl = await generateBytedanceSpeechAudio(
            text, appId, token,
            settings?.bytedanceVoice || "en_female_dacey_uranus_bigtts", 1
          );
        }
      } else {
        const ttsKey =
          settings?.ttsApiKey ||
          (settings?.aiProvider?.provider === "openai" ? settings.aiProvider.apiKey : null);
        if (ttsKey) {
          audioUrl = await generateSpeechAudio(text, ttsKey, settings?.ttsVoice || "nova");
        }
      }
    } catch (e) {
      console.warn("TTS failed:", e);
    }
    setGeneratingAudio(false);
    setReferenceAudioUrl(audioUrl);
  }

  function handlePlayReference() {
    if (!feedback?.correctedText) return;

    if (isPlaying) {
      if (audioRef.current) audioRef.current.pause();
      else speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    if (referenceAudioUrl) {
      const audio = new Audio(referenceAudioUrl);
      audio.playbackRate = 0.9;
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => setIsPlaying(false);
      audioRef.current = audio;
      setIsPlaying(true);
      audio.play();
    } else {
      const utterance = new SpeechSynthesisUtterance(feedback.correctedText);
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      setIsPlaying(true);
      speechSynthesis.speak(utterance);
    }
  }

  function handleStartRecording() {
    setError(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setError("Speech recognition not supported in this browser.");
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
        webSpeechTranscriptRef.current = finalTranscript.trim() || interimTranscript.trim();
      };

      recognition.onend = () => {};

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        if (event.error === "not-allowed") {
          setError("Microphone permission denied. Please allow microphone access.");
          setState("feedback");
        }
      };

      webSpeechRef.current = recognition;
      recognition.start();
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
      setState("recording");
    } catch {
      setError("Failed to start speech recognition.");
    }
  }

  async function handleStopRecording() {
    if (!feedback?.correctedText) return;

    setState("evaluating");

    if (webSpeechRef.current) {
      webSpeechRef.current.stop();
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const transcription = webSpeechTranscriptRef.current;
    webSpeechRef.current = null;

    try {
      if (!transcription.trim()) {
        setError("Could not recognize any speech. Please try speaking more clearly.");
        setState("feedback");
        return;
      }

      const evalResult = await evaluatePronunciation(feedback.correctedText, transcription);
      const combinedScore = Math.round(evalResult.accuracyScore * 0.6 + evalResult.fluencyScore * 0.4);

      const promptId = `writing-speak-${uuid()}`;
      const result: SpeakingPracticeResult = {
        promptId,
        targetText: feedback.correctedText,
        userTranscription: transcription,
        score: combinedScore,
        feedback: evalResult,
        practicedAt: new Date().toISOString(),
      };

      setSpeakingResult(result);

      // Save to speaking day data
      const today = getTodayKey();
      const dayData = (await getSpeakingDayData(today)) ?? { date: today, prompts: [], results: [] };
      dayData.prompts.push({
        id: promptId,
        topic: currentTopic,
        scenario: "Read your corrected article aloud.",
        text: feedback.correctedText,
        annotations: [],
        difficulty: "intermediate",
      });
      dayData.results.push(result);
      await saveSpeakingDayData(dayData);

      // Mark speaking as completed
      const uniquePromptIds = new Set(dayData.results.map((r) => r.promptId));
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
          completed: true,
          checkedInAt: new Date().toISOString(),
          practicesCompleted: uniquePromptIds.size,
          averageScore: avgScore,
        },
      }));

      setState("speaking-result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to evaluate pronunciation");
      setState("feedback");
    }
  }

  // --- Render: Speaking result ---
  if (state === "speaking-result" && speakingResult && feedback) {
    return (
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => setState("feedback")}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4"
        >
          &larr; Back to feedback
        </button>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Speaking Result
        </h1>

        {/* Score */}
        <div className={`rounded-xl border p-6 mb-4 ${
          speakingResult.score >= 80
            ? "bg-green-50 border-green-200"
            : speakingResult.score >= 60
            ? "bg-blue-50 border-blue-200"
            : "bg-amber-50 border-amber-200"
        }`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">Your Score</h2>
            <span className={`text-3xl font-bold ${
              speakingResult.score >= 80
                ? "text-green-600"
                : speakingResult.score >= 60
                ? "text-blue-600"
                : "text-amber-600"
            }`}>
              {speakingResult.score}/100
            </span>
          </div>
          <div className="flex gap-4 text-sm mb-3">
            <span className="text-gray-600">
              Accuracy: <strong>{speakingResult.feedback.accuracyScore}</strong>
            </span>
            <span className="text-gray-600">
              Fluency: <strong>{speakingResult.feedback.fluencyScore}</strong>
            </span>
          </div>
          <p className="text-sm text-gray-700">{speakingResult.feedback.overallComment}</p>
        </div>

        {/* Comparison */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h3 className="font-semibold text-gray-900 mb-3">Comparison</h3>
          <div className="space-y-3">
            <div>
              <span className="text-xs font-medium text-gray-400 uppercase">Target</span>
              <p className="text-sm text-gray-800 mt-1">{feedback.correctedText}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-gray-400 uppercase">You said</span>
              <p className="text-sm text-gray-800 mt-1">
                {speakingResult.userTranscription || <em className="text-gray-400">No speech detected</em>}
              </p>
            </div>
          </div>
        </div>

        {/* Pronunciation notes */}
        {speakingResult.feedback.pronunciationNotes.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <h3 className="font-semibold text-gray-900 mb-3">Pronunciation Notes</h3>
            <div className="space-y-3">
              {speakingResult.feedback.pronunciationNotes.map((note, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3">
                  <span className="text-sm font-medium text-gray-900">{note.word}</span>
                  <p className="text-sm text-gray-600 mt-1">{note.issue}</p>
                  <p className="text-sm text-blue-600 mt-1">{note.suggestion}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => {
              setSpeakingResult(null);
              setState("feedback");
            }}
            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            Try Again
          </button>
          <button
            onClick={() => {
              setSpeakingResult(null);
              setFeedback(null);
              setReferenceAudioUrl(null);
              setState("list");
            }}
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // --- Render: Feedback + Speaking controls ---
  if ((state === "feedback" || state === "recording" || state === "evaluating") && feedback) {
    return (
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => setState("list")}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4"
        >
          &larr; Back to list
        </button>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Writing Feedback
        </h1>

        {/* Score */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Score</h2>
            <span
              className={`text-3xl font-bold ${
                feedback.score >= 80
                  ? "text-green-600"
                  : feedback.score >= 60
                    ? "text-yellow-600"
                    : "text-red-600"
              }`}
            >
              {feedback.score}/100
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-2">Topic: {currentTopic}</p>
          <p className="text-gray-700">{feedback.overallComment}</p>
        </div>

        {/* Grammar Issues */}
        {feedback.grammarIssues.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
            <h2 className="font-semibold text-gray-900 mb-3">Grammar Issues</h2>
            <div className="space-y-3">
              {feedback.grammarIssues.map((item, i) => (
                <div key={i} className="text-sm">
                  <p className="text-red-600 line-through">{item.original}</p>
                  <p className="text-green-700">{item.correction}</p>
                  <p className="text-gray-500 mt-1">{item.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Style Suggestions */}
        {feedback.styleNotes.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
            <h2 className="font-semibold text-gray-900 mb-3">Style Suggestions</h2>
            <div className="space-y-3">
              {feedback.styleNotes.map((item, i) => (
                <div key={i} className="text-sm">
                  <p className="text-gray-600">{item.original}</p>
                  <p className="text-blue-700">&rarr; {item.correction}</p>
                  <p className="text-gray-500 mt-1">{item.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tips */}
        {feedback.suggestions.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
            <h2 className="font-semibold text-gray-900 mb-3">Tips</h2>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              {feedback.suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Corrected Article + Speaking Controls */}
        {feedback.correctedText && (
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-6 mb-4">
            <h2 className="font-semibold text-gray-900 mb-3">
              Corrected Article — Read It Aloud
            </h2>
            <div className="bg-white rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">
                {feedback.correctedText}
              </p>
            </div>

            {/* Reference audio */}
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
                {generatingAudio ? "Loading audio..." : isPlaying ? "Stop" : "Listen First"}
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
            {state === "feedback" && (
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

            {state === "evaluating" && (
              <div className="py-4 text-center">
                <p className="text-gray-500 animate-pulse">Analyzing your pronunciation...</p>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    );
  }

  // --- Render: Writing editor ---
  if (state === "writing" || state === "submitting") {
    return (
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => setState("list")}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4"
        >
          &larr; Back to list
        </button>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Write & Speak
        </h1>

        <div className="bg-blue-50 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-700">Topic</span>
            <button
              onClick={() => setTopic(getRandomTopic())}
              className="text-sm text-blue-600 hover:text-blue-800"
              disabled={state === "submitting"}
            >
              &#8635; New Topic
            </button>
          </div>
          <p className="text-gray-900 font-medium">{topic}</p>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Start writing here..."
          disabled={state === "submitting"}
          className="w-full h-64 p-4 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 disabled:opacity-50"
        />

        <div className="flex items-center justify-between mt-4">
          <span
            className={`text-sm ${
              wordCount < 50 ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {wordCount} words
          </span>

          {error && <span className="text-sm text-red-600">{error}</span>}

          <button
            onClick={handleSubmit}
            disabled={wordCount < 10 || state === "submitting"}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state === "submitting" ? "Reviewing..." : "Submit for Review"}
          </button>
        </div>
      </div>
    );
  }

  // --- Render: List view (default) ---
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Write & Speak</h1>
        {todayEntries.length > 0 && (
          <span className="text-sm text-gray-500">
            {todayEntries.length} completed today
          </span>
        )}
      </div>

      {/* Completed banner or start button */}
      {isAllDone ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center mb-6">
          <span className="text-green-600 text-xl font-bold">&#10003;</span>
          <p className="text-green-700 font-medium mt-2">
            Write & Speak completed for today!
          </p>
          {todayEntries.length > 0 && todayEntries[todayEntries.length - 1].feedback && (
            <p className="text-green-600 text-sm mt-1">
              Latest writing score: {todayEntries[todayEntries.length - 1].feedback!.score}/100
            </p>
          )}
          {record.speaking.averageScore != null && (
            <p className="text-green-600 text-sm mt-1">
              Speaking score: {record.speaking.averageScore}/100
            </p>
          )}
          <button
            onClick={handleStartNew}
            className="mt-4 px-5 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors"
          >
            + Practice More
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center mb-6">
          <p className="text-gray-600 mb-2">
            Write about a topic, get AI feedback, then read your corrected article aloud.
          </p>
          <p className="text-sm text-gray-400 mb-6">
            Combines writing and speaking practice in one flow.
          </p>
          <button
            onClick={handleStartNew}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Start Writing
          </button>
        </div>
      )}

      {/* Today's history */}
      {todayEntries.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Today's Sessions</h2>
          {todayEntries.map((entry) => (
            <div key={entry.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{entry.topic}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span>{entry.wordCount} words</span>
                    {entry.feedback && (
                      <span>Score: <strong className={
                        entry.feedback.score >= 80 ? "text-green-600" :
                        entry.feedback.score >= 60 ? "text-blue-600" : "text-amber-600"
                      }>{entry.feedback.score}/100</strong></span>
                    )}
                  </div>
                </div>
                {entry.feedback && (
                  <button
                    onClick={() => handleReview(entry)}
                    className="shrink-0 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    Review
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
