import { describe, expect, it } from "vitest";
import { addMarks, createCut, removeMarks, transformMarks } from "./cut";
import {
  lassoPick,
  rotateAbout,
  scaleAbout,
  shapePoints,
  strokesBounds,
  transformFill,
  transformStroke,
  translate,
} from "./geometry";
import type { Fill, Stroke } from "./types";

const line = (x0: number, y0: number, x1: number, y1: number): Stroke => ({
  points: [
    [x0, y0, 0.5],
    [x1, y1, 0.5],
  ],
  color: "#000",
  size: 4,
  mode: "draw",
  simulatePressure: false,
});
const fill: Fill = { type: "fill", color: "#f00", spans: [0, 0, 10] };

describe("transforms", () => {
  it("moves, scales and rotates stroke points", () => {
    expect(transformStroke(line(0, 0, 10, 0), translate(5, 5)).points[1]).toEqual([15, 5, 0.5]);
    const scaled = transformStroke(line(0, 0, 10, 0), scaleAbout(2, 2, { x: 0, y: 0 }));
    expect(scaled.points[1]).toEqual([20, 0, 0.5]);
    expect(scaled.size).toBe(8); // width grows with the drawing
    const [x, y] = transformStroke(line(0, 0, 10, 0), rotateAbout(Math.PI / 2, { x: 0, y: 0 })).points[1];
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(10);
  });

  it("measures bounds including stroke width and fills", () => {
    expect(strokesBounds([line(0, 0, 10, 0)])).toEqual({ x0: -2, y0: -2, x1: 12, y1: 2 });
    expect(strokesBounds([line(0, 0, 10, 0), { ...fill, spans: [5, 0, 20] }])).toEqual({ x0: -2, y0: -2, x1: 21, y1: 6 });
  });

  it("moves fills exactly and resamples them when scaled", () => {
    const square: Fill = { type: "fill", color: "#f00", spans: [0, 0, 3, 1, 0, 3, 2, 0, 3, 3, 0, 3] };
    expect(transformFill(square, translate(10, 5)).spans.slice(0, 3)).toEqual([5, 10, 13]);
    const doubled = transformFill(square, scaleAbout(2, 2, { x: 0, y: 0 }));
    const area = (f: Fill) => f.spans.reduce((a, _, i) => (i % 3 === 0 ? a + f.spans[i + 2] - f.spans[i + 1] + 1 : a), 0);
    expect(area(doubled)).toBe(64);
  });
});

describe("lasso", () => {
  it("picks strokes and fills mostly inside", () => {
    const poly = [
      { x: -1, y: -1 },
      { x: 11, y: -1 },
      { x: 11, y: 11 },
      { x: -1, y: 11 },
    ];
    expect(lassoPick([line(0, 0, 10, 10), line(50, 50, 60, 60), fill], poly)).toEqual([0, 2]);
  });
});

describe("shapes", () => {
  it("snaps lines to 15° and makes squares with Shift", () => {
    const pts = shapePoints("line", { x: 0, y: 0 }, { x: 10, y: 1 }, true);
    expect(pts[pts.length - 1][1]).toBeCloseTo(0);
    const rect = shapePoints("rect", { x: 0, y: 0 }, { x: 10, y: 4 }, true);
    expect(Math.max(...rect.map((p) => p[1]))).toBeCloseTo(10);
    const ellipse = shapePoints("ellipse", { x: 0, y: 0 }, { x: 20, y: 10 });
    expect(Math.max(...ellipse.map((p) => p[0]))).toBeCloseTo(20);
  });
});

describe("mark edits", () => {
  it("adds, transforms and removes marks in a drawing", () => {
    const cut = createCut(2);
    const layer = cut.layers[0];
    const placed = addMarks(layer, 0, [line(0, 0, 1, 1), fill, line(2, 2, 3, 3)]);
    expect(placed.indices).toEqual([0, 1, 2]);
    const drawing = layer.drawings[placed.drawingId];
    transformMarks(drawing, [1, 2], translate(10, 0));
    expect((drawing.strokes[1] as Fill).spans).toEqual([0, 10, 20]); // fills move too
    expect((drawing.strokes[2] as Stroke).points[0][0]).toBe(12);
    removeMarks(drawing, [0, 1]);
    expect(drawing.strokes).toHaveLength(1);
  });
});
