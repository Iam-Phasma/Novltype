import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

async function setup(t, preferences = {}, device = { platform: 'MacIntel', userAgent: 'Mac' }, width = 1024) {
  const dom = new JSDOM(await readFile(new URL('../index.html', import.meta.url), 'utf8'), {
    url: 'http://localhost/',
  });
  const { window } = dom;
  // jsdom does not implement native dialog methods or browser focus trapping.
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  window.innerWidth = width;
  let voices = [];
  const spoken = [];
  let cancellations = 0;
  const speech = new window.EventTarget();
  Object.assign(speech, {
    getVoices: () => voices,
    cancel: () => cancellations++,
    speak: utterance => spoken.push(utterance),
  });
  window.speechSynthesis = speech;
  window.SpeechSynthesisUtterance = class {
    constructor(text) { this.text = text; }
  };
  window.AudioContext = class {
    state = 'running';
    resume() { return Promise.resolve(); }
  };
  class Audio {
    constructor(src) { this.src = src; }
    cloneNode() { return new Audio(this.src); }
    play() { return Promise.resolve(); }
  }
  window.localStorage.setItem('novltype_prefs', JSON.stringify(preferences));
  const globals = {
    window, document: window.document, navigator: device,
    localStorage: window.localStorage, Audio, CustomEvent: window.CustomEvent,
    SpeechSynthesisUtterance: window.SpeechSynthesisUtterance,
    getComputedStyle: window.getComputedStyle.bind(window),
    fetch: async () => ({ text: async () => 'cat\ndog\nword' }),
  };
  const previous = new Map();
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
  let game;
  t.after(async () => {
    game?.reset();
    await server.close();
    window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const state = await server.ssrLoadModule('/src/state.js');
  const words = await server.ssrLoadModule('/src/words.js');
  state.initCtx(words.nextWord);
  game = await server.ssrLoadModule('/src/game.js');
  await server.ssrLoadModule('/src/ui.js');
  return {
    ...state, game, window, spoken,
    async loadInsightsPage() {
      game.reset();
      game = null;
      const page = new JSDOM(await readFile(new URL('../insights.html', import.meta.url), 'utf8'));
      window.document.body.innerHTML = page.window.document.body.innerHTML;
      page.window.close();
      await server.ssrLoadModule('/src/insights-page.js');
    },
    get cancellations() { return cancellations; },
    el: id => window.document.getElementById(id),
    loadVoices(next) {
      voices = next;
      speech.dispatchEvent(new window.Event('voiceschanged'));
    },
  };
}

for (const jump of [false, true]) {
  test(`saved ${jump ? 'jump' : 'type'} mode restores exactly one selected button`, async t => {
    const app = await setup(t, { jump, light: true, soundKeys: false });
    const selected = app.el('sp-jump').querySelectorAll('.active');
    assert.equal(selected.length, 1);
    assert.equal(selected[0].dataset.val, jump ? 'on' : 'off');
    assert.equal(app.el('btn-sound').textContent, 'off');
    assert.ok(app.window.document.body.classList.contains('light'));
    app.el('btn-settings').click();
    assert.equal(app.el('btn-settings').getAttribute('aria-expanded'), 'true');
    assert.equal(app.el('settings-panel').inert, false);
    app.window.document.body.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(app.el('btn-settings').getAttribute('aria-expanded'), 'false');
    assert.equal(app.el('settings-panel').inert, true);
  });
}

test('delayed voices retain Karen default and selection previews welcome with narration off', async t => {
  const app = await setup(t);
  assert.equal(app.F.wordVoiceChoice, 'karen');
  const karen = { name: 'Karen', voiceURI: 'karen-id', lang: 'en-AU' };
  const daniel = { name: 'Daniel', voiceURI: 'daniel-id', lang: 'en-GB' };
  app.loadVoices([karen, daniel]);
  assert.equal(app.el('sel-voice').value, karen.voiceURI);
  app.el('sel-voice').value = daniel.voiceURI;
  app.el('sel-voice').dispatchEvent(new app.window.Event('change'));
  assert.equal(app.F.wordVoice, false);
  assert.equal(app.spoken.at(-1).text, 'welcome');
  assert.equal(app.spoken.at(-1).voice, daniel);
  assert.ok(app.cancellations > 0);
  assert.equal(JSON.parse(app.window.localStorage.getItem('novltype_prefs')).wordVoiceChoice, daniel.voiceURI);
  app.loadVoices([]);
  assert.equal(app.F.wordVoiceChoice, daniel.voiceURI);
  app.loadVoices([karen, daniel]);
  assert.equal(app.el('sel-voice').value, daniel.voiceURI);
});

test('saved voice survives an initially empty browser voice list', async t => {
  const app = await setup(t, { wordVoiceChoice: 'daniel-id' });
  assert.equal(app.F.wordVoiceChoice, 'daniel-id');
  app.loadVoices([{ name: 'Daniel', voiceURI: 'daniel-id', lang: 'en-GB' }]);
  assert.equal(app.el('sel-voice').value, 'daniel-id');
});

for (const timedMode of ['off', '30s']) {
  test(`${timedMode} session starts, stops, and resets its controls`, async t => {
    const app = await setup(t, { timedMode });
    t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
    const key = (type, key) => app.window.document.body.dispatchEvent(
      new app.window.KeyboardEvent(type, { key, bubbles: true }),
    );
    key('keyup', 'Enter');
    t.mock.timers.tick(280);
    assert.equal(app.S.started, true);
    assert.ok(app.el('app').classList.contains('session-active'));
    assert.equal(app.window.document.querySelector('.toolbar').inert, true);
    assert.equal(app.window.document.querySelector('.panel-actions').inert, true);
    assert.equal(app.el('btn-settings').disabled, true);
    assert.equal(app.el('settings-panel').inert, true);
    assert.equal(app.window.document.activeElement, app.el('typer'));
    assert.ok(app.S.currentWord.length > 0);
    if (timedMode === '30s') {
      assert.equal(app.S.timerArmed, true);
      app.game.startTimedCountdownIfArmed();
      assert.equal(app.S.timerArmed, false);
      app.S.timedEnd = performance.now() - 1;
      app.game.updateStats();
    } else {
      key('keydown', 'Escape');
    }
    assert.equal(app.S.started, false);
    assert.equal(app.S.ended, true);
    assert.equal(app.el('app').classList.contains('session-active'), false);
    assert.equal(app.window.document.querySelector('.toolbar').inert, false);
    assert.equal(app.window.document.querySelector('.panel-actions').inert, false);
    assert.equal(app.el('btn-settings').disabled, false);
    key('keydown', 'Escape');
    t.mock.timers.tick(280);
    assert.equal(app.S.ended, false);
    assert.equal(app.S.timerID, null);
    assert.ok(app.el('app').classList.contains('prestart'));
    t.mock.timers.tick(10000);
    assert.equal(app.S.started, false);
  });
}


test('S and I open panes and arrows navigate without interrupting typing', async t => {
  const app = await setup(t);
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const key = (value, options = {}, target = app.window.document.activeElement) => {
    const event = new app.window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...options });
    target.dispatchEvent(event);
    return event;
  };
  key('s');
  assert.equal(app.el('settings-panel').classList.contains('open'), true);
  assert.equal(app.window.document.activeElement.dataset.val, 'word');
  assert.equal(app.el('settings-panel').classList.contains('keyboard-navigation'), true);
  key('s', { repeat: true });
  assert.equal(app.el('settings-panel').classList.contains('open'), true);
  key('ArrowRight');
  assert.equal(app.window.document.activeElement.dataset.val, 'paragraph');
  key('ArrowDown');
  assert.equal(app.window.document.activeElement.closest('.spanel-group').id, 'sp-jump');
  key('ArrowUp');
  assert.equal(app.window.document.activeElement.closest('.spanel-group').id, 'sp-display');
  // Exercise navigation with an available speaker dropdown.
  app.el('sel-voice').disabled = false;
  app.el('btn-voice').focus();
  key('ArrowDown');
  assert.equal(app.window.document.activeElement.id, 'sel-voice');
  assert.equal(key('ArrowRight').defaultPrevented, false);
  assert.equal(app.window.document.activeElement.id, 'sel-voice');
  assert.equal(key('ArrowDown').defaultPrevented, true);
  assert.equal(app.window.document.activeElement.id, 'btn-theme');
  key('ArrowUp');
  assert.equal(app.window.document.activeElement.id, 'sel-voice');
  key('ArrowUp');
  assert.equal(app.window.document.activeElement.id, 'btn-voice');
  key('i');
  assert.equal(app.el('insights-panel').classList.contains('open'), true);
  assert.equal(app.el('settings-panel').classList.contains('open'), false);
  assert.equal(app.window.document.activeElement.id, 'insights-view-all');
  assert.equal(app.el('insights-panel').classList.contains('keyboard-navigation'), true);
  app.window.document.body.dispatchEvent(new app.window.Event('pointerdown', { bubbles: true }));
  assert.equal(app.el('insights-panel').classList.contains('keyboard-navigation'), false);
  app.el('insights-view-all').dispatchEvent(new app.window.KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
  assert.equal(app.S.started, false);
  key('Escape');
  key('s', { ctrlKey: true });
  assert.equal(app.el('settings-panel').classList.contains('open'), false);
  const theme = app.F.light;
  const sounds = app.F.soundKeys;
  for (const value of ['m', '?', 'f']) key(value);
  assert.equal(app.F.light, theme);
  assert.equal(app.F.soundKeys, sounds);
  for (const [shortcut, groupId, stateKey, value] of [
    ['k', 'tg-row', 'row', 'top'],
    ['l', 'tg-len', 'len', 'short'],
    ['t', 'tg-time', 'timedMode', '30s'],
  ]) {
    key(shortcut);
    const group = app.el(groupId);
    assert.equal(app.window.document.activeElement.closest('.tool-wrap'), group);
    assert.equal(group.classList.contains('keyboard-navigation'), true);
    key('ArrowDown');
    assert.equal(app.window.document.activeElement.dataset.val, value);
    key('Enter');
    app.window.document.activeElement.click();
    // Enter activates the button on keydown; selection blurs it before keyup.
    const release = new app.window.KeyboardEvent('keyup', { key: 'Enter', bubbles: true, cancelable: true });
    app.window.document.body.dispatchEvent(release);
    assert.equal(release.defaultPrevented, true);
    assert.equal(app.S.started, false);
    assert.equal(app.el('hint').classList.contains('exiting'), false);
    assert.equal(app.F[stateKey], value);
    assert.equal(group.classList.contains('keyboard-navigation'), false);
    key(shortcut);
    key('Escape');
    assert.equal(group.contains(app.window.document.activeElement), false);
  }
  key('s');
  app.el('btn-theme').focus();
  key('ArrowDown');
  assert.equal(app.window.document.activeElement.id, 'settings-shortcuts');
  const details = app.el('settings-shortcuts').closest('details');
  assert.equal(details.open, false);
  app.el('settings-shortcuts').click();
  assert.equal(details.open, true);
  key('Escape');
  app.game.start();
  t.mock.timers.tick(280);
  assert.equal(app.S.started, true);
  assert.equal(key('s').defaultPrevented, false);
  assert.equal(key('ArrowRight').defaultPrevented, false);
  assert.equal(app.el('settings-panel').classList.contains('open'), false);
});

test('wide tablet is blocked and Enter cannot start a hidden session', async t => {
  const app = await setup(t, {}, { platform: 'MacIntel', userAgent: 'Macintosh', maxTouchPoints: 5 }, 1366);
  assert.ok(app.window.document.body.classList.contains('access-blocked'));
  assert.equal(app.el('app').inert, true);
  assert.match(app.el('access-message').textContent, /desktop or laptop/);
  app.window.document.body.dispatchEvent(new app.window.KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
  app.game.start();
  assert.equal(app.S.started, false);
  assert.equal(app.el('hint').classList.contains('exiting'), false);
});

test('narrow desktop asks for more room and unblocks when widened', async t => {
  const app = await setup(t, {}, { platform: 'Win32', userAgent: 'Windows', maxTouchPoints: 10 }, 700);
  assert.match(app.el('access-message').textContent, /Widen/);
  assert.equal(app.el('app').inert, true);
  app.window.innerWidth = 1200;
  app.window.dispatchEvent(new app.window.Event('resize'));
  assert.equal(app.el('app').inert, false);
  assert.equal(app.window.document.body.classList.contains('access-blocked'), false);
});

test('shrinking the window stops an active session', async t => {
  const app = await setup(t);
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  app.game.start();
  t.mock.timers.tick(280);
  assert.equal(app.S.started, true);
  app.window.innerWidth = 600;
  app.window.dispatchEvent(new app.window.Event('resize'));
  assert.equal(app.S.started, false);
  assert.equal(app.S.timerID, null);
});

test('completed results are saved once and insights can display them', async t => {
  const app = await setup(t, { display: 'word', soundKeys: false, soundFx: false });
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  app.game.start();
  t.mock.timers.tick(280);
  assert.equal(app.el('btn-insights').disabled, true);
  app.S.startTime = performance.now() - 60000;
  app.S.typed = app.S.currentWord;
  app.game.submitWord();
  app.game.endGame();
  app.game.endGame();
  const saved = JSON.parse(app.window.localStorage.getItem('novltype_history'));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].words, 1);
  assert.equal(saved[0].accuracy, 100);
  assert.equal(app.el('btn-insights').disabled, false);
  app.el('btn-settings').click();
  app.el('btn-insights').click();
  assert.equal(app.el('settings-panel').classList.contains('open'), false);
  assert.equal(app.el('insights-panel').inert, false);
  assert.equal(app.el('insights-content').querySelectorAll('tbody tr').length, 1);
  assert.equal(app.el('btn-history-clear'), null);
  assert.equal(app.el('btn-insights-close'), null);
  app.window.document.body.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(app.el('insights-panel').inert, true);
  assert.equal(app.window.document.activeElement, app.el('btn-insights'));

});

test('empty sessions are not added to history', async t => {
  const app = await setup(t);
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  app.game.start(); t.mock.timers.tick(280); app.game.endGame();
  assert.equal(app.window.localStorage.getItem('novltype_history'), null);
});


test('insights preview stays compact and the full page displays all saved details', async t => {
  const app = await setup(t, { light: true });
  const history = Array.from({ length: 12 }, (_, i) => ({
    timestamp: Date.now() - i * 60000, wpm: 50 + i, accuracy: 95,
    durationMs: 30000, words: 25, mode: '30s',
  }));
  app.window.localStorage.setItem('novltype_history', JSON.stringify(history));
  app.el('btn-insights').click();
  assert.equal(app.el('insights-content').querySelectorAll('tbody tr').length, 5);
  assert.match(app.el('insights-view-all').getAttribute('href'), /insights.html$/);
  await app.loadInsightsPage();
  assert.equal(app.el('full-insights').querySelectorAll('tbody tr').length, 12);
  assert.equal(app.el('full-insights').querySelectorAll('tbody tr')[0].cells.length, 6);
  assert.match(app.el('full-insights').textContent, /words typed/);
  assert.ok(app.window.document.body.classList.contains('light'));
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  app.el('clear-all-history').click();
  assert.equal(app.el('history-confirm').open, true);
  assert.notEqual(app.window.localStorage.getItem('novltype_history'), null);
  app.el('history-confirm-button').click();
  assert.notEqual(app.window.localStorage.getItem('novltype_history'), null);
  const hold = app.el('history-hold');
  const key = type => hold.dispatchEvent(new app.window.KeyboardEvent(type, { key: ' ', bubbles: true }));
  key('keydown'); t.mock.timers.tick(4900); key('keyup');
  t.mock.timers.tick(5000);
  assert.notEqual(app.window.localStorage.getItem('novltype_history'), null);
  key('keydown'); t.mock.timers.tick(4999);
  assert.notEqual(app.window.localStorage.getItem('novltype_history'), null);
  t.mock.timers.tick(1);
  assert.equal(app.window.localStorage.getItem('novltype_history'), null);
  assert.equal(app.el('history-confirm').open, false);
  assert.notEqual(app.window.localStorage.getItem('novltype_prefs'), null);
  assert.match(app.el('full-insights').textContent, /fresh start/);
  assert.equal(app.el('history-status').textContent, 'History cleared.');
});


test('cancelling the confirmation or leaving a pointer hold preserves history', async t => {
  const app = await setup(t);
  app.window.localStorage.setItem('novltype_history', JSON.stringify([
    { timestamp: Date.now(), wpm: 40, accuracy: 90, durationMs: 30000, words: 20, mode: '30s' },
  ]));
  await app.loadInsightsPage();
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  app.el('clear-all-history').click();
  app.el('history-cancel').click();
  assert.equal(app.el('history-confirm').open, false);
  app.el('clear-all-history').click();
  app.el('history-confirm-button').click();
  app.el('history-hold').dispatchEvent(new app.window.MouseEvent('pointerdown', { button: 0, bubbles: true }));
  t.mock.timers.tick(2000);
  app.el('history-hold').dispatchEvent(new app.window.Event('pointerleave'));
  t.mock.timers.tick(6000);
  assert.notEqual(app.window.localStorage.getItem('novltype_history'), null);
  app.window.document.body.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(app.el('history-confirm').open, false);
});
