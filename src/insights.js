import { S } from './state.js';
import { readHistory } from './history.js';
import { initInsightsTransition } from './page-transition.js';

const button = document.getElementById('btn-insights');
const panel = document.getElementById('insights-panel');
const content = document.getElementById('insights-content');
initInsightsTransition();

export function isInsightsOpen() { return panel.classList.contains('open'); }

export function closeInsights(focus = false) {
  panel.classList.remove('open');
  panel.inert = true;
  button.classList.remove('open');
  button.setAttribute('aria-expanded', 'false');
  if (focus) button.focus();
}

function renderInsights() {
  const history = readHistory();
  content.replaceChildren();
  if (!history.length) {
    const empty = document.createElement('p');
    empty.className = 'insights-empty';
    empty.textContent = 'Your next session starts the story. Finish a session to see your results here.';
    content.append(empty);
    return;
  }
  const recent = history.slice(0, 10);
  const summary = document.createElement('div');
  summary.className = 'insights-summary';
  for (const [value, label] of [
    [Math.max(...history.map(item => item.wpm)), 'best wpm'],
    [Math.round(recent.reduce((sum, item) => sum + item.wpm, 0) / recent.length), 'recent wpm'],
    [Math.round(recent.reduce((sum, item) => sum + item.accuracy, 0) / recent.length) + '%', 'recent acc'],
  ]) {
    const stat = document.createElement('div');
    const number = document.createElement('strong');
    const caption = document.createElement('span');
    number.textContent = value;
    caption.textContent = label;
    stat.append(number, caption);
    summary.append(stat);
  }
  const note = document.createElement('p');
  note.className = 'insights-note';
  note.textContent = `Recent averages use your last ${recent.length} sessions across all modes.`;
  const table = document.createElement('table');
  table.className = 'insights-table';
  const caption = table.createCaption();
  caption.textContent = `latest ${Math.min(history.length, 5)} · ${history.length} saved`;
  const header = table.createTHead().insertRow();
  for (const label of ['when', 'mode', 'wpm', 'acc']) {
    const cell = document.createElement('th');
    cell.scope = 'col'; cell.textContent = label; header.append(cell);
  }
  const body = table.createTBody();
  for (const item of history.slice(0, 5)) {
    const row = body.insertRow();
    const date = new Date(item.timestamp);
    const duration = Math.round(item.durationMs / 1000);
    const mode = item.mode === 'off' ? 'free' : item.mode.replace('min', 'm');
    for (const value of [
      date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' +
        date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
      mode, item.wpm, item.accuracy + '%',
    ]) row.insertCell().textContent = value;
    row.title = `${item.words} words · ${duration}s`;
  }
  content.append(summary, note, table);
}

button.addEventListener('click', event => {
  event.stopPropagation();
  if (S.started) return;
  if (isInsightsOpen()) { closeInsights(); return; }
  window.dispatchEvent(new CustomEvent('insightsopen'));
  renderInsights();
  panel.classList.add('open'); panel.inert = false;
  button.classList.add('open'); button.setAttribute('aria-expanded', 'true');
});
panel.addEventListener('click', event => event.stopPropagation());
document.addEventListener('click', () => closeInsights());
window.addEventListener('sessionstart', () => { closeInsights(); button.disabled = true; });
window.addEventListener('sessionstop', () => { button.disabled = false; });
