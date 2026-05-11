import {
  F,
  S,
  CTX,
  START_KEY_LABEL,
  getParaSize,
  fillCtx,
  resetCtx,
  ensureParaBuf,
} from "./state.js";
import { nextWord, rebuildQueue } from "./words.js";
import { clearWrongPops, renderWord, setAnimateRise } from "./render.js";
import { speakWordText, stopWordSpeech, playFeedback, SND } from "./sounds.js";
import {
  $display,
  $hint,
  $typer,
  $escHint,
  $bgOrbs,
  $time,
  $wpm,
  $acc,
  $words,
  $app,
  $statsBar,
} from "./dom.ts";

// ══════════════════════════════════════════════════════════════════════
//  STATS
// ══════════════════════════════════════════════════════════════════════

export function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const READY_TOTAL_DOTS = 5;
const READY_STEP_MS = 1000;
const READY_BLINK_MS = 320;
let _readyStepTimer = null;
let _readyBlinkTimer = null;
let _resultPromptTimer = null;
let _resultPromptIdx = 0;

// Idle timer (lives here so start() can call resetIdleTimer directly)
let _idleTimer = null;

export function resetIdleTimer() {
  clearTimeout(_idleTimer);
  $escHint.classList.remove("flash");
  _idleTimer = setTimeout(() => {
    if (S.started) {
      $escHint.classList.remove("flash");
      void $escHint.offsetWidth;
      $escHint.classList.add("flash");
    }
  }, 5000);
}

export function setStatsBarVisible(visible) {
  if (!$statsBar) return;
  $statsBar.classList.toggle("hidden", !visible);
}

export function setPrestartLayout(enabled) {
  if (!$app) return;
  $app.classList.toggle("prestart", !!enabled);
}

const RESULT_PROMPTS = [
  [
    { text: "press" },
    { text: START_KEY_LABEL, key: true },
    { text: "to" },
    { text: "play" },
    { text: "again" },
  ],
  [
    { text: "press" },
    { text: "esc", key: true },
    { text: "to" },
    { text: "quit" },
    { text: "game" },
  ],
];

export function stopResultPromptCycle() {
  clearInterval(_resultPromptTimer);
  _resultPromptTimer = null;
}

function renderResultPrompt() {
  const $action = document.getElementById("hint-action-text");
  if (!$action) return;
  const tokens = RESULT_PROMPTS[_resultPromptIdx] || [];
  $action.innerHTML = tokens
    .map((t, i) => {
      if (t.key) {
        return `<span class="hint-word hint-word-key" style="--widx:${i}"><span class="hint-key">${t.text}</span></span>`;
      }
      return `<span class="hint-word" style="--widx:${i}">${t.text}</span>`;
    })
    .join("");
  $action.classList.remove("hint-sub-anim-live");
  void $action.offsetWidth;
  $action.classList.add("hint-sub-anim-live");
}

export function startResultPromptCycle() {
  stopResultPromptCycle();
  _resultPromptIdx = 0;
  renderResultPrompt();
  _resultPromptTimer = setInterval(() => {
    _resultPromptIdx = (_resultPromptIdx + 1) % RESULT_PROMPTS.length;
    renderResultPrompt();
  }, 3000);
}

export function clearReadySequenceTimers() {
  clearTimeout(_readyStepTimer);
  clearTimeout(_readyBlinkTimer);
  _readyStepTimer = null;
  _readyBlinkTimer = null;
}

export function runReadySequenceStep() {
  if (!S.started || !S.timerArmed) return;

  S.readyBlinkTick++;
  S.readyBlinkActive = true;
  renderWord();

  _readyBlinkTimer = setTimeout(() => {
    if (!S.started || !S.timerArmed) return;

    S.readyBlinkActive = false;
    S.readyDots = Math.max(0, S.readyDots - 1);
    renderWord();

    if (S.readyDots <= 0) {
      startTimedCountdownIfArmed();
      return;
    }

    _readyStepTimer = setTimeout(
      runReadySequenceStep,
      READY_STEP_MS - READY_BLINK_MS,
    );
  }, READY_BLINK_MS);
}

export function updateStats() {
  if (!S.started) return;
  const now = performance.now();
  const elapsed = S.startTime === null ? 0 : now - S.startTime;
  const mins = elapsed / 60000;

  if (S.timerArmed && S.timedDurationMs > 0) {
    $time.textContent = fmtTime(S.timedDurationMs);
    $time.classList.remove("live");
  } else if (S.timedEnd !== null) {
    const remaining = S.timedEnd - now;
    if (remaining <= 0) {
      endGame();
      return;
    }
    $time.textContent = fmtTime(remaining);
    $time.classList.add("live");
  } else {
    $time.textContent = fmtTime(elapsed);
  }

  $words.textContent = S.wordsDone;

  if (S.typedChars > 0) {
    const wpm = Math.max(0, S.correctChars / 5 / (mins || 0.0001));
    $wpm.textContent = Math.round(wpm);
    $acc.textContent =
      Math.round((S.correctChars / S.typedChars) * 100) + "%";
    [$wpm, $acc, $time, $words].forEach((el) => el.classList.add("live"));
  }
}

// ══════════════════════════════════════════════════════════════════════
//  TOOLBAR LOCK
// ══════════════════════════════════════════════════════════════════════

const LOCKABLE_SPANEL = ["sp-display", "sp-jump", "sp-strict"];

export function lockToolbar() {
  document
    .getElementById("tg-row")
    .closest("nav")
    .classList.add("toolbar-locked");
  const settingsBtn = document.getElementById("btn-settings");
  const settingsPanel = document.getElementById("settings-panel");
  if (settingsPanel) settingsPanel.classList.remove("open");
  if (settingsBtn) {
    settingsBtn.classList.remove("open");
    settingsBtn.classList.add("settings-locked");
  }
  LOCKABLE_SPANEL.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.closest(".spanel-row").classList.add("spanel-locked");
  });
}

export function unlockToolbar() {
  document
    .getElementById("tg-row")
    .closest("nav")
    .classList.remove("toolbar-locked");
  const settingsBtn = document.getElementById("btn-settings");
  if (settingsBtn) settingsBtn.classList.remove("settings-locked");
  LOCKABLE_SPANEL.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.closest(".spanel-row").classList.remove("spanel-locked");
  });
}

// ══════════════════════════════════════════════════════════════════════
//  GAME FLOW
// ══════════════════════════════════════════════════════════════════════

export function loadNextWord() {
  clearWrongPops();
  if (F.display === "paragraph") {
    ensureParaBuf();
    S.currentWord = CTX.buf[CTX.cur].text;
  } else if (F.display !== "word") {
    fillCtx();
    S.currentWord = CTX.buf[CTX.cur].text;
  } else {
    S.currentWord = nextWord();
  }
  S.typed = "";
  $typer.value = "";
  renderWord();
  speakWordText(S.currentWord);
}

export function reset() {
  clearInterval(S.timerID);
  clearReadySequenceTimers();
  stopResultPromptCycle();
  clearWrongPops();
  stopWordSpeech();
  setPrestartLayout(true);
  setStatsBarVisible(false);
  Object.assign(S, {
    started: false,
    ended: false,
    startTime: null,
    timerID: null,
    timedEnd: null,
    timedDurationMs: 0,
    timerArmed: false,
    timerArmedAt: null,
    readyDots: READY_TOTAL_DOTS,
    readyBlinkTick: 0,
    readyBlinkActive: false,
    currentWord: "",
    typed: "",
    wordsDone: 0,
    correct: 0,
    wrong: 0,
    typedChars: 0,
    correctChars: 0,
  });
  $typer.value = "";
  $display.innerHTML = "";
  $display.className = "word-display";
  $display.style.display = "none";
  resetCtx();
  [$wpm, $acc, $time, $words].forEach((el) => {
    el.textContent = "—";
    el.classList.remove("live");
  });
  $time.textContent = "0:00";
  $words.textContent = "0";
  clearTimeout(_idleTimer);
  $escHint.classList.remove("visible", "flash");
  unlockToolbar();
  $bgOrbs.classList.remove("hide");
  $hint.innerHTML = `press <span class="hint-key">${START_KEY_LABEL}</span> to start`;
  $hint.classList.remove("hidden");
}

export function endGame() {
  clearInterval(S.timerID);
  clearReadySequenceTimers();
  stopResultPromptCycle();
  clearWrongPops();
  stopWordSpeech();
  setPrestartLayout(false);
  setStatsBarVisible(true);
  S.started = false;
  S.ended = true;
  S.timedEnd = null;
  S.timerArmed = false;
  S.timedDurationMs = 0;
  S.timerArmedAt = null;
  S.readyDots = READY_TOTAL_DOTS;
  S.readyBlinkTick = 0;
  S.readyBlinkActive = false;
  clearTimeout(_idleTimer);
  $escHint.classList.remove("visible", "flash");
  unlockToolbar();
  $bgOrbs.classList.remove("hide");
  $typer.blur();
  $display.innerHTML = "";
  $display.className = "word-display";
  $display.style.display = "none";

  const elapsed = S.startTime === null ? 0 : performance.now() - S.startTime;
  const mins = elapsed / 60000;
  const wpm =
    S.correctChars > 0
      ? Math.round(Math.max(0, S.correctChars / 5 / (mins || 0.0001)))
      : 0;
  const acc =
    S.typedChars > 0 ? Math.round((S.correctChars / S.typedChars) * 100) : 0;
  $hint.innerHTML =
    `<span class="hint-stat">${wpm} wpm</span>` +
    `<span class="hint-sep">/</span>` +
    `<span class="hint-stat">${acc}%</span>` +
    '<br><span class="hint-sub hint-sub-cycle"><span id="hint-action-text" class="hint-sub-anim"></span></span>';
  $hint.classList.remove("hidden");
  startResultPromptCycle();
}

export function start() {
  if (S.started) return;
  stopResultPromptCycle();
  setPrestartLayout(false);
  $hint.classList.add("exiting");
  setTimeout(() => {
    $hint.classList.remove("exiting");
    if (S.ended) reset();
    setPrestartLayout(false);
    S.started = true;
    const DURATIONS = {
      "30s": 30000,
      "1min": 60000,
      "2min": 120000,
      "3min": 180000,
      "5min": 300000,
    };
    const duration = DURATIONS[F.timedMode] || 0;
    S.timedDurationMs = duration;
    S.timerArmed = duration > 0;
    if (S.timerArmed) {
      S.startTime = null;
      S.timedEnd = null;
      S.timerArmedAt = performance.now();
      S.readyDots = READY_TOTAL_DOTS;
      S.readyBlinkTick = 0;
      S.readyBlinkActive = false;
      clearReadySequenceTimers();
      _readyStepTimer = setTimeout(
        runReadySequenceStep,
        READY_STEP_MS - READY_BLINK_MS,
      );
      $time.textContent = fmtTime(duration);
      $time.classList.remove("live");
    } else {
      S.startTime = performance.now();
      S.timedEnd = null;
      S.timerArmedAt = null;
      S.readyDots = READY_TOTAL_DOTS;
      S.readyBlinkTick = 0;
      S.readyBlinkActive = false;
      clearReadySequenceTimers();
    }
    S.timerID = setInterval(updateStats, 200);
    setStatsBarVisible(true);
    lockToolbar();
    $bgOrbs.classList.add("hide");
    resetCtx();
    $hint.classList.add("hidden");
    $display.style.display = "";
    $escHint.classList.add("visible");
    resetIdleTimer();
    $typer.focus();
    loadNextWord();
  }, 280);
}

export function startTimedCountdownIfArmed() {
  if (!S.started || !S.timerArmed || S.timedDurationMs <= 0) return;
  clearReadySequenceTimers();
  const now = performance.now();
  S.timerArmed = false;
  S.startTime = now;
  S.timedEnd = now + S.timedDurationMs;
  S.timerArmedAt = null;
  S.readyDots = READY_TOTAL_DOTS;
  S.readyBlinkTick = 0;
  S.readyBlinkActive = false;
  $time.classList.add("live");
  renderWord();
}

export function skipWord() {
  if (!S.started) return;
  if (F.display !== "word") {
    CTX.buf[CTX.cur].typed = "";
    CTX.buf[CTX.cur].ok = true;
    CTX.cur++;
  }
  if (F.display === "rise") setAnimateRise(true);
  if (F.display === "paragraph" && CTX.cur >= CTX.paraStart + getParaSize()) {
    CTX.paraStart = CTX.cur;
    ensureParaBuf();
  }
  S.typed = "";
  $typer.value = "";
  loadNextWord();
}

export function submitWord() {
  if (!S.started || S.typed.trim() === "") return;
  const correct = S.typed === S.currentWord;
  const typedWord = S.typed;
  const targetWord = S.currentWord;
  const overlap = Math.min(typedWord.length, targetWord.length);
  let correctCharsThisWord = 0;
  for (let i = 0; i < overlap; i++) {
    if (typedWord[i] === targetWord[i]) correctCharsThisWord++;
  }
  S.typedChars += typedWord.length;
  S.correctChars += correctCharsThisWord;
  if (correct) {
    S.correct++;
    playFeedback(SND.feedback.correct, 0.5);
  } else {
    S.wrong++;
  }
  S.wordsDone++;
  if (F.display !== "word") {
    CTX.buf[CTX.cur].typed = S.typed;
    CTX.buf[CTX.cur].ok = correct;
    CTX.cur++;
  }
  if (F.display === "rise") setAnimateRise(true);
  if (F.display === "paragraph" && CTX.cur >= CTX.paraStart + getParaSize()) {
    CTX.paraStart = CTX.cur;
    ensureParaBuf();
  }
  updateStats();
  loadNextWord();
}
