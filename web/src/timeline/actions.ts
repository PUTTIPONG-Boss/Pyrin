// Timesheet commands shared by the toolbar buttons and keyboard shortcuts.
import {
  addLayer,
  clearCell,
  deleteFrame,
  getLayer,
  holdPrevious,
  insertFrame,
  newDrawingAt,
  retime,
} from "../model/cut";
import { useEditor } from "../model/store";

const onActiveCell = (fn: (layer: NonNullable<ReturnType<typeof getLayer>>, frame: number) => void) => {
  const { edit, activeLayerId, frame } = useEditor.getState();
  edit((cut) => {
    const layer = getLayer(cut, activeLayerId);
    if (layer) fn(layer, frame);
  });
};

export const actions = {
  newDrawing: () => onActiveCell((layer, frame) => void newDrawingAt(layer, frame)),
  hold: () => onActiveCell(holdPrevious),
  clear: () => onActiveCell(clearCell),
  deleteFrame: () => onActiveCell(deleteFrame),

  insertFrame: () => {
    const { edit, activeLayerId, frame } = useEditor.getState();
    edit((cut) => insertFrame(cut, activeLayerId, frame));
  },

  retime: (n: number) => {
    const { edit, activeLayerId } = useEditor.getState();
    edit((cut) => retime(cut, activeLayerId, n));
  },

  addLayer: () => {
    let id = "";
    useEditor.getState().edit((cut) => void (id = addLayer(cut).id));
    if (id) useEditor.getState().setActiveLayer(id);
  },
};
