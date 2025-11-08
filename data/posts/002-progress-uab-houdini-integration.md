---
title: "Universal Asset Browser: Houdini Integration"
category: "tech art"
date: "08-11-2025"
id: "ta-0002"
tags: ["houdini", "python", "tech art", "uab"]
excerpt: "Integrating the Universal Asset Browser with Houdini."
---

Last week, I integrated the Universal Asset Browser with Houdini. The bare-bones functionality is there, which is a great start, but there's still a long way to go.

![Universal Asset Browser in Houdini](/blog-images/002-uab-houdini-panel.png)

I created a `dev` branch for the changes that would be required to format it as a Houdini package. Working in Houdini has a few constraints:

- The modern way to distribute large Houdini tools is as a Houdini package, which has specific formatting and access requirements.
- The UAB should exist as a Python panel, as it is a standalone GUI that artists should have immediate access to within Houdini's main window.
  - Python panels expect a root PySide widget in their `onCreateInterface` function.
- As a Houdini package, all of its external dependencies need to exist within the package's `python3.11libs` directory.

Previously, I'd been running and testing the package as a standalone desktop GUI using the MVP architecture, which instantiated a Presenter that created a `QApplication` and `QMainWindow`. Houdini just needs the main widget of the application, so I refactored such that the GUI instantiates its own Presenter, and the desktop GUI has a very simple `QApplication` and `QMainWindow`, which just sets its central widget to a new `MainWidget` class that Houdini (and future DCC's) will use.

I also had a great conversation with [Kellyn Mendez](https://www.linkedin.com/in/kellyn-mendez/), a technical director at Warner Brothers, who suggested that the GUI should have a base class with default implementations for everything that is application-agnostic, and should subclass for each application-specific functionality, like GUI initialization (desktop must create its own `QApplication` and `QMainWindow`, Houdini must just create its own `MainWidget`, etc.). My previous plan had been to use the adapter pattern and have full adapters for each application, but this accomplishes the same goal in a much simpler way that is still architecturally sound.

Finally, I implemented asset instantiation in Houdini's viewport, so a selected HDRI can be automatically set up as a dome light in the LOPS context.

![Universal Asset Browser instantiating an HDRI in the viewport](/blog-images/002-uab-hdri-instantiation.png)

# Upcoming Features

At the [Pixel Foundry](https://pixelfoundrylab.com/), we work in weekly sprints (the typical AGILE cycle). This week, I'm working on:

1. Finalizing the refactor of the `main` branch with everything I learned from creating the Houdini package.
2. Zooming in/out of the browser's grid, allowing users to change how many assets are previewed at a given time.
3. Batch importing a directory of HDRI's.
4. A new 'Preview' view, which displays the asset in maximum size.

And this/next week (depending on how long the above changes take):

5. A brand-new control scheme:
    - LMB: select an asset.
    - Ctrl + LMB: instantiate the selected asset in the viewport.
    - RMB: open context menu.
      - Options to edit the asset, replace the selected light's texture with the selected HDRI, etc.
    - Double LMB: open asset details.
6. A new asset details view, which replaces the current top-down format with a Lightroom-like layout of preview on the left and info in a vertical view on the right.
7. Tagging assets.
8. Creating an endpoint for fuzzy searching assets by name, filetype, and tag.

# Current Questions
- The texture parameter on a dome light is listed as `inputs:texture:file`, but `file` (or other variations I tried) didn't work for setting the light's texture. When investigating all the parameters on the node with `node.parms`, the only one that worked for setting the Base Properties/Texture parameter was `xn__inputstexturefile_r3ah`. I'm clearly not understanding something.

# Current Issues
- I haven't yet found a way to reload the package without restarting Houdini. `importlib.reload` and `hou.ui.reloadPackage` haven't seemed to have any effect, even in the `onCreateInterface` function.
- The package is around 800MB right now because of all of the external dependencies that are included. I'd really prefer not to package it this way, so I'm looking into ways to reduce package size and dependencies.
- Working on figuring out drag-and-drop to drop assets as nodes in Houdini's context panel. Haven't had much success yet.
- Working on learning the `hou.logging` API, as my current logging methods have been rudimentary.
- I'm worried about namespace conflicts with Houdini's larger environment and the external dependencies that are packaged with the UAB. I *think* they're scoped to the package, but I haven't verified that yet.
