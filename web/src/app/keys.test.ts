import { describe, expect, it } from "vitest";
import { addLayer, createCut, drawingStarts, holdPrevious, newDrawingAt } from "../model/cut";
import { commands } from "./commands";
import { comboFromEvent, displayKeys, type KeyLike } from "./keys";

const key = (code: string, mods: Partial<KeyLike> = {}): KeyLike => ({
  code,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

describe("keyboard combos", () => {
  it("names keys by position, so a Thai layout still gives B", () => {
    // With the Thai layout, KeyB types "ิ" but its code is still KeyB.
    expect(comboFromEvent(key("KeyB"))).toBe("B");
    expect(comboFromEvent(key("Digit2"))).toBe("2");
    expect(comboFromEvent(key("BracketLeft"))).toBe("[");
  });

  it("orders modifiers and treats Cmd as Ctrl", () => {
    expect(comboFromEvent(key("KeyZ", { ctrlKey: true, shiftKey: true }))).toBe("Ctrl+Shift+Z");
    expect(comboFromEvent(key("KeyZ", { metaKey: true }))).toBe("Ctrl+Z");
    expect(comboFromEvent(key("ArrowUp", { altKey: true }))).toBe("Alt+Up");
  });

  it("shows friendly key names", () => {
    expect(displayKeys("Shift+Left")).toEqual(["Shift", "←"]);
    expect(displayKeys("Shift+/")).toEqual(["?"]);
    expect(displayKeys("=")).toEqual(["+"]);
  });

  it("never gives two commands the same key", () => {
    const all = commands.flatMap((c) => c.keys);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("drawing starts", () => {
  it("lists the first frame of each drawing for jumping between drawings", () => {
    const cut = createCut(8);
    addLayer(cut);
    const layer = cut.layers[0];
    newDrawingAt(layer, 0);
    holdPrevious(layer, 1);
    newDrawingAt(layer, 3);
    holdPrevious(layer, 4);
    newDrawingAt(layer, 6);
    expect(drawingStarts(layer)).toEqual([0, 3, 6]);
  });
});
