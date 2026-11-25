import { getStroke } from "perfect-freehand";
import { drawingAt, neighbourDrawings } from "../model/cut";
import type { Cut, Drawing, Stroke } from "../model/types";

const ONION_BEFORE = { color: "#e0464e", alphas: [0.35, 0.15] };
const ONION_AFTER = { color: "#2f9e5b", alphas: [0.35, 0.15] };

// Committed strokes never change, so their outline is cached. The live stroke grows while
// drawing, so the cache entry also records how many points it was built from.
const pathCache = new WeakMap<Stroke, { path: Path2D; count: number }>();

export function strokePath(stroke: Stroke): Path2D {
  const cached = pathCache.get(stroke);
  if (cached && cached.count === stroke.points.length) return cached.path;
  const outline = getStroke(stroke.points, {
    size: stroke.size,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.4,
    simulatePressure: stroke.simulatePressure,
  });
  const path = new Path2D();
  if (outline.length) {
    path.moveTo(outline[0][0], outline[0][1]);
    for (let i = 0; i < outline.length; i++) {
      const [x0, y0] = outline[i];
      const [x1, y1] = outline[(i + 1) % outline.length];
      path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
    }
    path.closePath();
  }
  pathCache.set(stroke, { path, count: stroke.points.length });
  return path;
}

function paintStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  for (const stroke of strokes) {
    ctx.globalCompositeOperation = stroke.mode === "erase" ? "destination-out" : "source-over";
    ctx.fillStyle = stroke.color;
    ctx.fill(strokePath(stroke));
  }
  ctx.globalCompositeOperation = "source-over";
}

export interface RenderOptions {
  activeLayerId?: string;
  onion?: boolean;
  /** Stroke still being drawn, shown on the active layer before it is committed. */
  liveStroke?: Stroke | null;
}

/** Draws one frame of the cut. `scratch` is a reusable canvas the size of the cut. */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  scratch: HTMLCanvasElement,
  cut: Cut,
  frame: number,
  opts: RenderOptions = {},
) {
  const sctx = scratch.getContext("2d")!;
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cut.width, cut.height);

  // Each layer is painted on its own scratch surface so erasing only affects that layer.
  const composite = (strokes: Stroke[], alpha = 1, tint?: string) => {
    sctx.clearRect(0, 0, scratch.width, scratch.height);
    paintStrokes(sctx, strokes);
    if (tint) {
      sctx.globalCompositeOperation = "source-in";
      sctx.fillStyle = tint;
      sctx.fillRect(0, 0, scratch.width, scratch.height);
      sctx.globalCompositeOperation = "source-over";
    }
    ctx.globalAlpha = alpha;
    ctx.drawImage(scratch, 0, 0);
    ctx.globalAlpha = 1;
  };

  for (const layer of cut.layers) {
    if (!layer.visible) continue;
    const isActive = layer.id === opts.activeLayerId;

    if (opts.onion && isActive) {
      const onion = (drawings: Drawing[], { color, alphas }: typeof ONION_BEFORE) =>
        drawings.forEach((d, i) => composite(d.strokes, alphas[i], color));
      onion(neighbourDrawings(layer, frame, -1, ONION_BEFORE.alphas.length), ONION_BEFORE);
      onion(neighbourDrawings(layer, frame, 1, ONION_AFTER.alphas.length), ONION_AFTER);
    }

    const strokes = drawingAt(layer, frame)?.strokes ?? [];
    const live = isActive && opts.liveStroke ? [opts.liveStroke] : [];
    if (strokes.length || live.length) composite(live.length ? [...strokes, ...live] : strokes);
  }
}
