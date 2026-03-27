import type { AIProvider, AIProviderConfig, TTSVoice, BytedanceVoice } from "../types";

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

// --- Text-to-Speech ---

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

// --- Text-to-Speech via ByteDance OpenSpeech API ---
// Routed through background service worker to bypass CORS restrictions

export async function generateBytedanceSpeechAudio(
  text: string,
  appId: string,
  token: string,
  voice: string = "en_female_dacey_uranus_bigtts",
  speed: number = 1
): Promise<string> {
  const response = await chrome.runtime.sendMessage({
    type: "bytedance-tts",
    appId,
    token,
    voice,
    text,
    speed,
  });

  if (response.error) {
    throw new Error(response.error);
  }

  const binaryStr = atob(response.data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: "audio/mpeg" });
  return URL.createObjectURL(blob);
}

// --- Speaking Practice ---

export interface SpeakingPromptResult {
  topic: string;
  scenario: string;
  text: string;
  annotations: {
    startIndex: number;
    endIndex: number;
    type: "linking" | "elision" | "assimilation" | "reduction" | "contraction" | "intrusion";
    written: string;
    spoken: string;
    explanation: string;
  }[];
  difficulty: "beginner" | "intermediate" | "advanced";
}

const SPEAKING_TOPICS = [
  "ordering food at a restaurant",
  "asking for directions in a new city",
  "making a phone call to schedule an appointment",
  "introducing yourself at a social gathering",
  "discussing weekend plans with a friend",
  "checking in at a hotel",
  "talking to a coworker about a project",
  "shopping for clothes and asking about sizes",
  "describing your daily routine",
  "sharing your opinion about a movie",
  "calling customer service about a problem",
  "making small talk with a neighbor",
  "explaining your job to someone new",
  "discussing the weather and seasons",
  "ordering coffee and making small talk with the barista",
  "talking about your favorite hobby",
  "asking for recommendations at a bookstore",
  "discussing travel experiences",
  "giving someone advice about a problem",
  "negotiating a price at a market",
];

export async function generateSpeakingPrompt(): Promise<SpeakingPromptResult> {
  const topic = SPEAKING_TOPICS[Math.floor(Math.random() * SPEAKING_TOPICS.length)];

  const system = `You are an English speaking coach.
Generate a natural English passage (80-150 words, 4-8 sentences) for a speaking practice scenario. The passage should read like a short monologue or one side of a conversation — natural, flowing, and realistic. Use contractions and natural phrasing as a native speaker would.

You MUST respond with valid JSON only, no markdown fences, in this exact format:
{
  "topic": "Short topic label",
  "scenario": "Brief scenario description (1 sentence)",
  "text": "The full passage to practice.",
  "annotations": [],
  "difficulty": "intermediate"
}

The "annotations" array should always be empty. Difficulty should be one of: "beginner", "intermediate", "advanced".`;

  const text = await callWithSettings(
    system,
    `Generate a speaking practice passage about: ${topic}`
  );

  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    return JSON.parse(cleaned);
  } catch {
    console.error("[Speaking] Failed to parse prompt response:", text.substring(0, 300));
    throw new Error("Failed to generate speaking prompt. Please try again.");
  }
}

export interface PronunciationEvalResult {
  overallComment: string;
  accuracyScore: number;
  fluencyScore: number;
  pronunciationNotes: { word: string; issue: string; suggestion: string }[];
}

export async function evaluatePronunciation(
  targetText: string,
  userTranscription: string
): Promise<PronunciationEvalResult> {
  const system = `You are an English pronunciation evaluator. Compare the target sentence with what was recognized from the learner's speech.

You MUST respond with valid JSON only, no markdown fences, in this exact format:
{
  "overallComment": "Brief encouraging feedback (1-2 sentences)",
  "accuracyScore": 85,
  "fluencyScore": 80,
  "pronunciationNotes": [
    {
      "word": "specific word or phrase",
      "issue": "what was wrong or unclear",
      "suggestion": "how to improve"
    }
  ]
}

Scoring guide:
- accuracyScore (0-100): How closely the recognized text matches the target. 100 = perfect match. Penalize missing/wrong words.
- fluencyScore (0-100): Based on natural flow, connected speech usage, and overall intelligibility. Consider that ASR may not perfectly capture connected speech — if words are approximately correct, give benefit of the doubt.

Be encouraging but honest. If the transcription is very close, give high scores. Include 0-3 pronunciation notes for the most important improvements.`;

  const text = await callWithSettings(
    system,
    `Target sentence: "${targetText}"\n\nRecognized from speech: "${userTranscription}"`
  );

  try {
    return JSON.parse(text);
  } catch {
    return {
      overallComment: "Could not evaluate pronunciation. Please try again.",
      accuracyScore: 0,
      fluencyScore: 0,
      pronunciationNotes: [],
    };
  }
}

// --- Speech Recognition via ByteDance OpenSpeech API ---

export async function recognizeSpeechBytedance(
  audioBase64: string,
  appId: string,
  token: string,
  cluster: string = "volc.seedasr.sauc.duration",
  audioFormat: string = "webm"
): Promise<string> {
  const response = await chrome.runtime.sendMessage({
    type: "bytedance-asr",
    appId,
    token,
    resourceId: cluster,
    audioBase64,
    audioFormat,
  });

  if (response.error) {
    throw new Error(response.error);
  }

  return response.text ?? "";
}
