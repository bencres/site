---
title: "What I Learned from 3 Months of Building My First Large Application, and Why I Spent January Rebuilding it from Scratch"
category: "tech art"
date: "2026-01-24"
id: "ta-0007"
tags: ["software engineering", "python", "tech art", "uab", "design patterns"]
excerpt: "Building a large application from the ground up is challenging. Here's what went wrong with my first attempt, and how I fixed it."
---

# Mistakes Were Made

When I set out to build the Universal Asset Browser, I'd written individual tools and scripts, shaders, some small web applications, and worked within large applications that other people had built, but I'd never built a serious application from nothing on my own. I've taken a few graduate CS classes, but I'm mostly self-taught--my formal education was in game development, but mostly on the artistic side (specifically art direction and environment art).

I began by researching design patterns and thinking about how the application should be architected. This was a good idea, but I was ignorant about how to thoughtfully and carefully plan out a project like this. I spent a few days reading about GUI architecture, read about MVP, and decided that it seemed like it made the most sense for me (not really understanding the differences between MVP, MVC, etc.). I was really excited just to *build*. I'd figure it out on the fly, right? I can always refactor, I naively thought.

So I started building. And build I did. I hit our minimum-viable-product, a local asset library in Houdini with local import and the ability to spawn and replace HDRI's, on schedule. But then it came time to integrate PolyHaven, and shocker, suddenly I was fighting my entire codebase. I had sincerely tried to be thoughtful about how I put everything together, and it was a pretty reasonable approach for a local asset library. But as soon as any meaningful amount of extensibility was an issue, the whole thing fell apart: there was no clear way to integrate external libraries at all. More than that, my attempts to do so revealed critical failures in my initial plan. 

## The Mistakes

This is a list of everything I noticed wrong with the original approach. I'm sure there's plenty more; these are just what I noticed. 

- The Presenter in the initial vision of MVP had become a god object in the worst way possible: my approach of creating an inheritance tree of `Presenter <- Application Presenter <- Application Renderer Presenter` meant that swapping renderers at runtime was catastrophic, since the object running the entire application was destroyed. More than that, there was quite a lot of logic that lived in the presenter that shouldn't have--not just business logic, but navigation and database logic, too.
- I'd implemented a local server process that ran separately from the browser that acted as the go-between between the browser and the local assets. This was so that I could implement real-time sync across browser instances, but in hindsight, that is not core to what makes the application useful, and there are ways to implement almost-real-time sync that don't require managing a completely separate process that is extremely bug-prone (the antics I had to do to launch a persisting server process from a function that just returns a base QWidget [required by Houdini] were pretty wild). 
- The browser relied on rendering Thumbnail widgets, which was fine for testing, but not feasible for thousands of assets. It was way too slow (understandably).
- There was no consideration of asynchronous processing, so the application hung while waiting for server responses (which, remember, was every response, because there was a local server between the browser and its asset database).
- There was no clear path for other developers to extend the application, which is core to what makes it so useful. 
- Because the application was tightly coupled to specific software packages, testing was extremely convoluted. 
- And more.

## My Solution

Here's my new approach. 

- Two kinds of presenters:
    - Main Presenter, which acts as an application shell and handles routing.
    - Tab Presenter, each of which is responsible for its own browser and asset library plugin.
- The [plugin system](https://www.bencres.dev/blog/006-progress-uab-plugins) I described in a previous blog post, allowing new asset libraries to be added easily. All an external asset library needs to do is return StandardAssets.
- Two new concepts:
    - Hosts, which are injected into the Main Presenter, and describe renderer-agnostic functionality for a specific DCC (for example, importing geometry in Houdini is Houdini-specific, but not specific to a particular renderer within Houdini).
    - Strategies, which are injected as a dependency to each host, and describe renderer-specific functionality in a DCC (for example, creating an environment light for Karma is different than creating an environment light for Redshift).
- No local server, just a database with a context manager that locks access while it's being used.
- All thumbnails are delegates, which are drawn on demand, enormously increasing performance.
- Built around asynchronous operations wherever possible.
- An absolute boatload of tests (near 100 at the time of writing), since this approach is so much easier to test.
- As described above, a very clear path for other developers to extend the application: if you want to add a new DCC, you add a Host that conforms to `uab.interfaces.HostIntegration`; if you want to add a renderer to a host, you add a Strategy that conforms to `uab.interfaces.RenderStrategy`; if you want to add a new asset library, you add an AssetLibraryPlugin that conforms to `uab.interfaces.AssetLibraryPlugin`. You can even add your own kind of plugin if you want to change other parts of the application (this is still a work-in-progress, though)!

# Lessons Learned

The biggest thing that I learned from this is that, in software engineering, **planning is everything**. Yeah, building is the fun part, but re-building stuff you already made because of poor planning is miserable, and a waste of time if it was possible to do the job properly in the first place. I got here because of ignorance and inexperience, but I won't make that mistake again; not only did I learn a *ton* about design patterns and architecture (especially from reading textbooks on them) from this experience, I began learning about how to plan.

If you take anything away from this blog post, it should be this: plan out exactly what your application needs to do, and with that in mind develop an approach that is intentionally extensible. Your application is very likely to need more than you expect from it originally, there will be edge cases and other issues you don't expect, and if your codebases does not have a clear separation of responsibilities and thoughtful interfaces for how its various parts talk to each other, it will fail.