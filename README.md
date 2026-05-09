# Novltype.

A minimal, keyboard-first typing trainer built with vanilla HTML, CSS, and JavaScript. No frameworks, no build step.

---

## Features

- **Three display modes** — single word, scrolling paragraph, or rising words
- **Keyboard row practice** — filter words to top, home, or bottom rows
- **Word length filter** — short (3–4), medium (5–7), or long (8–14 letters)
- **Timed mode** — 60-second sprint with live WPM countdown
- **Jump mode** — auto-advances the moment you finish typing a word
- **Live stats** — time, WPM, accuracy, and word count updated in real time
- **NovelKeys Cream sounds** — satisfying mechanical click on every keystroke via Web Audio API
- **Google 10 000 word pool** — fetched async at load; falls back to a local list offline
- **Persistent preferences** — all settings saved to `localStorage`
- **Dark / light theme** — defaults to system preference, manually toggleable
- **Tooltips** — hover any control for a short description
- **Desktop only** — a graceful overlay blocks the app on small screens

---

## Getting Started

No install required. Just serve the folder over HTTP (browsers block audio autoplay on `file://`).

```bash
# Python 3
python3 -m http.server 8787
```

Then open `http://localhost:8787` in your browser.

---

## How to Play

| Key | Action |
|-----|--------|
| `Enter` | Start / restart |
| `Space` | Submit word (type mode) |
| `Esc` | End session and see results |

Words are scored per character. WPM is calculated from actual elapsed time.

---

## Project Structure

```
Novltype/
├── index.html      # App shell and markup
├── styles.css      # All styles (dark/light themes, animations)
├── script.js       # Game logic, audio, settings, word pool
└── sounds/
    └── cream/
        ├── press/  # Key-down audio samples
        └── release/# Key-up audio samples
```

---

## Tech

- **Fonts** — JetBrains Mono + Inter via Google Fonts
- **Audio** — Web Audio API with gain boosting; `HTMLAudioElement.cloneNode()` for special keys
- **Word list** — [google-10000-english-no-swears](https://github.com/first20hours/google-10000-english) filtered to `[a-z]{3,14}`
- **Storage** — `localStorage` key `novltype_prefs`

---

## License

MIT
