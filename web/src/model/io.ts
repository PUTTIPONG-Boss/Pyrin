import type { Cut } from "./types";

const FORMAT = "pyrin";
const VERSION = 1;

export function serializeCut(cut: Cut): string {
  return JSON.stringify({ format: FORMAT, version: VERSION, cut });
}

export function parseCut(text: string): Cut {
  const data = JSON.parse(text);
  if (data?.format !== FORMAT || data.version !== VERSION) {
    throw new Error("Not a Pyrin project file (or an unsupported version).");
  }
  const cut = data.cut as Cut;
  if (!Array.isArray(cut?.layers) || !cut.layers.every((l) => Array.isArray(l.exposure))) {
    throw new Error("Project file is damaged: missing layers or timesheet.");
  }
  return cut;
}

export function downloadCut(cut: Cut, filename = "pyrin-cut.pyrin.json"): void {
  const url = URL.createObjectURL(new Blob([serializeCut(cut)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const AUTOSAVE_KEY = "pyrin.autosave";

export function loadAutosave(): Cut | null {
  try {
    const text = localStorage.getItem(AUTOSAVE_KEY);
    return text ? parseCut(text) : null;
  } catch {
    return null;
  }
}

export function saveAutosave(cut: Cut): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, serializeCut(cut));
  } catch {
    // Storage full or blocked: autosave is a convenience, so ignore.
  }
}
