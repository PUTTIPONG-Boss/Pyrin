import { useEffect, useRef } from "react";
import { createCut } from "../model/cut";
import { parseCut } from "../model/io";
import { useEditor } from "../model/store";
import { runCommand, setOpenFileHandler, tip } from "./commands";

export function Toolbar() {
  const s = useEditor();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setOpenFileHandler(() => fileRef.current?.click()), []);

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
        <button className={s.tool === "brush" ? "on" : ""} onClick={() => runCommand("tool.brush")} {...tip("tool.brush")}>
          Brush
        </button>
        <button className={s.tool === "eraser" ? "on" : ""} onClick={() => runCommand("tool.eraser")} {...tip("tool.eraser")}>
          Eraser
        </button>
        <label className="label" data-tip="Brush size" data-keys="[ ]">
          Size
          <input type="range" min={1} max={40} value={s.size} onChange={(e) => s.setSize(Number(e.target.value))} />
          <span className="muted">{s.size}</span>
        </label>
        <input type="color" value={s.color} onChange={(e) => s.setColor(e.target.value)} data-tip="Colour" />
      </div>

      <div className="group">
        <button className={s.onion ? "on" : ""} onClick={() => runCommand("view.onion")} {...tip("view.onion")}>
          Onion skin
        </button>
        <button onClick={() => runCommand("undo")} disabled={!s.past.length} {...tip("undo")}>
          Undo
        </button>
        <button onClick={() => runCommand("redo")} disabled={!s.future.length} {...tip("redo")}>
          Redo
        </button>
      </div>

      <div className="group">
        <button onClick={() => runCommand("frame.prev")} {...tip("frame.prev")}>◀</button>
        <button className={s.playing ? "on" : ""} onClick={() => runCommand("play")} {...tip("play")}>
          {s.playing ? "Pause" : "Play"}
        </button>
        <button onClick={() => runCommand("frame.next")} {...tip("frame.next")}>▶</button>
      </div>

      <div className="group right">
        <button
          data-tip="New cut"
          onClick={() => {
            if (confirm("Start a new cut? Unsaved work in this cut will be lost.")) s.replaceCut(createCut());
          }}
        >
          New
        </button>
        <button onClick={() => runCommand("file.open")} {...tip("file.open")}>Open…</button>
        <button onClick={() => runCommand("file.save")} {...tip("file.save")}>Save</button>
        <button className="help-button" onClick={() => runCommand("help")} {...tip("help")}>
          ?
        </button>
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
