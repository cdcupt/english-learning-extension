import { useState, useEffect } from "react";
import type { DailyRecord } from "@/shared/types";
import { getDailyRecord, getVocabulary, getWritingIndex } from "@/shared/storage";
import { getWeekDates } from "@/shared/utils/scoring";

interface WeekStats {
  reading: number;
  writing: number;
  vocabulary: number;
  speaking: number;
  listening: number;
  wordsLearned: number;
  writingScores: number[];
  perfectDays: number;
}

export function WeeklySummary() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [stats, setStats] = useState<WeekStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWeekStats();
  }, [weekOffset]);

  async function loadWeekStats() {
    setLoading(true);

    const ref = new Date();
    ref.setDate(ref.getDate() - weekOffset * 7);
    const dates = getWeekDates(ref);

    const records = await Promise.all(
      dates.map((d) => getDailyRecord(d))
    );

    let reading = 0,
      writing = 0,
      vocabulary = 0,
      speaking = 0,
      listening = 0,
      perfectDays = 0;
    const writingScores: number[] = [];

    for (const r of records) {
      if (!r) continue;
      if (r.reading.completed) reading++;
      if (r.writing.completed) writing++;
      if (r.vocabulary.completed) vocabulary++;
      if (r.speaking.completed) speaking++;
      if (r.listening?.completed) listening++;
      if (
        r.reading.completed &&
        r.writing.completed &&
        r.vocabulary.completed &&
        r.speaking.completed &&
        (r.listening?.completed ?? false)
      )
        perfectDays++;
    }

    const writingIndex = await getWritingIndex();
    for (const item of writingIndex) {
      if (dates.includes(item.date) && item.score !== null) {
        writingScores.push(item.score);
      }
    }

    const vocab = await getVocabulary();
    const wordsLearned = vocab.filter((v) =>
      dates.includes(v.addedDate)
    ).length;

    setStats({
      reading,
      writing,
      vocabulary,
      speaking,
      listening,
      wordsLearned,
      writingScores,
      perfectDays,
    });
    setLoading(false);
  }

  const ref = new Date();
  ref.setDate(ref.getDate() - weekOffset * 7);
  const dates = getWeekDates(ref);
  const weekLabel = `${dates[0]} — ${dates[6]}`;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Weekly Summary
      </h1>

      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setWeekOffset((o) => o + 1)}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          ← Previous
        </button>
        <span className="text-sm font-medium text-gray-700">{weekLabel}</span>
        <button
          onClick={() => setWeekOffset((o) => Math.max(0, o - 1))}
          disabled={weekOffset === 0}
          className="text-blue-600 hover:text-blue-800 text-sm disabled:opacity-30"
        >
          Next →
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500 text-center py-8">Loading...</p>
      ) : stats ? (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">
              Task Completion
            </h2>
            {(
              [
                { label: "Reading", value: stats.reading, color: "bg-blue-500" },
                { label: "Writing", value: stats.writing, color: "bg-purple-500" },
                { label: "Vocabulary", value: stats.vocabulary, color: "bg-green-500" },
                { label: "Speaking", value: stats.speaking, color: "bg-orange-500" },
                { label: "Listening", value: stats.listening, color: "bg-teal-500" },
              ] as const
            ).map(({ label, value, color }) => (
              <div key={label} className="mb-3 last:mb-0">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{label}</span>
                  <span className="text-gray-500">{value}/7 days</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${color} rounded-full transition-all`}
                    style={{ width: `${(value / 7) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {stats.perfectDays}
              </div>
              <div className="text-xs text-gray-500 mt-1">Perfect Days</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <div className="text-2xl font-bold text-green-600">
                {stats.wordsLearned}
              </div>
              <div className="text-xs text-gray-500 mt-1">Words Learned</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <div className="text-2xl font-bold text-purple-600">
                {stats.writingScores.length > 0
                  ? Math.round(
                      stats.writingScores.reduce((a, b) => a + b, 0) /
                        stats.writingScores.length
                    )
                  : "—"}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Avg Writing Score
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
