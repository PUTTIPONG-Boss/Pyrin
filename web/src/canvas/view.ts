// Maps between the screen and the paper when the view is panned, zoomed, rotated or flipped.
// The paper is centred in the stage and transformed around its centre with CSS.
import type { Point } from "../model/geometry";
import type { View } from "../model/store";

export interface Size {
  width: number;
  height: number;
}

export function paperTransform(view: View): string {
  return `translate(${view.panX}px, ${view.panY}px) rotate(${view.rotation}deg) scale(${view.flip ? -view.zoom : view.zoom}, ${view.zoom})`;
}

/**
 * Screen point → cut pixel. `stage` is the stage's client rect, `fit` the paper's on-screen
 * size at zoom 1, `cut` the cut's pixel size.
 */
export function screenToCut(clientX: number, clientY: number, stage: DOMRect, view: View, fit: Size, cut: Size): Point {
  const dx = clientX - (stage.left + stage.width / 2) - view.panX;
  const dy = clientY - (stage.top + stage.height / 2) - view.panY;
  const a = (-view.rotation * Math.PI) / 180;
  const rx = dx * Math.cos(a) - dy * Math.sin(a);
  const ry = dx * Math.sin(a) + dy * Math.cos(a);
  const px = rx / (view.flip ? -view.zoom : view.zoom) + fit.width / 2;
  const py = ry / view.zoom + fit.height / 2;
  return { x: (px * cut.width) / fit.width, y: (py * cut.height) / fit.height };
}

/** Screen pixels per cut pixel, e.g. to keep selection handles the same size on screen. */
export const screenScale = (view: View, fit: Size, cut: Size) => (fit.width / cut.width) * view.zoom;

/** New pan so the point under the cursor stays put when zooming from `from` to `to`. */
export function zoomAround(clientX: number, clientY: number, stage: DOMRect, view: View, to: number) {
  const dx = clientX - (stage.left + stage.width / 2);
  const dy = clientY - (stage.top + stage.height / 2);
  const k = to / view.zoom;
  return { zoom: to, panX: dx - (dx - view.panX) * k, panY: dy - (dy - view.panY) * k };
}

/**
 * Space is both "play" (tap) and "pan" (hold and drag), like most drawing programs.
 * The keyboard handler and the stage share this state.
 */
export const spaceKey = { held: false, usedForPan: false };
