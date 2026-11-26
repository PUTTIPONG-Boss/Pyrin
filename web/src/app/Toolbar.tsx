import { FlipHorizontal2, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef } from "react";
import { ToolOptions } from "./ToolOptions";
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

      <ToolOptions />

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

      <div className="group view-controls">
        <button className="icon-btn" onClick={() => runCommand("view.zoomOut")} {...tip("view.zoomOut")}>
          <ZoomOut size={16} />
        </button>
        <button className="zoom-level" onClick={() => runCommand("view.reset")} {...tip("view.reset")}>
          {Math.round(s.view.zoom * 100)}%
        </button>
        <button className="icon-btn" onClick={() => runCommand("view.zoomIn")} {...tip("view.zoomIn")}>
          <ZoomIn size={16} />
        </button>
        <button className="icon-btn" onClick={() => runCommand("view.rotateLeft")} {...tip("view.rotateLeft")}>
          <RotateCcw size={16} />
        </button>
        <button className="icon-btn" onClick={() => runCommand("view.rotateRight")} {...tip("view.rotateRight")}>
          <RotateCw size={16} />
        </button>
        <button
          className={`icon-btn${s.view.flip ? " on" : ""}`}
          onClick={() => runCommand("view.flip")}
          {...tip("view.flip")}
        >
          <FlipHorizontal2 size={16} />
        </button>
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
