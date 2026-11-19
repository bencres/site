// What season and hour the hill is painted for: the visitor's clock, or a preview
// (?season=&time= / ?day=MM-DD&time=HH:MM in the URL, or the almanac's dials,
// which are remembered for the rest of the visit so a post keeps the same light).

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const TIMES = ['morning', 'day', 'afternoon', 'dusk', 'night'];
const KEY = 'shire-ii:preview';

export function when(params = new URLSearchParams(location.search), now = new Date()) {
  let month = now.getMonth();
  let hours = now.getHours() + now.getMinutes() / 60;
  const day = params.get('day')?.match(/^(\d{1,2})-(\d{1,2})$/);
  if (day) month = Math.min(11, Math.max(0, +day[1] - 1));
  let season = [3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3][month];
  if (SEASONS.includes(params.get('season'))) season = SEASONS.indexOf(params.get('season'));
  const t = params.get('time') || '';
  const hm = t.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) hours = +hm[1] + +hm[2] / 60;
  // the light keeps different hours through the year
  const dawn = [5.5, 5, 6.5, 7.25][season];
  const golden = [16.5, 17.5, 15.5, 14.5][season];
  const dusk = [18.75, 19.75, 17.5, 16.5][season];
  const night = dusk + 2.25;
  let time = hours >= night || hours < dawn ? 4 : hours >= dusk ? 3 : hours >= golden ? 2 : hours >= 10 ? 1 : 0;
  if (TIMES.includes(t)) time = TIMES.indexOf(t);
  // the clock's hour, unless a named time (?time=day) stands in for it
  return { season, time, hour: TIMES.includes(t) ? null : hours, elevenses: hours >= 11 && hours < 12 && !TIMES.includes(t) };
}

export function remember(preview) {
  try {
    if (preview) sessionStorage.setItem(KEY, JSON.stringify({ season: preview.season, time: preview.time }));
    else sessionStorage.removeItem(KEY);
  } catch {}
}

export function remembered() {
  try {
    const p = JSON.parse(sessionStorage.getItem(KEY));
    if (p && Number.isInteger(p.season) && Number.isInteger(p.time)) return { ...p, hour: null, elevenses: false };
  } catch {}
  return null;
}
