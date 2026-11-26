import { describe, expect, it } from "vitest";
import { floodFill } from "./fill";

/** A transparent image with an opaque black square outline (optionally with a gap). */
function boxImage(size: number, from: number, to: number, gapWidth = 0) {
  const data = new Uint8ClampedArray(size * size * 4);
  const ink = (x: number, y: number) => data.set([0, 0, 0, 255], (y * size + x) * 4);
  for (let i = from; i <= to; i++) {
    ink(i, from);
    ink(i, to);
    ink(from, i);
    // Leave a gap in the right edge, centred.
    const mid = (from + to) / 2;
    if (Math.abs(i - mid) >= gapWidth / 2 || gapWidth === 0) ink(to, i);
  }
  return data;
}

/** Number of pixels covered by spans, and whether a given pixel is covered. */
function coverage(spans: number[]) {
  let count = 0;
  const has = (x: number, y: number) => {
    for (let i = 0; i < spans.length; i += 3) if (spans[i] === y && x >= spans[i + 1] && x <= spans[i + 2]) return true;
    return false;
  };
  for (let i = 0; i < spans.length; i += 3) count += spans[i + 2] - spans[i + 1] + 1;
  return { count, has };
}

describe("flood fill", () => {
  it("fills inside a closed outline and tucks 1px under the line", () => {
    const spans = floodFill(boxImage(40, 10, 30), 40, 40, 20, 20, { tolerance: 40, gap: 0 })!;
    const { has } = coverage(spans);
    expect(has(20, 20)).toBe(true);
    expect(has(10, 20)).toBe(true); // under the line edge
    expect(has(5, 20)).toBe(false); // outside stays empty
  });

  it("leaks through a gap without gap closing", () => {
    const spans = floodFill(boxImage(40, 10, 30, 3), 40, 40, 20, 20, { tolerance: 40, gap: 0 })!;
    expect(coverage(spans).has(35, 20)).toBe(true);
  });

  it("closes a small gap when gap closing is on", () => {
    const spans = floodFill(boxImage(40, 10, 30, 3), 40, 40, 20, 20, { tolerance: 40, gap: 2 })!;
    const { has } = coverage(spans);
    expect(has(20, 20)).toBe(true);
    expect(has(25, 15)).toBe(true); // reaches back near the lines after closing
    expect(has(35, 20)).toBe(false);
    expect(has(5, 5)).toBe(false);
  });

  it("fills right into inner corners with gap closing on", () => {
    const spans = floodFill(boxImage(40, 10, 30), 40, 40, 20, 20, { tolerance: 40, gap: 3 })!;
    const { has } = coverage(spans);
    // Every pixel inside the outline is covered, including next to the corners.
    for (let y = 11; y < 30; y++) for (let x = 11; x < 30; x++) expect(has(x, y)).toBe(true);
  });

  it("returns null outside the image", () => {
    expect(floodFill(new Uint8ClampedArray(16), 2, 2, 5, 5, { tolerance: 40, gap: 0 })).toBeNull();
  });
});
