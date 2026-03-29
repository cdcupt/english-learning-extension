# English Learning Tracker

A Chrome extension for building daily English learning habits with 5 practice tasks: Reading, Writing, Vocabulary, Speaking, and Listening.

## Features

- **Reading** — Read NYT articles and take AI-generated comprehension quizzes. After completing all articles, generate extra AI-written articles for more practice.
- **Writing** — Practice writing on random topics with AI feedback (grammar, style, score 0-100). Review past writings and feedback from today's history list.
- **Vocabulary** — Daily IELTS vocabulary quiz: 20 AI-generated words with 4-choice meanings, persistent progress, and full review at the end.
- **Speaking** — AI-generated passages, HD reference audio via ByteDance TTS 2.0, record yourself and get pronunciation feedback via Web Speech API + AI evaluation (accuracy & fluency scores). Retries don't inflate completion count; scores average from best attempt per prompt.
- **Listening** — IELTS-style listening practice with HD audio (ByteDance TTS 2.0 or OpenAI TTS) and 5-question quizzes. Persistent session history with review capability.
- **Streak Tracking** — Complete all 5 tasks for a perfect day; track streaks and weekly stats
- **Side Panel** — Quick task overview and check-in without leaving your current tab
- **Context Menu** — Select any word on a webpage → right-click → get an AI-powered explanation
- **Config Sharing** — Export/import settings with AES-256-GCM encryption; "Share" mode strips API keys for safe distribution

## Tech Stack

- React 19 + TypeScript
- Tailwind CSS v4
- Vite + CRXJS (Chrome extension bundling, Manifest V3)
- Chrome Storage API
- Multi-provider AI (Kimi, OpenAI, Claude, DeepSeek, Gemini)
- ByteDance OpenSpeech TTS 2.0 (SSE endpoint, recommended) or OpenAI TTS for HD audio
- Web Speech API for speaking practice speech recognition

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
4. Load in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist/` folder
5. Open a new tab to see the dashboard, then go to **Settings** to configure:
   - **NYT API Key** — for reading articles ([developer.nytimes.com](https://developer.nytimes.com))
   - **AI Provider & Key** — for content generation, writing review, and word explanations
   - **TTS Provider** — Choose ByteDance TTS 2.0 (recommended) or OpenAI TTS for HD audio
     - *ByteDance TTS 2.0:* App ID + Access Token from [Volcengine console](https://console.volcengine.com/speech/app); default voice: `en_female_dacey_uranus_bigtts` (Dacey)
     - *OpenAI:* API key + voice selection (alloy, echo, fable, onyx, nova, shimmer)

## Development

```bash
npm run dev      # Dev server with HMR
npm run build    # Production build to dist/
```

## License

MIT
