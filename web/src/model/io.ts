import type { Cut, Drawing, Layer } from "./types";

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

// Autosave lives in IndexedDB, which has no 5 MB limit like localStorage. Copying a whole
// cut into storage blocks the page for hundreds of milliseconds on big cuts, so each drawing
// is its own record and only drawings that changed since the last save are written. Immer
// gives an edited drawing a new object, so "changed" is an identity check.
// Failures are ignored, since autosave is a convenience.
const DB_NAME = "pyrin";
const STORE = "autosave";
const CUT_KEY = "cut"; // the cut with each layer's drawings replaced by their ids
const DRAWING_PREFIX = "drawing:";
const DRAWING_RANGE = () => IDBKeyRange.bound(DRAWING_PREFIX, DRAWING_PREFIX + "￿");
const OLD_KEY = "current"; // whole cut in one record (before per-drawing saves)
const LEGACY_KEY = "pyrin.autosave"; // localStorage, before IndexedDB

type StoredLayer = Omit<Layer, "drawings"> & { drawings: string[] };
type StoredCut = Omit<Cut, "layers"> & { layers: StoredLayer[] };

/** Drawings as they are currently stored, to tell which ones changed. */
let stored = new Map<string, Drawing>();

const request = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;
const db = () => (dbPromise ??= openDb());

export async function loadAutosave(): Promise<Cut | null> {
  try {
    const store = (await db()).transaction(STORE).objectStore(STORE);
    const [skeleton, drawings, old] = await Promise.all([
      request<StoredCut | undefined>(store.get(CUT_KEY)),
      request<Drawing[]>(store.getAll(DRAWING_RANGE())),
      request<Cut | undefined>(store.get(OLD_KEY)),
    ]);
    if (skeleton) {
      const byId = new Map(drawings.map((d) => [d.id, d]));
      const cut: Cut = {
        ...skeleton,
        layers: skeleton.layers.map((l) => ({
          ...l,
          drawings: Object.fromEntries(l.drawings.flatMap((id) => (byId.has(id) ? [[id, byId.get(id)!]] : []))),
        })),
      };
      stored = byId;
      return cut;
    }
    // Earlier versions: one record, or localStorage. The next save rewrites it in the new form.
    if (old) return old;
    const legacy = localStorage.getItem(LEGACY_KEY);
    return legacy ? parseCut(legacy) : null;
  } catch {
    return null;
  }
}

export async function saveAutosave(cut: Cut): Promise<void> {
  try {
    const tx = (await db()).transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const current = new Map<string, Drawing>();
    const skeleton: StoredCut = {
      ...cut,
      layers: cut.layers.map((l) => {
        for (const d of Object.values(l.drawings)) current.set(d.id, d);
        return { ...l, drawings: Object.keys(l.drawings) };
      }),
    };
    store.put(skeleton, CUT_KEY);
    for (const [id, d] of current) if (stored.get(id) !== d) store.put(d, DRAWING_PREFIX + id);
    for (const id of stored.keys()) if (!current.has(id)) store.delete(DRAWING_PREFIX + id);
    store.delete(OLD_KEY);
    tx.oncomplete = () => localStorage.removeItem(LEGACY_KEY);
    // Assume success so the next save stays small; on failure, rewrite everything next time.
    stored = current;
    tx.onerror = tx.onabort = () => (stored = new Map());
  } catch {
    // Storage blocked (e.g. private window): nothing to do.
  }
}
