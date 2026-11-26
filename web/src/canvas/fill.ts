// Paint-bucket flood fill on RGBA pixels. Pure (no DOM) so it can be tested directly.

export interface FillOptions {
  /** Max per-channel difference (0-255) still counted as the clicked colour. */
  tolerance: number;
  /** Closes gaps in line art up to about 2·gap px wide. 0 = no gap closing. */
  gap: number;
}

/**
 * Returns the filled region as runs [y, x0, x1, ...] (x1 inclusive), or null when the click
 * is outside the image.
 *
 * Gap closing: lines (pixels unlike the clicked colour) are first thickened by `gap` px so
 * small gaps close, and the area is flood-filled. The fill then grows back through the
 * thickened band (never through the lines themselves), and finally 1 px under the lines'
 * edge so no white halo is left between colour and line.
 */
export function floodFill(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  sx: number,
  sy: number,
  { tolerance, gap }: FillOptions,
): number[] | null {
  sx = Math.floor(sx);
  sy = Math.floor(sy);
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return null;

  const n = width * height;
  const seed = (sy * width + sx) * 4;
  const wall = new Uint8Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const d = Math.max(
      Math.abs(data[p] - data[seed]),
      Math.abs(data[p + 1] - data[seed + 1]),
      Math.abs(data[p + 2] - data[seed + 2]),
      Math.abs(data[p + 3] - data[seed + 3]),
    );
    wall[i] = d > tolerance ? 1 : 0;
  }

  let blocked = gap > 0 ? dilate(wall, width, height, gap) : wall;
  // Clicked right next to a line: thickening swallowed the seed, so fill without it.
  if (blocked[sy * width + sx]) blocked = wall;

  let region = scanlineFill(blocked, width, height, sx, sy);
  if (blocked !== wall) {
    for (let i = 0; i < gap; i++) region = grow(region, width, height, wall);
  }
  region = grow(region, width, height, null);
  return toSpans(region, width, height);
}

/**
 * Grows a region by 1 px in all 8 directions, skipping pixels set in `stop`. Diagonals
 * matter: the lines were thickened with a square, and growing only up/down/left/right
 * would leave a small unfilled triangle inside every corner.
 */
function grow(region: Uint8Array, width: number, height: number, stop: Uint8Array | null): Uint8Array {
  const out = region.slice();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (region[i] || (stop && stop[i])) continue;
      search: for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < width && region[ny * width + nx]) {
            out[i] = 1;
            break search;
          }
        }
      }
    }
  }
  return out;
}

/** Marks every pixel within `r` px (square) of a set pixel. Two 1D passes, O(n). */
export function dilate(mask: Uint8Array, width: number, height: number, r: number): Uint8Array {
  if (r <= 0) return mask;
  const tmp = new Uint8Array(mask.length);
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let last = -Infinity; // last set pixel seen moving right
    for (let x = 0; x < width; x++) {
      if (mask[row + x]) last = x;
      if (x - last <= r) tmp[row + x] = 1;
    }
    last = Infinity;
    for (let x = width - 1; x >= 0; x--) {
      if (mask[row + x]) last = x;
      if (last - x <= r) tmp[row + x] = 1;
    }
  }
  for (let x = 0; x < width; x++) {
    let last = -Infinity;
    for (let y = 0; y < height; y++) {
      if (tmp[y * width + x]) last = y;
      if (y - last <= r) out[y * width + x] = 1;
    }
    last = Infinity;
    for (let y = height - 1; y >= 0; y--) {
      if (tmp[y * width + x]) last = y;
      if (last - y <= r) out[y * width + x] = 1;
    }
  }
  return out;
}

function scanlineFill(blocked: Uint8Array, width: number, height: number, sx: number, sy: number): Uint8Array {
  const region = new Uint8Array(blocked.length);
  const stack: number[] = [sx, sy];
  const open = (x: number, y: number) => !blocked[y * width + x] && !region[y * width + x];
  while (stack.length) {
    const y = stack.pop()!;
    let x = stack.pop()!;
    if (!open(x, y)) continue;
    while (x > 0 && open(x - 1, y)) x--;
    let above = false;
    let below = false;
    for (; x < width && open(x, y); x++) {
      region[y * width + x] = 1;
      if (y > 0) {
        const o = open(x, y - 1);
        if (o && !above) stack.push(x, y - 1);
        above = o;
      }
      if (y < height - 1) {
        const o = open(x, y + 1);
        if (o && !below) stack.push(x, y + 1);
        below = o;
      }
    }
  }
  return region;
}

function toSpans(mask: Uint8Array, width: number, height: number): number[] {
  const spans: number[] = [];
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (!mask[row + x]) continue;
      const start = x;
      while (x + 1 < width && mask[row + x + 1]) x++;
      spans.push(y, start, x);
    }
  }
  return spans;
}
