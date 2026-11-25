# Pyrin Server

The inference server: calls generative models through a provider interface, then applies Pyrin's timing and clean-up pipeline.

**Stack:** Python 3.11, FastAPI, NumPy, OpenCV, scikit-image

| Path | Purpose |
|---|---|
| `app/pipeline/inbetween.py` | Key A + key B → dense frames via the configured provider |
| `app/pipeline/spacing.py` | Spacing curves and sampling of drawings |
| `app/pipeline/postprocess.py` | Palette lock, line clean-up |
| `comfy_workflows/` | Exported ComfyUI workflow JSON for self-hosting |

Not scaffolded yet. See the [roadmap](../docs/roadmap.md), Phase 2.
