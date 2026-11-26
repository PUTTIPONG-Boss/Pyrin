import { create } from "zustand";
import { freeze, produce } from "immer";
import type { BrushPreset } from "./brushes";
import { createCut } from "./cut";
import type { Cut } from "./types";

export type Tool =
  | "brush"
  | "eraser"
  | "line"
  | "rect"
  | "ellipse"
  | "fill"
  | "eyedropper"
  | "select"
  | "hand";

/** How the paper is shown on screen. Not part of the cut and not undoable. */
export interface View {
  zoom: number;
  /** Degrees, clockwise. */
  rotation: number;
  flip: boolean;
  panX: number;
  panY: number;
}

export const DEFAULT_VIEW: View = { zoom: 1, rotation: 0, flip: false, panX: 0, panY: 0 };

/** Selected strokes, by index into one drawing's marks. */
export interface Selection {
  drawingId: string;
  indices: number[];
}

const HISTORY_LIMIT = 200;

interface EditorState {
  cut: Cut;
  past: Cut[];
  future: Cut[];

  frame: number;
  activeLayerId: string;
  tool: Tool;
  color: string;
  size: number;
  brush: BrushPreset["id"];
  /** 0-100, see streamlineFor. */
  stabilizer: number;
  fillGap: number;
  /** Fill looks at every visible layer (line art on another layer) or only the active one. */
  fillSampleAll: boolean;
  onion: boolean;
  playing: boolean;
  view: View;
  selection: Selection | null;

  /** Applies a change to the cut and records it for undo. */
  edit: (recipe: (cut: Cut) => void) => void;
  undo: () => void;
  redo: () => void;
  replaceCut: (cut: Cut) => void;

  setFrame: (frame: number) => void;
  stepFrame: (delta: number) => void;
  setActiveLayer: (layerId: string) => void;
  setTool: (tool: Tool) => void;
  setColor: (color: string) => void;
  setSize: (size: number) => void;
  setBrush: (brush: BrushPreset["id"]) => void;
  setStabilizer: (value: number) => void;
  setFillGap: (value: number) => void;
  setFillSampleAll: (value: boolean) => void;
  toggleOnion: () => void;
  setPlaying: (playing: boolean) => void;
  setView: (view: Partial<View>) => void;
  setSelection: (selection: Selection | null) => void;
}

const initialCut = freeze(createCut(), true);

/** Keeps the playhead and active layer valid after the cut changes. */
function fixups(cut: Cut, frame: number, activeLayerId: string) {
  return {
    frame: Math.min(Math.max(0, frame), cut.length - 1),
    activeLayerId: cut.layers.some((l) => l.id === activeLayerId)
      ? activeLayerId
      : cut.layers[cut.layers.length - 1].id,
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export const useEditor = create<EditorState>((set, get) => ({
  cut: initialCut,
  past: [],
  future: [],

  frame: 0,
  activeLayerId: initialCut.layers[initialCut.layers.length - 1].id,
  tool: "brush",
  color: "#1a1a1a",
  size: 6,
  brush: "ink",
  stabilizer: 30,
  fillGap: 3,
  fillSampleAll: true,
  onion: true,
  playing: false,
  view: DEFAULT_VIEW,
  selection: null,

  edit: (recipe) => {
    const { cut, past, frame, activeLayerId } = get();
    const next = produce(cut, recipe);
    if (next === cut) return;
    set({
      cut: next,
      past: [...past, cut].slice(-HISTORY_LIMIT),
      future: [],
      ...fixups(next, frame, activeLayerId),
    });
  },

  undo: () => {
    const { cut, past, future, frame, activeLayerId } = get();
    if (!past.length) return;
    const prev = past[past.length - 1];
    set({
      cut: prev,
      past: past.slice(0, -1),
      future: [cut, ...future],
      selection: null,
      ...fixups(prev, frame, activeLayerId),
    });
  },

  redo: () => {
    const { cut, past, future, frame, activeLayerId } = get();
    if (!future.length) return;
    const next = future[0];
    set({
      cut: next,
      past: [...past, cut],
      future: future.slice(1),
      selection: null,
      ...fixups(next, frame, activeLayerId),
    });
  },

  replaceCut: (cut) => {
    // Freeze once up front so Immer never has to walk the whole loaded cut during an edit.
    const frozen = freeze(cut, true);
    set({
      cut: frozen,
      past: [],
      future: [],
      playing: false,
      selection: null,
      ...fixups(frozen, 0, get().activeLayerId),
    });
  },

  // Selection belongs to one drawing, so moving to another frame or layer drops it.
  setFrame: (frame) => {
    const { length } = get().cut;
    set({ frame: clamp(frame, 0, length - 1), selection: null });
  },
  stepFrame: (delta) => {
    const { frame, cut } = get();
    set({ frame: (frame + delta + cut.length) % cut.length, selection: null });
  },
  setActiveLayer: (activeLayerId) =>
    set((s) => (s.activeLayerId === activeLayerId ? {} : { activeLayerId, selection: null })),
  setTool: (tool) => set((s) => ({ tool, selection: tool === "select" ? s.selection : null })),
  setColor: (color) => set({ color }),
  setSize: (size) => set({ size: clamp(size, 1, 80) }),
  setBrush: (brush) => set({ brush }),
  setStabilizer: (stabilizer) => set({ stabilizer: clamp(stabilizer, 0, 100) }),
  setFillGap: (fillGap) => set({ fillGap: clamp(Math.round(fillGap), 0, 10) }),
  setFillSampleAll: (fillSampleAll) => set({ fillSampleAll }),
  toggleOnion: () => set((s) => ({ onion: !s.onion })),
  setPlaying: (playing) => set({ playing, selection: playing ? null : get().selection }),
  setView: (view) =>
    set((s) => {
      const next = { ...s.view, ...view };
      next.zoom = clamp(next.zoom, 0.1, 8);
      next.rotation = ((next.rotation % 360) + 360) % 360;
      return { view: next };
    }),
  setSelection: (selection) => set({ selection }),
}));
