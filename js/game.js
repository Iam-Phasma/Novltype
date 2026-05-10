"use strict";

// ══════════════════════════════════════════════════════════════════════
//  STATS
// ══════════════════════════════════════════════════════════════════════

function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function updateStats() {
  if (!S.started) return;
  const elapsed = performance.now() - S.startTime;
  const mins = elapsed / 60000;

  if (S.timedEnd !== null) {
    const remaining = S.timedEnd - performance.now();
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

  if (S.wordsDone > 0) {
    $wpm.textContent = Math.round(S.wordsDone / (mins || 0.0001));
    const total = S.correct + S.wrong;
    $acc.textContent = total
      ? Math.round((S.correct / total) * 100) + "%"
      : "—";
    [$wpm, $acc, $time, $words].forEach((el) => el.classList.add("live"));
  }
}

// ══════════════════════════════════════════════════════════════════════
//  TOOLBAR LOCK
// ══════════════════════════════════════════════════════════════════════

const LOCKABLE = ["tg-row", "tg-len", "tg-time"];
const LOCKABLE_SPANEL = ["sp-display", "sp-jump"];

function lockToolbar() {
  document
    .getElementById("tg-row")
    .closest("nav")
    .classList.add("toolbar-locked");
  LOCKABLE_SPANEL.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.closest(".spanel-row").classList.add("spanel-locked");
  });
}

function unlockToolbar() {
  document
    .getElementById("tg-row")
    .closest("nav")
    .classList.remove("toolbar-locked");
  LOCKABLE_SPANEL.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.closest(".spanel-row").classList.remove("spanel-locked");
  });
}

// ══════════════════════════════════════════════════════════════════════
//  GAME FLOW
// ══════════════════════════════════════════════════════════════════════

function loadNextWord() {
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
}

function reset() {
  clearInterval(S.timerID);
  Object.assign(S, {
    started: false,
    ended: false,
    startTime: null,
    timerID: null,
    timedEnd: null,
    currentWord: "",
    typed: "",
    wordsDone: 0,
    correct: 0,
    wrong: 0,
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
  $hint.innerHTML = 'press <span class="hint-key">enter</span> to start';
  $hint.classList.remove("hidden");
}

function endGame() {
  clearInterval(S.timerID);
  S.started = false;
  S.ended = true;
  S.timedEnd = null;
  clearTimeout(_idleTimer);
  $escHint.classList.remove("visible", "flash");
  unlockToolbar();
  $bgOrbs.classList.remove("hide");
  $typer.blur();
  $display.innerHTML = "";
  $display.className = "word-display";
  $display.style.display = "none";

  const elapsed = performance.now() - S.startTime;
  const mins = elapsed / 60000;
  const wpm = S.wordsDone > 0 ? Math.round(S.wordsDone / (mins || 0.0001)) : 0;
  const total = S.correct + S.wrong;
  const acc = total ? Math.round((S.correct / total) * 100) : 0;
  $hint.innerHTML =
    `<span class="hint-stat">${wpm} wpm</span>` +
    `<span class="hint-sep">/</span>` +
    `<span class="hint-stat">${acc}%</span>` +
    `<br><span class="hint-sub">press <span class="hint-key">enter</span> to play again</span>`;
  $hint.classList.remove("hidden");
}

function start() {
  if (S.started) return;
  $hint.classList.add("exiting");
  setTimeout(() => {
    $hint.classList.remove("exiting");
    if (S.ended) reset();
    S.started = true;
    S.startTime = performance.now();
    const DURATIONS = {
      "30s": 30000,
      "1min": 60000,
      "2min": 120000,
      "3min": 180000,
      "5min": 300000,
    };
    S.timedEnd = DURATIONS[F.timedMode]
      ? performance.now() + DURATIONS[F.timedMode]
      : null;
    S.timerID = setInterval(updateStats, 200);
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

function skipWord() {
  if (!S.started) return;
  if (F.display !== "word") {
    CTX.buf[CTX.cur].typed = "";
    CTX.buf[CTX.cur].ok = true;
    CTX.cur++;
  }
  if (F.display === "rise") _animateRise = true;
  if (F.display === "paragraph" && CTX.cur >= CTX.paraStart + getParaSize()) {
    CTX.paraStart = CTX.cur;
    ensureParaBuf();
  }
  S.typed = "";
  $typer.value = "";
  loadNextWord();
}

function submitWord() {
  if (!S.started || S.typed.trim() === "") return;
  const correct = S.typed === S.currentWord;
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
  if (F.display === "rise") _animateRise = true;
  if (F.display === "paragraph" && CTX.cur >= CTX.paraStart + getParaSize()) {
    CTX.paraStart = CTX.cur;
    ensureParaBuf();
  }
  updateStats();
  loadNextWord();
}
