---
name: eng-learn-extension
description: Quick context loader for the English Learning Tracker Chrome extension project at codes/github.com/english-learning-extension/
user-invocable: true
---

# English Learning Tracker — Chrome Extension

A Chrome/Chromium browser extension that helps users build consistent English learning habits through 5 daily practice tasks: Reading, Writing, Vocabulary, Speaking, and Listening.

## Tech Stack

- **Frontend:** React 19 + TypeScript
- **Styling:** Tailwind CSS v4
- **Build:** Vite + CRX plugin (Chrome extension bundling)
- **Storage:** `chrome.storage.local` (no IndexedDB or localStorage)
- **AI Providers:** Multi-provider support (Kimi/Moonshot, OpenAI, Claude, DeepSeek, Gemini) for content generation, writing review, and word explanation
- **TTS:** OpenAI TTS API for HD listening audio (falls back to browser SpeechSynthesis)

## Project Location

`/Users/erik/codes/github.com/english-learning-extension/`

## Source Structure

```
src/
├── background/service-worker.ts     # Extension lifecycle, badge, context menu, alarms
├── content/explain.ts               # Content script for word explanation popup
├── newtab/                          # Main dashboard (new tab page)
│   ├── main.tsx, App.tsx            # Entry point & router
│   ├── components/
│   │   ├── Navigation.tsx           # Left sidebar nav
│   │   ├── TaskCard.tsx             # Daily task cards
│   │   └── CheckInButton.tsx        # Simple check-in UI
│   ├── hooks/
│   │   ├── useDailyTasks.ts         # Load/update today's record + streak sync
│   │   └── useStorage.ts            # Generic Chrome storage hook
│   └── pages/
│       ├── Dashboard.tsx            # Home: streak, 5 task cards, week calendar
│       ├── Reading.tsx              # NYT article list
│       ├── ArticleReader.tsx        # Full article view + quiz
│       ├── Writing.tsx              # Writing prompt + AI feedback
│       ├── Vocabulary.tsx           # Word list, quiz, check-in
│       ├── Speaking.tsx             # Speaking check-in only
│       ├── Listening.tsx            # IELTS-style listening practice with HD audio + quiz
│       ├── PracticesHistory.tsx     # Historical view by date
│       ├── WeeklySummary.tsx        # Weekly stats & charts
│       └── Settings.tsx             # API keys, TTS voice, preferences, data export
├── sidepanel/
│   ├── SidePanel.tsx                # Mini dashboard in side panel
│   └── main.tsx, index.html
└── shared/
    ├── types.ts                     # All TypeScript interfaces
    ├── storage.ts                   # Chrome storage abstraction (get/set/remove)
    ├── constants.ts                 # 103 writing topics
    ├── api/nyt.ts                   # NYT article search client
    ├── api/claude.ts                # Multi-provider AI client + OpenAI TTS
    └── utils/
        ├── date.ts                  # Date key formatting, calculations
        └── scoring.ts              # Streak calculation & task completion logic
```

## Key Data Models (in `shared/types.ts`)

- **DailyRecord** — stored as `day:{YYYY-MM-DD}`: tracks completion of 5 tasks (reading, writing, vocabulary, speaking, listening) per day
- **Article** — NYT article with `readAt` timestamp
- **VocabularyEntry** — word, sentence, explanation, reviewCount, mastered flag
- **WritingEntry** — topic, content, wordCount, AI feedback (score, grammar, style, suggestions)
- **ListeningPractice** — title, scenario, passage, questions (5 quiz questions per practice)
- **StreakData** — current streak, longest streak, lastPerfectDate
- **Settings** — API keys (NYT, AI provider, TTS), TTS voice, dailyArticleCount, dailyListeningCount, installedDate

## Storage Keys

| Key | Value |
|-----|-------|
| `settings` | Settings object |
| `day:{YYYY-MM-DD}` | DailyRecord |
| `articles:{YYYY-MM-DD}` | Cached daily articles |
| `vocab` | VocabularyEntry[] |
| `writingIndex` | WritingIndexItem[] (metadata) |
| `writing:{ID}` | Full WritingEntry |
| `streak` | StreakData |

## Daily Task Flow

1. **Reading** — Fetch 1-5 NYT articles, read and take AI-generated comprehension quiz
2. **Writing** — Random topic from 103 prompts, write 10+ words, submit for AI review (grammar, style, score)
3. **Vocabulary** — Add words via context menu or manually; quiz mode with flashcards; check-in to complete
4. **Speaking** — Practice externally, click check-in button to mark complete
5. **Listening** — AI-generated IELTS-style passage, played via OpenAI TTS (HD audio) or browser speech, then 5-question comprehension quiz; 1-5 practices per day (configurable)
6. **Streak** — All 5 tasks complete = perfect day; consecutive perfect days = streak

## Extension Features

- **Manifest V3** with permissions: storage, unlimitedStorage, alarms, contextMenus, scripting, activeTab, sidePanel
- **Multi-provider AI:** Supports Kimi, OpenAI, Claude, DeepSeek, Gemini — configurable in Settings
- **HD Listening Audio:** OpenAI TTS API with 6 voice options (alloy, echo, fable, onyx, nova, shimmer) and 3 playback speeds; warns if TTS key not configured
- **Context menu:** Right-click selected text → "Explain..." → floating draggable popup with AI explanation → "Add to Vocabulary"
- **Badge:** Shows remaining task count (red) or checkmark (green) when all done
- **Side panel:** Quick task status, check-in buttons, recent words
- **Practices history:** Browse daily records by date
- **Weekly summary:** Completion rates, perfect days, words learned, avg writing score
- **Data export:** Download all data as JSON from Settings

## Build Commands

```bash
cd /Users/erik/codes/github.com/english-learning-extension
npm run dev      # Dev server with HMR
npm run build    # Production build to dist/
```
