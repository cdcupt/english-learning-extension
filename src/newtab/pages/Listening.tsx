import { useState, useEffect, useRef } from "react";
import type { DailyRecord, QuizQuestion } from "@/shared/types";
import {
  generateListeningPractice,
  generateSpeechAudio,
  generateBytedanceSpeechAudio,
  type ListeningPracticeResult,
} from "@/shared/api/claude";
import { getSettings } from "@/shared/storage";

interface Props {
  record: DailyRecord;
  onUpdate: (updater: (r: DailyRecord) => DailyRecord) => Promise<void>;
  visible?: boolean;
}

type PracticeState = "idle" | "generating" | "listen" | "quiz" | "result";

interface PracticeSession {
  practice: ListeningPracticeResult;
  audioUrl: string | null;
  answers: Record<number, number>;
  submitted: boolean;
}

export function Listening({ record, onUpdate, visible }: Props) {
  const [targetCount, setTargetCount] = useState(2);
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [state, setState] = useState<PracticeState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [hasTtsKey, setHasTtsKey] = useState<boolean | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const completedCount = record.listening?.practicesCompleted ?? 0;

  function loadTtsSettings() {
    getSettings().then((s) => {
      if (s?.dailyListeningCount) setTargetCount(s.dailyListeningCount);
      const provider = s?.ttsProvider ?? "openai";
      let hasTts = false;
      if (provider === "bytedance") {
        hasTts = !!(s?.bytedanceAppId && s?.bytedanceToken);
      } else {
        const ttsKey =
          s?.ttsApiKey ||
          (s?.aiProvider?.provider === "openai" ? s.aiProvider.apiKey : null);
        hasTts = !!ttsKey;
      }
      setHasTtsKey(hasTts);
    });
  }

  useEffect(() => {
    loadTtsSettings();
  }, [visible]);

  // Cleanup audio URLs on unmount
  useEffect(() => {
    return () => {
      sessions.forEach((s) => {
        if (s.audioUrl) URL.revokeObjectURL(s.audioUrl);
      });
    };
  }, [sessions]);

  async function handleGenerate() {
    setState("generating");
    setError(null);
    try {
      const settings = await getSettings();
      const aiKey = settings?.aiProvider?.apiKey || settings?.claudeApiKey;
      if (!aiKey) {
        setError("Please set your AI API key in Settings first.");
        setState("idle");
        return;
      }

      const practice = await generateListeningPractice();

      // Generate real audio — dispatch to configured TTS provider
      const ttsProvider = settings?.ttsProvider ?? "openai";
      let audioUrl: string | null = null;

      // Re-read settings fresh to get latest TTS config
      const ttsSettings = await getSettings();
      const activeTtsProvider = ttsSettings?.ttsProvider ?? "openai";

      if (activeTtsProvider === "bytedance") {
        const appId = ttsSettings?.bytedanceAppId?.trim();
        const token = ttsSettings?.bytedanceToken?.trim();
        if (appId && token) {
          setGeneratingAudio(true);
          try {
            audioUrl = await generateBytedanceSpeechAudio(
              practice.passage,
              appId,
              token,
              (ttsSettings?.bytedanceVoice?.startsWith("BV") ? ttsSettings.bytedanceVoice : "BV504_streaming"),
              1,
              ttsSettings?.bytedanceCluster || "volcano_tts"
            );
          } catch (e) {
            console.warn("ByteDance TTS failed, falling back to browser speech:", e);
            setError(`TTS error: ${e instanceof Error ? e.message : "Unknown error"}. Using browser speech instead.`);
          }
          setGeneratingAudio(false);
        }
      } else {
        const ttsKey =
          ttsSettings?.ttsApiKey ||
          (ttsSettings?.aiProvider?.provider === "openai"
            ? ttsSettings.aiProvider.apiKey
            : null);
        if (ttsKey) {
          setGeneratingAudio(true);
          try {
            audioUrl = await generateSpeechAudio(
              practice.passage,
              ttsKey,
              ttsSettings?.ttsVoice || "nova"
            );
          } catch (e) {
            console.warn("OpenAI TTS failed, falling back to browser speech:", e);
            setError(`TTS error: ${e instanceof Error ? e.message : "Unknown error"}. Using browser speech instead.`);
          }
          setGeneratingAudio(false);
        }
      }

      setSessions((prev) => [
        ...prev,
        { practice, audioUrl, answers: {}, submitted: false },
      ]);
      setCurrentIndex(sessions.length);
      setPlayCount(0);
      setState("listen");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate practice");
      setState("idle");
    }
  }

  function handlePlay() {
    const session = sessions[currentIndex];
    if (!session) return;

    if (isPlaying) {
      if (session.audioUrl && audioRef.current) {
        audioRef.current.pause();
      } else {
        speechSynthesis.cancel();
      }
      setIsPlaying(false);
      return;
    }

    if (session.audioUrl) {
      // Use real audio file
      const audio = new Audio(session.audioUrl);
      audio.playbackRate = speed;
      audio.onended = () => {
        setIsPlaying(false);
        setPlayCount((c) => c + 1);
      };
      audio.onerror = () => {
        setIsPlaying(false);
        setError("Audio playback failed.");
      };
      audioRef.current = audio;
      setIsPlaying(true);
      audio.play();
    } else {
      // Fallback to browser TTS
      const utterance = new SpeechSynthesisUtterance(session.practice.passage);
      utterance.lang = "en-US";
      utterance.rate = speed;
      utterance.onend = () => {
        setIsPlaying(false);
        setPlayCount((c) => c + 1);
      };
      utterance.onerror = () => {
        setIsPlaying(false);
      };
      setIsPlaying(true);
      speechSynthesis.speak(utterance);
    }
  }

  // Update playback speed on the fly
  useEffect(() => {
    if (audioRef.current && isPlaying) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed, isPlaying]);

  function handleStartQuiz() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    speechSynthesis.cancel();
    setIsPlaying(false);
    setState("quiz");
  }

  function selectAnswer(questionIndex: number, optionIndex: number) {
    const session = sessions[currentIndex];
    if (!session || session.submitted) return;
    const updated = [...sessions];
    updated[currentIndex] = {
      ...session,
      answers: { ...session.answers, [questionIndex]: optionIndex },
    };
    setSessions(updated);
  }

  async function handleSubmitQuiz() {
    const updated = [...sessions];
    updated[currentIndex] = { ...updated[currentIndex], submitted: true };
    setSessions(updated);
    setState("result");

    const newCompleted = completedCount + 1;
    const allDone = newCompleted >= targetCount;

    await onUpdate((r) => ({
      ...r,
      listening: {
        completed: allDone,
        practicesCompleted: newCompleted,
      },
    }));
  }

  function handleNext() {
    setState("idle");
  }

  const session = sessions[currentIndex];
  const questions: QuizQuestion[] = session?.practice.questions ?? [];
  const allAnswered =
    questions.length > 0 &&
    Object.keys(session?.answers ?? {}).length === questions.length;
  const correctCount = session?.submitted
    ? questions.filter((q, i) => session.answers[i] === q.correctIndex).length
    : 0;
  const isTaskDone = record.listening?.completed ?? false;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Listening Practice</h1>
        <span className="text-sm text-gray-500">
          {completedCount}/{targetCount} completed
        </span>
      </div>

      {isTaskDone && state === "idle" && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center mb-6">
          <span className="text-green-600 text-xl font-bold">✓</span>
          <p className="text-green-700 font-medium mt-2">
            All listening practices completed for today!
          </p>
        </div>
      )}

      {/* Idle state */}
      {state === "idle" && !isTaskDone && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-600 mb-2">
            IELTS-style listening practice with AI-generated passages.
          </p>
          <p className="text-sm text-gray-400 mb-6">
            Listen to the audio, then answer 5 comprehension questions.
          </p>
          {hasTtsKey === false && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-left">
              <p className="text-sm text-amber-700 font-medium">
                No TTS credentials configured
              </p>
              <p className="text-xs text-amber-600 mt-1">
                Audio will use low-quality browser speech synthesis. For
                realistic HD audio, configure OpenAI or ByteDance TTS in{" "}
                <span className="font-semibold">
                  Settings → Listening Audio
                </span>
                .
              </p>
            </div>
          )}
          <button
            onClick={handleGenerate}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Start Practice {completedCount + 1}
          </button>
          {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
        </div>
      )}

      {/* Generating */}
      {state === "generating" && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500">
            {generatingAudio
              ? "Generating audio..."
              : "Generating listening practice..."}
          </p>
        </div>
      )}

      {/* Listen state */}
      {state === "listen" && session && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-1">
              {session.practice.title}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {session.practice.scenario}
            </p>

            {/* Audio type indicator */}
            <div className="flex items-center gap-2 mb-3">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  session.audioUrl
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {session.audioUrl ? "HD Audio" : "Browser TTS"}
              </span>
              {!session.audioUrl && (
                <span className="text-xs text-gray-400">
                  Configure TTS in Settings for HD audio
                </span>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={handlePlay}
                  className={`px-5 py-2 rounded-lg font-medium transition-colors ${
                    isPlaying
                      ? "bg-red-500 text-white hover:bg-red-600"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {isPlaying ? "Stop" : playCount === 0 ? "Play" : "Replay"}
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Speed:</span>
                  {[0.75, 1, 1.25].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSpeed(s)}
                      className={`px-2 py-1 text-xs rounded ${
                        speed === s
                          ? "bg-blue-600 text-white"
                          : "bg-white border border-gray-200 text-gray-600"
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-400">
                Played {playCount} time(s). Listen carefully before taking the
                quiz.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {questions.length} questions after listening
              </p>
              <button
                onClick={handleStartQuiz}
                disabled={playCount === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-30"
              >
                Take Quiz
              </button>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-700">
              Tip: Listen at least once before taking the quiz. You won't see
              the passage text during the quiz — just like a real IELTS test!
            </p>
          </div>
        </div>
      )}

      {/* Quiz state */}
      {(state === "quiz" || state === "result") && session && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-1">
              {session.practice.title}
            </h2>
            <p className="text-sm text-gray-500">{session.practice.scenario}</p>
          </div>

          {state === "result" && (
            <div
              className={`p-4 rounded-lg text-sm font-medium ${
                correctCount === questions.length
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-blue-50 text-blue-700 border border-blue-200"
              }`}
            >
              You got {correctCount}/{questions.length} correct!
              {correctCount === questions.length && " Perfect score!"}
            </div>
          )}

          <div className="space-y-4">
            {questions.map((q, qi) => {
              const userAnswer = session.answers[qi];
              const isCorrect = userAnswer === q.correctIndex;
              return (
                <div
                  key={qi}
                  className="bg-white rounded-xl border border-gray-200 p-5"
                >
                  <p className="font-medium text-gray-900 mb-3">
                    {qi + 1}. {q.question}
                  </p>
                  <div className="space-y-2">
                    {q.options.map((option, oi) => {
                      let style =
                        "border border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50";
                      if (userAnswer === oi && !session.submitted) {
                        style =
                          "border-2 border-blue-500 bg-blue-50 text-blue-700";
                      }
                      if (session.submitted) {
                        if (oi === q.correctIndex) {
                          style =
                            "border-2 border-green-500 bg-green-50 text-green-800";
                        } else if (userAnswer === oi && !isCorrect) {
                          style =
                            "border-2 border-red-400 bg-red-50 text-red-700";
                        } else {
                          style = "border border-gray-200 text-gray-400";
                        }
                      }
                      return (
                        <button
                          key={oi}
                          onClick={() => selectAnswer(qi, oi)}
                          disabled={session.submitted}
                          className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors ${style}`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  {session.submitted && (
                    <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                      {q.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {!session.submitted ? (
            <button
              onClick={handleSubmitQuiz}
              disabled={!allAnswered}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-30 font-medium"
            >
              Submit Answers
            </button>
          ) : (
            <div className="space-y-3">
              {/* Show transcript after quiz */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-2">Transcript</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {session.practice.passage}
                </p>
              </div>
              {!isTaskDone && (
                <button
                  onClick={handleNext}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Next Practice ({completedCount}/{targetCount})
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
