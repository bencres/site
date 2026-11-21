// What season and hour the hill is painted for: the visitor's clock, or a preview
// (?season=&time= / ?day=MM-DD&time=HH:MM in the URL). And whether it's a holiday.

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const TIMES = ['morning', 'day', 'afternoon', 'dusk', 'night'];

// A few holidays hang a painting of their own (site/holidays/<name>/), each between two
// days of the year, inclusive (Yule runs over the new year), and each in one season;
// Lithe's midsummer light also keeps its own hours (dawn, gold, dusk, night).
export const HOLIDAYS = {
  lithe: { name: 'Lithe', from: [6, 19], to: [6, 24], season: 1, light: [4.75, 17, 20.25, 22.75] },
  bilbo: { name: 'Bilbo’s birthday', from: [9, 19], to: [9, 25], season: 2 },
  halloween: { name: 'Halloween', from: [10, 20], to: [10, 31], season: 2 },
  yule: { name: 'Yule', from: [12, 18], to: [1, 3], season: 3 },
};

// the holiday by the visitor's calendar (or ?day=MM-DD); ?holiday=<name> shows one any day
// and ?holiday=none none at all
export function holiday(params = new URLSearchParams(location.search), now = new Date()) {
  const asked = params.get('holiday');
  if (asked === 'none') return null;
  if (Object.hasOwn(HOLIDAYS, asked)) return asked;
  const day = params.get('day')?.match(/^(\d{1,2})-(\d{1,2})$/);
  const md = day ? +day[1] * 100 + +day[2] : (now.getMonth() + 1) * 100 + now.getDate();
  for (const [key, { from, to }] of Object.entries(HOLIDAYS)) {
    const a = from[0] * 100 + from[1], b = to[0] * 100 + to[1];
    if (a <= b ? md >= a && md <= b : md >= a || md <= b) return key;
  }
  return null;
}

export function when(params = new URLSearchParams(location.search), now = new Date()) {
  let month = now.getMonth();
  let hours = now.getHours() + now.getMinutes() / 60;
  const day = params.get('day')?.match(/^(\d{1,2})-(\d{1,2})$/);
  if (day) month = Math.min(11, Math.max(0, +day[1] - 1));
  let season = [3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3][month];
  if (SEASONS.includes(params.get('season'))) season = SEASONS.indexOf(params.get('season'));
  const feast = HOLIDAYS[holiday(params, now)];
  if (feast) season = feast.season;
  const t = params.get('time') || '';
  const hm = t.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) hours = +hm[1] + +hm[2] / 60;
  // the light keeps different hours through the year
  const [dawn, golden, dusk] = feast?.light || [[5.5, 5, 6.5, 7.25][season], [16.5, 17.5, 15.5, 14.5][season], [18.75, 19.75, 17.5, 16.5][season]];
  const night = feast?.light?.[3] ?? dusk + 2.25;
  let time = hours >= night || hours < dawn ? 4 : hours >= dusk ? 3 : hours >= golden ? 2 : hours >= 10 ? 1 : 0;
  if (TIMES.includes(t)) time = TIMES.indexOf(t);
  // the clock's hour, unless a named time (?time=day) stands in for it
  return { season, time, hour: TIMES.includes(t) ? null : hours, elevenses: hours >= 11 && hours < 12 && !TIMES.includes(t) };
}
