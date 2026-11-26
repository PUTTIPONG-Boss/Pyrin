// Pure operations on a Cut. Functions that change data mutate their argument,
// so call them inside an Immer recipe (see store.ts).
import { transformMark, type Matrix } from "./geometry";
import type { Cut, Drawing, DrawingId, Layer, Mark } from "./types";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const uid = () => crypto.randomUUID();

export function createCut(length = 48, fps = 24): Cut {
  const cut: Cut = { id: uid(), fps, length, width: 1280, height: 720, layers: [] };
  addLayer(cut);
  return cut;
}

export function addLayer(cut: Cut): Layer {
  const used = new Set(cut.layers.map((l) => l.prefix));
  const prefix = [...LETTERS].find((c) => !used.has(c)) ?? `L${cut.layers.length + 1}`;
  const layer: Layer = {
    id: uid(),
    name: `Layer ${prefix}`,
    prefix,
    visible: true,
    nextNumber: 1,
    drawings: {},
    exposure: Array(cut.length).fill(null),
  };
  cut.layers.push(layer);
  return layer;
}

export function getLayer(cut: Cut, layerId: string): Layer | undefined {
  return cut.layers.find((l) => l.id === layerId);
}

export function drawingAt(layer: Layer, frame: number): Drawing | null {
  const id = layer.exposure[frame];
  return id ? layer.drawings[id] ?? null : null;
}

/** Creates an empty drawing and exposes it on `frame`. */
export function newDrawingAt(layer: Layer, frame: number, kind: Drawing["kind"] = "key"): DrawingId {
  const drawing: Drawing = {
    id: uid(),
    name: `${layer.prefix}${layer.nextNumber++}`,
    kind,
    strokes: [],
  };
  layer.drawings[drawing.id] = drawing;
  layer.exposure[frame] = drawing.id;
  return drawing.id;
}

/** Adds a stroke or fill to the drawing on `frame`, creating one if the cell is empty. */
export function addStroke(layer: Layer, frame: number, stroke: Mark): void {
  addMarks(layer, frame, [stroke]);
}

/**
 * Appends marks to the drawing on `frame` (creating one if the cell is empty) and returns
 * where they landed, so a paste can select what it added.
 */
export function addMarks(layer: Layer, frame: number, marks: Mark[]): { drawingId: DrawingId; indices: number[] } {
  const id = layer.exposure[frame] ?? newDrawingAt(layer, frame);
  const strokes = layer.drawings[id].strokes;
  const start = strokes.length;
  strokes.push(...marks);
  return { drawingId: id, indices: marks.map((_, i) => start + i) };
}

export function removeMarks(drawing: Drawing, indices: number[]): void {
  const drop = new Set(indices);
  drawing.strokes = drawing.strokes.filter((_, i) => !drop.has(i));
}

/** Applies an affine transform to the selected strokes and fills. */
export function transformMarks(drawing: Drawing, indices: number[], m: Matrix): void {
  for (const i of indices) {
    const mark = drawing.strokes[i];
    if (mark) drawing.strokes[i] = transformMark(mark, m);
  }
}

/** Exposes the previous frame's drawing on `frame` (extends a hold). */
export function holdPrevious(layer: Layer, frame: number): void {
  if (frame > 0) layer.exposure[frame] = layer.exposure[frame - 1];
}

export function clearCell(layer: Layer, frame: number): void {
  layer.exposure[frame] = null;
}

/** Inserts one frame of the current drawing at `frame`, lengthening the cut by one. */
export function insertFrame(cut: Cut, layerId: string, frame: number): void {
  cut.length += 1;
  for (const layer of cut.layers) {
    if (layer.id === layerId) {
      layer.exposure.splice(frame, 0, layer.exposure[frame] ?? null);
    } else {
      // Other layers hold their last cell so the cut does not end early on them.
      layer.exposure.push(layer.exposure[layer.exposure.length - 1] ?? null);
    }
  }
}

/** Removes the cell at `frame` and shifts the rest of the layer left. */
export function deleteFrame(layer: Layer, frame: number): void {
  layer.exposure.splice(frame, 1);
  layer.exposure.push(null);
}

export function setLength(cut: Cut, length: number): void {
  const next = Math.max(1, Math.floor(length));
  for (const layer of cut.layers) {
    if (next < layer.exposure.length) layer.exposure.length = next;
    else while (layer.exposure.length < next) layer.exposure.push(null);
  }
  cut.length = next;
}

/** Drawings in the order they appear, with consecutive repeats and empty cells removed. */
export function drawingSequence(layer: Layer): DrawingId[] {
  const seq: DrawingId[] = [];
  for (const id of layer.exposure) {
    if (id && id !== seq[seq.length - 1]) seq.push(id);
  }
  return seq;
}

/** Re-shoots the layer's drawings on `n`s (each drawing held for n frames). */
export function retime(cut: Cut, layerId: string, n: number): void {
  const layer = getLayer(cut, layerId);
  if (!layer) return;
  const seq = drawingSequence(layer);
  const needed = seq.length * n;
  if (needed > cut.length) setLength(cut, needed);
  layer.exposure = Array.from({ length: cut.length }, (_, f) => seq[Math.floor(f / n)] ?? null);
}

/** Frames where a new drawing begins (the start of each exposure run). */
export function drawingStarts(layer: Layer): number[] {
  const starts: number[] = [];
  layer.exposure.forEach((id, f) => {
    if (id && id !== layer.exposure[f - 1]) starts.push(f);
  });
  return starts;
}

/**
 * Up to `count` distinct drawings before (`dir = -1`) or after (`dir = 1`) the one on `frame`,
 * nearest first. Used for onion skin.
 */
export function neighbourDrawings(layer: Layer, frame: number, dir: -1 | 1, count: number): Drawing[] {
  const result: Drawing[] = [];
  let last = layer.exposure[frame];
  for (let f = frame + dir; f >= 0 && f < layer.exposure.length && result.length < count; f += dir) {
    const id = layer.exposure[f];
    if (id && id !== last) {
      result.push(layer.drawings[id]);
      last = id;
    }
  }
  return result;
}

export function removeLayer(cut: Cut, layerId: string): void {
  if (cut.layers.length <= 1) return;
  cut.layers = cut.layers.filter((l) => l.id !== layerId);
}

export function moveLayer(cut: Cut, layerId: string, delta: number): void {
  const i = cut.layers.findIndex((l) => l.id === layerId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= cut.layers.length) return;
  const [layer] = cut.layers.splice(i, 1);
  cut.layers.splice(j, 0, layer);
}
