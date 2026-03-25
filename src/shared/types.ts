export type AIProvider = "kimi" | "openai" | "claude" | "deepseek" | "gemini";

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

export type TTSVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

export interface Settings {
  nytApiKey: string;
  claudeApiKey: string; // kept for backward compatibility
  aiProvider: AIProviderConfig;
  ttsApiKey: string; // OpenAI API key for text-to-speech
  ttsVoice: TTSVoice;
  dailyArticleCount: 1 | 2 | 3 | 4 | 5;
  dailyListeningCount: 1 | 2 | 3 | 4 | 5;
  installedDate: string;
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
  listening: {
    completed: boolean;
    practicesCompleted: number;
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

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface ListeningPractice {
  id: string;
  title: string;
  scenario: string;
  passage: string;
  questions: QuizQuestion[];
}

export type TaskType = "reading" | "writing" | "vocabulary" | "speaking" | "listening";

export type Page =
  | "dashboard"
  | "reading"
  | "article"
  | "writing"
  | "vocabulary"
  | "speaking"
  | "listening"
  | "history"
  | "summary"
  | "settings";
