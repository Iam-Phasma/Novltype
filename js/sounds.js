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
};

const _actx = new (window.AudioContext || window.webkitAudioContext)();
const _decodeCache = new Map();

function playWithGain(audio, gain) {
  if (!audio || !F.sound) return;
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
    .then((r) => r.arrayBuffer())
    .then((buf) => _actx.decodeAudioData(buf))
    .then((decoded) => {
      _decodeCache.set(url, decoded);
      doPlay(decoded);
    })
    .catch(() => {});
}

function play(audio, gain = 1) {
  if (!audio || !F.sound) return;
  if (gain !== 1) {
    playWithGain(audio, gain);
    return;
  }
  const c = audio.cloneNode();
  c.volume = 1;
  c.play().catch(() => {});
}

function soundFor(key, phase) {
  const k = key.toLowerCase();
  if (phase === "press") {
    if (k === " ") play(SND.press.space);
    else if (k === "enter") play(SND.press.enter);
    else if (k === "backspace") play(SND.press.backspace);
    else {
      play(SND.press.generic[genericIdx % GENERIC_N], 1.6);
      genericIdx++;
    }
  } else {
    if (k === " ") play(SND.release.space);
    else if (k === "enter") play(SND.release.enter);
    else if (k === "backspace") play(SND.release.backspace);
    else play(SND.release.generic, 1.6);
  }
}
