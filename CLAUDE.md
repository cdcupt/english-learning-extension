# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

English Learning Tracker — a Chrome extension (MV3) for daily English practice with 4 tasks: Reading, Write & Speak, Vocabulary, and Listening.

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
- **TTS:** ByteDance OpenSpeech TTS 2.0 (SSE endpoint) or OpenAI TTS; falls back to browser SpeechSynthesis
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
│   └── pages/                      # Dashboard, Reading, ArticleReader, Writing (merged Write & Speak), Vocabulary, Listening, Settings, etc.
├── sidepanel/                      # Side panel mini-dashboard
├── shared/
│   ├── types.ts                    # All TypeScript interfaces
│   ├── storage.ts                  # Chrome storage abstraction
│   ├── constants.ts                # Writing topics
│   ├── crypto.ts                   # AES-256-GCM encrypt/decrypt for config sharing
│   ├── api/nyt.ts                  # NYT article client
│   ├── api/claude.ts               # AI client + TTS + ASR wrappers
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

All 4 practice modules follow a consistent pattern:
- **List view** as default with "Today's Practices" history
- **"Review" button** on completed items to recap results/feedback
- **"Back to list"** navigation from any sub-view
- **"+ Practice More"** button after daily goal is met
- **Persistent storage** — progress survives navigation and page reload

### Module-specific notes:
- **Reading:** Supports two modes via `readingSource` setting: `"nyt_mixed"` (NYT articles + optional AI extras) or `"ai_only"` (all AI-generated, no NYT key needed). Default 2 articles/day.
- **Write & Speak:** Merged writing + speaking in one page (`Writing.tsx`). Flow: write → AI review with corrected article → read corrected article aloud → pronunciation evaluation. Completes both `writing` and `speaking` fields in DailyRecord. Speaking.tsx is unused but kept in codebase.
- **Vocabulary:** 20 AI-generated IELTS words with 4-choice quiz; options are shuffled client-side after AI response
- **Listening:** Sessions persisted to `listening:{date}` storage key; audio URLs are not persisted (regenerated on replay)

## Important Notes

- Listening component is always mounted (uses `visible` prop) to preserve playback state during navigation. Speaking is now part of Writing.tsx.
- Config sharing uses AES-256-GCM encryption (`shared/crypto.ts`); shared configs strip API keys, import preserves local keys.
- ByteDance API calls must go through the service worker (CORS).
- The `_bigtts` voice types require `seed-tts-2.0` resource ID; V1 `BV*_streaming` voices require `seed-tts-1.0`.
- AI prompt responses often include markdown fences — always strip them before JSON.parse.
- Articles older than 30 days are auto-pruned by the service worker alarm.
- AI-generated vocab quiz options are always shuffled post-generation to avoid correct-answer position bias.
