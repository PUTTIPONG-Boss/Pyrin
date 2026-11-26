import { useEffect } from "react";
import { spaceKey } from "../canvas/view";
import { commandForCombo, isHelpOpen, runCommand, toggleHelp } from "./commands";
import { comboFromEvent } from "./keys";

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  target.matches("input:not([type=range]):not([type=color]), textarea, [contenteditable]");

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Let text fields keep their keys (but not sliders or colour pickers).
      if (isTyping(e.target)) return;
      if (e.code === "Escape" && isHelpOpen()) {
        toggleHelp(false);
        return;
      }
      // Space: hold to pan the canvas, tap to play (handled on release).
      if (e.code === "Space" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (!e.repeat) {
          spaceKey.held = true;
          spaceKey.usedForPan = false;
        }
        return;
      }
      const command = commandForCombo(comboFromEvent(e));
      if (!command) return;
      e.preventDefault();
      // A focused button would also react to Enter; shortcuts win.
      if (e.target instanceof HTMLButtonElement) e.target.blur();
      command.run();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !spaceKey.held) return;
      spaceKey.held = false;
      if (!spaceKey.usedForPan && !isTyping(e.target)) runCommand("play");
    };

    // Losing focus while Space is down would otherwise leave pan mode stuck on.
    const onBlur = () => (spaceKey.held = false);

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);
}
