// Keyboard combos are matched on physical keys (KeyboardEvent.code), so shortcuts keep
// working when the keyboard layout is switched, e.g. to Thai, where "B" types "ิ".

const CODE_NAMES: Record<string, string> = {
  Space: "Space",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  ArrowUp: "Up",
  ArrowDown: "Down",
  BracketLeft: "[",
  BracketRight: "]",
  Minus: "-",
  Equal: "=",
  Slash: "/",
  Comma: ",",
  Period: ".",
  Backquote: "`",
  NumpadAdd: "Num+",
  NumpadSubtract: "Num-",
};

/** Name of the physical key, e.g. "B", "1", "Left", "[", "Delete". */
export function keyName(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return CODE_NAMES[code] ?? code;
}

export interface KeyLike {
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** Canonical combo for an event, e.g. "Ctrl+Shift+Z". Cmd on macOS counts as Ctrl. */
export function comboFromEvent(e: KeyLike): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  parts.push(keyName(e.code));
  return parts.join("+");
}

const DISPLAY: Record<string, string> = {
  Left: "←",
  Right: "→",
  Up: "↑",
  Down: "↓",
  "Shift+/": "?",
  "=": "+",
  Delete: "Del",
};

/** How a combo is shown to people: "Shift+Left" → ["Shift", "←"]. */
export function displayKeys(combo: string): string[] {
  if (DISPLAY[combo]) return [DISPLAY[combo]];
  return combo.split("+").map((k) => DISPLAY[k] ?? k);
}
