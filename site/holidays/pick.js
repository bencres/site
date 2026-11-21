// The almanac's row of holidays (when.js): any of them can be seen on any day, or none
// for the ordinary hill even on a holiday. A holiday is a painting and a script of its own,
// so choosing one loads the page again, keeping the hour if one was being previewed.
import { h } from '../shared/content.js';
import { HOLIDAYS, holiday } from '../when.js';

export function holidayRow() {
  const params = new URLSearchParams(location.search);
  const showing = holiday(params) ?? 'none';
  const today = holiday(new URLSearchParams()) ?? 'none';
  const go = (key) => {
    const q = new URLSearchParams();
    if (params.has('time')) q.set('time', params.get('time'));
    if (key !== today) q.set('holiday', key);
    location.assign(q.size ? `?${q}` : location.pathname);
  };
  const pick = (key, label) => h('button', { type: 'button', 'aria-pressed': String(key === showing), onclick: () => key !== showing && go(key) }, label);
  return h('div', { class: 'feasts', role: 'group', 'aria-label': 'Holiday' },
    h('span', {}, 'holiday'),
    pick('none', 'none'),
    Object.entries(HOLIDAYS).map(([key, { name }]) => pick(key, name)));
}

// "back to now" undoes a holiday picked in the almanac too, which takes loading the page again
export const pickedHoliday = () => new URLSearchParams(location.search).has('holiday');
