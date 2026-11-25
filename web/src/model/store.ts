import { create } from "zustand";
import { freeze, produce } from "immer";
import { createCut } from "./cut";
import type { Cut } from "./types";

export type Tool = "brush" | "eraser";

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
  onion: boolean;
  playing: boolean;

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
  toggleOnion: () => void;
  setPlaying: (playing: boolean) => void;
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

export const useEditor = create<EditorState>((set, get) => ({
  cut: initialCut,
  past: [],
  future: [],

  frame: 0,
  activeLayerId: initialCut.layers[initialCut.layers.length - 1].id,
  tool: "brush",
  color: "#1a1a1a",
  size: 6,
  onion: true,
  playing: false,

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
    set({ cut: prev, past: past.slice(0, -1), future: [cut, ...future], ...fixups(prev, frame, activeLayerId) });
  },

  redo: () => {
    const { cut, past, future, frame, activeLayerId } = get();
    if (!future.length) return;
    const next = future[0];
    set({ cut: next, past: [...past, cut], future: future.slice(1), ...fixups(next, frame, activeLayerId) });
  },

  replaceCut: (cut) => {
    // Freeze once up front so Immer never has to walk the whole loaded cut during an edit.
    const frozen = freeze(cut, true);
    set({ cut: frozen, past: [], future: [], playing: false, ...fixups(frozen, 0, get().activeLayerId) });
  },

  setFrame: (frame) => {
    const { length } = get().cut;
    set({ frame: Math.min(Math.max(0, frame), length - 1) });
  },
  stepFrame: (delta) => {
    const { frame, cut } = get();
    set({ frame: (frame + delta + cut.length) % cut.length });
  },
  setActiveLayer: (activeLayerId) => set({ activeLayerId }),
  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
  setSize: (size) => set({ size: Math.min(Math.max(1, size), 80) }),
  toggleOnion: () => set((s) => ({ onion: !s.onion })),
  setPlaying: (playing) => set({ playing }),
}));
