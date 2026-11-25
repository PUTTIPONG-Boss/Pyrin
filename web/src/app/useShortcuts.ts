import { useEffect } from "react";
import { commandForCombo, isHelpOpen, toggleHelp } from "./commands";
import { comboFromEvent } from "./keys";

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Let text fields keep their keys (but not sliders or colour pickers).
      if (target.matches("input:not([type=range]):not([type=color]), textarea, [contenteditable]")) return;
      if (e.code === "Escape" && isHelpOpen()) {
        toggleHelp(false);
        return;
      }
      const command = commandForCombo(comboFromEvent(e));
      if (!command) return;
      e.preventDefault();
      // A focused button would also react to Space/Enter; shortcuts win.
      if (target instanceof HTMLButtonElement) target.blur();
      command.run();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
