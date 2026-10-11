import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { initInsightsTransition } from '../src/page-transition.js';

test('fallback slides loaded insights over typing before navigating', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const dom = new JSDOM('<main>typing</main><a id="insights-view-all" href="/insights.html">insights</a>', { url: 'https://novltype.test/' });
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const destinations = [];
  globalThis.document = dom.window.document;
  globalThis.window = {
    location: { assign: url => destinations.push(url) },
    matchMedia: () => ({ matches: false }),
    addEventListener: dom.window.addEventListener.bind(dom.window),
  };
  t.after(() => {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    dom.window.close();
  });
  initInsightsTransition();
  const link = document.getElementById('insights-view-all');
  const click = () => link.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.equal(click(), false);
  const frame = document.querySelector('iframe');
  assert.equal(frame.src, link.href);
  assert.equal(document.querySelector('main').textContent, 'typing');
  click();
  assert.equal(document.querySelectorAll('iframe').length, 1);
  assert.deepEqual(destinations, []);
  frame.dispatchEvent(new dom.window.Event('load'));
  assert.equal(frame.classList.contains('entering'), true);
  frame.dispatchEvent(new dom.window.Event('animationend'));
  assert.deepEqual(destinations, [link.href]);
  t.mock.timers.tick(600);
  assert.equal(destinations.length, 1);
});
