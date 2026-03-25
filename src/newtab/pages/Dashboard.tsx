import { useEffect, useState } from "react";
import type { Page, DailyRecord, StreakData } from "@/shared/types";
import { getStreak, getDailyRecord } from "@/shared/storage";
import { completedTaskCount, isDayComplete } from "@/shared/utils/scoring";
import { getWeekDates } from "@/shared/utils/scoring";
import { TaskCard } from "../components/TaskCard";

interface Props {
  record: DailyRecord;
  onNavigate: (page: Page) => void;
}

export function Dashboard({ record, onNavigate }: Props) {
  const [streak, setStreak] = useState<StreakData>({
    current: 0,
    longest: 0,
    lastPerfectDate: null,
  });
  const [weekStatus, setWeekStatus] = useState<boolean[]>([]);

  useEffect(() => {
    getStreak().then(setStreak);

    const dates = getWeekDates(new Date());
    Promise.all(dates.map((d) => getDailyRecord(d))).then((records) => {
      setWeekStatus(records.map((r) => (r ? isDayComplete(r) : false)));
    });
  }, [record]);

  const completed = completedTaskCount(record);
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Today's Tasks
          </h1>
          <p className="text-gray-500 mt-1">
            {completed}/5 completed
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-blue-600">
            {streak.current}
          </div>
          <div className="text-sm text-gray-500">day streak</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <TaskCard
          type="reading"
          completed={record.reading.completed}
          onNavigate={onNavigate}
        />
        <TaskCard
          type="writing"
          completed={record.writing.completed}
          onNavigate={onNavigate}
        />
        <TaskCard
          type="vocabulary"
          completed={record.vocabulary.completed}
          onNavigate={onNavigate}
        />
        <TaskCard
          type="speaking"
          completed={record.speaking.completed}
          onNavigate={onNavigate}
        />
        <TaskCard
          type="listening"
          completed={record.listening?.completed ?? false}
          onNavigate={onNavigate}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          This Week
        </h2>
        <div className="flex gap-2">
          {dayNames.map((name, i) => (
            <div key={name} className="flex-1 text-center">
              <div
                className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center text-sm font-medium ${
                  weekStatus[i]
                    ? "bg-green-500 text-white"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {weekStatus[i] ? "✓" : "·"}
              </div>
              <div className="text-xs text-gray-500 mt-1">{name}</div>
            </div>
          ))}
        </div>
        {streak.longest > 0 && (
          <p className="text-xs text-gray-400 mt-4 text-center">
            Longest streak: {streak.longest} days
          </p>
        )}
      </div>
    </div>
  );
}
