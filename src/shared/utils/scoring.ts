import type { DailyRecord, StreakData } from "../types";
import { getDayKey, daysBetween } from "./date";

export function isDayComplete(record: DailyRecord): boolean {
  return (
    record.reading.completed &&
    record.writing.completed &&
    record.vocabulary.completed &&
    record.speaking.completed &&
    (record.listening?.completed ?? false)
  );
}

export function completedTaskCount(record: DailyRecord): number {
  let count = 0;
  if (record.reading.completed) count++;
  if (record.writing.completed && record.speaking.completed) count++;
  if (record.vocabulary.completed) count++;
  if (record.listening?.completed) count++;
  return count;
}

export function updateStreak(
  streak: StreakData,
  record: DailyRecord
): StreakData {
  const complete = isDayComplete(record);
  if (!complete) return streak;

  const today = record.date;

  if (!streak.lastPerfectDate) {
    return {
      current: 1,
      longest: Math.max(1, streak.longest),
      lastPerfectDate: today,
    };
  }

  const gap = daysBetween(streak.lastPerfectDate, today);

  if (gap === 1) {
    const newCurrent = streak.current + 1;
    return {
      current: newCurrent,
      longest: Math.max(newCurrent, streak.longest),
      lastPerfectDate: today,
    };
  } else if (gap === 0) {
    return streak;
  } else {
    return {
      current: 1,
      longest: streak.longest,
      lastPerfectDate: today,
    };
  }
}

export function getWeekDates(referenceDate: Date): string[] {
  const day = referenceDate.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(referenceDate);
  monday.setDate(referenceDate.getDate() - diff);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(getDayKey(d));
  }
  return dates;
}
