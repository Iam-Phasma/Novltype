"use strict";

// ══════════════════════════════════════════════════════════════════════
//  RENDER  — word, paragraph, rise display modes
// ══════════════════════════════════════════════════════════════════════

const WRONG_POP_MS = 800;
let _wrongPopSeq = 0;
let _wrongPopEvents = [];
let _wrongPopTimer = null;

function escapeHtmlChar(ch) {
  return String(ch)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function pruneWrongPopEvents(now = performance.now()) {
  _wrongPopEvents = _wrongPopEvents.filter(
    (evt) => now - evt.createdAt < WRONG_POP_MS,
  );
}

function scheduleWrongPopCleanup() {
  clearTimeout(_wrongPopTimer);
  if (_wrongPopEvents.length === 0) {
    _wrongPopTimer = null;
    return;
  }

  const now = performance.now();
  let nextExpiryAt = Infinity;
  for (const evt of _wrongPopEvents) {
    nextExpiryAt = Math.min(nextExpiryAt, evt.createdAt + WRONG_POP_MS);
  }
  const waitMs = Math.max(0, Math.ceil(nextExpiryAt - now));

  _wrongPopTimer = setTimeout(() => {
    pruneWrongPopEvents();
    if (S.started) renderWord();
    scheduleWrongPopCleanup();
  }, waitMs);
}

function registerWrongPop(index, typedChar) {
  if (typeof index !== "number" || index < 0 || !typedChar) return;
  const now = performance.now();
  pruneWrongPopEvents(now);
  _wrongPopEvents.push({
    id: ++_wrongPopSeq,
    index,
    typedChar,
    createdAt: now,
  });
  scheduleWrongPopCleanup();
}

function clearWrongPops() {
  _wrongPopEvents = [];
  clearTimeout(_wrongPopTimer);
  _wrongPopTimer = null;
}

function getWrongPopByIndex(now = performance.now()) {
  pruneWrongPopEvents(now);
  const byIndex = new Map();
  for (const evt of _wrongPopEvents) byIndex.set(evt.index, evt);
  return byIndex;
}

function renderActiveChar(ch, cls, idx, wrongPopByIndex, now) {
  const evt = wrongPopByIndex.get(idx);
  const typed = escapeHtmlChar(ch);
  if (!evt)
    return `<span class="ch-anchor"><span class="${cls}">${typed}</span></span>`;

  const elapsed = Math.max(0, Math.min(WRONG_POP_MS, now - evt.createdAt));
  const delay = Math.round(elapsed);
  return (
    `<span class="ch-anchor">` +
    `<span class="${cls}">${typed}</span>` +
    `<span class="wrong-pop" style="animation-delay:-${delay}ms">${escapeHtmlChar(evt.typedChar)}</span>` +
    `</span>`
  );
}

function renderWord() {
  if (F.display === "paragraph") {
    renderParagraph();
    return;
  }
  if (F.display === "rise") {
    renderRise();
    return;
  }

  $display.className = "word-display";
  const word = S.currentWord;
  const typed = S.typed;
  const now = performance.now();
  const wrongPopByIndex = getWrongPopByIndex(now);
  let html = "";

  for (let i = 0; i < word.length; i++) {
    if (i === typed.length) html += '<span class="caret"></span>';
    let cls = "ch";
    if (i < typed.length) cls += typed[i] === word[i] ? " correct" : " wrong";
    html += renderActiveChar(word[i], cls, i, wrongPopByIndex, now);
  }
  if (typed.length >= word.length) html += '<span class="caret"></span>';

  const timedReady = S.started && S.timerArmed && F.timedMode !== "off";
  const readyDots = Math.max(0, Math.min(5, Number(S.readyDots ?? 5)));
  const readyDotsHtml = Array.from(
    { length: 5 },
    (_, i) => `<span class="dot${i < readyDots ? "" : " off"}"></span>`,
  ).join("");
  const blinkClass =
    S.readyBlinkActive && S.readyBlinkTick > 0
      ? S.readyBlinkTick % 2 === 0
        ? " blink-even"
        : " blink-odd"
      : "";
  html =
    `<span class="word-inline${timedReady ? " with-ready" : ""}">` +
    (timedReady
      ? `<span class="timed-ready-dots${blinkClass}" aria-hidden="true">${readyDotsHtml}</span>`
      : "") +
    html +
    "</span>";

  $display.style.fontSize = "";
  $display.innerHTML = html;

  // Measure the actual rendered character spans to detect overflow.
  // getBoundingClientRect returns true layout position even through overflow:hidden.
  const _chs = $display.querySelectorAll(".ch");
  if (_chs.length > 0) {
    const _r0 = _chs[0].getBoundingClientRect();
    const _rN = _chs[_chs.length - 1].getBoundingClientRect();
    const _viewW = document.documentElement.clientWidth;
    if (_rN.right > _viewW * 0.93 || _r0.left < _viewW * 0.07) {
      const _wordW = _rN.right - _r0.left;
      const _targetW = _viewW * 0.86;
      const _curFs = parseFloat(getComputedStyle($display).fontSize);
      $display.style.fontSize = Math.floor((_curFs * _targetW) / _wordW) + "px";
    }
  }
}

window.addEventListener("resize", () => {
  if (S.started) renderWord();
});

window.addEventListener("orientationchange", () => {
  if (S.started) renderWord();
});

if (document.fonts) {
  document.fonts.ready.then(() => {
    if (S.started) renderWord();
  });
  document.fonts.addEventListener("loadingdone", () => {
    if (S.started) renderWord();
  });
}

// ── Paragraph mode ────────────────────────────────────────────────────

function renderParagraph() {
  $display.className = "word-display mode-paragraph";
  ensureParaBuf();
  const start = CTX.paraStart;
  const end = start + getParaSize();
  const now = performance.now();
  const wrongPopByIndex = getWrongPopByIndex(now);
  let html = "";

  for (let wi = start; wi < end; wi++) {
    const w = CTX.buf[wi];
    const cls = wi < CTX.cur ? "past" : wi === CTX.cur ? "current" : "future";
    html += `<span class="para-word ${cls}" data-wi="${wi}"${wi === CTX.cur ? ' id="para-cur"' : ""}>`;

    if (wi < CTX.cur) {
      for (let i = 0; i < w.text.length; i++)
        html += `<span class="${w.typed[i] === w.text[i] ? "ch correct" : "ch wrong"}">${w.text[i]}</span>`;
    } else if (wi === CTX.cur) {
      for (let i = 0; i < w.text.length; i++) {
        if (i === S.typed.length) html += '<span class="caret"></span>';
        let cls2 = "ch";
        if (i < S.typed.length)
          cls2 += S.typed[i] === w.text[i] ? " correct" : " wrong";
        html += renderActiveChar(w.text[i], cls2, i, wrongPopByIndex, now);
      }
      if (S.typed.length >= w.text.length)
        html += '<span class="caret"></span>';
    } else {
      for (const c of w.text) html += `<span class="ch">${c}</span>`;
    }
    html += "</span>";
  }

  $display.innerHTML = html;

  const $cur = document.getElementById("para-cur");
  if ($cur) {
    const dispRect = $display.getBoundingClientRect();
    const curRect = $cur.getBoundingClientRect();
    $display.scrollTop += curRect.top - dispRect.top - dispRect.height * 0.38;
  }
}

// ── Rise mode ─────────────────────────────────────────────────────────

let _animateRise = false;
let _riseAnimating = false;
let _riseTrack = null;

function riseRowHtml(wi) {
  if (wi < 0 || wi >= CTX.buf.length) return "";
  const w = CTX.buf[wi];
  const now = performance.now();
  const wrongPopByIndex = getWrongPopByIndex(now);
  let html = "";
  if (wi < CTX.cur) {
    for (let i = 0; i < w.text.length; i++)
      html += `<span class="${w.typed[i] === w.text[i] ? "ch correct" : "ch wrong"}">${w.text[i]}</span>`;
  } else if (wi === CTX.cur) {
    for (let i = 0; i < w.text.length; i++) {
      if (i === S.typed.length) html += '<span class="caret"></span>';
      const cls = `ch${i < S.typed.length ? (S.typed[i] === w.text[i] ? " correct" : " wrong") : ""}`;
      html += renderActiveChar(w.text[i], cls, i, wrongPopByIndex, now);
    }
    if (S.typed.length >= w.text.length) html += '<span class="caret"></span>';
  } else {
    for (const c of w.text) html += `<span class="ch">${c}</span>`;
  }
  return html;
}

function buildRiseTrack() {
  _riseTrack.innerHTML = "";
  for (let wi = CTX.cur - 1; wi <= CTX.cur + 1; wi++) {
    const div = document.createElement("div");
    div.className =
      "rise-row " + (wi === CTX.cur ? "rise-current" : "rise-near");
    div.innerHTML = riseRowHtml(wi);
    _riseTrack.appendChild(div);
  }
}

function renderRise() {
  if (
    !$display.classList.contains("mode-rise") ||
    !_riseTrack ||
    !$display.contains(_riseTrack)
  ) {
    $display.className = "word-display mode-rise";
    $display.innerHTML = '<div class="rise-track"></div>';
    _riseTrack = $display.querySelector(".rise-track");
    buildRiseTrack();
    _animateRise = false;
    _riseAnimating = false;
    return;
  }

  if (_animateRise) {
    _animateRise = false;
    const rows = _riseTrack.querySelectorAll(".rise-row");
    // If a previous animation is still mid-flight (extra rows present), rebuild cleanly
    if (_riseAnimating || rows.length !== 3) {
      _riseAnimating = false;
      _riseTrack.style.transition = "none";
      _riseTrack.style.transform = "";
      buildRiseTrack();
      return;
    }
    _riseAnimating = true;
    rows[1].className = "rise-row rise-near";
    rows[1].innerHTML = riseRowHtml(CTX.cur - 1);
    rows[2].className = "rise-row rise-current";
    rows[2].innerHTML = riseRowHtml(CTX.cur);
    const newRow = document.createElement("div");
    newRow.className = "rise-row rise-near";
    newRow.innerHTML = riseRowHtml(CTX.cur + 1);
    _riseTrack.appendChild(newRow);
    requestAnimationFrame(() => {
      _riseTrack.style.transition = "transform 0.2s ease-in-out";
      _riseTrack.style.transform = "translateY(-8rem)";
      setTimeout(() => {
        _riseTrack.style.transition = "none";
        _riseTrack.style.transform = "";
        rows[0].remove();
        _riseAnimating = false;
      }, 215);
    });
    return;
  }

  const rows = _riseTrack.querySelectorAll(".rise-row");
  const curRow = [...rows].find((r) => r.classList.contains("rise-current"));
  if (curRow) curRow.innerHTML = riseRowHtml(CTX.cur);
}
