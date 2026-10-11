// Keep the outgoing screen visible while the destination slides over it.
export function initInsightsTransition() {
  const link = document.getElementById('insights-view-all');
  if (!link || 'CSSViewTransitionRule' in window) return;
  let navigating = false;

  link.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    event.preventDefault();
    event.stopPropagation();
    if (navigating) return;
    navigating = true;

    const frame = document.createElement('iframe');
    frame.className = 'insights-transition-frame';
    frame.title = 'Your insights';
    frame.tabIndex = -1;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(loadTimeout);
      window.location.assign(link.href);
    };
    const loadTimeout = setTimeout(finish, 5000);
    frame.addEventListener('load', () => {
      clearTimeout(loadTimeout);
      frame.addEventListener('animationend', finish, { once: true });
      frame.classList.add('entering');
      // Navigation still completes if animation events are unavailable.
      setTimeout(finish, 500);
    }, { once: true });
    frame.addEventListener('error', finish, { once: true });
    frame.src = link.href;
    document.body.append(frame);

    window.addEventListener('pageshow', () => {
      frame.remove();
      navigating = false;
    }, { once: true });
  });
}
