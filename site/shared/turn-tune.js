// A card of sliders for the page transition's settings (turn.js), kept in
// localStorage so the next arrival uses them. "try it" jumps between the hill
// and a post so the downpour can be watched; "copy" puts the current values on
// the clipboard, ready to become the defaults in turn.js.
const T = globalThis.TURN;

if (T) {
  const values = T.read();
  const save = () => {
    try {
      localStorage.setItem(T.key, JSON.stringify(values));
    } catch {}
  };
  const show = (s, v) => `${s.step < 1 ? (+v).toFixed(s.step < 0.01 ? 3 : 2) : v}${s.unit === 'ms' ? 'ms' : ''}`;

  const card = document.createElement('details');
  card.className = 'turn-tune';
  card.innerHTML = `<summary>the rain</summary>${T.settings
    .map((s) => `<label title="${s.unit ? `${s.label}, ${s.unit}` : s.label}"><span>${s.label} <output data-for="${s.id}"></output></span><input type="range" data-id="${s.id}" min="${s.min}" max="${s.max}" step="${s.step}" value="${values[s.id]}"></label>`)
    .join('')}<div class="row"><button type="button" class="try">try it</button><button type="button" class="quiet reset">reset</button><button type="button" class="quiet copy">copy</button></div>`;
  const outputs = Object.fromEntries([...card.querySelectorAll('output')].map((o) => [o.dataset.for, o]));
  for (const s of T.settings) outputs[s.id].textContent = show(s, values[s.id]);

  card.addEventListener('input', (e) => {
    const id = e.target.dataset?.id;
    if (!id) return;
    values[id] = +e.target.value;
    outputs[id].textContent = show(T.settings.find((s) => s.id === id), values[id]);
    save();
  });
  card.querySelector('.reset').addEventListener('click', () => {
    for (const s of T.settings) {
      values[s.id] = s.value;
      card.querySelector(`[data-id="${s.id}"]`).value = s.value;
      outputs[s.id].textContent = show(s, s.value);
    }
    try {
      localStorage.removeItem(T.key);
    } catch {}
  });
  card.querySelector('.copy').addEventListener('click', (e) => {
    navigator.clipboard?.writeText(JSON.stringify(values, null, 2));
    e.target.textContent = 'copied';
    setTimeout(() => (e.target.textContent = 'copy'), 1200);
  });
  // on the hill, open a post that's written here; on a post, go back to the hill
  card.querySelector('.try').addEventListener('click', (e) => {
    const link = document.querySelector('a[href^="blog/"]') || document.querySelector('.trail a');
    if (!link) return;
    link.click();
    // the rain starts from the button, not from wherever that link is
    try {
      sessionStorage.setItem('turn:at', JSON.stringify({ x: e.clientX / innerWidth, y: e.clientY / innerHeight }));
    } catch {}
  });

  // remember whether it's open; on the hill, sit just above the season & time card
  try {
    card.open = localStorage.getItem('turn:tune-open') === '1';
  } catch {}
  card.addEventListener('toggle', () => {
    try {
      localStorage.setItem('turn:tune-open', card.open ? '1' : '0');
    } catch {}
  });
  // at the foot of the page on narrow screens it sits just above the season & time card
  const almanac = document.getElementById('almanac');
  if (almanac) almanac.before(card);
  else document.body.append(card);
  if (almanac) {
    const place = () => (card.style.bottom = getComputedStyle(almanac).position !== 'fixed' ? '' : `${almanac.getBoundingClientRect().height + parseFloat(getComputedStyle(almanac).bottom) + 10}px`);
    new ResizeObserver(place).observe(almanac);
    place();
  }
}
