import { F } from "./state.js";

// ══════════════════════════════════════════════════════════════════════
//  NOVELKEYS CREAM SOUNDS
// ══════════════════════════════════════════════════════════════════════

const SND_ROOT = `${import.meta.env.BASE_URL}sounds/cream`;
const GENERIC_N = 5;
let genericIdx = 0;

function _audio(path) {
  const a = new Audio(path);
  a.preload = "auto";
  return a;
}

export const SND = {
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
    correct: _audio(`${import.meta.env.BASE_URL}sounds/correct.wav`),
    wrong: _audio(`${import.meta.env.BASE_URL}sounds/beep.wav`),
  },
};

export const _actx = new (window.AudioContext || window.webkitAudioContext)();
const _decodeCache = new Map();
const _decodeInFlight = new Map();
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

export function ensureAudioUnlocked() {
  if (_actx.state === "running") return;
  _actx.resume().catch(() => {});
}

function decodeToCache(audio) {
  if (!audio) return Promise.resolve(null);
  const url = audio.src;
  if (!url) return Promise.resolve(null);
  if (_decodeCache.has(url)) return Promise.resolve(_decodeCache.get(url));
  if (_decodeInFlight.has(url)) return _decodeInFlight.get(url);

  const p = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error("audio fetch failed");
      return r.arrayBuffer();
    })
    .then((buf) => _actx.decodeAudioData(buf))
    .then((decoded) => {
      _decodeCache.set(url, decoded);
      _decodeInFlight.delete(url);
      return decoded;
    })
    .catch(() => {
      _decodeInFlight.delete(url);
      return null;
    });

  _decodeInFlight.set(url, p);
  return p;
}

["pointerdown", "keydown", "touchstart"].forEach((evt) => {
  document.addEventListener(evt, ensureAudioUnlocked, { passive: true });
});

let _prewarmed = false;
function prewarmKeyBuffers() {
  if (_prewarmed) return;
  _prewarmed = true;
  [
    ...SND.press.generic,
    SND.press.space,
    SND.press.enter,
    SND.press.backspace,
    SND.release.generic,
    SND.release.space,
    SND.release.enter,
    SND.release.backspace,
  ].forEach((a) => decodeToCache(a));
}

["pointerdown", "keydown", "touchstart"].forEach((evt) => {
  document.addEventListener(
    evt,
    () => {
      ensureAudioUnlocked();
      prewarmKeyBuffers();
    },
    { once: true, passive: true },
  );
});

export function playWithGain(audio, gain, channel = "keys") {
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

  // First hit should feel instant; decode in background for next hits.
  const c = audio.cloneNode();
  c.volume = Math.min(1, gain);
  c.play().catch(() => {});
  decodeToCache(audio);
}

export function play(audio, gain = 1, channel = "keys") {
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

export function playFeedback(audio, gain = 2.2) {
  if (!audio || !isFxSoundOn()) return;
  _duckKeysUntil = performance.now() + 180;
  ensureAudioUnlocked();

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

export function soundFor(key, phase) {
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
    else if (k === "enter")
      playKey(SND.release.enter, KEY_GAIN.special * duck);
    else if (k === "backspace")
      playKey(SND.release.backspace, KEY_GAIN.special * duck);
    else playKey(SND.release.generic, KEY_GAIN.releaseGeneric * duck);
  }
}

// ── Speech synthesis ──────────────────────────────────────────────────

let _ttsVoices = [];
let _preferredTtsVoice = null;
let _wordVoiceChoice =
  typeof F.wordVoiceChoice === "string" ? F.wordVoiceChoice : "auto";

export function isWordSpeechAvailable() {
  return (
    typeof window.speechSynthesis !== "undefined" &&
    typeof window.SpeechSynthesisUtterance !== "undefined"
  );
}

function voiceOptionId(voice) {
  return (voice && (voice.voiceURI || voice.name)) || "";
}

const FEMALE_HINT_RE =
  /female|woman|susan|victoria|karen|moira|zira|fiona|ava|allison|serena|veena|kathy|kendra|joanna|salli|kimberly|ivy|emma/i;
const MALE_HINT_RE =
  /male|man|mark|guy|james|daniel|george|brian|thomas|matthew|andrew|ryan|richard|alex/i;

function uniqVoices(voices) {
  const dedup = [];
  const seen = new Set();
  (voices || []).forEach((voice) => {
    const id = voiceOptionId(voice);
    if (!id || seen.has(id)) return;
    seen.add(id);
    dedup.push(voice);
  });
  return dedup;
}

function shortVoiceName(voice) {
  return String((voice && voice.name) || "voice")
    .replace(/^Microsoft\s+/i, "")
    .replace(/\s*Desktop\s*-/i, " Desktop ")
    .replace(/\s*\(United States\)\s*/i, "")
    .replace(/\s*-\s*English\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function pickDefaultVoice(voices) {
  if (!voices || voices.length === 0) return null;

  const byNameEq = voices.find(
    (v) => v.name && v.name.toLowerCase() === "zira",
  );
  if (byNameEq) return byNameEq;

  const byNameIncludes = voices.find(
    (v) =>
      v.name &&
      v.name.toLowerCase().includes("zira") &&
      !v.name.toLowerCase().includes("desktop"),
  );
  if (byNameIncludes) return byNameIncludes;

  const byZiraDesktop = voices.find(
    (v) => v.name && v.name.toLowerCase().includes("zira"),
  );
  if (byZiraDesktop) return byZiraDesktop;

  const femaleEn = voices.find(
    (v) => FEMALE_HINT_RE.test(v.name || "") && /en/i.test(v.lang || ""),
  );
  if (femaleEn) return femaleEn;

  const anyEn = voices.find((v) => /en/i.test(v.lang || ""));
  if (anyEn) return anyEn;

  return voices[0] || null;
}

function getFemaleWordVoices(voices) {
  if (!voices || voices.length === 0) return [];
  const dedup = uniqVoices(voices);
  const female = dedup.filter((v) => FEMALE_HINT_RE.test(v.name || ""));
  const femaleEn = female.filter((v) => /en/i.test(v.lang || ""));
  if (femaleEn.length > 0) return femaleEn;
  if (female.length > 0) return female;
  return [];
}

function getMaleWordVoices(voices) {
  if (!voices || voices.length === 0) return [];
  const dedup = uniqVoices(voices);
  const male = dedup.filter((v) => MALE_HINT_RE.test(v.name || ""));
  const maleEn = male.filter((v) => /en/i.test(v.lang || ""));

  const prioritized = (maleEn.length > 0 ? maleEn : male).filter(
    (v) => !/david/i.test(v.name || ""),
  );

  const mark = prioritized.find((v) => /mark/i.test(v.name || ""));
  if (mark) return [mark];

  if (prioritized.length > 0) {
    prioritized.sort((a, b) => {
      const pref = /guy|james|daniel|george|brian|thomas/i;
      const sa = pref.test(a.name || "") ? 1 : 0;
      const sb = pref.test(b.name || "") ? 1 : 0;
      return sb - sa;
    });
    return prioritized.slice(0, 1);
  }

  const fallbackEn = dedup.filter(
    (v) =>
      /en/i.test(v.lang || "") &&
      !/david/i.test(v.name || "") &&
      !FEMALE_HINT_RE.test(v.name || "") &&
      !MALE_HINT_RE.test(v.name || ""),
  );
  return fallbackEn.slice(0, 1);
}

function pickWordVoice(voices, choice) {
  if (!voices || voices.length === 0) return null;
  if (choice && choice !== "auto") {
    const exact = voices.find((v) => voiceOptionId(v) === choice);
    if (exact) return exact;
  }
  return pickDefaultVoice(voices);
}

export function getWordSpeechVoiceOptions() {
  const options = [{ id: "auto", label: "auto" }];
  if (!isWordSpeechAvailable()) return options;

  if (_ttsVoices.length === 0) {
    _ttsVoices = window.speechSynthesis.getVoices() || [];
    _preferredTtsVoice = pickWordVoice(_ttsVoices, _wordVoiceChoice);
  }
  const seen = new Set(["auto"]);

  getFemaleWordVoices(_ttsVoices).forEach((voice) => {
    const id = voiceOptionId(voice);
    if (!id || seen.has(id)) return;
    seen.add(id);
    options.push({ id, label: shortVoiceName(voice) });
  });

  getMaleWordVoices(_ttsVoices).forEach((voice) => {
    const id = voiceOptionId(voice);
    if (!id || seen.has(id)) return;
    seen.add(id);
    options.push({ id, label: shortVoiceName(voice) });
  });

  return options;
}

export function setWordSpeechVoice(choice) {
  _wordVoiceChoice = typeof choice === "string" && choice ? choice : "auto";
  _preferredTtsVoice = pickWordVoice(_ttsVoices, _wordVoiceChoice);
}

export function refreshWordVoices(announce = false) {
  if (!isWordSpeechAvailable()) return;
  _ttsVoices = window.speechSynthesis.getVoices() || [];
  _preferredTtsVoice = pickWordVoice(_ttsVoices, _wordVoiceChoice);
  if (announce) {
    window.dispatchEvent(new CustomEvent("wordvoicesupdated"));
  }
}

export function stopWordSpeech() {
  if (!isWordSpeechAvailable()) return;
  window.speechSynthesis.cancel();
}

export function speakWordText(text) {
  if (!isWordSpeechAvailable() || !F.wordVoice) return;
  const word = String(text || "").trim();
  if (!word) return;

  refreshWordVoices();
  stopWordSpeech();

  const utter = new SpeechSynthesisUtterance(word);
  if (_preferredTtsVoice) {
    utter.voice = _preferredTtsVoice;
    if (_preferredTtsVoice.lang) utter.lang = _preferredTtsVoice.lang;
  } else {
    utter.lang = "en-US";
  }
  utter.rate = 0.98;
  utter.pitch = 1.05;
  utter.volume = 1;
  window.speechSynthesis.speak(utter);
}

export async function testSoundPlayback() {
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

if (isWordSpeechAvailable()) {
  refreshWordVoices(true);
  window.speechSynthesis.addEventListener("voiceschanged", () => {
    refreshWordVoices(true);
  });
}
