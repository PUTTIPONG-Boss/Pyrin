import { useEffect } from "react";
import { useEditor } from "../model/store";
import { actions } from "../timeline/actions";

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.matches("input:not([type=range]):not([type=color]), textarea")) return;
      const s = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === "z") s[e.shiftKey ? "redo" : "undo"]();
      else if (mod && key === "y") s.redo();
      else if (mod) return;
      else if (key === " ") s.setPlaying(!s.playing);
      else if (key === "arrowleft") s.stepFrame(-1);
      else if (key === "arrowright") s.stepFrame(1);
      else if (key === "b") s.setTool("brush");
      else if (key === "e") s.setTool("eraser");
      else if (key === "o") s.toggleOnion();
      else if (key === "[") s.setSize(s.size - 1);
      else if (key === "]") s.setSize(s.size + 1);
      else if (key === "n") actions.newDrawing();
      else if (key === "h") actions.hold();
      else if (key === "delete" || key === "backspace") actions.clear();
      else if (key === "+" || key === "=") actions.insertFrame();
      else if (key === "-") actions.deleteFrame();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
