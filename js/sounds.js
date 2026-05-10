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
const KEY_GAIN = {
  special: 3.0,
  pressGeneric: 3.6,
  releaseGeneric: 3.2,
};
const KEY_STACK = {
  layers: 2,
  delayMs: 7,
  secondLayerMul: 0.7,
};

function isKeysSoundOn() {
  if (typeof F.soundKeys === "boolean") return F.soundKeys;
  if (typeof F.sound === "boolean") return F.sound;
  return true;
}

function isFxSoundOn() {
  if (typeof F.soundFx === "boolean") return F.soundFx;
  if (typeof F.sound === "boolean") return F.sound;
  return true;
}

function ensureAudioUnlocked() {
  if (_actx.state === "running") return;
  _actx.resume().catch(() => {});
}

["pointerdown", "keydown", "touchstart"].forEach((evt) => {
  document.addEventListener(evt, ensureAudioUnlocked, { passive: true });
});

function playWithGain(audio, gain, channel = "keys") {
  if (!audio) return;
  if (channel === "keys" && !isKeysSoundOn()) return;
  if (channel === "fx" && !isFxSoundOn()) return;
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

function play(audio, gain = 1, channel = "keys") {
  if (!audio) return;
  if (channel === "keys" && !isKeysSoundOn()) return;
  if (channel === "fx" && !isFxSoundOn()) return;
  ensureAudioUnlocked();
  if (gain !== 1) {
    playWithGain(audio, gain, channel);
    return;
  }
  const c = audio.cloneNode();
  c.volume = 1;
  c.play().catch(() => {});
}

function playHtml(audio, volume = 1, channel = "fx") {
  if (!audio) return;
  if (channel === "keys" && !isKeysSoundOn()) return;
  if (channel === "fx" && !isFxSoundOn()) return;
  const c = audio.cloneNode();
  c.volume = Math.max(0, Math.min(1, volume));
  c.play().catch(() => {});
}

function playFeedback(audio, gain = 2.2) {
  if (!audio || !isFxSoundOn()) return;
  _duckKeysUntil = performance.now() + 180;
  ensureAudioUnlocked();

  // Honor gain exactly, including values below 1. For gain > 1, layer clones
  // in 1.0 chunks plus a final remainder to preserve loudness scaling.
  let remaining = Math.max(0, gain);
  if (remaining <= 0) return;
  while (remaining > 0.001) {
    playHtml(audio, Math.min(1, remaining), "fx");
    remaining -= 1;
  }
}

function playKey(audio, gain) {
  if (!isKeysSoundOn()) return;
  playWithGain(audio, gain, "keys");
  if (KEY_STACK.layers > 1) {
    setTimeout(
      () => playWithGain(audio, gain * KEY_STACK.secondLayerMul, "keys"),
      KEY_STACK.delayMs,
    );
  }
}

function soundFor(key, phase) {
  const k = key.toLowerCase();
  const duck = performance.now() < _duckKeysUntil ? 0.35 : 1;
  if (phase === "press") {
    if (k === " ") playKey(SND.press.space, KEY_GAIN.special * duck);
    else if (k === "enter") playKey(SND.press.enter, KEY_GAIN.special * duck);
    else if (k === "backspace")
      playKey(SND.press.backspace, KEY_GAIN.special * duck);
    else {
      playKey(
        SND.press.generic[genericIdx % GENERIC_N],
        KEY_GAIN.pressGeneric * duck,
      );
      genericIdx++;
    }
  } else {
    if (k === " ") playKey(SND.release.space, KEY_GAIN.special * duck);
    else if (k === "enter") playKey(SND.release.enter, KEY_GAIN.special * duck);
    else if (k === "backspace")
      playKey(SND.release.backspace, KEY_GAIN.special * duck);
    else playKey(SND.release.generic, KEY_GAIN.releaseGeneric * duck);
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
