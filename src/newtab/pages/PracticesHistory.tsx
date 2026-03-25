import { useState, useEffect } from "react";
import type {
  DailyRecord,
  DailyArticles,
  WritingEntry,
  VocabularyEntry,
} from "@/shared/types";
import {
  getDailyRecord,
  getDailyArticles,
  getWritingEntry,
  getVocabulary,
} from "@/shared/storage";
import { getDayKey } from "@/shared/utils/date";

export function PracticesHistory() {
  const [selectedDate, setSelectedDate] = useState(() => getDayKey(new Date()));
  const [record, setRecord] = useState<DailyRecord | null>(null);
  const [articles, setArticles] = useState<DailyArticles | null>(null);
  const [writing, setWriting] = useState<WritingEntry | null>(null);
  const [dayVocab, setDayVocab] = useState<VocabularyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedWriting, setExpandedWriting] = useState(false);

  useEffect(() => {
    loadDayData(selectedDate);
  }, [selectedDate]);

  async function loadDayData(date: string) {
    setLoading(true);
    setExpandedWriting(false);

    const [dayRecord, dayArticles, vocab] = await Promise.all([
      getDailyRecord(date),
      getDailyArticles(date),
      getVocabulary(),
    ]);

    setRecord(dayRecord ?? null);
    setArticles(dayArticles ?? null);
    setDayVocab(vocab.filter((v) => v.addedDate === date));

    if (dayRecord?.writing.writingId) {
      const entry = await getWritingEntry(dayRecord.writing.writingId);
      setWriting(entry ?? null);
    } else {
      setWriting(null);
    }

    setLoading(false);
  }

  function shiftDate(days: number) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    const today = getDayKey(new Date());
    const key = getDayKey(d);
    if (key <= today) {
      setSelectedDate(key);
    }
  }

  const isToday = selectedDate === getDayKey(new Date());
  const displayDate = new Date(selectedDate + "T00:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", year: "numeric", month: "long", day: "numeric" }
  );

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Practices History
      </h1>

      {/* Date Navigator */}
      <div className="flex items-center justify-between mb-6 bg-white rounded-xl border border-gray-200 p-4">
        <button
          onClick={() => shiftDate(-1)}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          ← Previous
        </button>
        <div className="text-center">
          <div className="text-sm font-medium text-gray-900">{displayDate}</div>
          {isToday && (
            <span className="text-xs text-blue-600 font-medium">Today</span>
          )}
        </div>
        <button
          onClick={() => shiftDate(1)}
          disabled={isToday}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium disabled:opacity-30"
        >
          Next →
        </button>
      </div>

      {/* Date Picker */}
      <div className="mb-6 flex justify-center">
        <input
          type="date"
          value={selectedDate}
          max={getDayKey(new Date())}
          onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-700"
        />
      </div>

      {loading ? (
        <p className="text-gray-500 text-center py-8">Loading...</p>
      ) : !record ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-400">No practice record for this day.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Overview */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Overview</h2>
            <div className="grid grid-cols-5 gap-3">
              {(
                [
                  { label: "Reading", done: record.reading.completed, color: "blue" },
                  { label: "Writing", done: record.writing.completed, color: "purple" },
                  { label: "Vocabulary", done: record.vocabulary.completed, color: "green" },
                  { label: "Speaking", done: record.speaking.completed, color: "orange" },
                  { label: "Listening", done: record.listening?.completed ?? false, color: "teal" },
                ] as const
              ).map(({ label, done, color }) => (
                <div
                  key={label}
                  className={`text-center p-3 rounded-lg ${
                    done ? `bg-${color}-50` : "bg-gray-50"
                  }`}
                >
                  <div className={`text-lg ${done ? `text-${color}-600` : "text-gray-300"}`}>
                    {done ? "✓" : "—"}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Reading Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">
              Reading
              {record.reading.completed && (
                <span className="ml-2 text-xs text-green-600 font-normal">Completed</span>
              )}
            </h2>
            {articles && articles.articles.length > 0 ? (
              <ul className="space-y-2">
                {articles.articles.map((article) => (
                  <li
                    key={article.id}
                    className="flex items-start gap-2 text-sm"
                  >
                    <span className={article.readAt ? "text-green-500" : "text-gray-300"}>
                      {article.readAt ? "✓" : "○"}
                    </span>
                    <div>
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {article.headline}
                      </a>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {article.section}
                        {article.readAt &&
                          ` · Read at ${new Date(article.readAt).toLocaleTimeString()}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">No articles recorded.</p>
            )}
            {record.reading.wordsLearned > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                Words learned from reading: {record.reading.wordsLearned}
              </p>
            )}
          </div>

          {/* Writing Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">
              Writing
              {record.writing.completed && (
                <span className="ml-2 text-xs text-green-600 font-normal">Completed</span>
              )}
            </h2>
            {writing ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Topic: {writing.topic}
                  </span>
                  {writing.feedback && (
                    <span className="text-sm font-bold text-purple-600">
                      Score: {writing.feedback.score}/100
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  {writing.wordCount} words · Submitted at{" "}
                  {new Date(writing.submittedAt).toLocaleTimeString()}
                </p>
                <button
                  onClick={() => setExpandedWriting(!expandedWriting)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {expandedWriting ? "Hide details ▲" : "Show details ▼"}
                </button>
                {expandedWriting && (
                  <div className="mt-3 space-y-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <h3 className="text-xs font-semibold text-gray-500 mb-1">
                        Your Writing
                      </h3>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {writing.content}
                      </p>
                    </div>
                    {writing.feedback && (
                      <>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <h3 className="text-xs font-semibold text-gray-500 mb-1">
                            Overall Comment
                          </h3>
                          <p className="text-sm text-gray-800">
                            {writing.feedback.overallComment}
                          </p>
                        </div>
                        {writing.feedback.grammarIssues.length > 0 && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <h3 className="text-xs font-semibold text-gray-500 mb-2">
                              Grammar Issues
                            </h3>
                            <ul className="space-y-2">
                              {writing.feedback.grammarIssues.map((issue, i) => (
                                <li key={i} className="text-sm">
                                  <span className="text-red-500 line-through">
                                    {issue.original}
                                  </span>
                                  {" → "}
                                  <span className="text-green-600">
                                    {issue.correction}
                                  </span>
                                  <p className="text-xs text-gray-500">
                                    {issue.explanation}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {writing.feedback.suggestions.length > 0 && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <h3 className="text-xs font-semibold text-gray-500 mb-1">
                              Suggestions
                            </h3>
                            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                              {writing.feedback.suggestions.map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No writing recorded.</p>
            )}
          </div>

          {/* Vocabulary Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">
              Vocabulary
              {record.vocabulary.completed && (
                <span className="ml-2 text-xs text-green-600 font-normal">
                  Completed
                  {record.vocabulary.checkedInAt &&
                    ` at ${new Date(record.vocabulary.checkedInAt).toLocaleTimeString()}`}
                </span>
              )}
            </h2>
            {dayVocab.length > 0 ? (
              <ul className="space-y-2">
                {dayVocab.map((entry) => (
                  <li
                    key={entry.id}
                    className="bg-gray-50 rounded-lg p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900">
                        {entry.word}
                      </span>
                      {entry.mastered && (
                        <span className="text-xs text-green-600">Mastered</span>
                      )}
                    </div>
                    {entry.sentence && (
                      <p className="text-xs text-gray-500 mt-1 italic">
                        "{entry.sentence}"
                      </p>
                    )}
                    {entry.explanation && (
                      <p className="text-xs text-gray-600 mt-1">
                        {entry.explanation}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">No words added this day.</p>
            )}
          </div>

          {/* Speaking Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">
              Speaking
              {record.speaking.completed && (
                <span className="ml-2 text-xs text-green-600 font-normal">Completed</span>
              )}
            </h2>
            {record.speaking.checkedInAt ? (
              <p className="text-sm text-gray-700">
                Checked in at{" "}
                {new Date(record.speaking.checkedInAt).toLocaleTimeString()}
              </p>
            ) : (
              <p className="text-sm text-gray-400">No speaking check-in.</p>
            )}
          </div>
          {/* Listening Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">
              Listening
              {record.listening?.completed && (
                <span className="ml-2 text-xs text-green-600 font-normal">Completed</span>
              )}
            </h2>
            {(record.listening?.practicesCompleted ?? 0) > 0 ? (
              <p className="text-sm text-gray-700">
                {record.listening!.practicesCompleted} practice(s) completed
              </p>
            ) : (
              <p className="text-sm text-gray-400">No listening practice.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
