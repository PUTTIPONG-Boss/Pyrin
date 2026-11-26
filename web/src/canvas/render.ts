import { getStroke } from "perfect-freehand";
import { drawingAt, getLayer, neighbourDrawings } from "../model/cut";
import type { Matrix } from "../model/geometry";
import { isFill, type Cut, type Drawing, type Fill, type Mark, type Stroke } from "../model/types";

const ONION_BEFORE = { color: "#e0464e", alphas: [0.35, 0.15] };
const ONION_AFTER = { color: "#2f9e5b", alphas: [0.35, 0.15] };

// Committed strokes never change, so their outline is cached. The live stroke grows while
// drawing, so the cache entry also records how many points it was built from and whether
// it was built as a finished stroke.
const pathCache = new WeakMap<Stroke, { path: Path2D; count: number; complete: boolean }>();

/** `complete` draws the stroke all the way to its last point; while drawing, streamline lags it. */
export function strokePath(stroke: Stroke, complete = true): Path2D {
  const cached = pathCache.get(stroke);
  if (cached && cached.count === stroke.points.length && cached.complete === complete) return cached.path;
  const outline = getStroke(stroke.points, {
    size: stroke.size,
    thinning: stroke.thinning ?? 0.6,
    smoothing: 0.5,
    streamline: stroke.streamline ?? 0.4,
    simulatePressure: stroke.simulatePressure,
    last: complete,
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
  pathCache.set(stroke, { path, count: stroke.points.length, complete });
  return path;
}

/**
 * Even-width, unsmoothed strokes (shape tools) are drawn as a plain canvas line with round
 * joins. Perfect-freehand's outline folds over itself at sharp corners, which leaves a small
 * unpainted notch inside each corner that the fill tool cannot reach.
 */
const isPlainLine = (s: Stroke) => s.thinning === 0 && s.streamline === 0;

const lineCache = new WeakMap<Stroke, Path2D>();

function linePath(stroke: Stroke): Path2D {
  let path = lineCache.get(stroke);
  if (!path) {
    path = linePathUncached(stroke);
    lineCache.set(stroke, path);
  }
  return path;
}

function paintStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, complete: boolean) {
  if (!isPlainLine(stroke)) {
    ctx.fill(strokePath(stroke, complete));
    return;
  }
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // The live shape is rebuilt on every move, so only cache finished ones.
  ctx.stroke(complete ? linePath(stroke) : linePathUncached(stroke));
}

function linePathUncached(stroke: Stroke): Path2D {
  const path = new Path2D();
  stroke.points.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
  return path;
}

const fillCache = new WeakMap<Fill, Path2D>();

export function fillPath(fill: Fill): Path2D {
  let path = fillCache.get(fill);
  if (!path) {
    path = new Path2D();
    const s = fill.spans;
    for (let i = 0; i < s.length; i += 3) path.rect(s[i + 1], s[i], s[i + 2] - s[i + 1] + 1, 1);
    fillCache.set(fill, path);
  }
  return path;
}

/**
 * Paints marks in order, with all fills first so colour sits under line art. `transforms`
 * moves individual marks (by index) for a live transform preview.
 */
function paintMarks(
  ctx: CanvasRenderingContext2D,
  marks: readonly Mark[],
  complete = true,
  transforms?: Map<number, Matrix>,
) {
  marks.forEach((mark, i) => {
    if (!isFill(mark)) return;
    ctx.fillStyle = mark.color;
    const m = transforms?.get(i);
    if (m) {
      ctx.save();
      ctx.transform(...m);
      ctx.fill(fillPath(mark));
      ctx.restore();
    } else {
      ctx.fill(fillPath(mark));
    }
  });
  marks.forEach((mark, i) => {
    if (isFill(mark)) return;
    ctx.globalCompositeOperation = mark.mode === "erase" ? "destination-out" : "source-over";
    ctx.fillStyle = mark.color;
    const m = transforms?.get(i);
    if (m) {
      ctx.save();
      ctx.transform(...m);
      paintStroke(ctx, mark, complete);
      ctx.restore();
    } else {
      paintStroke(ctx, mark, complete);
    }
  });
  ctx.globalCompositeOperation = "source-over";
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Rasterises each drawing once and keeps the bitmap. Drawings are immutable (Immer), so a
 * drawing object always has the same pixels. When a stroke is added, the new drawing's
 * marks start with the old drawing's marks, so the old bitmap is reused and only the new
 * strokes are painted. A new fill goes under everything, so it repaints the drawing.
 */
class DrawingCache {
  private bitmaps = new Map<Drawing, HTMLCanvasElement>(); // oldest first, for LRU eviction
  private latestById = new Map<string, Drawing>();

  constructor(
    readonly width: number,
    readonly height: number,
    private limit = 64,
  ) {}

  get(drawing: Drawing): HTMLCanvasElement {
    const hit = this.bitmaps.get(drawing);
    if (hit) {
      this.bitmaps.delete(drawing);
      this.bitmaps.set(drawing, hit);
      return hit;
    }

    let canvas: HTMLCanvasElement;
    const prev = this.latestById.get(drawing.id);
    const prevCanvas = prev && this.bitmaps.get(prev);
    const added = prev && isPrefix(prev.strokes, drawing.strokes) ? drawing.strokes.slice(prev.strokes.length) : null;
    if (prev && prevCanvas && added && !added.some(isFill)) {
      // Take over the previous bitmap and paint only what was added.
      this.bitmaps.delete(prev);
      canvas = prevCanvas;
      paintMarks(canvas.getContext("2d")!, added);
    } else {
      canvas = makeCanvas(this.width, this.height);
      paintMarks(canvas.getContext("2d")!, drawing.strokes);
    }

    this.bitmaps.set(drawing, canvas);
    this.latestById.set(drawing.id, drawing);
    this.evict();
    return canvas;
  }

  get capacity() {
    return this.limit;
  }

  /**
   * Drops least recently used bitmaps over the limit. Canvases are never recycled, because
   * one may still be on screen as the active layer.
   */
  private evict() {
    for (const oldest of this.bitmaps.keys()) {
      if (this.bitmaps.size <= this.limit) break;
      this.bitmaps.delete(oldest);
      if (this.latestById.get(oldest.id) === oldest) this.latestById.delete(oldest.id);
    }
  }
}

function isPrefix(a: readonly Mark[], b: readonly Mark[]) {
  if (a.length > b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function sameList(a: readonly unknown[], b: readonly unknown[]) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

export interface Scene {
  cut: Cut;
  frame: number;
  activeLayerId: string;
  onion: boolean;
}

/**
 * Draws a frame onto three stacked canvases: everything under the active layer (paper,
 * onion skin, lower layers), the active layer, and everything above it. While drawing,
 * only the active canvas is repainted, which costs one bitmap copy plus the live stroke.
 */
export class StageRenderer {
  private cache: DrawingCache | null = null;
  private scratch: HTMLCanvasElement | null = null;
  private underKey: unknown[] = [];
  private overKey: unknown[] = [];
  private activeBitmap: HTMLCanvasElement | null = null;
  private activeCtx: CanvasRenderingContext2D;

  constructor(
    private under: HTMLCanvasElement,
    private active: HTMLCanvasElement,
    private over: HTMLCanvasElement,
  ) {
    // Low-latency mode lets the browser show brush updates without waiting for compositing.
    this.activeCtx = active.getContext("2d", { desynchronized: true })!;
  }

  private ensureCache(cut: Cut): DrawingCache {
    if (!this.cache || this.cache.width !== cut.width || this.cache.height !== cut.height) {
      this.cache = new DrawingCache(cut.width, cut.height);
      this.scratch = makeCanvas(cut.width, cut.height);
      this.underKey = [];
      this.overKey = [];
    }
    return this.cache;
  }

  /**
   * Builds stroke outlines and drawing bitmaps while the browser is idle, in timesheet order,
   * so the first playback of a loaded cut does not stutter. Returns a cancel function.
   */
  prewarm(cut: Cut): () => void {
    const cache = this.ensureCache(cut);
    const seen = new Set<string>();
    const drawings: Drawing[] = [];
    for (let f = 0; f < cut.length; f++) {
      for (const layer of cut.layers) {
        const d = drawingAt(layer, f);
        if (d && !seen.has(d.id)) {
          seen.add(d.id);
          drawings.push(d);
        }
      }
    }
    const bitmapBudget = Math.floor(cache.capacity / 2); // leave room for what is on screen

    let i = 0;
    let s = 0;
    let handle = 0;
    const step = (deadline: IdleDeadline) => {
      while (i < drawings.length && deadline.timeRemaining() > 2) {
        const d = drawings[i];
        if (s < d.strokes.length) {
          const mark = d.strokes[s++];
          if (isFill(mark)) fillPath(mark);
          else if (isPlainLine(mark)) linePath(mark);
          else strokePath(mark);
          continue;
        }
        if (i < bitmapBudget) cache.get(d);
        i++;
        s = 0;
      }
      if (i < drawings.length) handle = requestIdleCallback(step);
    };
    handle = requestIdleCallback(step);
    return () => cancelIdleCallback(handle);
  }

  render({ cut, frame, activeLayerId, onion }: Scene) {
    const cache = this.ensureCache(cut);

    const index = cut.layers.findIndex((l) => l.id === activeLayerId);
    const activeLayer = getLayer(cut, activeLayerId);
    const visibleDrawings = (from: number, to: number) =>
      cut.layers.slice(from, to).flatMap((l) => (l.visible ? [drawingAt(l, frame)] : []));

    const showOnion = onion && activeLayer?.visible;
    const before = showOnion ? neighbourDrawings(activeLayer, frame, -1, ONION_BEFORE.alphas.length) : [];
    const after = showOnion ? neighbourDrawings(activeLayer, frame, 1, ONION_AFTER.alphas.length) : [];
    const below = visibleDrawings(0, index);
    const underKey = [cut.width, ...below, "onion", ...before, "|", ...after];
    if (!sameList(underKey, this.underKey)) {
      this.underKey = underKey;
      const ctx = this.under.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cut.width, cut.height);
      below.forEach((d) => d && ctx.drawImage(cache.get(d), 0, 0));
      before.forEach((d, i) => this.drawTinted(ctx, d, ONION_BEFORE.color, ONION_BEFORE.alphas[i]));
      after.forEach((d, i) => this.drawTinted(ctx, d, ONION_AFTER.color, ONION_AFTER.alphas[i]));
    }

    const above = visibleDrawings(index + 1, cut.layers.length);
    const overKey = [cut.width, ...above];
    if (!sameList(overKey, this.overKey)) {
      this.overKey = overKey;
      const ctx = this.over.getContext("2d")!;
      ctx.clearRect(0, 0, cut.width, cut.height);
      above.forEach((d) => d && ctx.drawImage(cache.get(d), 0, 0));
    }

    const drawing = activeLayer?.visible ? drawingAt(activeLayer, frame) : null;
    this.activeBitmap = drawing ? cache.get(drawing) : null;
    this.drawLive(null);
  }

  /** Repaints the active layer with the stroke being drawn (and predicted points, if any). */
  drawLive(stroke: Stroke | null) {
    const ctx = this.activeCtx;
    ctx.clearRect(0, 0, this.active.width, this.active.height);
    if (this.activeBitmap) ctx.drawImage(this.activeBitmap, 0, 0);
    if (stroke) paintMarks(ctx, [stroke], false);
  }

  /** Repaints the active layer with some of its strokes moved, for the select tool. */
  drawTransformed(drawing: Drawing, indices: readonly number[], m: Matrix) {
    const ctx = this.activeCtx;
    ctx.clearRect(0, 0, this.active.width, this.active.height);
    paintMarks(ctx, drawing.strokes, true, new Map(indices.map((i) => [i, m])));
  }

  /**
   * The colour at a cut pixel, as #rrggbb (paper and all visible layers, no onion skin).
   * Reads from a 1×1 copy: reading the on-screen canvases would make the browser move them
   * off the GPU and slow drawing down.
   */
  sampleColor(cut: Cut, frame: number, x: number, y: number): string {
    const cache = this.ensureCache(cut);
    const probe = makeCanvas(1, 1);
    const ctx = probe.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 1, 1);
    for (const layer of cut.layers) {
      const d = layer.visible ? drawingAt(layer, frame) : null;
      if (d) ctx.drawImage(cache.get(d), Math.floor(x), Math.floor(y), 1, 1, 0, 0, 1, 1);
    }
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  }

  /** Pixels the fill tool looks at: every visible layer, or just the active one. */
  fillSource(cut: Cut, frame: number, layerIds: readonly string[]): ImageData {
    const cache = this.ensureCache(cut);
    const canvas = makeCanvas(cut.width, cut.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    for (const layer of cut.layers) {
      if (!layer.visible || !layerIds.includes(layer.id)) continue;
      const d = drawingAt(layer, frame);
      if (d) ctx.drawImage(cache.get(d), 0, 0);
    }
    return ctx.getImageData(0, 0, cut.width, cut.height);
  }

  private drawTinted(ctx: CanvasRenderingContext2D, drawing: Drawing, color: string, alpha: number) {
    const scratch = this.scratch!;
    const sctx = scratch.getContext("2d")!;
    sctx.clearRect(0, 0, scratch.width, scratch.height);
    sctx.drawImage(this.cache!.get(drawing), 0, 0);
    sctx.globalCompositeOperation = "source-in";
    sctx.fillStyle = color;
    sctx.fillRect(0, 0, scratch.width, scratch.height);
    sctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = alpha;
    ctx.drawImage(scratch, 0, 0);
    ctx.globalAlpha = 1;
  }
}
