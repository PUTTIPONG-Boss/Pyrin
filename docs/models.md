# Model Notes

Pyrin integrates existing models and does not train its own. This page tracks candidates per pipeline stage. Models change quickly, so check Hugging Face and GitHub for newer releases before committing to one.

## Inbetweening

| Model | Strengths | Limitations |
|---|---|---|
| Wan FLF2V | Best open-weight quality; handles large motion | Large (14B); needs high VRAM or offloading |
| ToonCrafter | Designed for cartoons; accepts sketch guidance | Low resolution (512×320); soft lines |
| Framer | Point-trajectory control over motion | Research code; harder to integrate |
| AnimeInbet | Works on line art directly; no blur | Line art only; small motion |
| RIFE / FILM | Very fast; arbitrary timestep t | Breaks on large motion; ghosting on lines |

Recommended combination: a video model for the main motion, plus RIFE to sample exact spacing positions.

## Key poses and characters

- Base: Illustrious XL, NoobAI XL, Animagine XL (SDXL anime family)
- Pose control: ControlNet OpenPose / DWPose
- Sketch control: ControlNet Lineart
- Consistency: IP-Adapter, or per-character LoRA trained with kohya_ss (20 to 50 images)

## Clean-up

- Line extraction: Lineart Anime annotator, Anime2Sketch
- Vectorisation: vtracer, Potrace
- Thinning: `skimage.morphology.skeletonize`

## Colour

- Reference-based: AniDoc, LVCD
- Cel look: gap-closing flood fill with cross-frame region matching

## Layer separation

- SAM 2 for splitting hair, face, body and limbs into separate layers

## Providers

| Provider | Use |
|---|---|
| Replicate | Hosted Wan, ToonCrafter, RIFE, FILM, SDXL |
| fal.ai | Hosted Wan, LTX-Video, Kling, RIFE |
| ComfyUI (self-hosted) | Full control, ControlNet / LoRA, no per-call cost |

Self-hosting needs roughly 24 GB VRAM (RTX 3090 / 4090), or a rented GPU on RunPod, Vast.ai or Modal.
