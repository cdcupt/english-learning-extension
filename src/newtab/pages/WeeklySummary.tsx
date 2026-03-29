import { useState, useEffect } from "react";
import type { DailyRecord } from "@/shared/types";
import { getDailyRecord, getVocabulary, getWritingIndex, getSpeakingDayData } from "@/shared/storage";
import { getWeekDates } from "@/shared/utils/scoring";

interface DayCompletion {
  reading: boolean;
  writing: boolean;
  vocabulary: boolean;
  speaking: boolean;
  listening: boolean;
}

interface WeekStats {
  reading: number;
  writing: number;
  vocabulary: number;
  speaking: number;
  listening: number;
  wordsLearned: number;
  writingScores: number[];
  speakingScores: number[];
  perfectDays: number;
  daily: DayCompletion[];
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
    const daily: DayCompletion[] = [];

    for (const r of records) {
      const day: DayCompletion = {
        reading: r?.reading.completed ?? false,
        writing: r?.writing.completed ?? false,
        vocabulary: r?.vocabulary.completed ?? false,
        speaking: r?.speaking.completed ?? false,
        listening: r?.listening?.completed ?? false,
      };
      daily.push(day);
      if (day.reading) reading++;
      if (day.writing) writing++;
      if (day.vocabulary) vocabulary++;
      if (day.speaking) speaking++;
      if (day.listening) listening++;
      if (day.reading && day.writing && day.vocabulary && day.speaking && day.listening)
        perfectDays++;
    }

    // Collect speaking scores
    const speakingScores: number[] = [];
    const speakingDays = await Promise.all(dates.map((d) => getSpeakingDayData(d)));
    for (const sd of speakingDays) {
      if (!sd) continue;
      for (const result of sd.results) {
        speakingScores.push(result.score);
      }
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
      speakingScores,
      perfectDays,
      daily,
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
            {(() => {
              const tasks = [
                { key: "reading" as const, label: "Reading", color: "#3b82f6", total: stats.reading },
                { key: "writing" as const, label: "Writing", color: "#a855f7", total: stats.writing },
                { key: "vocabulary" as const, label: "Vocabulary", color: "#22c55e", total: stats.vocabulary },
                { key: "speaking" as const, label: "Speaking", color: "#f97316", total: stats.speaking },
                { key: "listening" as const, label: "Listening", color: "#14b8a6", total: stats.listening },
              ];
              const dayLabels = dates.map((d) => {
                const dt = new Date(d + "T00:00:00");
                return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()];
              });

              // Chart dimensions
              const w = 500, h = 180, padL = 28, padR = 12, padT = 12, padB = 24;
              const chartW = w - padL - padR;
              const chartH = h - padT - padB;

              // Cumulative completion per task across 7 days
              const lines = tasks.map((task) => {
                let cum = 0;
                return stats.daily.map((day) => {
                  if (day[task.key]) cum++;
                  return cum;
                });
              });
              const maxY = 7;

              function x(i: number) { return padL + (i / 6) * chartW; }
              function y(v: number) { return padT + chartH - (v / maxY) * chartH; }

              return (
                <div>
                  <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxHeight: 220 }}>
                    {/* Grid lines */}
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((v) => (
                      <g key={v}>
                        <line x1={padL} x2={w - padR} y1={y(v)} y2={y(v)} stroke="#f3f4f6" strokeWidth={1} />
                        {v % 2 === 0 && (
                          <text x={padL - 6} y={y(v) + 4} textAnchor="end" className="fill-gray-400" style={{ fontSize: 10 }}>{v}</text>
                        )}
                      </g>
                    ))}
                    {/* X-axis labels */}
                    {dayLabels.map((label, i) => (
                      <text key={i} x={x(i)} y={h - 4} textAnchor="middle" className="fill-gray-400" style={{ fontSize: 10 }}>{label}</text>
                    ))}
                    {/* Lines */}
                    {lines.map((pts, ti) => (
                      <polyline
                        key={tasks[ti].key}
                        fill="none"
                        stroke={tasks[ti].color}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={pts.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
                      />
                    ))}
                    {/* Dots */}
                    {lines.map((pts, ti) =>
                      pts.map((v, i) => (
                        <circle key={`${ti}-${i}`} cx={x(i)} cy={y(v)} r={3} fill={tasks[ti].color} />
                      ))
                    )}
                  </svg>
                  {/* Legend */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                    {tasks.map((t) => (
                      <div key={t.key} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: t.color }} />
                        {t.label} ({t.total}/7)
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <div className="text-2xl font-bold text-orange-600">
                {stats.speakingScores.length > 0
                  ? Math.round(
                      stats.speakingScores.reduce((a, b) => a + b, 0) /
                        stats.speakingScores.length
                    )
                  : "—"}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Avg Speaking Score
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
