import { useState, useEffect } from "react";
import type { DailyRecord, WritingFeedback, WritingEntry } from "@/shared/types";
import { getSettings, saveWritingEntry, getWritingIndex, getWritingEntry } from "@/shared/storage";
import { reviewWriting } from "@/shared/api/claude";
import { getRandomTopic } from "@/shared/constants";
import { v4 as uuid } from "uuid";
import { getTodayKey } from "@/shared/utils/date";

interface Props {
  record: DailyRecord;
  onUpdate: (updater: (r: DailyRecord) => DailyRecord) => Promise<void>;
}

type WritingState = "list" | "writing" | "submitting" | "feedback";

export function Writing({ record, onUpdate }: Props) {
  const [state, setState] = useState<WritingState>("list");
  const [topic, setTopic] = useState(getRandomTopic);
  const [content, setContent] = useState("");
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
  const [currentTopic, setCurrentTopic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [todayEntries, setTodayEntries] = useState<WritingEntry[]>([]);

  const isTaskDone = record.writing?.completed ?? false;

  useEffect(() => {
    loadTodayEntries();
  }, []);

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
    setState("feedback");
  }

  // Feedback view
  if (state === "feedback" && feedback) {
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

        {feedback.grammarIssues.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
            <h2 className="font-semibold text-gray-900 mb-3">
              Grammar Issues
            </h2>
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

        {feedback.styleNotes.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
            <h2 className="font-semibold text-gray-900 mb-3">
              Style Suggestions
            </h2>
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

        {feedback.suggestions.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Tips</h2>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              {feedback.suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // Writing editor
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
          Writing Practice
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

  // List view (default)
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Writing Practice</h1>
        {todayEntries.length > 0 && (
          <span className="text-sm text-gray-500">
            {todayEntries.length} completed today
          </span>
        )}
      </div>

      {/* Completed banner or start button */}
      {isTaskDone ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center mb-6">
          <span className="text-green-600 text-xl font-bold">&#10003;</span>
          <p className="text-green-700 font-medium mt-2">
            Writing practice completed for today!
          </p>
          {todayEntries.length > 0 && todayEntries[todayEntries.length - 1].feedback && (
            <p className="text-green-600 text-sm mt-1">
              Latest score: {todayEntries[todayEntries.length - 1].feedback!.score}/100
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
            Practice your English writing skills.
          </p>
          <p className="text-sm text-gray-400 mb-6">
            Write about a topic and get AI feedback on grammar, style, and suggestions.
          </p>
          <button
            onClick={handleStartNew}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Start Writing
          </button>
        </div>
      )}

      {/* Today's writings history */}
      {todayEntries.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Today's Writings</h2>
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
