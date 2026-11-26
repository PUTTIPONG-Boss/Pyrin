export type DrawingId = string;

/** [x, y, pressure] in cut pixel space. */
export type StrokePoint = [number, number, number];

export interface Stroke {
  points: StrokePoint[];
  color: string;
  size: number;
  mode: "draw" | "erase";
  /** True when the input device reports no pressure (mouse). */
  simulatePressure: boolean;
  /** How much pressure changes the width (0 = even line). Defaults to 0.6. */
  thinning?: number;
  /** Stabilizer: how much the line lags behind the pen to smooth it. Defaults to 0.4. */
  streamline?: number;
}

/**
 * A paint-bucket fill: a flat colour over a pixel region, stored as horizontal runs
 * [y, x0, x1, y, x0, x1, ...] (x1 inclusive). Fills are painted under a drawing's strokes,
 * like colour under line art.
 */
export interface Fill {
  type: "fill";
  color: string;
  spans: number[];
}

/** Anything a drawing is made of, in the order it was added. */
export type Mark = Stroke | Fill;

export const isFill = (m: Mark): m is Fill => (m as Fill).type === "fill";

/** A single drawing, like one sheet of paper. */
export interface Drawing {
  id: DrawingId;
  /** Sheet name as written on a timesheet, e.g. "A3". */
  name: string;
  kind: "key" | "breakdown" | "inbetween";
  strokes: Mark[];
  /** Bitmap produced by a model, if any. */
  raster?: string;
}

/** A cel layer with its own drawings and its own timing. */
export interface Layer {
  id: string;
  name: string;
  /** Letter used to name this layer's drawings (A, B, C ...). */
  prefix: string;
  visible: boolean;
  nextNumber: number;
  drawings: Record<DrawingId, Drawing>;
  /** The timesheet: index = frame, value = drawing shown on that frame (null = empty). */
  exposure: (DrawingId | null)[];
}

export interface Cut {
  id: string;
  fps: number;
  length: number;
  width: number;
  height: number;
  /** Bottom to top. */
  layers: Layer[];
}
