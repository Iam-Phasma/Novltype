"use strict";

// ══════════════════════════════════════════════════════════════════════
//  FILTER STATE  (shared mutable object — all modules read/write F)
// ══════════════════════════════════════════════════════════════════════

const F = {
  row: "all", // 'all' | 'top' | 'home' | 'bottom'
  len: "all", // 'all' | 'short' | 'medium' | 'long'
  timedMode: "off", // 'off' | '1min'
  display: "word", // 'word' | 'paragraph' | 'rise'
  jump: false, // auto-advance on complete without space
  soundKeys: true,
  soundFx: true,
  wordVoice: false,
  wordVoiceChoice: "auto",
  light: false,
};

function isMacLikePlatform() {
  const platform =
    navigator.userAgentData?.platform || navigator.platform || "";
  const ua = navigator.userAgent || "";
  return /mac|iphone|ipad|ipod/i.test(`${platform} ${ua}`);
}

const START_KEY_LABEL = isMacLikePlatform() ? "return" : "enter";

// ══════════════════════════════════════════════════════════════════════
//  GAME STATE
// ══════════════════════════════════════════════════════════════════════

const S = {
  started: false,
  ended: false,
  startTime: null,
  timerID: null,
  timedEnd: null,
  timedDurationMs: 0,
  timerArmed: false,
  timerArmedAt: null,
  readyDots: 5,
  readyBlinkTick: 0,
  readyBlinkActive: false,
  currentWord: "",
  typed: "",
  wordsDone: 0,
  correct: 0,
  wrong: 0,
  typedChars: 0,
  correctChars: 0,
};

// ══════════════════════════════════════════════════════════════════════
//  CONTEXT BUFFER  (paragraph / rise display modes)
// ══════════════════════════════════════════════════════════════════════

const CTX_SIZE = 60;
const PARA_SIZE = 30;

function getParaSize() {
  return F.len === "long" ? 30 : PARA_SIZE;
}

let CTX = { buf: [], cur: 0, paraStart: 0 };

function fillCtx() {
  while (CTX.buf.length - CTX.cur < CTX_SIZE) {
    CTX.buf.push({ text: nextWord(), typed: "", ok: true });
  }
  if (F.display !== "paragraph" && CTX.cur > 5) {
    CTX.buf.splice(0, CTX.cur - 5);
    CTX.cur = 5;
  }
}

function resetCtx() {
  CTX.buf = [];
  CTX.cur = 0;
  CTX.paraStart = 0;
}

function ensureParaBuf() {
  while (CTX.buf.length < CTX.paraStart + getParaSize()) {
    CTX.buf.push({ text: nextWord(), typed: "", ok: true });
  }
}
