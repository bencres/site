// Tell the page-turn which way it's going: deeper into the site (a post) turns
// forward, back up toward the hill turns back. Runs on the page being revealed.
addEventListener('pagereveal', (e) => {
  if (!e.viewTransition) return;
  const activation = window.navigation?.activation;
  const from = activation?.from?.url;
  const to = activation?.entry?.url;
  const depth = (u) => new URL(u).pathname.split('/').filter(Boolean).length;
  const back = from && to ? depth(to) < depth(from) : false;
  e.viewTransition.types.add(back ? 'back' : 'forward');
});
