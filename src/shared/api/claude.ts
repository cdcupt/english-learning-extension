interface KimiResponse {
  choices: { message: { content: string } }[];
}

async function callKimi(
  apiKey: string,
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const res = await fetch("https://api.moonshot.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "moonshot-v1-8k",
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Kimi API error: ${res.status} - ${err}`);
  }

  const data: KimiResponse = await res.json();
  return data.choices[0]?.message?.content ?? "";
}

export async function explainWord(
  apiKey: string,
  word: string,
  context: string
): Promise<string> {
  const system = `You are an English tutor helping a learner understand unfamiliar words and phrases.
Give clear, simple explanations. Include:
1. The meaning in context
2. A simple definition
3. 2 example sentences using the word/phrase
Keep it concise — under 150 words.`;

  return callKimi(
    apiKey,
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
  apiKey: string,
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

  const text = await callKimi(
    apiKey,
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
