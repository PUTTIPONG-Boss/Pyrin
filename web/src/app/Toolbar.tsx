import { useRef } from "react";
import { createCut } from "../model/cut";
import { downloadCut, parseCut } from "../model/io";
import { useEditor } from "../model/store";

export function Toolbar() {
  const s = useEditor();
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async (file: File) => {
    try {
      s.replaceCut(parseCut(await file.text()));
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <header className="toolbar">
      <strong className="brand">Pyrin</strong>

      <div className="group">
        <button className={s.tool === "brush" ? "on" : ""} onClick={() => s.setTool("brush")} title="Brush (B)">
          Brush
        </button>
        <button className={s.tool === "eraser" ? "on" : ""} onClick={() => s.setTool("eraser")} title="Eraser (E)">
          Eraser
        </button>
        <label className="label" title="Size ([ and ])">
          Size
          <input type="range" min={1} max={40} value={s.size} onChange={(e) => s.setSize(Number(e.target.value))} />
          <span className="muted">{s.size}</span>
        </label>
        <input type="color" value={s.color} onChange={(e) => s.setColor(e.target.value)} title="Colour" />
      </div>

      <div className="group">
        <button className={s.onion ? "on" : ""} onClick={s.toggleOnion} title="Onion skin (O)">
          Onion skin
        </button>
        <button onClick={s.undo} disabled={!s.past.length} title="Undo (Ctrl+Z)">Undo</button>
        <button onClick={s.redo} disabled={!s.future.length} title="Redo (Ctrl+Shift+Z)">Redo</button>
      </div>

      <div className="group">
        <button onClick={() => s.stepFrame(-1)} title="Previous frame (←)">◀</button>
        <button className={s.playing ? "on" : ""} onClick={() => s.setPlaying(!s.playing)} title="Play / pause (Space)">
          {s.playing ? "Pause" : "Play"}
        </button>
        <button onClick={() => s.stepFrame(1)} title="Next frame (→)">▶</button>
      </div>

      <div className="group right">
        <button
          onClick={() => {
            if (confirm("Start a new cut? Unsaved work in this cut will be lost.")) s.replaceCut(createCut());
          }}
        >
          New
        </button>
        <button onClick={() => fileRef.current?.click()}>Open…</button>
        <button onClick={() => downloadCut(s.cut)}>Save</button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) load(file);
            e.target.value = "";
          }}
        />
      </div>
    </header>
  );
}
