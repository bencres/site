// Floating pill linking the drafts, so they can be compared side by side.
const drafts = [
  ['margins', '1 · Margins'],
  ['sketchbook', '2 · Sketchbook'],
  ['plum', '3 · Night plum'],
  ['desk', '4 · Desk'],
  ['hello', '5 · Hello'],
  ['harbor', '6 · Harbor'],
  ['winter', '7 · Winter'],
  ['rings', '8 · Rings'],
  ['herbarium', '9 · Herbarium'],
  ['nook', '10 · Nook'],
  ['winter-ii', '11 · Winter II'],
  ['winter-iii', '12 · Winter III'],
  ['seasons', '13 · Seasons'],
  ['seasons-ii', '14 · Seasons II'],
  ['sketchbook-ii', '15 · Sketchbook II'],
  ['shire', '16 · Shire'],
  ['field-notes', '17 · Field notes'],
  ['manuscript', '18 · Manuscript'],
  ['hearth', '19 · Hearth'],
  ['the-lane', '20 · The lane'],
  ['shire-ii', '21 · Shire II'],
  ['journey', '22 · Journey map'],
];
const here = location.pathname.split('/').filter(Boolean).at(-1);
const nav = document.createElement('nav');
nav.className = 'variant-switch';
nav.setAttribute('aria-label', 'Design drafts');
nav.innerHTML = drafts
  .map(([slug, label]) => `<a href="../${slug}/" ${slug === here ? 'aria-current="page"' : ''} title="${label}">${label.split(' · ')[0]}</a>`)
  .join('') + '<a href="../" title="All drafts">⌂</a>';
document.body.append(nav);
