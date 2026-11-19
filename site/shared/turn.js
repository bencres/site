// Remember where a link was pressed, so the next page can spread in from there
// (see turn.css). Runs as a plain script in <head>, before the page is revealed.
const KEY = 'turn:at';

addEventListener('click', (e) => {
  const a = e.target.closest?.('a[href]');
  if (!a || a.origin !== location.origin || e.defaultPrevented) return;
  // a keyboard "click" has no pointer position; use the link itself
  let x = e.clientX, y = e.clientY;
  if (!e.detail) {
    const r = a.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  }
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ x: x / innerWidth, y: y / innerHeight }));
  } catch {}
}, true);

addEventListener('pagereveal', (e) => {
  if (!e.viewTransition) return;
  let at = { x: 0.5, y: 0.35 };
  try {
    at = JSON.parse(sessionStorage.getItem(KEY)) || at;
    sessionStorage.removeItem(KEY);
  } catch {}
  const root = document.documentElement.style;
  root.setProperty('--bloom-x', `${(at.x * 100).toFixed(2)}vw`);
  root.setProperty('--bloom-y', `${(at.y * 100).toFixed(2)}vh`);
  e.viewTransition.finished.finally(() => {
    root.removeProperty('--bloom-x');
    root.removeProperty('--bloom-y');
  });
});
