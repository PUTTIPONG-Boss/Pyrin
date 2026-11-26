import { BRUSHES } from "../model/brushes";
import { useEditor } from "../model/store";

const HINTS: Partial<Record<string, string>> = {
  eyedropper: "Click or drag on the canvas to pick a colour",
  select: "Drag to lasso · drag inside to move · corners scale · circle rotates · Shift constrains",
  hand: "Drag to pan · Ctrl + wheel to zoom",
};

/** Settings for the current tool, shown in the top bar. */
export function ToolOptions() {
  const s = useEditor();
  const sizeSlider = (
    <label className="label" data-tip="Size" data-keys="[ ]">
      Size
      <input type="range" min={1} max={40} value={s.size} onChange={(e) => s.setSize(Number(e.target.value))} />
      <span className="muted value">{s.size}</span>
    </label>
  );

  switch (s.tool) {
    case "brush":
      return (
        <div className="group options">
          <div className="segmented" role="radiogroup" aria-label="Brush">
            {BRUSHES.map((b) => (
              <button
                key={b.id}
                role="radio"
                aria-checked={s.brush === b.id}
                className={s.brush === b.id ? "on" : ""}
                onClick={() => s.setBrush(b.id)}
              >
                {b.label}
              </button>
            ))}
          </div>
          {sizeSlider}
          <label className="label" data-tip="Stabilizer: smooths shaky lines (higher = smoother, more lag)">
            Stabilizer
            <input type="range" min={0} max={100} value={s.stabilizer} onChange={(e) => s.setStabilizer(Number(e.target.value))} />
            <span className="muted value">{s.stabilizer}</span>
          </label>
        </div>
      );
    case "eraser":
    case "line":
    case "rect":
    case "ellipse":
      return <div className="group options">{sizeSlider}</div>;
    case "fill":
      return (
        <div className="group options">
          <label className="label" data-tip="Closes small gaps in the line art so colour does not leak">
            Close gaps
            <input type="range" min={0} max={10} value={s.fillGap} onChange={(e) => s.setFillGap(Number(e.target.value))} />
            <span className="muted value">{s.fillGap}</span>
          </label>
          <div className="segmented" role="radiogroup" aria-label="Fill looks at">
            <button
              role="radio"
              aria-checked={s.fillSampleAll}
              className={s.fillSampleAll ? "on" : ""}
              onClick={() => s.setFillSampleAll(true)}
              data-tip="Use line art from every visible layer (colour on its own layer)"
            >
              All layers
            </button>
            <button
              role="radio"
              aria-checked={!s.fillSampleAll}
              className={!s.fillSampleAll ? "on" : ""}
              onClick={() => s.setFillSampleAll(false)}
              data-tip="Use only this layer's lines"
            >
              This layer
            </button>
          </div>
        </div>
      );
    default:
      return <div className="group options muted hint">{HINTS[s.tool]}</div>;
  }
}
