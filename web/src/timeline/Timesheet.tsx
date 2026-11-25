import { memo, useMemo } from "react";
import { getLayer, moveLayer, removeLayer, setLength } from "../model/cut";
import { useEditor } from "../model/store";
import type { Layer } from "../model/types";
import { actions } from "./actions";

export function Timesheet() {
  const cut = useEditor((s) => s.cut);
  const frame = useEditor((s) => s.frame);
  const activeLayerId = useEditor((s) => s.activeLayerId);
  const setFrame = useEditor((s) => s.setFrame);
  const edit = useEditor((s) => s.edit);

  const frames = useMemo(() => Array.from({ length: cut.length }, (_, i) => i), [cut.length]);
  // Top layer first, like a layer panel.
  const rows = [...cut.layers].reverse();

  const scrub = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.type === "pointermove" && e.buttons !== 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setFrame(Math.floor(((e.clientX - rect.left) / rect.width) * cut.length));
  };

  return (
    <section className="timesheet">
      <div className="timesheet-bar">
        <button onClick={actions.addLayer}>+ Layer</button>
        <span className="sep" />
        <button onClick={actions.newDrawing} title="New drawing on this frame (N)">New drawing</button>
        <button onClick={actions.hold} title="Hold previous drawing (H)">Hold</button>
        <button onClick={actions.clear} title="Clear cell (Delete)">Clear</button>
        <button onClick={actions.insertFrame} title="Insert frame (+)">+ Frame</button>
        <button onClick={actions.deleteFrame} title="Delete frame (-)">− Frame</button>
        <span className="sep" />
        <span className="label">Shoot layer on</span>
        {[1, 2, 3].map((n) => (
          <button key={n} onClick={() => actions.retime(n)} title={`Hold every drawing for ${n} frame(s)`}>
            {n}s
          </button>
        ))}
        <span className="sep" />
        <label className="label">
          Length
          <input
            type="number"
            min={1}
            value={cut.length}
            onChange={(e) => edit((c) => setLength(c, Number(e.target.value) || 1))}
          />
          <span className="muted">{(cut.length / cut.fps).toFixed(2)}s @ {cut.fps}fps</span>
        </label>
      </div>

      <div className="grid" style={{ "--frames": cut.length } as React.CSSProperties}>
        <div className="corner">Frame {frame + 1}</div>
        <div className="ruler" onPointerDown={scrub} onPointerMove={scrub}>
          {frames.map((f) => (
            <div
              key={f}
              className={`ruler-cell${f === frame ? " current" : ""}${(f + 1) % cut.fps === 0 ? " second" : (f + 1) % 6 === 0 ? " beat" : ""}`}
            >
              {f + 1}
            </div>
          ))}
        </div>

        {rows.map((layer) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            frames={frames}
            frame={frame}
            active={layer.id === activeLayerId}
          />
        ))}
      </div>
    </section>
  );
}

// Rows only re-render when their own layer, the playhead or selection changes.
const LayerRow = memo(function LayerRow({
  layer,
  frames,
  frame,
  active,
}: {
  layer: Layer;
  frames: number[];
  frame: number;
  active: boolean;
}) {
  const edit = useEditor((s) => s.edit);
  const setFrame = useEditor((s) => s.setFrame);
  const setActiveLayer = useEditor((s) => s.setActiveLayer);
  const layerCount = useEditor((s) => s.cut.layers.length);

  const update = (fn: (l: Layer) => void) =>
    edit((cut) => {
      const l = getLayer(cut, layer.id);
      if (l) fn(l);
    });

  return (
    <>
      <div className={`layer-head${active ? " active" : ""}`} onClick={() => setActiveLayer(layer.id)}>
        <button
          className="icon"
          title={layer.visible ? "Hide layer" : "Show layer"}
          onClick={(e) => {
            e.stopPropagation();
            update((l) => void (l.visible = !l.visible));
          }}
        >
          {layer.visible ? "◉" : "○"}
        </button>
        <input
          className="layer-name"
          value={layer.name}
          onChange={(e) => update((l) => void (l.name = e.target.value))}
        />
        <button className="icon" title="Move up" onClick={() => edit((c) => moveLayer(c, layer.id, 1))}>▲</button>
        <button className="icon" title="Move down" onClick={() => edit((c) => moveLayer(c, layer.id, -1))}>▼</button>
        <button
          className="icon"
          title="Delete layer"
          disabled={layerCount <= 1}
          onClick={(e) => {
            e.stopPropagation();
            edit((c) => removeLayer(c, layer.id));
          }}
        >
          ✕
        </button>
      </div>
      <div className={`cells${active ? " active" : ""}`}>
        {frames.map((f) => {
          const id = layer.exposure[f];
          const starts = id && layer.exposure[f - 1] !== id;
          const holds = id && !starts;
          const ends = id && layer.exposure[f + 1] !== id;
          return (
            <div
              key={f}
              className={[
                "cell",
                f === frame && "current",
                active && f === frame && "selected",
                starts && "start",
                holds && "hold",
                ends && "end",
                id && layer.drawings[id]?.kind,
              ]
                .filter(Boolean)
                .join(" ")}
              onPointerDown={() => {
                setActiveLayer(layer.id);
                setFrame(f);
              }}
            >
              {starts ? layer.drawings[id]?.name : ""}
            </div>
          );
        })}
      </div>
    </>
  );
});
