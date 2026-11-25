// Every action that has a shortcut. Buttons, tooltips, the shortcut sheet and the keyboard
// handler all read from this list, so a key is defined in exactly one place.
import { drawingStarts, getLayer, moveLayer } from "../model/cut";
import { downloadCut } from "../model/io";
import { useEditor } from "../model/store";
import { actions } from "../timeline/actions";
import { displayKeys } from "./keys";

export type CommandGroup = "Tools" | "Playback" | "Timesheet" | "Layers" | "Edit" | "File";

export interface Command {
  id: string;
  label: string;
  group: CommandGroup;
  /** Combos as produced by comboFromEvent; the first one is shown in tooltips. */
  keys: string[];
  run: () => void;
}

const state = () => useEditor.getState();

function activeLayer() {
  const s = state();
  return getLayer(s.cut, s.activeLayerId);
}

/** Selects the layer above (+1) or below (-1) the active one. */
function selectLayer(delta: number) {
  const { cut, activeLayerId, setActiveLayer } = state();
  const i = cut.layers.findIndex((l) => l.id === activeLayerId);
  const next = cut.layers[i + delta];
  if (next) setActiveLayer(next.id);
}

/** Moves the playhead to the previous (-1) or next (+1) drawing on the active layer. */
function jumpToDrawing(dir: -1 | 1) {
  const layer = activeLayer();
  if (!layer) return;
  const { frame, setFrame } = state();
  const starts = drawingStarts(layer);
  const target = dir > 0 ? starts.find((f) => f > frame) : starts.findLast((f) => f < frame);
  if (target !== undefined) setFrame(target);
}

/** Lets an "Open…" button elsewhere register how to open the file picker. */
let openFile: () => void = () => {};
export const setOpenFileHandler = (fn: () => void) => (openFile = fn);

export const commands: Command[] = [
  // Tools
  { id: "tool.brush", label: "Brush", group: "Tools", keys: ["B"], run: () => state().setTool("brush") },
  { id: "tool.eraser", label: "Eraser", group: "Tools", keys: ["E"], run: () => state().setTool("eraser") },
  {
    id: "tool.swap",
    label: "Switch brush / eraser",
    group: "Tools",
    keys: ["X"],
    run: () => state().setTool(state().tool === "brush" ? "eraser" : "brush"),
  },
  { id: "size.down", label: "Smaller brush", group: "Tools", keys: ["["], run: () => state().setSize(state().size - 1) },
  { id: "size.up", label: "Bigger brush", group: "Tools", keys: ["]"], run: () => state().setSize(state().size + 1) },
  { id: "view.onion", label: "Onion skin", group: "Tools", keys: ["O"], run: () => state().toggleOnion() },

  // Playback
  { id: "play", label: "Play / pause", group: "Playback", keys: ["Space"], run: () => state().setPlaying(!state().playing) },
  { id: "frame.prev", label: "Previous frame", group: "Playback", keys: ["Left", ","], run: () => state().stepFrame(-1) },
  { id: "frame.next", label: "Next frame", group: "Playback", keys: ["Right", "."], run: () => state().stepFrame(1) },
  { id: "drawing.prev", label: "Previous drawing", group: "Playback", keys: ["Shift+Left"], run: () => jumpToDrawing(-1) },
  { id: "drawing.next", label: "Next drawing", group: "Playback", keys: ["Shift+Right"], run: () => jumpToDrawing(1) },
  { id: "frame.first", label: "First frame", group: "Playback", keys: ["Home"], run: () => state().setFrame(0) },
  { id: "frame.last", label: "Last frame", group: "Playback", keys: ["End"], run: () => state().setFrame(state().cut.length - 1) },

  // Timesheet
  { id: "cell.new", label: "New drawing on this frame", group: "Timesheet", keys: ["N"], run: actions.newDrawing },
  { id: "cell.hold", label: "Hold previous drawing", group: "Timesheet", keys: ["H"], run: actions.hold },
  { id: "cell.clear", label: "Clear cell", group: "Timesheet", keys: ["Delete", "Backspace"], run: actions.clear },
  { id: "frame.insert", label: "Insert frame", group: "Timesheet", keys: ["=", "Shift+=", "Num+"], run: actions.insertFrame },
  { id: "frame.delete", label: "Delete frame", group: "Timesheet", keys: ["-", "Num-"], run: actions.deleteFrame },
  { id: "retime.1", label: "Shoot layer on 1s", group: "Timesheet", keys: ["1"], run: () => actions.retime(1) },
  { id: "retime.2", label: "Shoot layer on 2s", group: "Timesheet", keys: ["2"], run: () => actions.retime(2) },
  { id: "retime.3", label: "Shoot layer on 3s", group: "Timesheet", keys: ["3"], run: () => actions.retime(3) },

  // Layers
  { id: "layer.add", label: "New layer", group: "Layers", keys: ["Shift+N"], run: actions.addLayer },
  { id: "layer.above", label: "Select layer above", group: "Layers", keys: ["Up"], run: () => selectLayer(1) },
  { id: "layer.below", label: "Select layer below", group: "Layers", keys: ["Down"], run: () => selectLayer(-1) },
  {
    id: "layer.moveUp",
    label: "Move layer up",
    group: "Layers",
    keys: ["Alt+Up"],
    run: () => state().edit((c) => moveLayer(c, state().activeLayerId, 1)),
  },
  {
    id: "layer.moveDown",
    label: "Move layer down",
    group: "Layers",
    keys: ["Alt+Down"],
    run: () => state().edit((c) => moveLayer(c, state().activeLayerId, -1)),
  },
  {
    id: "layer.visibility",
    label: "Show / hide layer",
    group: "Layers",
    keys: ["V"],
    run: () =>
      state().edit((c) => {
        const l = getLayer(c, state().activeLayerId);
        if (l) l.visible = !l.visible;
      }),
  },

  // Edit
  { id: "undo", label: "Undo", group: "Edit", keys: ["Ctrl+Z"], run: () => state().undo() },
  { id: "redo", label: "Redo", group: "Edit", keys: ["Ctrl+Shift+Z", "Ctrl+Y"], run: () => state().redo() },

  // File
  { id: "file.save", label: "Save", group: "File", keys: ["Ctrl+S"], run: () => downloadCut(state().cut) },
  { id: "file.open", label: "Open…", group: "File", keys: ["Ctrl+O"], run: () => openFile() },
  { id: "help", label: "Keyboard shortcuts", group: "File", keys: ["Shift+/"], run: () => toggleHelp() },
];

const byId = new Map(commands.map((c) => [c.id, c]));
const byCombo = new Map(commands.flatMap((c) => c.keys.map((k) => [k, c] as const)));

export const getCommand = (id: string) => byId.get(id);
export const commandForCombo = (combo: string) => byCombo.get(combo);
export const runCommand = (id: string) => byId.get(id)?.run();

/** Shortcut sheet visibility lives outside the document store: it is not undoable. */
let helpOpen = false;
const helpListeners = new Set<() => void>();
export const isHelpOpen = () => helpOpen;
export function toggleHelp(open = !helpOpen) {
  helpOpen = open;
  helpListeners.forEach((fn) => fn());
}
export function subscribeHelp(fn: () => void) {
  helpListeners.add(fn);
  return () => void helpListeners.delete(fn);
}

/**
 * Props for any element that should show a tooltip with the command's name and key,
 * e.g. `<button {...tip("tool.brush")}>`. `label` overrides the command's label.
 */
export function tip(id: string, label?: string) {
  const command = byId.get(id);
  return {
    "data-tip": label ?? command?.label ?? id,
    "data-keys": command ? displayKeys(command.keys[0]).join(" ") : undefined,
    "aria-keyshortcuts": command?.keys[0],
  };
}
