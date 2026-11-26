// Pure geometry for tools: affine transforms, lasso hit tests and shape outlines.
import { isFill, type Fill, type Mark, type Stroke, type StrokePoint } from "./types";

/** 2D affine matrix [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f (canvas order). */
export type Matrix = [number, number, number, number, number, number];
export type Point = { x: number; y: number };
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export function multiply(m: Matrix, n: Matrix): Matrix {
  // Applies n first, then m.
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export const translate = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];
export const scaleAbout = (sx: number, sy: number, o: Point): Matrix =>
  multiply(translate(o.x, o.y), multiply([sx, 0, 0, sy, 0, 0], translate(-o.x, -o.y)));
export const rotateAbout = (angle: number, o: Point): Matrix => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return multiply(translate(o.x, o.y), multiply([c, s, -s, c, 0, 0], translate(-o.x, -o.y)));
};

export function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Moves a stroke's points; its width scales with the matrix's average scale. */
export function transformStroke(stroke: Stroke, m: Matrix): Stroke {
  const scale = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
  return {
    ...stroke,
    size: Math.max(0.5, stroke.size * scale),
    points: stroke.points.map(([x, y, p]): StrokePoint => [...apply(m, x, y), p]),
  };
}

function invert(m: Matrix): Matrix | null {
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-9) return null;
  const [a, b, c, d, e, f] = m;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

/**
 * Moves a fill. A plain move shifts its pixel runs exactly; scaling or rotating resamples
 * the region (each new pixel takes the value of the source pixel it came from).
 */
export function transformFill(fill: Fill, m: Matrix): Fill {
  const s = fill.spans;
  if (m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1) {
    const dx = Math.round(m[4]);
    const dy = Math.round(m[5]);
    const spans: number[] = [];
    for (let i = 0; i < s.length; i += 3) spans.push(s[i] + dy, s[i + 1] + dx, s[i + 2] + dx);
    return { ...fill, spans };
  }
  const inv = invert(m);
  const src = fillBounds(fill);
  if (!inv || !src) return fill;
  // Source pixels as a bitmap for quick lookups.
  const w = src.x1 - src.x0 + 1;
  const h = src.y1 - src.y0 + 1;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < s.length; i += 3) {
    const row = (s[i] - src.y0) * w;
    for (let x = s[i + 1]; x <= s[i + 2]; x++) mask[row + x - src.x0] = 1;
  }
  const corners = [
    apply(m, src.x0, src.y0),
    apply(m, src.x1 + 1, src.y0),
    apply(m, src.x0, src.y1 + 1),
    apply(m, src.x1 + 1, src.y1 + 1),
  ];
  const y0 = Math.floor(Math.min(...corners.map((p) => p[1])));
  const y1 = Math.ceil(Math.max(...corners.map((p) => p[1])));
  const x0 = Math.floor(Math.min(...corners.map((p) => p[0])));
  const x1 = Math.ceil(Math.max(...corners.map((p) => p[0])));
  const spans: number[] = [];
  for (let y = y0; y <= y1; y++) {
    let start = -1;
    for (let x = x0; x <= x1 + 1; x++) {
      let inside = false;
      if (x <= x1) {
        const [sx, sy] = apply(inv, x + 0.5, y + 0.5);
        const mx = Math.floor(sx) - src.x0;
        const my = Math.floor(sy) - src.y0;
        inside = mx >= 0 && my >= 0 && mx < w && my < h && mask[my * w + mx] === 1;
      }
      if (inside && start < 0) start = x;
      if (!inside && start >= 0) {
        spans.push(y, start, x - 1);
        start = -1;
      }
    }
  }
  return { ...fill, spans };
}

export function fillBounds(fill: Fill): Box | null {
  const s = fill.spans;
  if (!s.length) return null;
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (let i = 0; i < s.length; i += 3) {
    box.y0 = Math.min(box.y0, s[i]);
    box.y1 = Math.max(box.y1, s[i]);
    box.x0 = Math.min(box.x0, s[i + 1]);
    box.x1 = Math.max(box.x1, s[i + 2]);
  }
  return box;
}

/** Applies a transform to any mark. */
export function transformMark(mark: Mark, m: Matrix): Mark {
  return isFill(mark) ? transformFill(mark, m) : transformStroke(mark, m);
}

/** Bounds of the given marks, including stroke width. */
export function strokesBounds(marks: readonly Mark[]): Box | null {
  let box: Box | null = null;
  const add = (x0: number, y0: number, x1: number, y1: number) => {
    if (!box) box = { x0, y0, x1, y1 };
    else {
      box.x0 = Math.min(box.x0, x0);
      box.y0 = Math.min(box.y0, y0);
      box.x1 = Math.max(box.x1, x1);
      box.y1 = Math.max(box.y1, y1);
    }
  };
  for (const m of marks) {
    if (isFill(m)) {
      const b = fillBounds(m);
      if (b) add(b.x0, b.y0, b.x1 + 1, b.y1 + 1);
      continue;
    }
    const r = m.size / 2;
    for (const [x, y] of m.points) add(x - r, y - r, x + r, y + r);
  }
  return box;
}

export function pointInPolygon(x: number, y: number, poly: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * Indices of marks inside a lasso: a stroke is picked when at least half of its points are
 * inside, a fill when at least half of its pixel runs (by their middle) are. Eraser strokes
 * are never picked.
 */
export function lassoPick(marks: readonly Mark[], poly: readonly Point[]): number[] {
  if (poly.length < 3) return [];
  const picked: number[] = [];
  marks.forEach((m, i) => {
    let inside = 0;
    let total = 0;
    if (isFill(m)) {
      for (let k = 0; k < m.spans.length; k += 3, total++) {
        if (pointInPolygon((m.spans[k + 1] + m.spans[k + 2]) / 2, m.spans[k], poly)) inside++;
      }
    } else if (m.mode === "draw") {
      total = m.points.length;
      inside = m.points.filter(([x, y]) => pointInPolygon(x, y, poly)).length;
    }
    if (total && inside * 2 >= total) picked.push(i);
  });
  return picked;
}

/** Points every `step` px along a polyline, so shapes get an even outline. */
function densify(corners: Point[], step = 4): StrokePoint[] {
  const out: StrokePoint[] = [];
  for (let i = 0; i < corners.length - 1; i++) {
    const a = corners[i];
    const b = corners[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = 0; k < n; k++) out.push([a.x + ((b.x - a.x) * k) / n, a.y + ((b.y - a.y) * k) / n, 0.5]);
  }
  const last = corners[corners.length - 1];
  out.push([last.x, last.y, 0.5]);
  return out;
}

export type ShapeKind = "line" | "rect" | "ellipse";

/**
 * Points for a shape dragged from `a` to `b`. With `constrain` (Shift), lines snap to 15°
 * steps and rectangles / ellipses become squares / circles.
 */
export function shapePoints(kind: ShapeKind, a: Point, b: Point, constrain = false): StrokePoint[] {
  let { x, y } = b;
  if (constrain && kind === "line") {
    const angle = Math.round(Math.atan2(y - a.y, x - a.x) / (Math.PI / 12)) * (Math.PI / 12);
    const len = Math.hypot(x - a.x, y - a.y);
    x = a.x + Math.cos(angle) * len;
    y = a.y + Math.sin(angle) * len;
  } else if (constrain) {
    const side = Math.max(Math.abs(x - a.x), Math.abs(y - a.y));
    x = a.x + Math.sign(x - a.x || 1) * side;
    y = a.y + Math.sign(y - a.y || 1) * side;
  }
  if (kind === "line") return densify([a, { x, y }]);
  if (kind === "rect") return densify([a, { x, y: a.y }, { x, y }, { x: a.x, y }, a]);
  const cx = (a.x + x) / 2;
  const cy = (a.y + y) / 2;
  const rx = Math.abs(x - a.x) / 2;
  const ry = Math.abs(y - a.y) / 2;
  const n = Math.max(24, Math.ceil((Math.PI * (rx + ry)) / 4));
  return Array.from({ length: n + 1 }, (_, i): StrokePoint => {
    const t = (i / n) * Math.PI * 2;
    return [cx + Math.cos(t) * rx, cy + Math.sin(t) * ry, 0.5];
  });
}
