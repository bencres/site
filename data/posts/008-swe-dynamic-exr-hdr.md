---
title: "Dynamically Loading EXR and HDR Files During Paint"
category: "swe"
date: "2026-01-28"
id: "swe-0001"
tags: ["software engineering", "qt", "optimization"]
excerpt: "How I implemented dynamically loading EXR and HDR files for the delegate asset thumbnails in the Universal Asset Browser"
---

# Context

For rendering thousands of items on the screen, your only choice in QT is to use delegates (`QStyledItemDelegate`); widgets are too memory-costly to keep thousands at once alive. Delegates, however, are drawn during paint, which (in short) means that every time the user interacts with the view, delegates are re-rendered.

The problem is this: not every HDR or EXR file (or other heavy file types, but implemented now is HDR and EXR) is guaranteed to come with a pre-rendered preview. As such, they have to be decoded, tone-mapped, gamma-corrected, and resampled on-the-fly. Without anything external to painting the delegates, this process is repeated for each delegate, up to something like 60 times every second, which makes the application so slow as to be unusable.

As such, I implemented an asynchronous HDR/EXR thumbnail loading system. 


# Implementation

Details about how this system is architected and works in the context of the Universal Asset Browser.

A unified base class architecture with specialized loaders:

## Base Class: `ThumbnailLoaderBase`

Abstract base class (`QThread`) providing:
- Thread management: queue (`list[Any]`), mutex (`QMutex`), stop flag
- Common signals: `batch_complete`, `all_complete`
- Queue operations: `set_items()`, `add_item()`, `request_stop()`
- Abstract method: `_process_item(item: Any) -> None` for subclass-specific logic

Uses `QMutexLocker` for thread-safe queue access. The `run()` loop processes items, calls `_process_item()`, and emits batch/all-complete signals.

## Subclass 1: `NetworkThumbnailLoader`

Extends `ThumbnailLoaderBase` for network thumbnail downloads:
- Processes `StandardAsset` items
- Uses synchronous `urllib` (avoids aiohttp thread-safety issues)
    - Using `urllib` instead of `requests` to avoid as many third-party dependencies as possible, as the dependencies have to be bundled with the application in embedded contexts
- Emits `thumbnail_ready(str, Path)` with asset_id and cached file path
- Used by the presenter layer for batch processing cloud assets

## Subclass 2: `LocalImageLoader`

Extends `ThumbnailLoaderBase` for local file processing:
- Processes `(asset_id: str, path: Path, max_size: int)` tuples
- Detects HDR/EXR by file extension
    - Bug right now: many texture maps are EXR files... so naturally they're currently considered HDRI's!
- Calls `load_hdri_thumbnail()` for conversion
- Emits `thumbnail_loaded(str, QPixmap)` with asset_id and processed pixmap
- Used by the UI layer for on-demand loading during paint

## Layers

The layers of this system ()

### Delegate Layer (`AssetDelegate`)

**Loading State Tracking:**
- `_loading_assets: set[str]` — tracks assets currently loading
- `_loading_placeholder: Optional[QPixmap]` — cached loading icon
- `_image_loader: Optional[LocalImageLoader]` — reference to background loader
- `thumbnail_ready = Signal(str)` — emitted when thumbnail is ready

```python
# short version
if cached:
    return cached

if suffix in (".hdr", ".exr"):
    if asset_id not in _loading_assets and _image_loader is not None:
        _loading_assets.add(asset_id)
        _image_loader.add_item((asset_id, path, max_size))
        if not _image_loader.isRunning():
            _image_loader.start()
        return _get_loading_placeholder()
```

**Handler Methods:**
- `set_image_loader()` — connects loader's `thumbnail_loaded` signal
- `_on_image_thumbnail_loaded()` — updates cache, removes from loading set, emits `thumbnail_ready`
- `_get_loading_placeholder()` — creates/caches lightweight "Loading..." QPixmap

### View Layer (`BrowserView`)

**Initialization:**
- Creates `LocalImageLoader` instance in `__init__`
- Connects delegate's `thumbnail_ready` signal to `_on_thumbnail_ready()`
- Passes loader to delegate via `delegate.set_image_loader()`

**Update Handler:**
- `_on_thumbnail_ready(asset_id)` — finds `QModelIndex` by iterating model, calls `self._grid.update(index)` to trigger repaint

# Data Flow

1. User scrolls → `paint()` called for visible items
2. `_get_thumbnail()` checks cache → not found
3. For HDR/EXR: adds to `_loading_assets`, queues load request, returns placeholder
4. Background thread: `LocalImageLoader._process_item()` calls `load_hdri_thumbnail()`
5. On completion: emits `thumbnail_loaded(asset_id, pixmap)`
6. Main thread: `_on_image_thumbnail_loaded()` updates cache, emits `thumbnail_ready(asset_id)`
7. View: `_on_thumbnail_ready()` finds index, calls `update(index)` → repaint with actual thumbnail

# Technical Challenges and Solutions

A brief discussion of challenges and problems I faced, and how I handled them.

## 1. Challenge: Thread Safety

- Qt signals/slots use queued connections for cross-thread communication
- `QMutex` protects queue access
- Cache updates happen on the main thread via signal handlers
- `_loading_assets` set is only accessed from the main thread

## 2. Challenge: Queue Management

- `add_item()` allows incremental additions without replacing the queue
- Supports concurrent requests during rapid scrolling
- Thread-safe via mutex protection

## 3. Problem: Houdini bundles an older Pillow without `Image.Resampling` (added in 9.1.0).

**Solution:** Use Lanczos resampling.

```python
try:
    resampling = Image.Resampling.LANCZOS
except AttributeError:
    resampling = Image.LANCZOS
```

## 4. Problem: HDR files appeared darker in Houdini than in the standalone desktop app

I think either because of a different `imageio` version or color space management, but I'm not sure about this one. Needs more research.

**Solution:** Adaptive exposure based on median luminance:
```python
# actual implementation
luminance = 0.2126 * hdr_data[:, :, 0] + 0.7152 * hdr_data[:, :, 1] + 0.0722 * hdr_data[:, :, 2]
median_lum = np.median(luminance[luminance > 0])
if median_lum > 0:
    target_lum = 0.18  # Middle gray
    exposure = target_lum / median_lum
    exposure = max(0.1, min(10.0, exposure))  # Clamp to reasonable range
```

This normalizes brightness across different HDR files and environments, though minor differences persist. Will come back to this.

## 5. Problem: Caching thousands of assets

I've implemented a simple [LRU cache](https://redis.io/glossary/lru-cache/) capped at 200, which is pretty arbitrary, but was chosen for:

QPixmap Memory Footprint:
- Each thumbnail is a QPixmap stored in GPU/system memory
- At default cell size (180px) with margins: ~164×164 pixels
- RGBA format: 164 × 164 × 4 bytes ≈ 107 KB per thumbnail
- 200 thumbnails ≈ 21 MB minimum (before Qt overhead)

And because given physical size constraints of the browser, it should be very rare that 200 assets is not at least several screen-fulls.

*Side note*: `functools` has a built-in LRU cache in `functools.lru_cache`. Lesson learned to check if there's a built-in solution for data structures in the future. I'm sure their implementation is way more robust than mine.

# Questions

1. Does Houdini apply anything to images with tonemapping, color spaces, etc. that would cause the dynamically rendered HDR/EXR's to look different? I'm confused because this process is very similar to my first implemenation that used widgets instead of delegates, and the coloration between the embedded Houdini version and the standalone desktop version was consistent.

2. Is this how Nuke, Unreal, etc. render EXR thumbnail images? Is there a better way to accomplish this?

3. Architecturally, does it make a meaningful difference to have implemented an interface for thumbnail loading, since there are only ever two ways to get a thumbnail (from disk or from network)?

# Implementation Reference

Quick reference for my implementation and some places I read about these concepts.

## Universal Asset Browser

1. [Delegates](https://github.com/pxf-lab/uab/blob/main/src/uab/ui/delegates.py)
2. [Thumbnail loader interface, local implementation, and HDR/EXR conversion](https://github.com/pxf-lab/uab/blob/main/src/uab/ui/utils.py)
3. [Network implementation and usage](https://github.com/pxf-lab/uab/blob/main/src/uab/presenters/tab_presenter.py)

## PySide6 Documentation
1. [QStyledItemDelegate](https://doc.qt.io/qtforpython-6/PySide6/QtWidgets/QStyledItemDelegate.html)
2. [What is a mutex?](https://stackoverflow.com/a/34558/23048824) (this is my first time touching threading)
3. [LRU Cache Concept](https://redis.io/glossary/lru-cache/) (this is also my first time implementing an LRU cache)
4. [LRU Cache Implementation](https://www.geeksforgeeks.org/system-design/lru-cache-implementation/)