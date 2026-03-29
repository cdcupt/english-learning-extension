# English Learning Tracker

A Chrome extension for building daily English learning habits with 4 practice tasks: Reading, Write & Speak, Vocabulary, and Listening.

## Features

- **Reading** — Read NYT articles or pure AI-generated articles (configurable via "Reading Source" toggle in Settings), take comprehension quizzes, and generate extra articles for more practice.
- **Write & Speak** — Unified writing + speaking practice: write about a topic, get AI feedback with a corrected article, then read it aloud for pronunciation evaluation. Completes both writing and speaking tasks in one flow.
- **Vocabulary** — Daily IELTS vocabulary quiz: 20 AI-generated words with 4-choice meanings, persistent progress, and full review at the end.
- **Listening** — IELTS-style listening practice with HD audio (OpenAI TTS or ByteDance TTS 2.0) and 5-question quizzes. Persistent session history with review capability.
- **Config Sharing** — Share your settings (encrypted, without API keys) with others via password-protected `.enc` files. Import shared configs without overwriting your own API keys.
- **Streak Tracking** — Complete all 4 tasks for a perfect day; track streaks and weekly stats
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
