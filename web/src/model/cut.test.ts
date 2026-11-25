import { describe, expect, it } from "vitest";
import {
  addLayer,
  addStroke,
  createCut,
  deleteFrame,
  drawingSequence,
  holdPrevious,
  insertFrame,
  neighbourDrawings,
  newDrawingAt,
  retime,
  setLength,
} from "./cut";
import { parseCut, serializeCut } from "./io";
import type { Stroke } from "./types";

const stroke: Stroke = { points: [[0, 0, 0.5]], color: "#000", size: 4, mode: "draw", simulatePressure: true };

/** Timesheet as drawing names, "." for empty cells. */
const sheet = (cut: ReturnType<typeof createCut>, i = 0) => {
  const layer = cut.layers[i];
  return layer.exposure.map((id) => (id ? layer.drawings[id].name : ".")).join(" ");
};

describe("timesheet operations", () => {
  it("names drawings by layer letter and number", () => {
    const cut = createCut(4);
    const b = addLayer(cut);
    newDrawingAt(cut.layers[0], 0);
    newDrawingAt(cut.layers[0], 2);
    newDrawingAt(b, 1);
    expect(sheet(cut)).toBe("A1 . A2 .");
    expect(sheet(cut, 1)).toBe(". B1 . .");
  });

  it("adds strokes to the drawing exposed on a frame, creating one if empty", () => {
    const cut = createCut(4);
    const layer = cut.layers[0];
    addStroke(layer, 0, stroke);
    holdPrevious(layer, 1);
    addStroke(layer, 1, stroke);
    expect(sheet(cut)).toBe("A1 A1 . .");
    expect(Object.keys(layer.drawings)).toHaveLength(1);
    expect(layer.drawings[layer.exposure[0]!].strokes).toHaveLength(2);
  });

  it("re-shoots a layer on 2s and 3s, lengthening the cut if needed", () => {
    const cut = createCut(4);
    const layer = cut.layers[0];
    newDrawingAt(layer, 0);
    newDrawingAt(layer, 1);
    newDrawingAt(layer, 2);
    retime(cut, layer.id, 2);
    expect(sheet(cut)).toBe("A1 A1 A2 A2 A3 A3");
    expect(cut.length).toBe(6);
    retime(cut, layer.id, 3);
    expect(sheet(cut)).toBe("A1 A1 A1 A2 A2 A2 A3 A3 A3");
    retime(cut, layer.id, 1);
    expect(sheet(cut)).toBe("A1 A2 A3 . . . . . .");
  });

  it("inserts a frame into one layer and holds the others", () => {
    const cut = createCut(3);
    const a = cut.layers[0];
    const b = addLayer(cut);
    newDrawingAt(a, 0);
    newDrawingAt(a, 1);
    newDrawingAt(b, 2);
    insertFrame(cut, a.id, 0);
    expect(sheet(cut)).toBe("A1 A1 A2 .");
    expect(sheet(cut, 1)).toBe(". . B1 B1");
    deleteFrame(a, 0);
    expect(sheet(cut)).toBe("A1 A2 . .");
  });

  it("truncates and pads when the length changes", () => {
    const cut = createCut(3);
    newDrawingAt(cut.layers[0], 2);
    setLength(cut, 2);
    expect(sheet(cut)).toBe(". .");
    setLength(cut, 4);
    expect(sheet(cut)).toBe(". . . .");
  });

  it("finds distinct neighbouring drawings for onion skin", () => {
    const cut = createCut(7);
    const layer = cut.layers[0];
    [0, 2, 5].forEach((f) => newDrawingAt(layer, f));
    holdPrevious(layer, 1);
    holdPrevious(layer, 3);
    holdPrevious(layer, 4);
    expect(sheet(cut)).toBe("A1 A1 A2 A2 A2 A3 .");
    expect(neighbourDrawings(layer, 3, -1, 2).map((d) => d.name)).toEqual(["A1"]);
    expect(neighbourDrawings(layer, 1, 1, 2).map((d) => d.name)).toEqual(["A2", "A3"]);
    expect(drawingSequence(layer).length).toBe(3);
  });
});

describe("project files", () => {
  it("round-trips a cut and rejects other JSON", () => {
    const cut = createCut(4);
    addStroke(cut.layers[0], 0, stroke);
    expect(parseCut(serializeCut(cut))).toEqual(cut);
    expect(() => parseCut('{"hello":1}')).toThrow();
  });
});
