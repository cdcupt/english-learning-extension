export interface Settings {
  nytApiKey: string;
  claudeApiKey: string;
  dailyArticleCount: 1 | 2;
  installedDate: string;
  paused: boolean;
}

export interface DailyRecord {
  date: string;
  reading: {
    completed: boolean;
    articlesRead: string[];
    wordsLearned: number;
  };
  writing: {
    completed: boolean;
    writingId: string | null;
  };
  vocabulary: {
    completed: boolean;
    checkedInAt: string | null;
  };
  speaking: {
    completed: boolean;
    checkedInAt: string | null;
  };
}

export interface DailyArticles {
  date: string;
  articles: Article[];
  fetchedAt: string;
}

export interface Article {
  id: string;
  headline: string;
  abstract: string;
  url: string;
  body: string;
  section: string;
  publishedDate: string;
  readAt: string | null;
}

export interface VocabularyEntry {
  id: string;
  word: string;
  sentence: string;
  explanation: string;
  articleId: string;
  addedDate: string;
  reviewCount: number;
  lastReviewed: string | null;
  mastered: boolean;
}

export interface WritingEntry {
  id: string;
  date: string;
  topic: string;
  content: string;
  wordCount: number;
  feedback: WritingFeedback | null;
  submittedAt: string;
}

export interface WritingFeedback {
  score: number;
  grammarIssues: FeedbackItem[];
  styleNotes: FeedbackItem[];
  suggestions: string[];
  overallComment: string;
}

export interface FeedbackItem {
  original: string;
  correction: string;
  explanation: string;
}

export interface WritingIndexItem {
  id: string;
  date: string;
  topic: string;
  score: number | null;
}

export interface StreakData {
  current: number;
  longest: number;
  lastPerfectDate: string | null;
}

export type TaskType = "reading" | "writing" | "vocabulary" | "speaking";

export type Page =
  | "dashboard"
  | "reading"
  | "article"
  | "writing"
  | "vocabulary"
  | "speaking"
  | "summary"
  | "settings";
