# Pyrin Editor

The web-based animation editor: canvas, layers, onion skin, timesheet and playback.

**Stack:** TypeScript, React, Vite, Zustand + Immer, Canvas 2D, perfect-freehand, Vitest

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for the timesheet model
npm run build      # type-check and production build
```

## Concepts

- **Drawing:** one sheet, named by layer letter and number (`A1`, `A2`, ...).
- **Exposure (timesheet):** each layer lists which drawing is shown on each frame. A drawing exposed on several frames is a *hold*; drawing on any of those frames edits the same sheet.
- **Shoot on 1s / 2s / 3s:** re-times the active layer so each drawing is held for that many frames.
- **Onion skin:** previous drawings in red, next drawings in green (two each, fading with distance).

Work is autosaved in the browser. Use **Save** / **Open…** to keep `.pyrin.json` project files.

## Shortcuts

Press `?` in the editor for the full list. Hovering a button shows its shortcut.

| Key | Action |
|---|---|
| `B` / `E` / `X` | Brush / eraser / switch between them |
| `[` / `]` | Brush size |
| `O` | Toggle onion skin |
| `Space` | Play / pause |
| `←` / `→` (or `,` / `.`) | Previous / next frame |
| `Shift+←` / `Shift+→` | Previous / next drawing |
| `Home` / `End` | First / last frame |
| `N` / `H` / `Delete` | New drawing / hold / clear cell |
| `+` / `-` | Insert / delete frame |
| `1` / `2` / `3` | Shoot layer on 1s / 2s / 3s |
| `Shift+N` | New layer |
| `↑` / `↓` | Select layer above / below |
| `Alt+↑` / `Alt+↓` | Move layer up / down |
| `V` | Show / hide layer |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / redo |
| `Ctrl+S` / `Ctrl+O` | Save / open |

Shortcuts match physical key positions, so they keep working with a Thai keyboard layout. All shortcuts are defined in [`src/app/commands.ts`](src/app/commands.ts).

## Rendering and performance

- **Three stacked canvases:** under (paper, onion skin, lower layers), active layer, over (upper layers). While drawing, only the active canvas repaints: one cached bitmap plus the live stroke. It uses a low-latency (`desynchronized`) context and shows the pen's predicted points.
- **Drawing bitmaps:** each drawing is rasterised once and cached (LRU, 64 bitmaps). Adding a stroke paints only that stroke onto the existing bitmap. After a cut loads, outlines and bitmaps are prepared during idle time.
- **Input:** coalesced pen events are thinned to points at least 1.5 px apart, which cuts outline cost about 10× with no visible change.
- **Autosave:** IndexedDB, one record per drawing, written during idle time. Only drawings that changed are saved.

Measured on a heavy cut (3 layers × 24 drawings × 60 strokes, 4,320 strokes):

| | Before | After |
|---|---|---|
| Repaint per pen move | 15–24 ms | ~1.3 ms |
| Changing frame (median) | 15–24 ms | ~6.7 ms |
| Autosave after a stroke (blocks page) | ~290 ms | ~9 ms |

## Layout

| Folder | Purpose |
|---|---|
| `src/model/` | Data model, timesheet operations, store with undo, project files |
| `src/canvas/` | Stroke rendering, onion skin, drawing surface |
| `src/timeline/` | Timesheet UI, timesheet commands, playback |
| `src/app/` | App shell, toolbar, keyboard shortcuts |
| `src/api/` | Client for the inference server (Phase 2) |
