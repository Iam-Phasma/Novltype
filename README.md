# Novltype

Novltype is a minimal, keyboard-first typing trainer focused on clean visuals, responsive input, and mechanical-style key audio.

Vercel: https://novltype.vercel.app/ \
Pages: https://iam-phasma.github.io/Novltype/

## Deployment

### Vercel

- This project is Vercel-ready by default.
- Import the repository in Vercel and deploy with default settings.
- Build command: `npm run build`
- Output directory: `dist`

### GitHub Pages (optional)

- The app uses `BASE_PATH` to control the Vite base URL.
- Vercel should use the default `/` base (no extra config required).
- For GitHub Pages under `/Novltype/`, build with:

```bash
BASE_PATH=/Novltype/ npm run build
```

## Features

- Three display modes: single word, scrolling paragraph, and rise mode
- Practice filters by keyboard row and word length
- Timed sessions: free, 30s, 1m, 2m, 3m, 5m
- Jump mode and strict key mode
- Live metrics for time, WPM, accuracy, and words
- Theme toggle with system preference support
- Key press and release sounds with low-latency warmup
- Progressive Web App support with install prompt capability

## Credits

- Word pool source: google-10000-english-no-swears
    - https://github.com/first20hours/google-10000-english-no-swears
- Audio inspiration: tplai/kbsim
    - https://github.com/tplai/kbsim
- Feedback sound reference: RealKai42/qwerty-learner
    - https://github.com/RealKai42/qwerty-learner

## License

MIT
