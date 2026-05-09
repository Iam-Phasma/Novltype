'use strict';

// ══════════════════════════════════════════════════════════════════════
//  WORD LIST
// ══════════════════════════════════════════════════════════════════════

const WORDS = [
  'the','be','to','of','and','a','in','that','have','it','for','not','on','with',
  'he','as','you','do','at','this','but','his','by','from','they','we','say','her',
  'she','or','an','will','my','one','all','would','there','their','what','so','up',
  'out','if','about','who','get','which','go','me','when','make','can','like','time',
  'no','just','him','know','take','people','into','year','your','good','some','could',
  'them','see','other','than','then','now','look','only','come','its','over','think',
  'also','back','after','use','two','how','our','work','first','well','way','even',
  'new','want','because','any','these','give','day','most','us','great','between',
  'need','large','often','hand','high','place','hold','turn','during','without',
  'before','around','school','still','learn','plant','cover','food','sun','four',
  'state','keep','never','last','let','thought','city','tree','cross','farm','hard',
  'start','might','story','saw','far','sea','draw','left','late','run','while',
  'press','close','night','real','life','few','open','seem','together','next','white',
  'children','begin','got','walk','example','ease','paper','group','always','music',
  'those','both','mark','often','letter','until','mile','river','car','feet','care',
  'second','book','carry','took','science','eat','room','friend','began','idea',
  'fish','mountain','stop','once','base','hear','horse','cut','sure','watch','color',
  'face','wood','main','enough','plain','girl','usual','young','ready','above','ever',
  'red','list','though','feel','talk','bird','soon','body','dog','family','direct',
  'pose','leave','song','measure','door','product','black','short','numeral','class',
  'wind','question','happen','complete','ship','area','half','rock','order','fire',
  'south','piece','told','knew','pass','since','top','whole','king','space','heard',
  'best','hour','better','true','hundred','five','remember','step','early','hold',
  'west','ground','interest','reach','fast','verb','sing','listen','six','table',
  'travel','less','morning','ten','simple','several','vowel','toward','war','lay',
  'against','pattern','slow','center','love','person','money','serve','appear',
  'road','map','rain','rule','govern','pull','cold','notice','voice','power','town',
  'fine','drive','lead','cry','dark','machine','note','wait','plan','figure','star',
  'box','noun','field','rest','correct','able','pound','done','beauty','stood',
  'contain','front','teach','week','final','gave','green','oh','quick','develop',
  'ocean','warm','free','minute','strong','special','mind','behind','clear','tail',
  'produce','fact','street','inch','multiply','nothing','course','stay','wheel','full',
];

// ── Keyboard row membership ────────────────────────────────────
const ROW_KEYS = {
  top:    new Set('qwertyuiop'.split('')),
  home:   new Set('asdfghjkl'.split('')),
  bottom: new Set('zxcvbnm'.split('')),
};

function rowScore(word, rowSet) {
  const letters = word.toLowerCase().split('').filter(c => /[a-z]/.test(c));
  if (!letters.length) return 0;
  return letters.filter(c => rowSet.has(c)).length / letters.length;
}

// ── Active filter state ────────────────────────────────────────
const F = {
  row:       'all',   // 'all' | 'top' | 'home' | 'bottom'
  len:       'all',   // 'all' | 'short' | 'medium' | 'long'
  timedMode: 'off',  // 'off' | '1min'
  display:   'word', // 'word' | 'paragraph' | 'rise'
  jump:      false,  // skip word on space/enter without scoring
  sound: true,
  light: false,
};

function getPool() {
  // Use fetched API pool if ready, otherwise fall back to local WORDS (min 3 chars)
  let pool = (_apiPool && _apiPool.length > 100) ? _apiPool : WORDS.filter(w => w.length >= 3);

  if (F.row !== 'all') {
    const rs = ROW_KEYS[F.row];
    const filtered = pool.filter(w => rowScore(w, rs) >= 0.5);
    if (filtered.length >= 20) pool = filtered;
  }

  if (F.len !== 'all') {
    const ranges = { short: [3, 4], medium: [5, 7], long: [8, 14] };
    const [min, max] = ranges[F.len];
    const lpool = pool.filter(w => w.length >= min && w.length <= max);
    if (lpool.length >= 20) pool = lpool;
  }

  return pool;
}

// ── Async word pool (Google 10k common words, no-swears list) ─
const WORDS_API_URL =
  'https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-no-swears.txt';

let _apiPool = null; // null=loading, []+=ready

async function fetchWordPool() {
  try {
    const resp = await fetch(WORDS_API_URL);
    const text = await resp.text();
    _apiPool = text.split('\n')
      .map(w => w.trim().toLowerCase())
      .filter(w => /^[a-z]{3,14}$/.test(w));
    rebuildQueue();
  } catch {
    _apiPool = []; // stay on local fallback
  }
}

fetchWordPool();



function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let queue  = shuffle(WORDS);
let queueI = 0;

function rebuildQueue() {
  queue  = shuffle(getPool());
  queueI = 0;
}

function nextWord() {
  if (queueI >= queue.length) rebuildQueue();
  return queue[queueI++];
}

// ── Context word buffer (paragraph / rise modes) ─────────────

const CTX_SIZE  = 60;
const PARA_SIZE = 30;
let CTX = { buf: [], cur: 0, paraStart: 0 };

function fillCtx() {
  while (CTX.buf.length - CTX.cur < CTX_SIZE) {
    CTX.buf.push({ text: nextWord(), typed: '', ok: true });
  }
  // Trim history (only for non-paragraph modes; paragraph uses absolute indices)
  if (F.display !== 'paragraph' && CTX.cur > 5) {
    CTX.buf.splice(0, CTX.cur - 5);
    CTX.cur = 5;
  }
}

function resetCtx() {
  CTX.buf = [];
  CTX.cur = 0;
  CTX.paraStart = 0;
}

function ensureParaBuf() {
  while (CTX.buf.length < CTX.paraStart + PARA_SIZE) {
    CTX.buf.push({ text: nextWord(), typed: '', ok: true });
  }
}

// ══════════════════════════════════════════════════════════════════════
//  NOVELKEYS CREAM SOUNDS
// ══════════════════════════════════════════════════════════════════════

const SND_ROOT  = 'sounds/cream';
const GENERIC_N = 5;
let   genericIdx = 0;

function _audio(path) {
  const a = new Audio(path);
  a.preload = 'auto';
  return a;
}

const SND = {
  press: {
    generic:   Array.from({ length: GENERIC_N }, (_, i) => _audio(`${SND_ROOT}/press/GENERIC_R${i}.mp3`)),
    space:     _audio(`${SND_ROOT}/press/SPACE.mp3`),
    enter:     _audio(`${SND_ROOT}/press/ENTER.mp3`),
    backspace: _audio(`${SND_ROOT}/press/BACKSPACE.mp3`),
  },
  release: {
    generic:   _audio(`${SND_ROOT}/release/GENERIC.mp3`),
    space:     _audio(`${SND_ROOT}/release/SPACE.mp3`),
    enter:     _audio(`${SND_ROOT}/release/ENTER.mp3`),
    backspace: _audio(`${SND_ROOT}/release/BACKSPACE.mp3`),
  },
};

const _actx = new (window.AudioContext || window.webkitAudioContext)();
const _decodeCache = new Map();

function playWithGain(audio, gain) {
  if (!audio || !F.sound) return;
  const url = audio.src;
  const doPlay = decoded => {
    const src = _actx.createBufferSource();
    src.buffer = decoded;
    const g = _actx.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(_actx.destination);
    src.start();
  };
  if (_decodeCache.has(url)) { doPlay(_decodeCache.get(url)); return; }
  fetch(url)
    .then(r => r.arrayBuffer())
    .then(buf => _actx.decodeAudioData(buf))
    .then(decoded => { _decodeCache.set(url, decoded); doPlay(decoded); })
    .catch(() => {});
}

function play(audio, gain = 1) {
  if (!audio || !F.sound) return;
  if (gain !== 1) { playWithGain(audio, gain); return; }
  const c = audio.cloneNode();
  c.volume = 1;
  c.play().catch(() => {});
}

function soundFor(key, phase) {
  const k = key.toLowerCase();
  if (phase === 'press') {
    if (k === ' ')              play(SND.press.space);
    else if (k === 'enter')     play(SND.press.enter);
    else if (k === 'backspace') play(SND.press.backspace);
    else { play(SND.press.generic[genericIdx % GENERIC_N], 1.6); genericIdx++; }
  } else {
    if (k === ' ')              play(SND.release.space);
    else if (k === 'enter')     play(SND.release.enter);
    else if (k === 'backspace') play(SND.release.backspace);
    else play(SND.release.generic, 1.6);
  }
}

// ══════════════════════════════════════════════════════════════════════
//  GAME STATE
// ══════════════════════════════════════════════════════════════════════

const S = {
  started:     false,
  ended:       false,
  startTime:   null,
  timerID:     null,
  timedEnd:    null,
  currentWord: '',
  typed:       '',
  wordsDone:   0,
  correct:     0,
  wrong:       0,
};

// ══════════════════════════════════════════════════════════════════════
//  ELEMENTS
// ══════════════════════════════════════════════════════════════════════

const $display  = document.getElementById('word-display');
const $hint     = document.getElementById('hint');
const $typer    = document.getElementById('typer');
const $wpm      = document.getElementById('stat-wpm');
const $acc      = document.getElementById('stat-acc');
const $time     = document.getElementById('stat-time');
const $words    = document.getElementById('stat-words');
const $btnSound   = document.getElementById('btn-sound');
const $btnTheme   = document.getElementById('btn-theme');
const $btnSettings = document.getElementById('btn-settings');
const $settingsPanel = document.getElementById('settings-panel');
const $escHint    = document.getElementById('esc-hint');
const $bgOrbs     = document.getElementById('bg-orbs');

let _idleTimer = null;
function resetIdleTimer() {
  clearTimeout(_idleTimer);
  $escHint.classList.remove('flash');
  _idleTimer = setTimeout(() => {
    if (S.started) {
      $escHint.classList.remove('flash'); // force reflow
      void $escHint.offsetWidth;
      $escHint.classList.add('flash');
    }
  }, 5000);
}

// ══════════════════════════════════════════════════════════════════════
//  RENDER
// ══════════════════════════════════════════════════════════════════════

function renderWord() {
  if (F.display === 'paragraph') { renderParagraph(); return; }
  if (F.display === 'rise')      { renderRise();      return; }

  $display.className = 'word-display';
  const word  = S.currentWord;
  const typed = S.typed;
  let   html  = '';

  for (let i = 0; i < word.length; i++) {
    if (i === typed.length) html += '<span class="caret"></span>';
    let cls = 'ch';
    if (i < typed.length) cls += typed[i] === word[i] ? ' correct' : ' wrong';
    html += `<span class="${cls}">${word[i]}</span>`;
  }
  if (typed.length >= word.length) html += '<span class="caret"></span>';

  $display.innerHTML = html;
}

function renderParagraph() {
  $display.className = 'word-display mode-paragraph';
  ensureParaBuf();
  const start = CTX.paraStart;
  const end   = start + PARA_SIZE;
  let html = '';

  for (let wi = start; wi < end; wi++) {
    const w = CTX.buf[wi];
    html += `<span class="para-word ${wi < CTX.cur ? 'past' : wi === CTX.cur ? 'current' : 'future'}" data-wi="${wi}"`;
    if (wi === CTX.cur) html += ' id="para-cur"';
    html += '>';

    if (wi < CTX.cur) {
      for (let i = 0; i < w.text.length; i++) {
        const cls = (w.typed[i] === w.text[i]) ? 'ch correct' : 'ch wrong';
        html += `<span class="${cls}">${w.text[i]}</span>`;
      }
    } else if (wi === CTX.cur) {
      for (let i = 0; i < w.text.length; i++) {
        if (i === S.typed.length) html += '<span class="caret"></span>';
        let cls = 'ch';
        if (i < S.typed.length) cls += S.typed[i] === w.text[i] ? ' correct' : ' wrong';
        html += `<span class="${cls}">${w.text[i]}</span>`;
      }
      if (S.typed.length >= w.text.length) html += '<span class="caret"></span>';
    } else {
      for (const c of w.text) html += `<span class="ch">${c}</span>`;
    }
    html += '</span>';
  }

  $display.innerHTML = html;
}

let _animateRise = false;
let _riseTrack = null;

function riseRowHtml(wi) {
  if (wi < 0 || wi >= CTX.buf.length) return '';
  const w = CTX.buf[wi];
  let html = '';
  if (wi < CTX.cur) {
    for (let i = 0; i < w.text.length; i++)
      html += `<span class="${w.typed[i] === w.text[i] ? 'ch correct' : 'ch wrong'}">${w.text[i]}</span>`;
  } else if (wi === CTX.cur) {
    for (let i = 0; i < w.text.length; i++) {
      if (i === S.typed.length) html += '<span class="caret"></span>';
      html += `<span class="ch${i < S.typed.length ? (S.typed[i] === w.text[i] ? ' correct' : ' wrong') : ''}">${w.text[i]}</span>`;
    }
    if (S.typed.length >= w.text.length) html += '<span class="caret"></span>';
  } else {
    for (const c of w.text) html += `<span class="ch">${c}</span>`;
  }
  return html;
}

function buildRiseTrack() {
  _riseTrack.innerHTML = '';
  for (let wi = CTX.cur - 1; wi <= CTX.cur + 1; wi++) {
    const div = document.createElement('div');
    div.className = 'rise-row ' + (wi === CTX.cur ? 'rise-current' : 'rise-near');
    div.innerHTML = riseRowHtml(wi);
    _riseTrack.appendChild(div);
  }
}

function renderRise() {
  // Rebuild track if entering rise mode or after reset
  if (!$display.classList.contains('mode-rise') || !_riseTrack || !$display.contains(_riseTrack)) {
    $display.className = 'word-display mode-rise';
    $display.innerHTML = '<div class="rise-track"></div>';
    _riseTrack = $display.querySelector('.rise-track');
    buildRiseTrack();
    _animateRise = false;
    return;
  }

  if (_animateRise) {
    _animateRise = false;
    const rows = _riseTrack.querySelectorAll('.rise-row');
    if (rows.length >= 3) {
      // Update near-above row (was current) to show completed coloring
      rows[1].className = 'rise-row rise-near';
      rows[1].innerHTML = riseRowHtml(CTX.cur - 1);
      // Update new current row (was near-below)
      rows[2].className = 'rise-row rise-current';
      rows[2].innerHTML = riseRowHtml(CTX.cur);
      // Add new near-below
      const newRow = document.createElement('div');
      newRow.className = 'rise-row rise-near';
      newRow.innerHTML = riseRowHtml(CTX.cur + 1);
      _riseTrack.appendChild(newRow);
      // Animate track up by one slot, then remove exit row
      requestAnimationFrame(() => {
        _riseTrack.style.transition = 'transform 0.2s ease-in-out';
        _riseTrack.style.transform = 'translateY(-8rem)';
        setTimeout(() => {
          _riseTrack.style.transition = 'none';
          _riseTrack.style.transform = '';
          rows[0].remove();
        }, 215);
      });
    }
    return;
  }

  // Keystroke: only update current row content
  const rows = _riseTrack.querySelectorAll('.rise-row');
  const curRow = [...rows].find(r => r.classList.contains('rise-current'));
  if (curRow) curRow.innerHTML = riseRowHtml(CTX.cur);
}

// ══════════════════════════════════════════════════════════════════════
//  STATS
// ══════════════════════════════════════════════════════════════════════

function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function updateStats() {
  if (!S.started) return;
  const elapsed = performance.now() - S.startTime;
  const mins    = elapsed / 60000;

  if (S.timedEnd !== null) {
    const remaining = S.timedEnd - performance.now();
    if (remaining <= 0) { endGame(); return; }
    $time.textContent = fmtTime(remaining);
    $time.classList.add('live');
  } else {
    $time.textContent = fmtTime(elapsed);
  }

  $words.textContent = S.wordsDone;

  if (S.wordsDone > 0) {
    $wpm.textContent = Math.round(S.wordsDone / (mins || 0.0001));
    const total = S.correct + S.wrong;
    $acc.textContent = total ? Math.round((S.correct / total) * 100) + '%' : '—';
    [$wpm, $acc, $time, $words].forEach(el => el.classList.add('live'));
  }
}

// ══════════════════════════════════════════════════════════════════════
//  GAME FLOW
// ══════════════════════════════════════════════════════════════════════

function loadNextWord() {
  if (F.display === 'paragraph') {
    ensureParaBuf();
    S.currentWord = CTX.buf[CTX.cur].text;
  } else if (F.display !== 'word') {
    fillCtx();
    S.currentWord = CTX.buf[CTX.cur].text;
  } else {
    S.currentWord = nextWord();
  }
  S.typed      = '';
  $typer.value = '';
  renderWord();
}

function reset() {
  clearInterval(S.timerID);
  S.started     = false;
  S.ended       = false;
  S.startTime   = null;
  S.timerID     = null;
  S.timedEnd    = null;
  S.currentWord = '';
  S.typed       = '';
  S.wordsDone   = 0;
  S.correct     = 0;
  S.wrong       = 0;
  $typer.value  = '';
  $display.innerHTML = '';
  $display.className = 'word-display';
  $display.style.display = 'none';
  resetCtx();
  [$wpm, $acc, $time, $words].forEach(el => {
    el.textContent = '—';
    el.classList.remove('live');
  });
  $time.textContent = '0:00';
  $words.textContent = '0';
  clearTimeout(_idleTimer);
  $escHint.classList.remove('visible', 'flash');
  unlockToolbar();
  $bgOrbs.classList.remove('hide');
  $hint.innerHTML = 'press <span class="hint-key">enter</span> to start';
  $hint.classList.remove('hidden');
}

function endGame() {
  clearInterval(S.timerID);
  S.started = false;
  S.ended   = true;
  S.timedEnd = null;
  clearTimeout(_idleTimer);
  $escHint.classList.remove('visible', 'flash');
  unlockToolbar();
  $bgOrbs.classList.remove('hide');
  $typer.blur();
  $display.innerHTML = '';
  $display.className = 'word-display';
  $display.style.display = 'none';
  // Show final results in hint area
  const elapsed = performance.now() - S.startTime;
  const mins    = elapsed / 60000;
  const wpm     = S.wordsDone > 0 ? Math.round(S.wordsDone / (mins || 0.0001)) : 0;
  const total   = S.correct + S.wrong;
  const acc     = total ? Math.round((S.correct / total) * 100) : 0;
  $hint.innerHTML =
    `<span class="hint-stat">${wpm} wpm</span>` +
    `<span class="hint-sep">/</span>` +
    `<span class="hint-stat">${acc}%</span>` +
    `<br><span class="hint-sub">press <span class="hint-key">enter</span> to play again</span>`;
  $hint.classList.remove('hidden');
}

// ── Toolbar lock (timed mode only) ──────────────────────────
const LOCKABLE = ['tg-row', 'tg-len', 'tg-time'];

function lockToolbar() {
  LOCKABLE.forEach(id => {
    document.getElementById(id).querySelectorAll('.tool-btn').forEach(b => {
      b.disabled = true;
    });
  });
  document.getElementById('tg-row').closest('nav').classList.add('toolbar-locked');
}

function unlockToolbar() {
  LOCKABLE.forEach(id => {
    document.getElementById(id).querySelectorAll('.tool-btn').forEach(b => {
      b.disabled = false;
    });
  });
  document.getElementById('tg-row').closest('nav').classList.remove('toolbar-locked');
}

function start() {
  if (S.started) return;
  // Animate hint out, then launch
  $hint.classList.add('exiting');
  setTimeout(() => {
    $hint.classList.remove('exiting');
    if (S.ended) reset(); // resets state; reset() restores hint but we'll immediately hide it
    S.started   = true;
    S.startTime = performance.now();
    S.timedEnd  = F.timedMode === '1min' ? performance.now() + 60000 : null;
    S.timerID   = setInterval(updateStats, 200);
    if (F.timedMode === '1min') lockToolbar();
    $bgOrbs.classList.add('hide');
    resetCtx();
    $hint.classList.add('hidden');
    $display.style.display = '';
    $escHint.classList.add('visible');
    resetIdleTimer();
    $typer.focus();
    loadNextWord();
  }, 280);
}

function skipWord() {
  if (!S.started) return;
  if (F.display !== 'word') {
    CTX.buf[CTX.cur].typed = '';
    CTX.buf[CTX.cur].ok    = true; // neutral — not penalised
    CTX.cur++;
  }
  if (F.display === 'rise') _animateRise = true;
  if (F.display === 'paragraph' && CTX.cur >= CTX.paraStart + PARA_SIZE) {
    CTX.paraStart = CTX.cur;
    ensureParaBuf();
  }
  S.typed = '';
  $typer.value = '';
  loadNextWord();
}

function submitWord() {
  if (!S.started || S.typed.trim() === '') return;
  const correct = S.typed === S.currentWord;
  if (correct) S.correct++; else S.wrong++;
  S.wordsDone++;
  if (F.display !== 'word') {
    CTX.buf[CTX.cur].typed = S.typed;
    CTX.buf[CTX.cur].ok    = correct;
    CTX.cur++;
  }
  if (F.display === 'rise') _animateRise = true;
  // Paragraph: flip to next paragraph when current one is fully typed
  if (F.display === 'paragraph' && CTX.cur >= CTX.paraStart + PARA_SIZE) {
    CTX.paraStart = CTX.cur;
    ensureParaBuf();
  }
  updateStats();
  loadNextWord();
}

// ══════════════════════════════════════════════════════════════════════
//  KEYBOARD INPUT
// ══════════════════════════════════════════════════════════════════════

const IGNORE_KEYS = ['Shift','Control','Alt','Meta','CapsLock','Tab'];

document.addEventListener('keydown', e => {
  if (IGNORE_KEYS.includes(e.key)) return;

  if (!e.repeat) soundFor(e.key, 'press');

  if (e.key === 'Escape' && S.started) {
    e.preventDefault();
    endGame();
    return;
  }

  if (!S.started) {
    // Animate the "enter" hint-key on press (game starts on release)
    if (e.key === 'Enter' && !e.repeat) {
      e.preventDefault();
      const enterEl = $hint.querySelector('.hint-key');
      if (enterEl) {
        enterEl.classList.remove('pressed');
        void enterEl.offsetWidth; // reflow to restart
        enterEl.classList.add('pressed');
      }
    }
    return;
  }
});

document.addEventListener('keyup', e => {
  if (IGNORE_KEYS.includes(e.key)) return;
  soundFor(e.key, 'release');
  if (!S.started && e.key === 'Enter') {
    start();
  }
});

$typer.addEventListener('input', () => {
  if (!S.started) return;
  resetIdleTimer();
  const val = $typer.value;
  if (val.endsWith(' ')) {
    $typer.value = '';
    S.typed = val.trimEnd();
    submitWord();
    return;
  }
  S.typed = val;
  renderWord();
  // Jump mode: auto-submit when all characters of the word are typed
  if (F.jump && val.length >= S.currentWord.length) {
    $typer.value = '';
    submitWord();
  }
});

$typer.addEventListener('keydown', e => {
  if (!S.started) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    if (F.jump) { $typer.value = ''; skipWord(); return; }
    S.typed = $typer.value.trimEnd();
    $typer.value = '';
    submitWord();
  }
});

document.addEventListener('click', () => { if (S.started) $typer.focus(); });

// ══════════════════════════════════════════════════════════════════════
//  TOOLBAR
// ══════════════════════════════════════════════════════════════════════

function bindGroup(groupId, stateKey) {
  document.querySelectorAll(`#${groupId} .tool-btn`).forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll(`#${groupId} .tool-btn`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      F[stateKey] = btn.dataset.val;
      savePrefs();
      rebuildQueue();
      if (S.started) loadNextWord();
    });
  });
}

// ── Preferences persistence ───────────────────────────────────────────
const PREF_KEY = 'novltype_prefs';

function savePrefs() {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(F)); } catch (_) {}
}

function loadPrefs() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(PREF_KEY)); } catch (_) {}
  if (!saved) return;

  // Merge saved into F
  const keys = ['row','len','timedMode','display','jump','sound','light'];
  keys.forEach(k => { if (k in saved) F[k] = saved[k]; });

  // Sync toolbar: row, len
  ['tg-row','tg-len'].forEach(id => {
    const key = id === 'tg-row' ? 'row' : 'len';
    document.querySelectorAll(`#${id} .tool-btn`).forEach(b => {
      b.classList.toggle('active', b.dataset.val === F[key]);
    });
  });

  // Sync timed mode
  document.querySelectorAll('#tg-time .tool-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.val === F.timedMode);
  });

  // Sync display
  document.querySelectorAll('#sp-display .spanel-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.val === F.display);
  });

  // Sync jump
  document.querySelectorAll('#sp-jump .spanel-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.val === (F.jump ? 'on' : 'type'));
  });

  // Sync sound
  const $bs = document.getElementById('btn-sound');
  if ($bs) { $bs.textContent = F.sound ? 'on' : 'off'; $bs.classList.toggle('active', F.sound); }

  // Sync theme
  document.body.classList.toggle('light', F.light);
  const $bt = document.getElementById('btn-theme');
  if ($bt) { $bt.textContent = F.light ? 'dark' : 'light'; $bt.classList.toggle('active', F.light); }
}

bindGroup('tg-row', 'row');
bindGroup('tg-len', 'len');

// Timed mode toggle
document.querySelectorAll('#tg-time .tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tg-time .tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    F.timedMode = btn.dataset.val;
    savePrefs();
    if (S.started || S.ended) { reset(); }
  });
});

// Settings panel toggle
$btnSettings.addEventListener('click', e => {
  e.stopPropagation();
  const open = $settingsPanel.classList.toggle('open');
  $btnSettings.classList.toggle('open', open);
});

document.addEventListener('click', () => {
  $settingsPanel.classList.remove('open');
  $btnSettings.classList.remove('open');
});

$settingsPanel.addEventListener('click', e => e.stopPropagation());

// Display setting
document.querySelectorAll('#sp-display .spanel-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#sp-display .spanel-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    F.display = btn.dataset.val;
    savePrefs();
    if (S.started || S.ended) { reset(); }
  });
});

// Jump setting
document.querySelectorAll('#sp-jump .spanel-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#sp-jump .spanel-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    F.jump = btn.dataset.val === 'on';
    savePrefs();
  });
});

// Sound toggle
$btnSound.addEventListener('click', () => {
  F.sound = !F.sound;
  savePrefs();
  $btnSound.textContent = F.sound ? 'on' : 'off';
  $btnSound.classList.toggle('active', F.sound);
});

// Theme toggle
$btnTheme.addEventListener('click', () => {
  F.light = !F.light;
  savePrefs();
  document.body.classList.toggle('light', F.light);
  $btnTheme.textContent = F.light ? 'dark' : 'light';
  $btnTheme.classList.toggle('active', F.light);
});

// ── Boot ──────────────────────────────────────────────────────────────
loadPrefs();
// Word display stays empty until Enter is pressed
$display.style.display = 'none';

// ── Tooltip ───────────────────────────────────────────────────────────
const $tip = document.getElementById('tip');
let _tipTimer = null;

document.addEventListener('mouseover', e => {
  const target = e.target.closest('[data-tip]');
  if (!target) return;
  clearTimeout(_tipTimer);
  $tip.textContent = target.dataset.tip;
  _tipTimer = setTimeout(() => {
    const r = target.getBoundingClientRect();
    const tw = $tip.offsetWidth;
    let left = r.left + r.width / 2 - tw / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
    const top = r.top - $tip.offsetHeight - 8;
    $tip.style.left = left + 'px';
    $tip.style.top  = (top < 8 ? r.bottom + 8 : top) + 'px';
    $tip.classList.add('visible');
  }, 400);
});

document.addEventListener('mouseout', e => {
  const target = e.target.closest('[data-tip]');
  if (!target) return;
  clearTimeout(_tipTimer);
  $tip.classList.remove('visible');
});
