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

  if (e.key === "Escape" && S.started) {
    e.preventDefault();
    endGame();
    return;
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
  if (!S.started && e.key === "Enter") start();
});

$typer.addEventListener("input", () => {
  if (!S.started) return;
  resetIdleTimer();
  const val = $typer.value;
  if (val.endsWith(" ")) {
    $typer.value = "";
    S.typed = val.trimEnd();
    submitWord();
    return;
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

$btnSettings.addEventListener("click", (e) => {
  e.stopPropagation();
  const open = $settingsPanel.classList.toggle("open");
  $btnSettings.classList.toggle("open", open);
});

document.addEventListener("click", () => {
  $settingsPanel.classList.remove("open");
  $btnSettings.classList.remove("open");
});

$settingsPanel.addEventListener("click", (e) => e.stopPropagation());

document.querySelectorAll("#sp-display .spanel-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
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
    document
      .querySelectorAll("#sp-jump .spanel-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    F.jump = btn.dataset.val === "on";
    savePrefs();
  });
});

$btnSound.addEventListener("click", () => {
  F.sound = !F.sound;
  savePrefs();
  $btnSound.textContent = F.sound ? "on" : "off";
  $btnSound.classList.toggle("active", F.sound);
});

$btnTheme.addEventListener("click", () => {
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

  ["row", "len", "timedMode", "display", "jump", "sound", "light"].forEach(
    (k) => {
      if (k in saved) F[k] = saved[k];
    },
  );

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
    $btnSound.textContent = F.sound ? "on" : "off";
    $btnSound.classList.toggle("active", F.sound);
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
$display.style.display = "none";
fetchWordPool();
