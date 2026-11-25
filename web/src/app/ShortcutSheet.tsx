import { useSyncExternalStore } from "react";
import { commands, isHelpOpen, subscribeHelp, toggleHelp, type CommandGroup } from "./commands";
import { displayKeys } from "./keys";

const GROUPS: CommandGroup[] = ["Tools", "Playback", "Timesheet", "Layers", "Edit", "File"];

export function ShortcutSheet() {
  const open = useSyncExternalStore(subscribeHelp, isHelpOpen);
  if (!open) return null;

  return (
    <div className="sheet-backdrop" onPointerDown={() => toggleHelp(false)}>
      <div
        className="sheet"
        role="dialog"
        aria-label="Keyboard shortcuts"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header>
          <h2>Keyboard shortcuts</h2>
          <button className="icon" onClick={() => toggleHelp(false)} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="sheet-groups">
          {GROUPS.map((group) => (
            <section key={group}>
              <h3>{group}</h3>
              {commands
                .filter((c) => c.group === group)
                .map((c) => (
                  <div className="sheet-row" key={c.id}>
                    <span>{c.label}</span>
                    <span className="keys">
                      {c.keys
                        .filter((k) => !k.startsWith("Num"))
                        .map((combo, i) => (
                          <span key={combo} className="combo">
                            {i > 0 && <span className="or">or</span>}
                            {displayKeys(combo).map((k) => (
                              <kbd key={k}>{k}</kbd>
                            ))}
                          </span>
                        ))}
                    </span>
                  </div>
                ))}
            </section>
          ))}
        </div>
        <footer className="muted">Shortcuts use key positions, so they also work with a Thai keyboard layout.</footer>
      </div>
    </div>
  );
}
