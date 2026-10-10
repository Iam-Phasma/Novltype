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
