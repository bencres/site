---
title: "Universal Asset Browser: Browser Resize Algorithm"
category: "tech art"
date: "2025-11-15"
id: "ta-0003"
tags: ["software engineering", "houdini", "python", "tech art", "uab"]
excerpt: "Writing an algorithm to dynamically resize grid cells and grid dimensions."
---

# Purpose

- Users often want to easily see up-close the Preview image of an asset to inspect it for their scene. They also often need to glance at many assets at once to glance through their assets to get an idea of which ones may be suitable. This algorithm is designed to enable that.

![The default size of the UAB's browser.](/blog-images/003-default-size.png)

![The UAB's browser at minimum size.](/blog-images/003-smallest-size.png)

![The UAB's browser zoomed in.](/blog-images/003-zoomed-in.png)

# Technical Design Specifications

- The grid's cell size is uniform.
- The grid's cell size must grow and shrink.
- The grid's row and column count must increase and decrease in proportion to the dimensions of the grid's cell size.
- The grid's row and column count still must respond to window resize events, maintaining cell size.

# Approach

The core flow is as follows:
```text
resize event (from Qt: resizeEvent)
  show event (from Qt: showEvent)
    zoom
    reflow the grid
    compute the new column count
    rebuild the layout
```

Necessary base information about the widget's current state is stored, tracking:
1. The minimum size of the grid's cell.
2. The scale factor (rate of zoom).
3. The last number of columns that was drawn.

There are three triggers for reflowing the grid:
1. When the widget is shown. On initial show, reflow the grid for the current widget size.
2. When the widget is resized. When the widget's size changes, reflow **only if the necessary column count actually changes**, which is why the last number of columns drawn is stored.
3. When the zoom changes. When the user holds cmd/ctrl and scrolls, zoom is triggered.

## Grid Reflow
1. Clear the grid. Remove all of the layout items.
2. Compute how many columns can fit.
    1. Start with the available width of the scroll area's visible section.
    2. Guard for early initialization (layout metrics don't yet exist on init).
    3. Subtract the grid margins.
    4. Compute the width of each cell.
    5. Compute how many cells can fit in the space.
      - Guarantee at least one column for small spaces as the minimum size of the widget.
3. Compute the scaled size of the cell.
    - `int(min width * scale factor)`
4. Place the widget contents in each cell (in this case, a Preview).
5. Add horizontal stretch to guarantee that each column is the same width.

## Zoom
1. Filter the event to guarantee that the scroll position doesn't change if cmd/ctrl is held.
2. Compute the change in angle.
3. Compute the new scale factor.
4. Reflow the grid with the new scale factor.
5. Compute the new positions of the horizontal and vertical scroll to keep the point under the cursor fixed.

This creates an intuitive way to zoom in and out of the browser's preview images.
