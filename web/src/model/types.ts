export type DrawingId = string;

export interface Point {
  x: number;
  y: number;
  pressure: number;
}

export interface Stroke {
  points: Point[];
  color: string;
  size: number;
}

/** A single drawing, like one sheet of paper. */
export interface Drawing {
  id: DrawingId;
  kind: "key" | "breakdown" | "inbetween";
  strokes: Stroke[];
  /** Bitmap produced by a model, if any. */
  raster?: string;
}

/** A cel layer with its own drawings and its own timing. */
export interface Layer {
  id: string;
  name: string;
  drawings: Record<DrawingId, Drawing>;
  /** The timesheet: index = frame, value = drawing shown on that frame (null = empty). */
  exposure: (DrawingId | null)[];
}

export interface Cut {
  id: string;
  fps: 24;
  length: number;
  layers: Layer[];
}
