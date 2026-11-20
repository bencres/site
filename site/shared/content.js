// One source of truth for what the site says. Every design variant renders
// from this, so narrowing down to one design never means rewriting copy.
// Pulled from bencres.dev (the Next.js site at ~/Projects/bencres-site:
// data/experiences.ts, data/projects.ts, data/posts/*.md, components/hero.tsx,
// components/header.tsx). Work entries without a public page link to '#'.

export const content = {
  name: 'Ben Cressman',
  short: 'Ben',
  initials: 'BC',
  tagline: 'Software engineer in Dallas, shipping fintech from idea to launch.',
  intro: [
    "Hi, I'm Ben. I'm a software engineer in fintech. Prior, I was a technical artist in visual effects and game development. Here, you'll find whatever's going on in my head and life.",
  ],
  email: 'hello@bencres.dev',
  site: 'https://bencres.dev',

  now: {
    updated: 'November 2026',
    items: [
      "I'm a senior engineer at The Axle Group building products and solving problems for lenders.",
      "I'm an adjunct professor at UTD teaching a tools development course that I developed with Prof. Nelson Lim.",
    ],
  },

  work: [
    { name: 'The Axle Group', role: 'Software Engineer III', when: 'Aug 2026 – present', url: '#', blurb: 'Shipping fintech applications from idea to launch with Next.js and AWS.', tags: ['Python', 'Next.js', 'TypeScript', 'AWS', 'PostgreSQL', 'Docker'] },
    { name: 'UT Dallas', role: 'Adjunct Professor', when: 'Aug 2026 – present', url: '#' },
    { name: 'The Axle Group', role: 'Software Engineer II', when: 'Mar – Aug 2026', url: '#', blurb: 'Shipping fintech applications from idea to launch with Next.js and AWS.', tags: ['Python', 'Next.js', 'TypeScript', 'AWS', 'PostgreSQL', 'Docker'] },
    { name: 'HytaleModding', role: 'Freelance full-stack developer', when: 'Dec 2025 – Mar 2026', url: 'https://hytalemodding.dev/', blurb: 'Shipped hytalemodding.dev as one of two front-end engineers, plus several real-time server back-ends in Python, FastAPI, Redis and Docker.', tags: ['TypeScript', 'Next.js', 'Python'] },
    { name: 'Pixel Foundry', role: 'Tools Developer', when: 'Aug 2025 – Mar 2026', url: 'https://github.com/pxf-lab', blurb: "Developed the photo-real effects and photogrammetry pipeline, including the environment launcher and a variety of small scripts and tools.", tags: ['Python', 'SQL', 'Houdini', 'Nuke', 'Maya', 'Unreal'] },
    { name: 'Multimodal Interaction Lab', role: 'Software Engineer', when: 'Jan – May 2025', url: '#', blurb: "Integrated novel VR haptics hardware with Unity and Meta's XR SDK; third coauthor of the paper, accepted to CHI 2026.", tags: ['C#', 'Unity', 'Meta XR SDK'] },
    { name: 'UT Dallas', role: 'Python teaching assistant', when: 'Aug 2023 – May 2026', url: '#', blurb: "Wrote the Bass School's educational programming infrastructure to automate testing, grading and feedback (16× cheaper to run than before), and lectured an introductory Python course.", tags: ['Python', 'GitHub Actions'] },
    { name: 'Unlimited Fries Studios', role: 'Technical artist', when: 'May – Sep 2023', url: 'https://store.steampowered.com/app/2667430/Grimhook/', blurb: 'Shaders and tools for Grimhook, a hand-painted 3D bullet-hell: a real-time FFT ocean and a procedural hand-painting generator.', tags: ['Python', 'HLSL', 'Unreal'] },
    { name: 'UT Dallas', role: 'Lead artist', when: 'Jan – May 2023', url: 'https://www.atec-animgames.com/game-lab', blurb: 'Lead artist on Death Bloom, a realistic horror game: assets, tools and shaders, and a team of 13 artists.', tags: ['Python', 'HLSL', 'Unreal'] },
  ],

  projects: [
    { name: 'Universal Asset Browser', blurb: 'one asset browser for every content creation app', url: 'https://github.com/pxf-lab/uab', description: "The Pixel Foundry's Universal Asset Browser: a tool for digital creators to unify asset access and usage across content creation applications.", tags: ['Python', 'Houdini'] },
    { name: 'SensoryBlox', blurb: 'modular VR controllers with haptic, olfactory, thermal and air feedback (accepted to CHI 2026)', url: 'https://dl.acm.org/doi/10.1145/3772318.3791596', description: 'A novel hardware system for dynamic, modular virtual reality controllers: user-authored, taking any simple shape, delivering haptic, olfactory, thermal and air feedback. Paper at CHI 2026.', tags: ['Python', 'Unity', 'C#'] },
    { name: 'Grimhook', blurb: 'shaders and tools for a hand-painted bullet-hell', url: 'https://store.steampowered.com/app/2667430/Grimhook/', description: 'Technical artist on Grimhook at Unlimited Fries: tools and shaders like a fast Fourier transform ocean and a procedural hand-painted generator.', tags: ['Python', 'HLSL', 'Unreal'] },
    { name: 'HytaleModding', blurb: 'the home of a 10,000-developer modding community', url: 'https://hytalemodding.dev/', description: "HytaleModding's main site: docs, guides, forums, game jams and partner project back-ends for 10,000+ developers modding Hytale.", tags: ['TypeScript', 'Python', 'Next.js', 'React', 'Tailwind', 'nginx', 'Redis', 'Docker', 'FastAPI'], links: [{ label: 'GitHub', url: 'https://github.com/HytaleModding/site' }, { label: 'Live', url: 'https://hytalemodding.dev/' }] },
    { name: 'vfxdirs', blurb: 'a Python library for VFX software paths on any OS', url: 'https://github.com/bencres/vfxdirs', description: 'Easy access to the useful paths of visual effects software on any operating system. Implements common packages and is easily extensible with others. Work in progress.', tags: ['Python', 'WIP'] },
    { name: 'Death Bloom', blurb: 'lead artist on a realistic horror game', url: 'https://www.atec-animgames.com/game-lab', description: 'Lead artist on Death Bloom at UTD: art direction, tools and shaders, and a team of 13 artists.', tags: ['Python', 'HLSL', 'Unreal'], links: [{ label: 'Play', url: 'https://www.atec-animgames.com/game-lab' }, { label: 'Trailer', url: 'https://vimeo.com/825557758' }] },
  ],

  writing: [
    { title: "Dynamically loading EXR and HDR files during Qt's paint", date: 'Jan 2026', url: 'blog/008-swe-dynamic-exr-hdr/', local: true },
    { title: 'Universal Asset Browser: plugins, external libraries, and the registry pattern', date: 'Dec 2025', url: 'blog/006-progress-uab-plugins/', local: true, starred: true },
    { title: 'Universal Asset Browser: GUI enhancements, launcher shenanigans, and a new server/client model', date: 'Nov 2025', url: 'blog/004-progress-uab-gui-enhancements/', local: true },
    { title: 'Universal Asset Browser: browser resize algorithm', date: 'Nov 2025', url: 'blog/003-progress-uab-resize-algorithm/', local: true },
    { title: 'Houdini 21: how to create a package', date: 'Nov 2025', url: 'blog/001-guide-houdini-package/', local: true, starred: true },
  ],

  elsewhere: [
    { name: 'GitHub', url: 'https://github.com/bencres' },
    { name: 'LinkedIn', url: 'https://linkedin.com/in/bencres' },
  ],
};

// tiny helper so each variant can build markup without a framework
export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null && c !== false) node.append(c.nodeType ? c : document.createTextNode(c));
  return node;
}
