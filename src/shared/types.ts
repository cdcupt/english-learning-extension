export type AIProvider = "kimi" | "openai" | "claude" | "deepseek" | "gemini";

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

export type TTSVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

export type TTSProvider = "openai" | "bytedance";

export type BytedanceVoice =
  | "en_female_dacey_uranus_bigtts"
  | "BV001_streaming"
  | "BV002_streaming"
  | "BV503_streaming"
  | "BV504_streaming";

export interface Settings {
  nytApiKey: string;
  claudeApiKey: string; // kept for backward compatibility
  aiProvider: AIProviderConfig;
  ttsProvider?: TTSProvider;
  ttsApiKey: string; // OpenAI API key for text-to-speech
  ttsVoice: TTSVoice;
  bytedanceAppId?: string;
  bytedanceToken?: string;
  bytedanceCluster?: string;
  bytedanceVoice?: BytedanceVoice;
  dailyArticleCount: 1 | 2 | 3 | 4 | 5;
  dailyListeningCount: 1 | 2 | 3 | 4 | 5;
  dailySpeakingCount?: 1 | 2 | 3 | 4 | 5;
  bytedanceAsrCluster?: string;
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
    practicesCompleted?: number;
    averageScore?: number;
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

// --- Speaking Practice Types ---

export type ConnectedSpeechType =
  | "linking"
  | "elision"
  | "assimilation"
  | "reduction"
  | "contraction"
  | "intrusion";

export interface ConnectedSpeechAnnotation {
  startIndex: number;
  endIndex: number;
  type: ConnectedSpeechType;
  written: string;
  spoken: string;
  explanation: string;
}

export interface SpeakingPrompt {
  id: string;
  topic: string;
  scenario: string;
  text: string;
  annotations: ConnectedSpeechAnnotation[];
  difficulty: "beginner" | "intermediate" | "advanced";
}

export interface SpeakingFeedback {
  overallComment: string;
  accuracyScore: number;
  fluencyScore: number;
  pronunciationNotes: PronunciationNote[];
}

export interface PronunciationNote {
  word: string;
  issue: string;
  suggestion: string;
}

export interface SpeakingPracticeResult {
  promptId: string;
  targetText: string;
  userTranscription: string;
  score: number;
  feedback: SpeakingFeedback;
  practicedAt: string;
}

export interface VocabQuizDayData {
  date: string;
  words: {
    word: string;
    meaning: string;
    options: string[];
    correctIndex: number;
    exampleSentence: string;
  }[];
  answers: Record<number, number>; // wordIndex -> selectedOptionIndex
}

export interface ListeningSessionData {
  practice: {
    title: string;
    scenario: string;
    passage: string;
    questions: QuizQuestion[];
  };
  answers: Record<number, number>;
  submitted: boolean;
}

export interface ListeningDayData {
  date: string;
  sessions: ListeningSessionData[];
}

export interface SpeakingDayData {
  date: string;
  prompts: SpeakingPrompt[];
  results: SpeakingPracticeResult[];
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
