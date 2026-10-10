import test from 'node:test';
import assert from 'node:assert/strict';
import { readHistory, saveSession, clearHistory, HISTORY_KEY } from '../src/history.js';

function storage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}
const session = { timestamp: 100, wpm: 60, accuracy: 95, durationMs: 30000, words: 30, mode: '30s' };

test('history retains the latest 50 sessions across reads', () => {
  const cache = storage();
  for (let i = 0; i < 55; i++) saveSession({ ...session, timestamp: i }, cache);
  const history = readHistory(cache);
  assert.equal(history.length, 50);
  assert.equal(history[0].timestamp, 54);
  assert.equal(history.at(-1).timestamp, 5);
});

test('invalid cache entries are ignored and clearing preserves preferences', () => {
  const cache = storage();
  cache.setItem('novltype_prefs', '{"light":true}');
  cache.setItem(HISTORY_KEY, JSON.stringify([session, null, { ...session, accuracy: 200 }, { ...session, words: 0 }]));
  assert.deepEqual(readHistory(cache), [session]);
  assert.equal(clearHistory(cache), true);
  assert.deepEqual(readHistory(cache), []);
  assert.equal(cache.getItem('novltype_prefs'), '{"light":true}');
  cache.setItem(HISTORY_KEY, 'invalid JSON');
  assert.deepEqual(readHistory(cache), []);
});

test('unavailable storage does not interrupt the session', () => {
  const cache = { getItem() { throw Error('blocked'); }, setItem() { throw Error('full'); }, removeItem() { throw Error('blocked'); } };
  assert.deepEqual(readHistory(cache), []);
  assert.equal(saveSession(session, cache), false);
  assert.equal(clearHistory(cache), false);
});
