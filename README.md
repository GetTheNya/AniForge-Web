# AniForge Web

<p align="center">
  <img src="public/AppIcon.png" alt="AniForge Web App Icon" width="300" />
</p>

<p align="center">
  <a href="./README.md">🇬🇧 English</a> &nbsp;|&nbsp; <a href="./README.uk.md">🇺🇦 Українська</a>
</p>

<p align="center">
  <a href="https://aniforge.pages.dev"><strong>🌐 Try AniForge Web</strong></a>
</p>

**AniForge Web** is the browser companion to the [AniForge Android app](https://github.com/GetTheNya/AniForge) — the same offline-first anime catalog, now running entirely in your browser. Live version is available at [aniforge.pages.dev](https://aniforge.pages.dev).

No installs. No extensions. Just open the page and start browsing 22,000+ anime entries instantly.

---

## What can you do with it?

### 🔍 Search & filter the full catalog
Explore every anime entry with powerful filtering — by genre, tag, studio, format, airing status, source material, score range, and episode count. Sort results by score, popularity, year, title, or relevance.

### 📋 Track your anime
Sign in with Google to manage your watchlists — **Watching**, **Completed**, **Planning**, **On Hold**, and **Dropped**. Update episode progress, set personal scores, and write private notes.

### 📁 Custom collections
Create your own curated anime compilations — group titles however you want and manage them from the Library page.

### 🖼️ Rich anime detail pages
Each anime has a full detail view with cover art, synopsis, trailers, screenshots, episode info, genres, tags, studio credits, staff, franchise timelines, and related works.

### 🌳 Follow franchises and timelines
See prequels, sequels, spin-offs, and alternative versions mapped out in a franchise timeline — never miss a related entry.

### 🌐 Bilingual interface
Full English and Ukrainian localization, with an option to prefer Ukrainian anime titles from the catalog database.

### 📱 Mobile-aware
Mobile visitors are greeted with a landing page to download the native Android app, with a QR code and a one-tap skip to continue using the web version.

---

## How it works

AniForge Web runs a real **SQLite database inside your browser** via WebAssembly. On first visit, the catalog is streamed and decompressed in-browser — after that, it boots instantly from the Cache API. Background version checks keep the catalog fresh with atomic A/B slot swaps, just like the Android app.

User tracking data (watchlists, scores, collections) is synchronized via **Supabase** with Google authentication, while the catalog itself is fully offline.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Bundler | Vite 8 |
| Styling | Tailwind CSS 4 |
| Database | sql.js (SQLite compiled to WASM) |
| User data | Dexie (IndexedDB) + Supabase |
| Auth | Supabase Google OAuth |
| i18n | i18next + browser language detection |
| Linting | Oxlint |

---

## Getting started

```bash
# Clone the repo
git clone https://github.com/GetTheNya/AniForge-Web.git
cd AniForge-Web

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Build for production

```bash
npm run build
npm run preview
```

---

## Project structure

```
src/
├── components/        # UI components (AnimeCard, FilterPanel, Layout, etc.)
├── context/           # React contexts (Auth, Database, Settings, Tracking, etc.)
├── hooks/             # Custom hooks (useAnimeSearch, useAnimeDetail, etc.)
├── services/          # SQLite WASM engine, Supabase client, query builder
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
├── i18n.ts            # Internationalization config (EN + UK)
├── App.tsx            # Root application component
├── main.tsx           # Entry point
└── index.css          # Global styles & design tokens
```

---

## 🌐 Languages

AniForge Web supports the following languages:

- 🇺🇦 Ukrainian
- 🇬🇧 English

---

## 🙏 Thanks to

AniForge Web wouldn't be possible without these awesome projects:

- [**AniList**](https://anilist.co) — the main source of anime information, metadata, and catalog data
- [**Hikka**](https://hikka.io) — Ukrainian anime titles and translations
- [**TMDB** (The Movie Database)](https://www.themoviedb.org) — anime screenshots and imagery

---

## Related

- 🤖 [**AniForge** (Android)](https://github.com/GetTheNya/AniForge) — the native Android app

---

## License

MIT License — see [LICENSE](./LICENSE) for details.  
Copyright © 2026 GetTheNya
