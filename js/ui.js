"use strict";

// ══════════════════════════════════════════════════════════════════════
//  DOM ELEMENTS
// ══════════════════════════════════════════════════════════════════════

const $display = document.getElementById("word-display");
const $hint = document.getElementById("hint");
const $typer = document.getElementById("typer");
const $wpm = document.getElementById("stat-wpm");
const $acc = document.getElementById("stat-acc");
const $time = document.getElementById("stat-time");
const $words = document.getElementById("stat-words");
const $btnSound = document.getElementById("btn-sound");
const $btnSoundFx = document.getElementById("btn-sound-fx");
const $btnSoundTest = document.getElementById("btn-sound-test");
const $btnVoice = document.getElementById("btn-voice");
const $selVoice = document.getElementById("sel-voice");
const $btnTheme = document.getElementById("btn-theme");
const $btnSettings = document.getElementById("btn-settings");
const $settingsPanel = document.getElementById("settings-panel");
const $escHint = document.getElementById("esc-hint");
const $bgOrbs = document.getElementById("bg-orbs");
const $tip = document.getElementById("tip");

// ── Idle timer ────────────────────────────────────────────────────────

let _idleTimer = null;

function resetIdleTimer() {
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

// ══════════════════════════════════════════════════════════════════════
//  KEYBOARD INPUT
// ══════════════════════════════════════════════════════════════════════

const IGNORE_KEYS = ["Shift", "Control", "Alt", "Meta", "CapsLock", "Tab"];

document.addEventListener("keydown", (e) => {
  if (IGNORE_KEYS.includes(e.key)) return;
  if (!e.repeat) soundFor(e.key, "press");

  if (e.key === "Escape") {
    if (S.started) {
      e.preventDefault();
      endGame();
      return;
    }
    if (S.ended) {
      e.preventDefault();
      reset();
      return;
    }
  }

  if (!S.started) {
    if (e.key === "Enter" && !e.repeat) {
      e.preventDefault();
      const enterEl = $hint.querySelector(".hint-key");
      if (enterEl) {
        enterEl.classList.remove("pressed");
        void enterEl.offsetWidth;
        enterEl.classList.add("pressed");
      }
    }
    return;
  }
});

document.addEventListener("keyup", (e) => {
  if (IGNORE_KEYS.includes(e.key)) return;
  soundFor(e.key, "release");
  if (!S.started && e.key === "Enter") {
    closeSettingsPanel();
    start();
  }
});

$typer.addEventListener("input", () => {
  if (!S.started) return;
  resetIdleTimer();
  const val = $typer.value;
  if (S.timerArmed && val.length > 0) startTimedCountdownIfArmed();
  if (val.endsWith(" ")) {
    $typer.value = "";
    S.typed = val.trimEnd();
    submitWord();
    return;
  }
  const prevTyped = S.typed;
  if (val.length > prevTyped.length && val.startsWith(prevTyped)) {
    const idx = val.length - 1;
    const typedChar = val[idx];
    const expectedChar = S.currentWord[idx] || "";
    if (typedChar !== expectedChar) {
      playFeedback(SND.feedback.wrong, 2.4);
    }
  }
  S.typed = val;
  renderWord();
  if (F.jump && val.length >= S.currentWord.length) {
    $typer.value = "";
    submitWord();
  }
});

$typer.addEventListener("keydown", (e) => {
  if (!S.started) return;
  if (e.key === "Enter") {
    e.preventDefault();
    if (F.jump) {
      $typer.value = "";
      skipWord();
      return;
    }
    S.typed = $typer.value.trimEnd();
    $typer.value = "";
    submitWord();
  }
});

document.addEventListener("click", () => {
  if (S.started) $typer.focus();
});

$hint.addEventListener("click", (e) => {
  if (e.target.classList.contains("hint-key") && !S.started) start();
});

// ══════════════════════════════════════════════════════════════════════
//  TOOLBAR & SETTINGS BINDINGS
// ══════════════════════════════════════════════════════════════════════

// Generic hover-dropdown binder.
// prefix: the "Keys" / "Length" / "Time" label shown before the pipe.
// onApply(val): called after state is set, for any extra side-effects.
function bindDropdown(groupId, stateKey, prefix, onApply) {
  const $trigger = document
    .getElementById(groupId)
    .querySelector(".tool-trigger");

  function apply(val) {
    F[stateKey] = val;
    document
      .querySelectorAll(`#${groupId} .tool-opt`)
      .forEach((b) => b.classList.toggle("active", b.dataset.val === val));
    const chosen = document.querySelector(
      `#${groupId} .tool-opt[data-val="${val}"]`,
    );
    $trigger.textContent = `${prefix} | ${chosen ? chosen.textContent.trim() : val}`;
    if (onApply) onApply(val);
  }

  document.querySelectorAll(`#${groupId} .tool-opt`).forEach((btn) => {
    btn.addEventListener("click", () => {
      if (S.started) return;
      apply(btn.dataset.val);
      btn.blur();
    });
  });

  return apply; // expose so loadPrefs can call it
}

const applyRow = bindDropdown("tg-row", "row", "Keys", (val) => {
  savePrefs();
  rebuildQueue();
  if (S.started) loadNextWord();
});
const applyLen = bindDropdown("tg-len", "len", "Length", (val) => {
  savePrefs();
  rebuildQueue();
  if (S.started) loadNextWord();
});
const applyTime = bindDropdown("tg-time", "timedMode", "Time", (val) => {
  savePrefs();
  if (S.started || S.ended) reset();
});

// Keep alias used by existing loadPrefs call
function applyTimedMode(val) {
  applyTime(val);
}

function closeSettingsPanel() {
  $settingsPanel.classList.remove("open");
  $btnSettings.classList.remove("open");
}

function refreshVoiceSelector() {
  if (!$selVoice) return;

  const speechAvailable =
    typeof isWordSpeechAvailable === "function" && isWordSpeechAvailable();

  if (!speechAvailable) {
    $selVoice.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "auto";
    opt.textContent = "speech unavailable";
    $selVoice.appendChild(opt);
    $selVoice.value = "auto";
    $selVoice.disabled = true;
    F.wordVoiceChoice = "auto";
    if (typeof setWordSpeechVoice === "function") setWordSpeechVoice("auto");
    return;
  }

  let options = [{ id: "auto", label: "auto (samantha first)" }];
  if (typeof getWordSpeechVoiceOptions === "function") {
    const fetched = getWordSpeechVoiceOptions();
    if (Array.isArray(fetched) && fetched.length > 0) {
      options = fetched;
    }
  }

  $selVoice.innerHTML = "";
  const seen = new Set();
  options.forEach((entry) => {
    if (!entry || !entry.id || seen.has(entry.id)) return;
    seen.add(entry.id);
    const opt = document.createElement("option");
    opt.value = entry.id;
    opt.textContent = entry.label || entry.id;
    $selVoice.appendChild(opt);
  });

  const selected =
    typeof F.wordVoiceChoice === "string" && seen.has(F.wordVoiceChoice)
      ? F.wordVoiceChoice
      : "auto";
  F.wordVoiceChoice = selected;
  $selVoice.value = selected;
  $selVoice.disabled = false;
  if (typeof setWordSpeechVoice === "function") setWordSpeechVoice(selected);
}

$btnSettings.addEventListener("click", (e) => {
  if (S.started) return;
  e.stopPropagation();
  const open = $settingsPanel.classList.toggle("open");
  $btnSettings.classList.toggle("open", open);
});

document.addEventListener("click", () => {
  closeSettingsPanel();
});

$settingsPanel.addEventListener("click", (e) => e.stopPropagation());

document.querySelectorAll("#sp-display .spanel-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (S.started) return;
    document
      .querySelectorAll("#sp-display .spanel-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    F.display = btn.dataset.val;
    savePrefs();
    if (S.started || S.ended) reset();
    closeSettingsPanel();
  });
});

document.querySelectorAll("#sp-jump .spanel-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (S.started) return;
    document
      .querySelectorAll("#sp-jump .spanel-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    F.jump = btn.dataset.val === "on";
    savePrefs();
    closeSettingsPanel();
  });
});

$btnSound.addEventListener("click", () => {
  if (S.started) return;
  F.soundKeys = !F.soundKeys;
  savePrefs();
  $btnSound.textContent = F.soundKeys ? "on" : "off";
  $btnSound.classList.toggle("active", F.soundKeys);
  if (F.soundKeys) play(SND.press.enter, 1.4);
  closeSettingsPanel();
});

if ($btnSoundFx) {
  $btnSoundFx.addEventListener("click", () => {
    if (S.started) return;
    F.soundFx = !F.soundFx;
    savePrefs();
    $btnSoundFx.textContent = F.soundFx ? "on" : "off";
    $btnSoundFx.classList.toggle("active", F.soundFx);
    if (F.soundFx) playFeedback(SND.feedback.correct, 0.6);
    closeSettingsPanel();
  });
}

if ($btnVoice) {
  $btnVoice.addEventListener("click", () => {
    if (S.started) return;
    if (
      typeof isWordSpeechAvailable === "function" &&
      !isWordSpeechAvailable()
    ) {
      showQuickTip($btnVoice, "speech synthesis unavailable", 2000);
      return;
    }
    F.wordVoice = !F.wordVoice;
    savePrefs();
    $btnVoice.textContent = F.wordVoice ? "on" : "off";
    $btnVoice.classList.toggle("active", F.wordVoice);
    if (F.wordVoice && typeof setWordSpeechVoice === "function") {
      setWordSpeechVoice(F.wordVoiceChoice || "auto");
    }
    if (F.wordVoice && S.started && typeof speakWordText === "function") {
      speakWordText(S.currentWord);
    }
    if (!F.wordVoice && typeof stopWordSpeech === "function") {
      stopWordSpeech();
    }
    closeSettingsPanel();
  });
}

if ($selVoice) {
  $selVoice.addEventListener("change", () => {
    if (S.started) return;
    if (
      typeof isWordSpeechAvailable === "function" &&
      !isWordSpeechAvailable()
    ) {
      showQuickTip($selVoice, "speech synthesis unavailable", 2000);
      return;
    }
    F.wordVoiceChoice = $selVoice.value || "auto";
    if (typeof setWordSpeechVoice === "function") {
      setWordSpeechVoice(F.wordVoiceChoice);
    }
    savePrefs();
    if (F.wordVoice && S.started && typeof speakWordText === "function") {
      speakWordText(S.currentWord);
    }
    closeSettingsPanel();
  });
}

function showQuickTip(target, text, ms = 1800) {
  const r = target.getBoundingClientRect();
  $tip.textContent = text;
  const tw = $tip.offsetWidth;
  let left = r.left + r.width / 2 - tw / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
  const top = r.top - $tip.offsetHeight - 8;
  $tip.style.left = left + "px";
  $tip.style.top = (top < 8 ? r.bottom + 8 : top) + "px";
  $tip.classList.add("visible");
  setTimeout(() => $tip.classList.remove("visible"), ms);
}

if ($btnSoundTest) {
  $btnSoundTest.addEventListener("click", async () => {
    if (S.started) return;
    if (!F.soundFx) {
      showQuickTip($btnSoundTest, "effects are off", 1600);
      return;
    }
    const testFn = window.testSoundPlayback;
    if (typeof testFn !== "function") {
      showQuickTip($btnSoundTest, "sound test unavailable", 2200);
      return;
    }
    const res = await testFn();
    if (res.ok) {
      showQuickTip($btnSoundTest, "sound ok", 1300);
      return;
    }
    showQuickTip(
      $btnSoundTest,
      "blocked/muted: unmute tab and allow site audio",
      3200,
    );
  });
}

$btnTheme.addEventListener("click", () => {
  if (S.started) return;
  F.light = !F.light;
  savePrefs();
  document.body.classList.toggle("light", F.light);
  $btnTheme.textContent = F.light ? "dark" : "light";
  $btnTheme.classList.toggle("active", F.light);
  closeSettingsPanel();
});

// ══════════════════════════════════════════════════════════════════════
//  PREFERENCES PERSISTENCE
// ══════════════════════════════════════════════════════════════════════

const PREF_KEY = "novltype_prefs";

function savePrefs() {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(F));
  } catch (_) {}
}

function loadPrefs() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(PREF_KEY));
  } catch (_) {}
  if (!saved) return;

  ["row", "len", "timedMode", "display", "jump", "light"].forEach((k) => {
    if (k in saved) F[k] = saved[k];
  });

  // Backward compatibility: migrate legacy unified sound preference.
  if ("soundKeys" in saved) F.soundKeys = saved.soundKeys;
  if ("soundFx" in saved) F.soundFx = saved.soundFx;
  if (!("soundKeys" in saved) && !("soundFx" in saved) && "sound" in saved) {
    F.soundKeys = saved.sound;
    F.soundFx = saved.sound;
  }

  if ("wordVoice" in saved) F.wordVoice = saved.wordVoice;
  if ("wordVoiceChoice" in saved) F.wordVoiceChoice = saved.wordVoiceChoice;

  ["tg-row", "tg-len"].forEach((id) => {
    const key = id === "tg-row" ? "row" : "len";
    const apply = id === "tg-row" ? applyRow : applyLen;
    apply(F[key]);
  });

  applyTimedMode(F.timedMode);

  document.querySelectorAll("#sp-display .spanel-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.val === F.display);
  });

  document.querySelectorAll("#sp-jump .spanel-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.val === (F.jump ? "on" : "type"));
  });

  if ($btnSound) {
    $btnSound.textContent = F.soundKeys ? "on" : "off";
    $btnSound.classList.toggle("active", F.soundKeys);
  }

  if ($btnSoundFx) {
    $btnSoundFx.textContent = F.soundFx ? "on" : "off";
    $btnSoundFx.classList.toggle("active", F.soundFx);
  }

  if ($btnVoice) {
    $btnVoice.textContent = F.wordVoice ? "on" : "off";
    $btnVoice.classList.toggle("active", F.wordVoice);
  }

  document.body.classList.toggle("light", F.light);
  if ($btnTheme) {
    $btnTheme.textContent = F.light ? "dark" : "light";
    $btnTheme.classList.toggle("active", F.light);
  }
}

// ══════════════════════════════════════════════════════════════════════
//  TOOLTIP
// ══════════════════════════════════════════════════════════════════════

let _tipTimer = null;

document.addEventListener("mouseover", (e) => {
  const target = e.target.closest("[data-tip]");
  if (!target) return;
  clearTimeout(_tipTimer);
  $tip.textContent = target.dataset.tip;
  _tipTimer = setTimeout(() => {
    const r = target.getBoundingClientRect();
    const tw = $tip.offsetWidth;
    let left = r.left + r.width / 2 - tw / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
    const top = r.top - $tip.offsetHeight - 8;
    $tip.style.left = left + "px";
    $tip.style.top = (top < 8 ? r.bottom + 8 : top) + "px";
    $tip.classList.add("visible");
  }, 400);
});

document.addEventListener("mouseout", (e) => {
  const target = e.target.closest("[data-tip]");
  if (!target) return;
  clearTimeout(_tipTimer);
  $tip.classList.remove("visible");
});

// ══════════════════════════════════════════════════════════════════════
//  BOOT
// ══════════════════════════════════════════════════════════════════════

loadPrefs();
refreshVoiceSelector();
window.addEventListener("wordvoicesupdated", refreshVoiceSelector);
const $initialHintKey = $hint.querySelector(".hint-key");
if ($initialHintKey && typeof START_KEY_LABEL === "string") {
  $initialHintKey.textContent = START_KEY_LABEL;
}
$display.style.display = "none";
fetchWordPool();
