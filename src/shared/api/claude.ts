import type { AIProvider, AIProviderConfig, TTSVoice } from "../types";

// --- Provider registry ---

interface ProviderDef {
  label: string;
  endpoint: string;
  defaultModel: string;
  models: string[];
  helpUrl: string;
}

export const AI_PROVIDERS: Record<AIProvider, ProviderDef> = {
  kimi: {
    label: "Kimi (Moonshot)",
    endpoint: "https://api.moonshot.ai/v1/chat/completions",
    defaultModel: "moonshot-v1-8k",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
    helpUrl: "platform.moonshot.cn",
  },
  openai: {
    label: "OpenAI",
    endpoint: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano"],
    helpUrl: "platform.openai.com",
  },
  claude: {
    label: "Claude (Anthropic)",
    endpoint: "https://api.anthropic.com/v1/messages",
    defaultModel: "claude-sonnet-4-6",
    models: ["claude-sonnet-4-6", "claude-haiku-4-5-20251001", "claude-opus-4-6"],
    helpUrl: "console.anthropic.com",
  },
  deepseek: {
    label: "DeepSeek",
    endpoint: "https://api.deepseek.com/chat/completions",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    helpUrl: "platform.deepseek.com",
  },
  gemini: {
    label: "Gemini (Google)",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/chat/completions",
    defaultModel: "gemini-2.5-flash",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
    helpUrl: "aistudio.google.com",
  },
};

// --- Unified chat call ---

interface ChatResponse {
  choices?: { message: { content: string } }[];
  content?: { type: string; text: string }[];
}

async function callAI(
  config: AIProviderConfig,
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const provider = AI_PROVIDERS[config.provider];

  // Anthropic uses a different API format
  if (config.provider === "claude") {
    return callClaude(config, provider, systemPrompt, userMessage);
  }

  // Gemini uses OpenAI-compatible format with API key as query param
  const url =
    config.provider === "gemini"
      ? `${provider.endpoint}?key=${config.apiKey}`
      : provider.endpoint;

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (config.provider !== "gemini") {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      max_tokens: 2048,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${provider.label} API error: ${res.status} - ${err}`);
  }

  const data: ChatResponse = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callClaude(
  config: AIProviderConfig,
  provider: ProviderDef,
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const res = await fetch(provider.endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${provider.label} API error: ${res.status} - ${err}`);
  }

  const data: ChatResponse = await res.json();
  return data.content?.[0]?.text ?? "";
}

// --- Legacy wrapper: resolves config from settings ---

async function callWithSettings(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const { getSettings } = await import("../storage");
  const settings = await getSettings();
  if (!settings) throw new Error("Settings not configured");

  const config = settings.aiProvider ?? {
    provider: "kimi" as AIProvider,
    apiKey: settings.claudeApiKey,
    model: "moonshot-v1-8k",
  };

  if (!config.apiKey) {
    throw new Error("Please set your AI API key in Settings first.");
  }

  return callAI(config, systemPrompt, userMessage);
}

// --- Public functions ---

export interface ListeningPracticeResult {
  title: string;
  scenario: string;
  passage: string;
  questions: QuizQuestionResult[];
}

export async function generateListeningPractice(): Promise<ListeningPracticeResult> {
  const scenarios = [
    "a university lecture about an academic topic",
    "a conversation between two students planning a project",
    "a tour guide describing a historical site",
    "a radio interview with a scientist",
    "a phone call to make a reservation or appointment",
    "a workplace meeting discussing a new policy",
    "a museum audio guide about an exhibit",
    "a news broadcast about a current event",
    "a doctor giving health advice to a patient",
    "a librarian helping a student find resources",
  ];
  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];

  const system = `You are an IELTS listening test designer. Generate a realistic listening practice.
Create a passage that simulates ${scenario}.

You MUST respond with valid JSON only, no markdown fences, in this exact format:
{
  "title": "Short descriptive title",
  "scenario": "Brief scenario description (1 sentence)",
  "passage": "The full listening passage text (150-250 words, natural spoken English with filler words, contractions, and realistic dialogue. Use Speaker A:/Speaker B: labels for conversations.)",
  "questions": [
    {
      "question": "...",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correctIndex": 0,
      "explanation": "..."
    }
  ]
}

Generate exactly 5 questions covering:
- Factual detail recall
- Speaker's purpose or opinion
- Vocabulary meaning in context
- Inference from what was said
- Sequence of events or logical connection

Make the passage sound natural and conversational. Each question must have exactly 4 options. correctIndex is 0-based.`;

  const text = await callWithSettings(
    system,
    `Generate an IELTS-style listening practice about: ${scenario}`
  );

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Failed to generate listening practice. Please try again.");
  }
}

export interface QuizQuestionResult {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export async function generateReadingQuiz(
  _apiKey: string,
  headline: string,
  abstract: string,
  body: string
): Promise<QuizQuestionResult[]> {
  const system = `You are an English reading comprehension tutor. Generate a quiz to test the reader's understanding of an article.
Create 3-5 multiple-choice questions covering:
- Main idea / key points
- Vocabulary in context
- Inference / critical thinking

You MUST respond with valid JSON only, no markdown fences, in this exact format:
[
  {
    "question": "...",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correctIndex": 0,
    "explanation": "..."
  }
]
Each question must have exactly 4 options. correctIndex is 0-based.`;

  const text = await callWithSettings(
    system,
    `Article headline: "${headline}"\n\nAbstract: ${abstract}\n\nBody: ${body}`
  );

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

export async function explainWord(
  _apiKey: string,
  word: string,
  context: string
): Promise<string> {
  const system = `You are an English tutor helping a learner understand unfamiliar words and phrases.
Give clear, simple explanations. Include:
1. The meaning in context
2. A simple definition
3. 2 example sentences using the word/phrase
Keep it concise — under 150 words.`;

  return callWithSettings(
    system,
    `I'm reading an article and found this word/phrase I don't understand: "${word}"\n\nContext: "${context}"`
  );
}

export interface WritingReviewResult {
  score: number;
  grammarIssues: { original: string; correction: string; explanation: string }[];
  styleNotes: { original: string; correction: string; explanation: string }[];
  suggestions: string[];
  overallComment: string;
}

export async function reviewWriting(
  _apiKey: string,
  topic: string,
  content: string
): Promise<WritingReviewResult> {
  const system = `You are an English writing tutor. Review the student's essay and provide detailed feedback.
You MUST respond with valid JSON only, no markdown fences, in this exact format:
{
  "score": <number 0-100>,
  "grammarIssues": [{"original": "...", "correction": "...", "explanation": "..."}],
  "styleNotes": [{"original": "...", "correction": "...", "explanation": "..."}],
  "suggestions": ["..."],
  "overallComment": "..."
}`;

  const text = await callWithSettings(
    system,
    `Topic: "${topic}"\n\nEssay:\n${content}`
  );

  try {
    return JSON.parse(text);
  } catch {
    return {
      score: 0,
      grammarIssues: [],
      styleNotes: [],
      suggestions: [],
      overallComment: text,
    };
  }
}

// --- Text-to-Speech via OpenAI API ---

export async function generateSpeechAudio(
  text: string,
  apiKey: string,
  voice: TTSVoice = "nova",
  speed: number = 1
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      voice,
      speed,
      response_format: "mp3",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI TTS error: ${res.status} - ${err}`);
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
