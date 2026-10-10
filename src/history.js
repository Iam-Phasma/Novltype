export const HISTORY_KEY = 'novltype_history';
export const HISTORY_LIMIT = 50;

export function readHistory(storage = localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(HISTORY_KEY));
    if (!Array.isArray(saved)) return [];
    return saved.filter(item => item && Number.isFinite(item.timestamp) &&
      Number.isFinite(item.wpm) && item.wpm >= 0 &&
      Number.isFinite(item.accuracy) && item.accuracy >= 0 && item.accuracy <= 100 &&
      Number.isFinite(item.durationMs) && item.durationMs > 0 &&
      Number.isInteger(item.words) && item.words > 0 &&
      ['off', '30s', '1min', '2min', '3min', '5min'].includes(item.mode)
    ).slice(0, HISTORY_LIMIT);
  } catch { return []; }
}

export function saveSession(session, storage = localStorage) {
  const history = [session, ...readHistory(storage)].slice(0, HISTORY_LIMIT);
  try {
    storage.setItem(HISTORY_KEY, JSON.stringify(history));
    return true;
  } catch { return false; }
}

export function clearHistory(storage = localStorage) {
  try { storage.removeItem(HISTORY_KEY); return true; }
  catch { return false; }
}
