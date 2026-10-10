import { clearHistory } from './history.js';

export function initHistoryClear(onClear) {
  const trigger = document.getElementById('clear-all-history');
  const panel = document.getElementById('history-confirm');
  const confirm = document.getElementById('history-confirm-button');
  const hold = document.getElementById('history-hold');
  const status = document.getElementById('history-hold-status');
  let deadline = null;
  let completion = null;
  let progress = null;
  let input = null;

  function stopHold() {
    clearTimeout(completion); clearInterval(progress);
    deadline = null; completion = null; progress = null; input = null;
    hold.style.setProperty('--hold-progress', '0%');
    hold.textContent = 'hold for 5 seconds to clear';
  }
  function cancelHold() {
    if (deadline === null) return;
    stopHold();
    status.textContent = 'Hold cancelled. Hold again for the full five seconds to clear.';
  }
  function close() {
    stopHold(); trigger.disabled = false; panel.close();
    document.body.classList.remove('history-modal-open');
  }
  function updateProgress() {
    const remaining = Math.max(0, deadline - Date.now());
    hold.style.setProperty('--hold-progress', `${(1 - remaining / 5000) * 100}%`);
    hold.textContent = `keep holding · ${Math.ceil(remaining / 1000)}s`;
  }
  function beginHold(source) {
    if (hold.hidden || !panel.open || deadline !== null) return;
    input = source; deadline = Date.now() + 5000;
    status.textContent = 'Keep holding. Releasing early cancels the hold.';
    updateProgress();
    progress = setInterval(updateProgress, 100);
    completion = setTimeout(() => {
      stopHold();
      if (clearHistory()) {
        close(); onClear();
        document.getElementById('history-status').textContent = 'History cleared.';
        document.querySelector('.insights-back').focus();
      } else status.textContent = 'History could not be cleared. Hold again to retry.';
    }, 5000);
  }
  trigger.addEventListener('click', () => {
    stopHold(); trigger.disabled = true;
    confirm.hidden = false; hold.hidden = true;
    status.textContent = 'Confirm, then hold for five seconds. Release early to cancel the hold.';
    panel.showModal();
    document.body.classList.add('history-modal-open');
    confirm.focus();
  });
  confirm.addEventListener('click', () => {
    confirm.hidden = true; hold.hidden = false;
    status.textContent = 'Hold the button for five seconds to clear. You can also hold Space or Enter.';
    hold.focus();
  });
  document.getElementById('history-cancel').addEventListener('click', () => { close(); trigger.focus(); });
  panel.addEventListener('cancel', event => {
    event.preventDefault(); close(); trigger.focus();
  });
  panel.addEventListener('click', event => {
    if (event.target !== panel) return;
    const bounds = panel.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) {
      close(); trigger.focus();
    }
  });
  hold.addEventListener('pointerdown' , event => {
    if (event.button !== 0 || event.isPrimary === false) return;
    event.preventDefault(); hold.focus(); beginHold('pointer');
  });
  for (const event of ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture']) {
    hold.addEventListener(event, () => { if (input === 'pointer') cancelHold(); });
  }
  document.addEventListener('pointerup', () => { if (input === 'pointer') cancelHold(); });
  hold.addEventListener('keydown', event => {
    if (![' ', 'Enter'].includes(event.key)) return;
    event.preventDefault();
    if (!event.repeat) beginHold(event.key);
  });
  hold.addEventListener('keyup', event => {
    if (event.key === input) { event.preventDefault(); cancelHold(); }
  });
  hold.addEventListener('blur', cancelHold);
  window.addEventListener('blur', cancelHold);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelHold(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && panel.open) { event.preventDefault(); close(); trigger.focus(); }
  });
}
