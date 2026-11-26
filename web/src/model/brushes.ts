export interface BrushPreset {
  id: "pencil" | "ink" | "marker";
  label: string;
  /** How much pressure changes the width (0 = even line). */
  thinning: number;
}

export const BRUSHES: BrushPreset[] = [
  { id: "pencil", label: "Pencil", thinning: 0.3 },
  { id: "ink", label: "Ink pen", thinning: 0.7 },
  { id: "marker", label: "Marker", thinning: 0 },
];

export const brushById = (id: BrushPreset["id"]) => BRUSHES.find((b) => b.id === id) ?? BRUSHES[0];

/** Stabilizer slider (0-100) to perfect-freehand's streamline (0.2 = raw, 0.95 = very smooth). */
export const streamlineFor = (stabilizer: number) => 0.2 + (Math.min(Math.max(stabilizer, 0), 100) / 100) * 0.75;
