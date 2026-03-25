import type {
  Settings,
  DailyRecord,
  DailyArticles,
  VocabularyEntry,
  WritingEntry,
  WritingIndexItem,
  StreakData,
} from "./types";
import { getTodayKey } from "./utils/date";

async function get<T>(key: string): Promise<T | undefined> {
  const result = await chrome.storage.local.get(key);
  return result[key] as T | undefined;
}

async function set(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

// Settings
export async function getSettings(): Promise<Settings | undefined> {
  return get<Settings>("settings");
}

export async function saveSettings(settings: Settings): Promise<void> {
  await set("settings", settings);
}

// Daily Record
export async function getDailyRecord(
  date?: string
): Promise<DailyRecord | undefined> {
  const key = `day:${date ?? getTodayKey()}`;
  return get<DailyRecord>(key);
}

export async function saveDailyRecord(record: DailyRecord): Promise<void> {
  await set(`day:${record.date}`, record);
}

export function createEmptyDailyRecord(date: string): DailyRecord {
  return {
    date,
    reading: { completed: false, articlesRead: [], wordsLearned: 0 },
    writing: { completed: false, writingId: null },
    vocabulary: { completed: false, checkedInAt: null },
    speaking: { completed: false, checkedInAt: null },
    listening: { completed: false, practicesCompleted: 0 },
  };
}

export async function getOrCreateTodayRecord(): Promise<DailyRecord> {
  const today = getTodayKey();
  const existing = await getDailyRecord(today);
  if (existing) return existing;
  const record = createEmptyDailyRecord(today);
  await saveDailyRecord(record);
  return record;
}

// Daily Records for a date range
export async function getDailyRecordsRange(
  dates: string[]
): Promise<(DailyRecord | undefined)[]> {
  return Promise.all(dates.map((d) => getDailyRecord(d)));
}

// Articles
export async function getDailyArticles(
  date?: string
): Promise<DailyArticles | undefined> {
  const key = `articles:${date ?? getTodayKey()}`;
  return get<DailyArticles>(key);
}

export async function saveDailyArticles(
  articles: DailyArticles
): Promise<void> {
  await set(`articles:${articles.date}`, articles);
}

// Vocabulary
export async function getVocabulary(): Promise<VocabularyEntry[]> {
  return (await get<VocabularyEntry[]>("vocab")) ?? [];
}

export async function saveVocabulary(
  entries: VocabularyEntry[]
): Promise<void> {
  await set("vocab", entries);
}

export async function addVocabularyEntry(
  entry: VocabularyEntry
): Promise<void> {
  const vocab = await getVocabulary();
  vocab.unshift(entry);
  await saveVocabulary(vocab);
}

// Writing
export async function getWritingEntry(
  id: string
): Promise<WritingEntry | undefined> {
  return get<WritingEntry>(`writing:${id}`);
}

export async function saveWritingEntry(entry: WritingEntry): Promise<void> {
  await set(`writing:${entry.id}`, entry);
  const index = await getWritingIndex();
  const existing = index.findIndex((i) => i.id === entry.id);
  const item: WritingIndexItem = {
    id: entry.id,
    date: entry.date,
    topic: entry.topic,
    score: entry.feedback?.score ?? null,
  };
  if (existing >= 0) {
    index[existing] = item;
  } else {
    index.unshift(item);
  }
  await set("writingIndex", index);
}

export async function getWritingIndex(): Promise<WritingIndexItem[]> {
  return (await get<WritingIndexItem[]>("writingIndex")) ?? [];
}

// Streak
export async function getStreak(): Promise<StreakData> {
  return (
    (await get<StreakData>("streak")) ?? {
      current: 0,
      longest: 0,
      lastPerfectDate: null,
    }
  );
}

export async function saveStreak(streak: StreakData): Promise<void> {
  await set("streak", streak);
}
