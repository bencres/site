// The road so far: every place on the journey map, in the order Ben got there.
//
// To add a stop, append an object to `stops` (the last stop is "here I am
// now") and run `node scripts/build-rive.mjs journey`. The generator
// (rive/journey/gen.mjs) reads this file, places the stops along a winding
// route, raises terrain around each one from its `terrain` hint, routes the
// dashed path, and writes the map (site/riv/journey.riv) plus the label and
// timing layout the page uses (site/journey/layout.json). Same data, same seed,
// same map.
//
//   id       unique, url-safe
//   title    the place label on the map (keep it short; long ones wrap)
//   kind     work | project | school | milestone  (picks the red landmark)
//   when     free text; the years in it feed the scale of years
//   note     a sentence or two for the note card
//   url      optional link ('#' or omit when there is none)
//   terrain  optional: forest | hills | mountains | lake | river | coast | town | plain
//   role     optional subtitle on the note card

export const seed = 1937;

export const stops = [
  {
    id: 'death-bloom', title: 'Death Bloom', kind: 'school', terrain: 'forest',
    role: 'Lead artist, UT Dallas game lab', when: 'Jan – May 2023',
    note: 'Lead artist on a realistic horror game: assets, tools and shaders, and a team of 13 artists.',
    url: 'https://www.atec-animgames.com/game-lab',
  },
  {
    id: 'grimhook', title: 'Grimhook', kind: 'work', terrain: 'coast',
    role: 'Technical artist, Unlimited Fries Studios', when: 'May – Sep 2023',
    note: 'Shaders and tools for a hand-painted 3D bullet-hell: a real-time FFT ocean and a procedural hand-painting generator.',
    url: 'https://store.steampowered.com/app/2667430/Grimhook/',
  },
  {
    id: 'utd', title: 'UT Dallas', kind: 'school', terrain: 'town',
    role: 'Python teaching assistant', when: 'Aug 2023 – May 2026',
    note: "Wrote the Bass School's programming infrastructure to automate testing, grading and feedback (16× cheaper to run), and lectured an introductory Python course.",
    url: '#',
  },
  {
    id: 'mmi-lab', title: 'Multimodal Interaction Lab', kind: 'work', terrain: 'lake',
    role: 'VR developer', when: 'Jan – May 2025',
    note: "Integrated novel VR haptics hardware with Unity and Meta's XR SDK.",
    url: '#',
  },
  {
    id: 'sensoryblox', title: 'SensoryBlox', kind: 'milestone', terrain: 'hills',
    role: 'Third coauthor of the paper', when: 'CHI 2026',
    note: 'Modular, user-authored VR controllers that give haptic, olfactory, thermal and air feedback, from the work at the lab. The paper was accepted to CHI 2026.',
    url: 'https://dl.acm.org/doi/10.1145/3772318.3791596',
  },
  {
    id: 'pixel-foundry', title: 'Pixel Foundry', kind: 'work', terrain: 'mountains',
    role: 'Pipeline technical director', when: 'Aug 2025 – Mar 2026',
    note: 'Built the photo-real effects and photogrammetry pipeline, from the environment launcher to a pile of small scripts and tools.',
    url: 'https://github.com/pxf-lab',
  },
  {
    id: 'uab', title: 'Universal Asset Browser', kind: 'project', terrain: 'river',
    role: 'Pixel Foundry', when: 'Nov 2025 – Jan 2026',
    note: 'One asset browser for every content creation app, written up on the blog as it grew.',
    url: 'https://github.com/pxf-lab/uab',
  },
  {
    id: 'env-manager', title: 'Environment Manager', kind: 'project', terrain: 'forest',
    role: 'Pixel Foundry', when: 'Dec 2025',
    note: "The effects pipeline's environment manager, integrated with Houdini for the studio's environment variable scheme. Open source soon.",
    url: '#',
  },
  {
    id: 'hytalemodding', title: 'HytaleModding', kind: 'work', terrain: 'town',
    role: 'Freelance full-stack developer', when: 'Dec 2025 – Mar 2026',
    note: 'Shipped hytalemodding.dev as one of two front-end engineers, plus real-time server back-ends, for a community of 10,000+ developers.',
    url: 'https://hytalemodding.dev/',
  },
  {
    id: 'vfxdirs', title: 'vfxdirs', kind: 'project', terrain: 'hills',
    role: 'Python library', when: 'In progress',
    note: 'Easy access to the useful paths of VFX software on any operating system. Still a work in progress.',
    url: 'https://github.com/bencres/vfxdirs',
  },
  {
    id: 'axle', title: 'The Axle Group', kind: 'work', terrain: 'plain',
    role: 'Software engineer', when: 'Mar 2026 – present',
    note: 'Shipping fintech applications from idea to launch with Next.js and AWS.',
    url: '#',
  },
];
