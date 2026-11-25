# Roadmap

## Phase 0: Model exploration

Goal: learn which inbetween models suit the target style before writing pipeline code.

- [ ] Prepare a test set of key pairs (small, medium and large motion; line art and coloured)
- [ ] Run each pair through Wan FLF2V, ToonCrafter and RIFE/FILM
- [ ] Record quality, speed, VRAM and cost per clip
- [ ] Export the best ComfyUI workflows to `server/comfy_workflows/`

## Phase 1: Editor without AI

Goal: an editor good enough to animate by hand. If this works, the data model is right.

- [x] Project / Cut / Layer / Drawing model with undo and redo
- [x] Pressure-sensitive brush and eraser (vector strokes)
- [x] Multiple layers (cels) with visibility and ordering
- [x] Onion skin (previous / next drawings)
- [x] X-sheet: edit exposure per layer, holds, on 1s / 2s / 3s
- [x] Playback at 24 fps honouring exposure
- [x] Save and load projects as JSON (plus browser autosave)
- [ ] Layer opacity (moved to later)

## Phase 2: AI inbetweening

Goal: select two keys, get editable inbetweens with anime timing.

- [ ] FastAPI server with a provider interface (hosted API first)
- [ ] Inbetween endpoint: key A + key B → dense frames
- [ ] Spacing curves (linear, ease in, ease out, ease in-out, custom)
- [ ] Sampling at arbitrary t (nearest frame, then RIFE re-interpolation)
- [ ] Insert results as `inbetween` drawings and write their exposure
- [ ] Progress over WebSocket
- [ ] Side-by-side comparison: raw model output vs. Pyrin timing

## Phase 3: Clean-up and colour

- [ ] Palette extraction and palette lock (remove gradients and colour flicker)
- [ ] Line re-extraction, thinning and consistent line weight
- [ ] Vectorisation of generated drawings
- [ ] Gap-closing flood fill
- [ ] Optional line boil on held frames

## Phase 4: Storyboard and prompt modes

- [ ] Storyboard panel: shots, duration, camera notes
- [ ] Key pose generation with ControlNet and character references
- [ ] Prompt → storyboard → keys → full cut
- [ ] Per-layer timing (e.g. hair on 1s, body on 2s) using layer separation
- [ ] Export: MP4, PNG sequence, layered PSD / OpenToonz / TVPaint
