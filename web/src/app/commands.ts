// Every action that has a shortcut. Buttons, tooltips, the shortcut sheet and the keyboard
// handler all read from this list, so a key is defined in exactly one place.
import { addMarks, drawingAt, drawingStarts, getLayer, moveLayer, removeMarks } from "../model/cut";
import { downloadCut } from "../model/io";
import { DEFAULT_VIEW, useEditor, type Tool } from "../model/store";
import { isFill, type Mark } from "../model/types";
import { actions } from "../timeline/actions";
import { displayKeys } from "./keys";

export type CommandGroup = "Tools" | "View" | "Playback" | "Timesheet" | "Layers" | "Edit" | "File";

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

/** The drawing on the active cell and the selected strokes that still exist in it. */
function activeSelection() {
  const s = state();
  const layer = activeLayer();
  const drawing = layer ? drawingAt(layer, s.frame) : null;
  if (!drawing || s.selection?.drawingId !== drawing.id) return null;
  const indices = s.selection.indices.filter((i) => i < drawing.strokes.length);
  return indices.length ? { drawing, indices } : null;
}

/** Copied marks. In-memory only: copying between frames and layers is the main use. */
let clipboard: Mark[] = [];

function copy() {
  const sel = activeSelection();
  const layer = activeLayer();
  const drawing = layer ? drawingAt(layer, state().frame) : null;
  clipboard = sel ? sel.indices.map((i) => sel.drawing.strokes[i]) : drawing ? [...drawing.strokes] : [];
}

/** Deletes the selection, or clears the cell when nothing is selected. */
function deleteSelectionOrCell() {
  const sel = activeSelection();
  if (!sel) return actions.clear();
  const s = state();
  s.edit((c) => {
    const drawing = c.layers.find((l) => l.id === s.activeLayerId)?.drawings[sel.drawing.id];
    if (drawing) removeMarks(drawing, sel.indices);
  });
  s.setSelection(null);
}

function paste() {
  if (!clipboard.length) return;
  const s = state();
  let placed: ReturnType<typeof addMarks> | null = null;
  s.edit((c) => {
    const layer = getLayer(c, s.activeLayerId);
    if (layer) placed = addMarks(layer, s.frame, clipboard);
  });
  const result = placed as ReturnType<typeof addMarks> | null;
  if (!result) return;
  // Select what was pasted so it can be moved into place straight away.
  s.setTool("select");
  s.setSelection({ drawingId: result.drawingId, indices: result.indices });
}

function selectAll() {
  const layer = activeLayer();
  const drawing = layer ? drawingAt(layer, state().frame) : null;
  if (!drawing) return;
  const indices = drawing.strokes.flatMap((m, i) => (!isFill(m) && m.mode === "erase" ? [] : [i]));
  state().setTool("select");
  state().setSelection(indices.length ? { drawingId: drawing.id, indices } : null);
}

const ZOOM_STEPS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8];
function zoomStep(dir: 1 | -1) {
  const { view, setView } = state();
  const next =
    dir > 0 ? ZOOM_STEPS.find((z) => z > view.zoom + 1e-6) : ZOOM_STEPS.findLast((z) => z < view.zoom - 1e-6);
  if (next === undefined) return;
  // Zoom around the middle of the stage: scale the pan with the zoom.
  const k = next / view.zoom;
  setView({ zoom: next, panX: view.panX * k, panY: view.panY * k });
}

const setTool = (tool: Tool) => () => state().setTool(tool);

export const commands: Command[] = [
  // Tools
  { id: "tool.brush", label: "Brush", group: "Tools", keys: ["B"], run: setTool("brush") },
  { id: "tool.eraser", label: "Eraser", group: "Tools", keys: ["E"], run: setTool("eraser") },
  {
    id: "tool.swap",
    label: "Switch brush / eraser",
    group: "Tools",
    keys: ["X"],
    run: () => state().setTool(state().tool === "eraser" ? "brush" : "eraser"),
  },
  { id: "tool.line", label: "Line (Shift: snap angle)", group: "Tools", keys: ["L"], run: setTool("line") },
  { id: "tool.rect", label: "Rectangle (Shift: square)", group: "Tools", keys: ["R"], run: setTool("rect") },
  { id: "tool.ellipse", label: "Ellipse (Shift: circle)", group: "Tools", keys: ["U"], run: setTool("ellipse") },
  { id: "tool.fill", label: "Fill bucket", group: "Tools", keys: ["G"], run: setTool("fill") },
  { id: "tool.eyedropper", label: "Eyedropper (or Alt-click)", group: "Tools", keys: ["I"], run: setTool("eyedropper") },
  { id: "tool.select", label: "Lasso select / transform", group: "Tools", keys: ["S"], run: setTool("select") },
  { id: "tool.hand", label: "Hand (or hold Space)", group: "Tools", keys: [], run: setTool("hand") },
  { id: "size.down", label: "Smaller brush", group: "Tools", keys: ["["], run: () => state().setSize(state().size - 1) },
  { id: "size.up", label: "Bigger brush", group: "Tools", keys: ["]"], run: () => state().setSize(state().size + 1) },
  { id: "view.onion", label: "Onion skin", group: "Tools", keys: ["O"], run: () => state().toggleOnion() },

  // View
  { id: "view.zoomIn", label: "Zoom in (or Ctrl + wheel)", group: "View", keys: ["Ctrl+="], run: () => zoomStep(1) },
  { id: "view.zoomOut", label: "Zoom out", group: "View", keys: ["Ctrl+-"], run: () => zoomStep(-1) },
  { id: "view.reset", label: "Reset view", group: "View", keys: ["0"], run: () => state().setView(DEFAULT_VIEW) },
  {
    id: "view.rotateLeft",
    label: "Rotate view left",
    group: "View",
    keys: ["Shift+,"],
    run: () => state().setView({ rotation: state().view.rotation - 15 }),
  },
  {
    id: "view.rotateRight",
    label: "Rotate view right",
    group: "View",
    keys: ["Shift+."],
    run: () => state().setView({ rotation: state().view.rotation + 15 }),
  },
  {
    id: "view.flip",
    label: "Flip view horizontally",
    group: "View",
    keys: ["Shift+H"],
    run: () => state().setView({ flip: !state().view.flip }),
  },

  // Playback
  // Space plays on release, so holding Space can pan instead (see useShortcuts).
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
  {
    id: "cell.clear",
    label: "Delete selection / clear cell",
    group: "Timesheet",
    keys: ["Delete", "Backspace"],
    run: deleteSelectionOrCell,
  },
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
  { id: "edit.copy", label: "Copy selection (or whole drawing)", group: "Edit", keys: ["Ctrl+C"], run: copy },
  {
    id: "edit.cut",
    label: "Cut selection (or whole drawing)",
    group: "Edit",
    keys: ["Ctrl+X"],
    run: () => {
      copy();
      deleteSelectionOrCell();
    },
  },
  { id: "edit.paste", label: "Paste", group: "Edit", keys: ["Ctrl+V"], run: paste },
  { id: "select.all", label: "Select all", group: "Edit", keys: ["Ctrl+A"], run: selectAll },
  { id: "select.none", label: "Deselect", group: "Edit", keys: ["Escape", "Ctrl+D"], run: () => state().setSelection(null) },

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
  const combo = command?.keys[0];
  return {
    "data-tip": label ?? command?.label ?? id,
    "data-keys": combo ? displayKeys(combo).join(" ") : undefined,
    "aria-keyshortcuts": combo,
  };
}
