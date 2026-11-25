<div align="center">

# Pyrin

**An AI-assisted 2D animation engine built on the grammar of hand-drawn anime.**

Storyboard → Key animation → Timesheet → Inbetween → Clean-up

[Overview](#overview) · [How It Works](#how-it-works) · [Architecture](#architecture) · [Getting Started](#getting-started) · [Roadmap](#roadmap)

![status](https://img.shields.io/badge/status-early%20prototype-orange)
![frontend](https://img.shields.io/badge/frontend-TypeScript%20%2B%20React-3178c6)
![backend](https://img.shields.io/badge/backend-Python%20%2B%20FastAPI-009688)

</div>

---

## Overview

Today's AI video models produce motion that is **smooth but weightless**: every frame is evenly spaced, everything moves at the same rate, and nothing ever holds still. Hand-drawn anime feels alive for the opposite reason. Animators *choose* what to draw and how long to hold it.

Pyrin is not another text-to-video generator. It is an animation engine that follows the production structure of a real anime studio, and uses existing generative models only as tools inside that pipeline:

- **Drawings are separate from timing.** Each layer has its own set of drawings and its own *exposure sheet* (X-sheet), just like professional 2D software.
- **Timing is a first-class control.** Holds, spacing (ease in/out), and shooting on 1s / 2s / 3s are explicit, editable data rather than something a model guesses.
- **AI fills in the labour, not the intent.** Models generate inbetweens and help with clean-up; the animator (or a preset) decides the rhythm.
- **Everything stays editable.** Output is layered drawings on a timeline, not a single flattened video.

### Who it is for

| Level | User | What they control | What Pyrin automates |
|---|---|---|---|
| 1. Prompt | Anyone | Story, character | Storyboard, keys, timing, inbetweens |
| 2. Storyboard | Creators | Shots, camera, mood | Keys and motion from the board |
| 3. Key + Timesheet | Animators | Key poses, holds, spacing | Inbetweens and clean-up |
| 4. Frame-level | Professionals | Every drawing | Consistency and colour assist |

All four levels share one engine and one data model, so work started at a high level can be refined at a lower one.

---

## How It Works

Pyrin treats a video model as a source of raw motion, then re-times that motion the way an animator would.

```
 Key A ─┐
        ├─► [1] Inbetween model ──► dense, evenly-spaced frames (e.g. 49)
 Key B ─┘
                     │
                     ▼
            [2] Spacing curve ──► positions t for each drawing (ease in/out)
                     │
                     ▼
            [3] Sampling ──► pick / re-interpolate frames at exactly those t
                     │
                     ▼
            [4] Exposure ──► place drawings on the X-sheet (on 2s, holds, ...)
                     │
                     ▼
            [5] Post-process ──► palette lock, line clean-up, optional line boil
```

Steps 2 to 5 are deterministic, model-agnostic code. They are where Pyrin's "hand-made" character lives, and they keep working when the underlying models are swapped for better ones.

### Core data model

```ts
type DrawingId = string;

interface Drawing {
  id: DrawingId;
  kind: "key" | "breakdown" | "inbetween";
  strokes: Stroke[];        // vector strokes, editable
  raster?: string;          // or a generated bitmap
}

interface Layer {
  id: string;
  name: string;                     // "body", "hair", "mouth" ...
  drawings: Record<DrawingId, Drawing>;
  exposure: (DrawingId | null)[];   // the timesheet: one entry per frame
}

interface Cut {
  id: string;
  fps: 24;
  length: number;
  layers: Layer[];
}
```

`exposure: ["A1","A1","A2","A2","A3","A3","A3","A3"]` means three drawings shot on 2s with a four-frame hold on A3. Retiming never requires redrawing.

---

## Architecture

```
┌────────────────────────────────┐          ┌──────────────────────────────────┐
│  Editor  (web/)                │  HTTP    │  Inference server  (server/)     │
│  TypeScript · React · Vite     │◄────────►│  Python · FastAPI                │
│  Canvas 2D · Zustand           │  WS      │  Spacing / exposure pipeline     │
│  X-sheet timeline · playback   │          │  Post-processing (OpenCV)        │
└────────────────────────────────┘          └───────────────┬──────────────────┘
                                                            │ provider interface
                                    ┌───────────────────────┼───────────────────────┐
                                    ▼                       ▼                       ▼
                             Hosted APIs              Self-hosted              Local utilities
                         (Replicate, fal.ai)       (ComfyUI, diffusers)          (RIFE, FILM)
```

The server talks to models through a **provider interface**, so a hosted API can be replaced with a self-hosted model without touching the editor.

### Tech stack

| Area | Choice |
|---|---|
| Editor | TypeScript, React, Vite, Zustand + Immer, Canvas 2D, perfect-freehand |
| Server | Python 3.11, FastAPI, WebSockets, NumPy, OpenCV, scikit-image |
| Inference (hosted) | Replicate, fal.ai |
| Inference (self-hosted) | ComfyUI (headless), PyTorch, diffusers |
| Desktop (later) | Tauri |

### Candidate models

Pyrin does not train its own models. It integrates existing ones:

| Stage | Models |
|---|---|
| Inbetweening | Wan FLF2V (first/last frame), ToonCrafter, Framer, AnimeInbet |
| Frame re-timing | RIFE, FILM (arbitrary timestep interpolation) |
| Key pose generation | Illustrious XL, NoobAI XL, Animagine XL + ControlNet (OpenPose / Lineart) |
| Character consistency | IP-Adapter, per-character LoRA |
| Line extraction | Lineart Anime, Anime2Sketch; vectorisation via vtracer / Potrace |
| Colourisation | AniDoc, LVCD, or gap-closing flood fill |
| Layer separation | SAM 2 |

The model landscape moves quickly; see [docs/models.md](docs/models.md) for notes on each.

---

## Repository Structure

```
Pyrin/
├── web/                      # Editor (TypeScript + React)
│   └── src/
│       ├── model/            # Cut, Layer, Drawing, exposure logic
│       ├── canvas/           # Drawing tools, onion skin, rendering
│       ├── timeline/         # X-sheet / timesheet UI
│       └── api/              # Client for the inference server
├── server/                   # Inference server (Python + FastAPI)
│   ├── app/
│   │   └── pipeline/         # inbetween, spacing, post-process
│   └── comfy_workflows/      # Exported ComfyUI workflow JSON
├── docs/                     # Architecture, models, roadmap
├── .env.example
└── README.md
```

---

## Getting Started

> Pyrin is at an early prototype stage. The editor runs today; the server arrives in Phase 2.

### Prerequisites

- Node.js 20+
- Python 3.11+
- An API key for [Replicate](https://replicate.com) or [fal.ai](https://fal.ai), **or** a local GPU with 24 GB VRAM for self-hosted models

### Setup

```bash
git clone https://github.com/PUTTIPONG-Boss/Pyrin.git
cd Pyrin
cp .env.example .env    # then add your provider API key
```

**Editor**

```bash
cd web
npm install
npm run dev
```

**Server**

```bash
cd server
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

---

## Roadmap

- [ ] **Phase 0: Model exploration.** Evaluate inbetween models on real key pairs through ComfyUI and hosted APIs.
- [x] **Phase 1: Editor without AI.** Canvas, layers, onion skin, X-sheet editing, 24 fps playback with correct holds.
- [ ] **Phase 2: AI inbetweening.** Key A/B → model → spacing → exposure, inserted as editable inbetween drawings.
- [ ] **Phase 3: Clean-up and colour.** Palette lock, line re-extraction, flat colour fill.
- [ ] **Phase 4: Storyboard and prompt modes.** High-level creation for non-animators.

Details in [docs/roadmap.md](docs/roadmap.md).

---

## Contributing

Pyrin is developed as a side project and the architecture is still taking shape. Issues and discussion are welcome. Please open an issue before starting large changes.

## License

To be decided.
