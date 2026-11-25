import { create } from "zustand";
import { produce } from "immer";
import { createCut } from "./cut";
import { loadAutosave } from "./io";
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

const initialCut = loadAutosave() ?? createCut();

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
    const { cut, past } = get();
    const next = produce(cut, recipe);
    if (next === cut) return;
    set({ cut: next, past: [...past, cut].slice(-HISTORY_LIMIT), future: [] });
    get().setFrame(get().frame); // keep the playhead inside the cut
    ensureActiveLayer();
  },

  undo: () => {
    const { cut, past, future } = get();
    if (!past.length) return;
    set({ cut: past[past.length - 1], past: past.slice(0, -1), future: [cut, ...future] });
    get().setFrame(get().frame);
    ensureActiveLayer();
  },

  redo: () => {
    const { cut, past, future } = get();
    if (!future.length) return;
    set({ cut: future[0], past: [...past, cut], future: future.slice(1) });
    get().setFrame(get().frame);
    ensureActiveLayer();
  },

  replaceCut: (cut) => {
    set({ cut, past: [], future: [], frame: 0, playing: false });
    ensureActiveLayer();
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

function ensureActiveLayer() {
  const { cut, activeLayerId } = useEditor.getState();
  if (!cut.layers.some((l) => l.id === activeLayerId)) {
    useEditor.setState({ activeLayerId: cut.layers[cut.layers.length - 1].id });
  }
}
