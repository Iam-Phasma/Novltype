import { F, S, START_KEY_LABEL } from "./state.js";
import {
  $display,
  $hint,
  $typer,
  $wpm,
  $acc,
  $time,
  $words,
  $btnSound,
  $btnSoundFx,
  $btnSoundTest,
  $btnStrictKey,
  $btnVoice,
  $selVoice,
  $btnTheme,
  $btnSettings,
  $settingsPanel,
  $escHint,
  $bgOrbs,
  $tip,
} from "./dom.ts";
import {
  start,
  endGame,
  reset,
  loadNextWord,
  resetIdleTimer,
  startTimedCountdownIfArmed,
  submitWord,
  skipWord,
} from "./game.js";
import {
  soundFor,
  SND,
  play,
  playFeedback,
  isWordSpeechAvailable,
  getWordSpeechVoiceOptions,
  setWordSpeechVoice,
  speakWordText,
  stopWordSpeech,
  testSoundPlayback,
} from "./sounds.js";
import { renderWord, registerWrongPop } from "./render.js";
import { fetchWordPool, rebuildQueue } from "./words.js";

// ══════════════════════════════════════════════════════════════════════
//  DOM ELEMENTS (local)
// ══════════════════════════════════════════════════════════════════════

let _resultEscTimer = null;

function resetFromResultWithAnimation() {
  if (!S.ended) {
    reset();
    return;
  }
  if ($hint.classList.contains("exiting")) return;
  $hint.classList.add("exiting");
  clearTimeout(_resultEscTimer);
  _resultEscTimer = setTimeout(() => {
    $hint.classList.remove("exiting");
    if (S.ended) reset();
    _resultEscTimer = null;
  }, 280);
}

// ══════════════════════════════════════════════════════════════════════
//  KEYBOARD INPUT
// ══════════════════════════════════════════════════════════════════════

const IGNORE_KEYS = ["Shift", "Control", "Alt", "Meta", "CapsLock", "Tab"];

document.addEventListener("keydown", (e) => {
  if (IGNORE_KEYS.includes(e.key)) return;
  if (!e.repeat) soundFor(e.key, "press");

  if (e.key === "Escape") {
    if (e.repeat) {
      e.preventDefault();
      return;
    }
    if (S.started) {
      e.preventDefault();
      endGame();
      return;
    }
    if (S.ended) {
      e.preventDefault();
      resetFromResultWithAnimation();
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

function sanitizeStrictTyped(rawVal, targetWord) {
  let accepted = "";
  let mismatchIndex = -1;
  let mismatchChar = "";
  const limit = Math.min(rawVal.length, targetWord.length);

  for (let i = 0; i < limit; i++) {
    if (rawVal[i] !== targetWord[i]) {
      mismatchIndex = i;
      mismatchChar = rawVal[i];
      break;
    }
    accepted += rawVal[i];
  }

  if (mismatchIndex < 0 && rawVal.length > targetWord.length) {
    mismatchIndex = targetWord.length;
    mismatchChar = rawVal[targetWord.length] || "";
  }

  if (mismatchIndex < 0 && rawVal.length <= targetWord.length) {
    accepted = rawVal;
  }

  return { typed: accepted, mismatchIndex, mismatchChar };
}

$typer.addEventListener("input", () => {
  if (!S.started) return;
  resetIdleTimer();
  const rawVal = $typer.value;
  if (S.timerArmed && rawVal.length > 0) startTimedCountdownIfArmed();
  const wantsSubmit = rawVal.endsWith(" ");
  const prevTyped = S.typed;
  let nextTyped = rawVal;

  if (F.strictKey) {
    const baseVal = wantsSubmit ? rawVal.trimEnd() : rawVal;
    const strictResult = sanitizeStrictTyped(baseVal, S.currentWord);
    nextTyped = strictResult.typed;

    if (strictResult.mismatchChar) {
      if (
        strictResult.mismatchIndex >= 0 &&
        strictResult.mismatchIndex < S.currentWord.length
      ) {
        registerWrongPop(strictResult.mismatchIndex, strictResult.mismatchChar);
      }
      playFeedback(SND.feedback.wrong, 2.4);
    }

    if (wantsSubmit) {
      if (nextTyped === S.currentWord) {
        $typer.value = "";
        S.typed = nextTyped;
        submitWord();
        return;
      }
      $typer.value = nextTyped;
      S.typed = nextTyped;
      renderWord();
      return;
    }

    if (nextTyped !== rawVal) $typer.value = nextTyped;
  } else {
    if (wantsSubmit) {
      $typer.value = "";
      S.typed = rawVal.trimEnd();
      submitWord();
      return;
    }

    if (rawVal.length > prevTyped.length && rawVal.startsWith(prevTyped)) {
      const idx = rawVal.length - 1;
      const typedChar = rawVal[idx];
      const expectedChar = S.currentWord[idx] || "";
      if (typedChar !== expectedChar) {
        if (idx < S.currentWord.length) {
          registerWrongPop(idx, typedChar);
        }
        playFeedback(SND.feedback.wrong, 2.4);
      }
    }
  }

  S.typed = nextTyped;
  renderWord();
  if (F.jump && nextTyped.length >= S.currentWord.length) {
    $typer.value = "";
    submitWord();
  }
});

$typer.addEventListener("keydown", (e) => {
  if (!S.started) return;

  if (
    e.repeat &&
    (e.key.length === 1 ||
      e.key === "Backspace" ||
      e.key === " " ||
      e.key === "Enter")
  ) {
    e.preventDefault();
    return;
  }

  if (e.key === "Enter") {
    e.preventDefault();
    const typedNow = $typer.value.trimEnd();
    if (F.jump) {
      if (F.strictKey) {
        if (typedNow !== S.currentWord) return;
        S.typed = typedNow;
        $typer.value = "";
        submitWord();
        return;
      }
      if (typedNow.length === 0) return;
      $typer.value = "";
      skipWord();
      return;
    }

    if (F.strictKey && typedNow !== S.currentWord) {
      S.typed = typedNow;
      $typer.value = typedNow;
      renderWord();
      return;
    }

    S.typed = typedNow;
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

  return apply;
}

const applyRow = bindDropdown("tg-row", "row", "Keys", () => {
  savePrefs();
  rebuildQueue();
  if (S.started) loadNextWord();
});
const applyLen = bindDropdown("tg-len", "len", "Length", () => {
  savePrefs();
  rebuildQueue();
  if (S.started) loadNextWord();
});
const applyTime = bindDropdown("tg-time", "timedMode", "Time", () => {
  savePrefs();
  if (S.started || S.ended) reset();
});

function applyTimedMode(val) {
  applyTime(val);
}

function closeSettingsPanel() {
  $settingsPanel.classList.remove("open");
  $btnSettings.classList.remove("open");
}

const SETTINGS_CLOSE_DISTANCE_PX = 150;

function isPointerFarFromSettings(clientX, clientY) {
  const panelRect = $settingsPanel.getBoundingClientRect();
  const btnRect = $btnSettings.getBoundingClientRect();

  const minX = Math.min(panelRect.left, btnRect.left);
  const maxX = Math.max(panelRect.right, btnRect.right);
  const minY = Math.min(panelRect.top, btnRect.top);
  const maxY = Math.max(panelRect.bottom, btnRect.bottom);

  const dx =
    clientX < minX ? minX - clientX : clientX > maxX ? clientX - maxX : 0;
  const dy =
    clientY < minY ? minY - clientY : clientY > maxY ? clientY - maxY : 0;
  return Math.hypot(dx, dy) > SETTINGS_CLOSE_DISTANCE_PX;
}

function refreshVoiceSelector() {
  if (!$selVoice) return;

  const speechAvailable = isWordSpeechAvailable();

  if (!speechAvailable) {
    $selVoice.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "auto";
    opt.textContent = "speech unavailable";
    $selVoice.appendChild(opt);
    $selVoice.value = "auto";
    $selVoice.disabled = true;
    F.wordVoiceChoice = "auto";
    setWordSpeechVoice("auto");
    return;
  }

  let options = [{ id: "auto", label: "auto" }];
  const fetched = getWordSpeechVoiceOptions();
  if (Array.isArray(fetched) && fetched.length > 0) {
    options = fetched;
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

  let selected =
    typeof F.wordVoiceChoice === "string" && seen.has(F.wordVoiceChoice)
      ? F.wordVoiceChoice
      : "auto";

  if (selected === "auto" && F.wordVoiceChoice === "zira") {
    const ziraPrimary = options.find(
      (entry) =>
        entry &&
        entry.id &&
        entry.id !== "auto" &&
        /^zira/i.test((entry.label || "").trim()) &&
        !/desktop/i.test(entry.label || ""),
    );
    const ziraAny = options.find(
      (entry) =>
        entry &&
        entry.id &&
        entry.id !== "auto" &&
        /^zira/i.test((entry.label || "").trim()),
    );
    selected = (ziraPrimary || ziraAny || { id: "auto" }).id;
  }

  F.wordVoiceChoice = selected;
  $selVoice.value = selected;
  $selVoice.disabled = false;
  setWordSpeechVoice(selected);
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

document.addEventListener("mousemove", (e) => {
  if (!$settingsPanel.classList.contains("open")) return;
  if (isPointerFarFromSettings(e.clientX, e.clientY)) closeSettingsPanel();
});

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
  });
});

if ($btnStrictKey) {
  $btnStrictKey.addEventListener("click", () => {
    if (S.started) return;
    F.strictKey = !F.strictKey;
    savePrefs();
    $btnStrictKey.textContent = F.strictKey ? "on" : "off";
    $btnStrictKey.classList.toggle("active", F.strictKey);
  });
}

$btnSound.addEventListener("click", () => {
  if (S.started) return;
  F.soundKeys = !F.soundKeys;
  savePrefs();
  $btnSound.textContent = F.soundKeys ? "on" : "off";
  $btnSound.classList.toggle("active", F.soundKeys);
  if (F.soundKeys) play(SND.press.enter, 1.4);
});

if ($btnSoundFx) {
  $btnSoundFx.addEventListener("click", () => {
    if (S.started) return;
    F.soundFx = !F.soundFx;
    savePrefs();
    $btnSoundFx.textContent = F.soundFx ? "on" : "off";
    $btnSoundFx.classList.toggle("active", F.soundFx);
    if (F.soundFx) playFeedback(SND.feedback.correct, 0.6);
  });
}

if ($btnVoice) {
  $btnVoice.addEventListener("click", () => {
    if (S.started) return;
    if (!isWordSpeechAvailable()) {
      showQuickTip($btnVoice, "speech synthesis unavailable", 2000);
      return;
    }
    F.wordVoice = !F.wordVoice;
    savePrefs();
    $btnVoice.textContent = F.wordVoice ? "on" : "off";
    $btnVoice.classList.toggle("active", F.wordVoice);
    if (F.wordVoice) {
      setWordSpeechVoice(F.wordVoiceChoice || "auto");
    }
    if (F.wordVoice && S.started) {
      speakWordText(S.currentWord);
    }
    if (!F.wordVoice) {
      stopWordSpeech();
    }
  });
}

if ($selVoice) {
  $selVoice.addEventListener("change", () => {
    if (S.started) return;
    if (!isWordSpeechAvailable()) {
      showQuickTip($selVoice, "speech synthesis unavailable", 2000);
      return;
    }
    F.wordVoiceChoice = $selVoice.value || "auto";
    setWordSpeechVoice(F.wordVoiceChoice);
    savePrefs();
    if (F.wordVoice && S.started) {
      speakWordText(S.currentWord);
    }
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
    const res = await testSoundPlayback();
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

  ["row", "len", "timedMode", "display", "jump", "strictKey", "light"].forEach(
    (k) => {
      if (k in saved) F[k] = saved[k];
    },
  );

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

  if ($btnStrictKey) {
    $btnStrictKey.textContent = F.strictKey ? "on" : "off";
    $btnStrictKey.classList.toggle("active", F.strictKey);
  }

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
