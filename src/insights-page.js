import './style.css';
import { readHistory } from './history.js';
import { initHistoryClear } from './history-clear.js';
import { validatePreferences } from './preferences.js';

try {
  const prefs = validatePreferences(JSON.parse(localStorage.getItem('novltype_prefs')));
  document.body.classList.toggle('light', prefs.light === true);
} catch {}

const content = document.getElementById('full-insights');
const clearButton = document.getElementById('clear-all-history');

function duration(ms) {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function render() {
  const history = readHistory();
  content.replaceChildren();
  clearButton.hidden = !history.length;
  if (!history.length) {
    const empty = document.createElement('p');
    empty.className = 'insights-page-empty';
    empty.textContent = 'A fresh start. Finish a typing session, then come back to see your progress.';
    content.append(empty);
    return;
  }
  const summary = document.createElement('div');
  summary.className = 'insights-summary insights-page-summary';
  const average = key => Math.round(history.reduce((sum, item) => sum + item[key], 0) / history.length);
  for (const [value, label] of [
    [history.length, 'sessions'],
    [Math.max(...history.map(item => item.wpm)), 'best wpm'],
    [average('wpm'), 'average wpm'],
    [average('accuracy') + '%', 'average acc'],
    [history.reduce((sum, item) => sum + item.words, 0), 'words typed'],
    [duration(history.reduce((sum, item) => sum + item.durationMs, 0)), 'typing time'],
  ]) {
    const stat = document.createElement('div');
    const valueElement = document.createElement('strong');
    const labelElement = document.createElement('span');
    valueElement.textContent = value; labelElement.textContent = label;
    stat.append(valueElement, labelElement); summary.append(stat);
  }
  const note = document.createElement('p');
  note.className = 'insights-note';
  note.textContent = 'Averages include all saved sessions across all modes.';
  const wrapper = document.createElement('div');
  wrapper.className = 'insights-history-wrap';
  const table = document.createElement('table');
  table.className = 'insights-table';
  table.createCaption().textContent = 'all sessions · newest first';
  const header = table.createTHead().insertRow();
  for (const label of ['date & time', 'mode', 'wpm', 'accuracy', 'words', 'duration']) {
    const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = label; header.append(cell);
  }
  const body = table.createTBody();
  for (const item of history) {
    const row = body.insertRow();
    for (const value of [
      new Date(item.timestamp).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      item.mode === 'off' ? 'free' : item.mode.replace('min', 'm'),
      item.wpm, item.accuracy + '%', item.words, duration(item.durationMs),
    ]) row.insertCell().textContent = value;
  }
  wrapper.append(table); content.append(summary, note, wrapper);
}

initHistoryClear(render);
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('dialog[open]')) return;
  event.preventDefault();
  document.querySelector('.insights-back').click();
});
window.addEventListener('storage', render);
window.addEventListener('pageshow', render);
render();
