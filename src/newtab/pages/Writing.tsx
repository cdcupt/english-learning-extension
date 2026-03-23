import { useState } from "react";
import type { DailyRecord, WritingFeedback } from "@/shared/types";
import { getSettings, saveWritingEntry } from "@/shared/storage";
import { reviewWriting } from "@/shared/api/claude";
import { getRandomTopic } from "@/shared/constants";
import { v4 as uuid } from "uuid";
import { getTodayKey } from "@/shared/utils/date";

interface Props {
  record: DailyRecord;
  onUpdate: (updater: (r: DailyRecord) => DailyRecord) => Promise<void>;
}

export function Writing({ record, onUpdate }: Props) {
  const [topic, setTopic] = useState(getRandomTopic);
  const [content, setContent] = useState("");
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wordCount = content
    .trim()
    .split(/\s+/)
    .filter((w) => w).length;

  async function handleSubmit() {
    if (wordCount < 10) return;

    setSubmitting(true);
    setError(null);

    try {
      const settings = await getSettings();
      if (!settings?.claudeApiKey) {
        setError("Please set your Kimi API key in Settings.");
        setSubmitting(false);
        return;
      }

      const result = await reviewWriting(
        settings.claudeApiKey,
        topic,
        content
      );
      setFeedback(result);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to review");
    }

    setSubmitting(false);
  }

  if (record.writing.completed && feedback) {
    return (
      <div className="max-w-2xl mx-auto">
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
                  <p className="text-blue-700">→ {item.correction}</p>
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

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Writing Practice
      </h1>

      <div className="bg-blue-50 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-blue-700">Topic</span>
          <button
            onClick={() => setTopic(getRandomTopic())}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            ↻ New Topic
          </button>
        </div>
        <p className="text-gray-900 font-medium">{topic}</p>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Start writing here..."
        className="w-full h-64 p-4 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
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
          disabled={wordCount < 10 || submitting}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Reviewing..." : "Submit for Review"}
        </button>
      </div>
    </div>
  );
}
