# English Learning Tracker

A Chrome extension that helps you build a daily English learning habit with four practice modules, progress tracking, and AI-powered feedback.

## Features

### Daily Learning Modules

- **Reading** — Fetches articles from the New York Times API. Highlight unfamiliar words or phrases to get instant AI explanations, then save them to your vocabulary list.
- **Writing** — Get a random topic, write a short essay, and submit it for AI review. Receive a score (0–100), grammar corrections, style suggestions, and an overall comment.
- **Vocabulary** — Review saved words, quiz yourself with flashcards, and check in after completing phone-based practice.
- **Speaking** — Check in after completing speaking practice on your phone.

### Tracking & Motivation

- Dashboard with daily task completion status
- Streak tracking (current + longest)
- Weekly summary with progress bars, words learned, and average writing scores
- Toolbar badge showing remaining tasks (or "✓" when all done)
- Pause toggle to temporarily disable the extension

## Tech Stack

- React 19 + TypeScript + Tailwind CSS 4
- Vite + @crxjs/vite-plugin (Manifest V3)
- Claude API (word explanations + writing review)
- NYT Article Search API
- Chrome Storage API (all data stored locally)

## Setup

### Prerequisites

- Node.js 18+
- A [NYT API key](https://developer.nytimes.com/)
- An [Anthropic API key](https://console.anthropic.com/)

### Install & Build

```bash
git clone https://github.com/cdcupt/eng_learn_plugin.git
cd eng_learn_plugin
npm install
npm run build
```

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `dist/` folder

### Configure

1. Click the extension icon in the toolbar
2. Click **Open Dashboard**
3. Go to **Settings**
4. Enter your NYT API key and Claude API key
5. Start learning!

## Development

```bash
npm run dev    # Start dev server with HMR
npm run build  # Production build
```

## Project Structure

```
src/
├── background/       # Service worker (alarms, badge updates)
├── newtab/           # Full-page dashboard app
│   ├── pages/        # Dashboard, Reading, Writing, Vocabulary, etc.
│   ├── components/   # TaskCard, CheckInButton, Navigation
│   └── hooks/        # useStorage, useDailyTasks
├── popup/            # Toolbar popup (task status + pause toggle)
├── sidepanel/        # Side panel (quick status + check-in)
└── shared/           # Types, storage, API clients, utilities
    ├── api/          # NYT and Claude API clients
    └── utils/        # Date helpers, scoring/streak logic
```

## License

MIT
