import { useEffect } from "react";
import { Stage } from "../canvas/Stage";
import { saveAutosave } from "../model/io";
import { useEditor } from "../model/store";
import { Timesheet } from "../timeline/Timesheet";
import { usePlayback } from "../timeline/usePlayback";
import { Toolbar } from "./Toolbar";
import { useShortcuts } from "./useShortcuts";

export function App() {
  usePlayback();
  useShortcuts();

  useEffect(() => {
    let timer = 0;
    const flush = () => {
      clearTimeout(timer);
      saveAutosave(useEditor.getState().cut);
    };
    const unsubscribe = useEditor.subscribe((s, prev) => {
      if (s.cut === prev.cut) return;
      clearTimeout(timer);
      timer = window.setTimeout(flush, 500);
    });
    window.addEventListener("pagehide", flush);
    return () => {
      unsubscribe();
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  return (
    <div className="app">
      <Toolbar />
      <Stage />
      <Timesheet />
    </div>
  );
}
