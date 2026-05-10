"use strict";

// ══════════════════════════════════════════════════════════════════════
//  RENDER  — word, paragraph, rise display modes
// ══════════════════════════════════════════════════════════════════════

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
  let html = "";

  for (let i = 0; i < word.length; i++) {
    if (i === typed.length) html += '<span class="caret"></span>';
    let cls = "ch";
    if (i < typed.length) cls += typed[i] === word[i] ? " correct" : " wrong";
    html += `<span class="${cls}">${word[i]}</span>`;
  }
  if (typed.length >= word.length) html += '<span class="caret"></span>';

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
        html += `<span class="${cls2}">${w.text[i]}</span>`;
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
    $display.scrollTop += curRect.top - dispRect.top - dispRect.height * 0.3;
  }
}

// ── Rise mode ─────────────────────────────────────────────────────────

let _animateRise = false;
let _riseTrack = null;

function riseRowHtml(wi) {
  if (wi < 0 || wi >= CTX.buf.length) return "";
  const w = CTX.buf[wi];
  let html = "";
  if (wi < CTX.cur) {
    for (let i = 0; i < w.text.length; i++)
      html += `<span class="${w.typed[i] === w.text[i] ? "ch correct" : "ch wrong"}">${w.text[i]}</span>`;
  } else if (wi === CTX.cur) {
    for (let i = 0; i < w.text.length; i++) {
      if (i === S.typed.length) html += '<span class="caret"></span>';
      html += `<span class="ch${i < S.typed.length ? (S.typed[i] === w.text[i] ? " correct" : " wrong") : ""}">${w.text[i]}</span>`;
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
    return;
  }

  if (_animateRise) {
    _animateRise = false;
    const rows = _riseTrack.querySelectorAll(".rise-row");
    if (rows.length >= 3) {
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
        }, 215);
      });
    }
    return;
  }

  const rows = _riseTrack.querySelectorAll(".rise-row");
  const curRow = [...rows].find((r) => r.classList.contains("rise-current"));
  if (curRow) curRow.innerHTML = riseRowHtml(CTX.cur);
}
