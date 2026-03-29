# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

English Learning Tracker — a Chrome extension (MV3) for daily English practice with 5 tasks: Reading, Writing, Vocabulary, Speaking, and Listening.

## Build & Dev Commands

```bash
npm run dev      # Dev server with HMR
npm run build    # Production build (tsc + vite) → dist/
```

Load in Chrome: `chrome://extensions/` → Developer mode → Load unpacked → select `dist/`

## Architecture

- **Frontend:** React 19 + TypeScript + Tailwind CSS v4
- **Build:** Vite + @crxjs/vite-plugin (MV3 Chrome extension bundling)
- **Storage:** `chrome.storage.local` only (no IndexedDB/localStorage)
- **AI:** Multi-provider (Kimi, OpenAI, Claude, DeepSeek, Gemini) via `shared/api/claude.ts`
- **TTS:** ByteDance OpenSpeech TTS 2.0 (SSE endpoint, recommended) or OpenAI TTS; falls back to browser SpeechSynthesis
- **ASR:** Web Speech API (browser built-in); ByteDance streaming ASR requires WebSocket with custom headers which browsers cannot do

## Source Structure

```
src/
├── background/service-worker.ts    # Lifecycle, badge, alarms, context menu, ByteDance TTS proxy, ByteDance ASR stub
├── content/explain.ts              # Content script for word explanation popup
├── newtab/                         # Main dashboard (new tab override)
│   ├── main.tsx, App.tsx
│   ├── components/                 # Navigation, TaskCard, CheckInButton
│   ├── hooks/                      # useDailyTasks, useStorage
│   └── pages/                      # Dashboard, Reading, ArticleReader, Writing, Vocabulary, Speaking, Listening, Settings, etc.
├── sidepanel/                      # Side panel mini-dashboard
├── shared/
│   ├── types.ts                    # All TypeScript interfaces
│   ├── storage.ts                  # Chrome storage abstraction
│   ├── constants.ts                # Writing topics
│   ├── api/nyt.ts                  # NYT article client
│   ├── api/claude.ts               # AI client + TTS + ASR wrappers
│   ├── crypto.ts                   # AES-GCM encryption (Web Crypto API)
│   ├── configExport.ts             # Config export/import with sensitive field stripping
│   └── utils/                      # Date, scoring helpers
└── assets/                         # Extension icons
```

## Key APIs & Services

### ByteDance TTS 2.0 (豆包语音合成模型2.0)
- **Endpoint:** `POST https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse`
- **Auth:** `X-Api-App-Key`, `X-Api-Access-Key` headers
- **Resource ID:** `seed-tts-2.0`
- **Default voice:** `en_female_dacey_uranus_bigtts`
- **Response:** Server-Sent Events with base64 audio in `event: 352` data
- **Proxy:** Routed through service worker for CORS bypass

### ByteDance ASR (NOT USED — browser limitation)
- The streaming ASR (`wss://openspeech.bytedance.com/api/v3/sauc/bigmodel`) requires custom headers on WebSocket handshake, which browser WebSocket API cannot do.
- Speaking practice uses **Web Speech API** instead.

### AI Providers
- All AI calls go through `callAI()` in `shared/api/claude.ts`
- Supports: Kimi/Moonshot, OpenAI, Claude (Anthropic), DeepSeek, Gemini
- JSON responses from AI should be cleaned of markdown fences before parsing

## Storage Keys

| Key | Value |
|-----|-------|
| `settings` | Settings object |
| `day:{YYYY-MM-DD}` | DailyRecord (5 task completion states) |
| `articles:{YYYY-MM-DD}` | Cached daily articles |
| `vocab` | VocabularyEntry[] |
| `writingIndex` | WritingIndexItem[] |
| `writing:{ID}` | Full WritingEntry |
| `speaking:{YYYY-MM-DD}` | SpeakingDayData (prompts + results) |
| `listening:{YYYY-MM-DD}` | ListeningDayData (sessions with quiz answers) |
| `vocabquiz:{YYYY-MM-DD}` | VocabQuizDayData (20 IELTS words + answers) |
| `streak` | StreakData |

## Practice Module Patterns

All 5 practice modules follow a consistent pattern:
- **List view** as default with "Today's Practices" history
- **"Review" button** on completed items to recap results/feedback
- **"Back to list"** navigation from any sub-view
- **"+ Practice More"** button after daily goal is met
- **Persistent storage** — progress survives navigation and page reload

### Module-specific notes:
- **Reading:** 2 NYT articles by default; extra articles are AI-generated (marked with "AI Generated" badge)
- **Vocabulary:** 20 AI-generated IELTS words with 4-choice quiz; options are shuffled client-side after AI response
- **Speaking:** Counts unique prompts only (retries don't inflate completion count); averages best score per prompt
- **Listening:** Sessions persisted to `listening:{date}` storage key; audio URLs are not persisted (regenerated on replay)
- **Writing:** History loaded from `writingIndex` + individual `writing:{id}` entries

## Config Sharing

Settings can be exported/imported via the Settings page with two modes:
- **Share** — encrypted (AES-256-GCM), sensitive fields (API keys/tokens) stripped. File extension: `.elc`
- **Backup** — encrypted, all fields included. File extension: `.elc`

Encryption uses Web Crypto API (PBKDF2 → AES-GCM), no external dependencies. Logic lives in `shared/crypto.ts` and `shared/configExport.ts`.

## Important Notes

- Speaking and Listening components are always mounted (use `visible` prop) to preserve recording/playback state during navigation.
- ByteDance API calls must go through the service worker (CORS).
- The `_bigtts` voice types require `seed-tts-2.0` resource ID; V1 `BV*_streaming` voices require `seed-tts-1.0`.
- AI prompt responses often include markdown fences — always strip them before JSON.parse.
- Articles older than 30 days are auto-pruned by the service worker alarm.
- AI-generated vocab quiz options are always shuffled post-generation to avoid correct-answer position bias.
