"use strict";

// ══════════════════════════════════════════════════════════════════════
//  NOVELKEYS CREAM SOUNDS
// ══════════════════════════════════════════════════════════════════════

const SND_ROOT = "sounds/cream";
const GENERIC_N = 5;
let genericIdx = 0;

function _audio(path) {
  const a = new Audio(path);
  a.preload = "auto";
  return a;
}

const SND = {
  press: {
    generic: Array.from({ length: GENERIC_N }, (_, i) =>
      _audio(`${SND_ROOT}/press/GENERIC_R${i}.mp3`),
    ),
    space: _audio(`${SND_ROOT}/press/SPACE.mp3`),
    enter: _audio(`${SND_ROOT}/press/ENTER.mp3`),
    backspace: _audio(`${SND_ROOT}/press/BACKSPACE.mp3`),
  },
  release: {
    generic: _audio(`${SND_ROOT}/release/GENERIC.mp3`),
    space: _audio(`${SND_ROOT}/release/SPACE.mp3`),
    enter: _audio(`${SND_ROOT}/release/ENTER.mp3`),
    backspace: _audio(`${SND_ROOT}/release/BACKSPACE.mp3`),
  },
  feedback: {
    correct: _audio("sounds/correct.wav"),
    wrong: _audio("sounds/beep.wav"),
  },
};

const _actx = new (window.AudioContext || window.webkitAudioContext)();
const _decodeCache = new Map();
let _duckKeysUntil = 0;

function ensureAudioUnlocked() {
  if (_actx.state === "running") return;
  _actx.resume().catch(() => {});
}

["pointerdown", "keydown", "touchstart"].forEach((evt) => {
  document.addEventListener(evt, ensureAudioUnlocked, { passive: true });
});

function playWithGain(audio, gain) {
  if (!audio || !F.sound) return;
  if (_actx.state !== "running") {
    ensureAudioUnlocked();
    const c = audio.cloneNode();
    c.volume = Math.min(1, gain);
    c.play().catch(() => {});
    return;
  }
  const url = audio.src;
  const doPlay = (decoded) => {
    const src = _actx.createBufferSource();
    src.buffer = decoded;
    const g = _actx.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(_actx.destination);
    src.start();
  };
  if (_decodeCache.has(url)) {
    doPlay(_decodeCache.get(url));
    return;
  }
  fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error("audio fetch failed");
      return r.arrayBuffer();
    })
    .then((buf) => _actx.decodeAudioData(buf))
    .then((decoded) => {
      _decodeCache.set(url, decoded);
      doPlay(decoded);
    })
    .catch(() => {
      const c = audio.cloneNode();
      c.volume = Math.min(1, gain);
      c.play().catch(() => {});
    });
}

function play(audio, gain = 1) {
  if (!audio || !F.sound) return;
  ensureAudioUnlocked();
  if (gain !== 1) {
    playWithGain(audio, gain);
    return;
  }
  const c = audio.cloneNode();
  c.volume = 1;
  c.play().catch(() => {});
}

function playFeedback(audio, gain = 2.2) {
  if (!audio || !F.sound) return;
  _duckKeysUntil = performance.now() + 140;
  setTimeout(() => playWithGain(audio, gain), 24);
}

function soundFor(key, phase) {
  const k = key.toLowerCase();
  const duck = performance.now() < _duckKeysUntil ? 0.35 : 1;
  if (phase === "press") {
    if (k === " ") playWithGain(SND.press.space, duck);
    else if (k === "enter") playWithGain(SND.press.enter, duck);
    else if (k === "backspace") playWithGain(SND.press.backspace, duck);
    else {
      play(SND.press.generic[genericIdx % GENERIC_N], 1.6 * duck);
      genericIdx++;
    }
  } else {
    if (k === " ") playWithGain(SND.release.space, duck);
    else if (k === "enter") playWithGain(SND.release.enter, duck);
    else if (k === "backspace") playWithGain(SND.release.backspace, duck);
    else play(SND.release.generic, 1.6 * duck);
  }
}

async function testSoundPlayback() {
  ensureAudioUnlocked();
  const probe = SND.feedback.wrong.cloneNode();
  probe.volume = 1;
  try {
    await probe.play();
    return { ok: true, state: _actx.state };
  } catch (err) {
    return {
      ok: false,
      state: _actx.state,
      error: err && err.message ? err.message : String(err),
    };
  }
}

window.testSoundPlayback = testSoundPlayback;
