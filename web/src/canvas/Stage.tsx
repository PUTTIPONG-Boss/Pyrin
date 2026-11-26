import { useEffect, useRef, useState } from "react";
import { brushById, streamlineFor } from "../model/brushes";
import { addStroke, drawingAt, getLayer, transformMarks } from "../model/cut";
import {
  apply,
  IDENTITY,
  lassoPick,
  rotateAbout,
  scaleAbout,
  shapePoints,
  strokesBounds,
  translate,
  type Box,
  type Matrix,
  type Point,
  type ShapeKind,
} from "../model/geometry";
import { useEditor, type Tool } from "../model/store";
import type { Drawing, Stroke, StrokePoint } from "../model/types";
import { floodFill } from "./fill";
import { StageRenderer } from "./render";
import { paperTransform, screenScale, screenToCut, spaceKey, zoomAround } from "./view";

const round = (n: number, step: number) => Math.round(n / step) * step;

/** Minimum distance in cut pixels between recorded stroke points. */
const MIN_SPACING = 1.5;
/** Selection handle size and rotate-handle distance, in screen pixels. */
const HANDLE = 9;
const ROTATE_OFFSET = 26;
const FILL_TOLERANCE = 40;

const SHAPES: Partial<Record<Tool, ShapeKind>> = { line: "line", rect: "rect", ellipse: "ellipse" };

/** What the current pointer drag is doing. */
type Gesture =
  | { kind: "stroke" }
  | { kind: "shape"; shape: ShapeKind; from: Point }
  | { kind: "pan"; startX: number; startY: number; panX: number; panY: number }
  | { kind: "pick" }
  | { kind: "lasso"; points: Point[] }
  | {
      kind: "transform";
      mode: "move" | "scale" | "rotate";
      drawing: Drawing;
      indices: number[];
      box: Box;
      start: Point;
      /** Fixed point for scaling (opposite corner) or rotating (centre). */
      origin: Point;
      matrix: Matrix;
    };

export function Stage() {
  const cut = useEditor((s) => s.cut);
  const frame = useEditor((s) => s.frame);
  const activeLayerId = useEditor((s) => s.activeLayerId);
  const onion = useEditor((s) => s.onion);
  const playing = useEditor((s) => s.playing);
  const tool = useEditor((s) => s.tool);
  const view = useEditor((s) => s.view);
  const selection = useEditor((s) => s.selection);

  const underRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef<HTMLCanvasElement>(null);
  const overRef = useRef<HTMLCanvasElement>(null);
  const uiRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<StageRenderer | null>(null);
  const liveRef = useRef<Stroke | null>(null);
  const predictedRef = useRef<StrokePoint[]>([]);
  const gestureRef = useRef<Gesture | null>(null);
  const rafRef = useRef(0);
  const [panning, setPanning] = useState(false);

  const getRenderer = () =>
    (rendererRef.current ??= new StageRenderer(underRef.current!, activeRef.current!, overRef.current!));

  useEffect(() => {
    getRenderer().render({ cut, frame, activeLayerId, onion: onion && !playing });
  }, [cut, frame, activeLayerId, onion, playing]);

  // A different cut was opened: prepare its drawings in the background.
  useEffect(() => getRenderer().prewarm(useEditor.getState().cut), [cut.id]);

  // Fit the paper inside the stage at zoom 1, keeping the cut's aspect ratio.
  const stageRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const scale = Math.min(width / cut.width, height / cut.height);
      setFit({ width: Math.floor(cut.width * scale), height: Math.floor(cut.height * scale) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [cut.width, cut.height]);

  // Ctrl + wheel zooms around the cursor; the wheel alone pans. Needs a non-passive listener.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { view: v, setView } = useEditor.getState();
      if (e.ctrlKey || e.metaKey) {
        const zoom = Math.min(Math.max(v.zoom * Math.exp(-e.deltaY * 0.0015), 0.1), 8);
        setView(zoomAround(e.clientX, e.clientY, el.getBoundingClientRect(), v, zoom));
      } else {
        setView({ panX: v.panX - e.deltaX, panY: v.panY - e.deltaY });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /** The active drawing and the selected stroke indices that still exist in it. */
  const currentSelection = () => {
    const s = useEditor.getState();
    const layer = getLayer(s.cut, s.activeLayerId);
    const drawing = layer ? drawingAt(layer, s.frame) : null;
    if (!s.selection || !drawing || s.selection.drawingId !== drawing.id) return null;
    const indices = s.selection.indices.filter((i) => i < drawing.strokes.length);
    return indices.length ? { drawing, indices } : null;
  };

  // ---- Overlay: lasso, selection box and handles -------------------------------------
  const drawOverlay = (gesture: Gesture | null = gestureRef.current) => {
    const canvas = uiRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const { view: v } = useEditor.getState();
    const unit = 1 / screenScale(v, fit, cut); // one screen pixel, in cut pixels
    ctx.lineWidth = unit * 1.5;

    if (gesture?.kind === "lasso" && gesture.points.length > 1) {
      ctx.setLineDash([6 * unit, 4 * unit]);
      ctx.strokeStyle = "#5b8def";
      ctx.beginPath();
      gesture.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }

    const sel = currentSelection();
    if (!sel) return;
    const box = gesture?.kind === "transform" ? gesture.box : strokesBounds(sel.indices.map((i) => sel.drawing.strokes[i]));
    if (!box) return;
    const m = gesture?.kind === "transform" ? gesture.matrix : IDENTITY;
    const corners = boxCorners(box).map((p) => apply(m, p.x, p.y));
    ctx.strokeStyle = "#5b8def";
    ctx.setLineDash([5 * unit, 3 * unit]);
    ctx.beginPath();
    corners.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    const [rx, ry] = rotateHandle(box, m, unit);
    const [tx, ty] = apply(m, (box.x0 + box.x1) / 2, box.y0);
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(rx, ry);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    const h = HANDLE * unit;
    for (const [x, y] of corners) {
      ctx.fillRect(x - h / 2, y - h / 2, h, h);
      ctx.strokeRect(x - h / 2, y - h / 2, h, h);
    }
    ctx.beginPath();
    ctx.arc(rx, ry, h / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };

  useEffect(() => drawOverlay(), [selection, cut, frame, activeLayerId, view, fit]);

  // ---- Live repaint ------------------------------------------------------------------
  // At most one repaint per display frame, however many pointer events arrive.
  const scheduleLive = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const gesture = gestureRef.current;
      if (gesture?.kind === "transform") {
        getRenderer().drawTransformed(gesture.drawing, gesture.indices, gesture.matrix);
        drawOverlay(gesture);
        return;
      }
      if (gesture?.kind === "lasso") {
        drawOverlay(gesture);
        return;
      }
      const live = liveRef.current;
      const predicted = predictedRef.current;
      getRenderer().drawLive(live && predicted.length ? { ...live, points: [...live.points, ...predicted] } : live);
    });
  };

  const toCut = (e: { clientX: number; clientY: number }): Point => {
    const { view: v } = useEditor.getState();
    return screenToCut(e.clientX, e.clientY, stageRef.current!.getBoundingClientRect(), v, fit, cut);
  };

  const toPoints = (events: PointerEvent[]): StrokePoint[] =>
    events.map((ev) => {
      const { x, y } = toCut(ev);
      return [round(x, 0.01), round(y, 0.01), round(ev.pressure || 0.5, 0.001)];
    });

  const pickColor = (p: Point) => {
    const s = useEditor.getState();
    s.setColor(getRenderer().sampleColor(s.cut, s.frame, p.x, p.y));
  };

  const fillAt = (p: Point) => {
    const s = useEditor.getState();
    const layer = getLayer(s.cut, s.activeLayerId);
    if (!layer?.visible) return;
    const ids = s.fillSampleAll ? s.cut.layers.map((l) => l.id) : [layer.id];
    const image = getRenderer().fillSource(s.cut, s.frame, ids);
    const spans = floodFill(image.data, image.width, image.height, p.x, p.y, {
      tolerance: FILL_TOLERANCE,
      gap: s.fillGap,
    });
    if (!spans?.length) return;
    s.edit((c) => {
      const l = getLayer(c, s.activeLayerId);
      if (l) addStroke(l, s.frame, { type: "fill", color: s.color, spans });
    });
  };

  /** Starts a move / scale / rotate if the pointer is on the selection or its handles. */
  const hitSelection = (p: Point): Gesture | null => {
    const sel = currentSelection();
    if (!sel) return null;
    const box = strokesBounds(sel.indices.map((i) => sel.drawing.strokes[i]));
    if (!box) return null;
    const unit = 1 / screenScale(useEditor.getState().view, fit, cut);
    const near = (x: number, y: number) => Math.hypot(p.x - x, p.y - y) <= HANDLE * unit;
    const base = { kind: "transform" as const, drawing: sel.drawing, indices: sel.indices, box, start: p, matrix: IDENTITY };
    const [rx, ry] = rotateHandle(box, IDENTITY, unit);
    if (near(rx, ry)) {
      return { ...base, mode: "rotate", origin: { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 } };
    }
    const corners = boxCorners(box);
    const corner = corners.findIndex((c) => near(c.x, c.y));
    if (corner >= 0) return { ...base, mode: "scale", origin: corners[(corner + 2) % 4] };
    if (p.x >= box.x0 && p.x <= box.x1 && p.y >= box.y0 && p.y <= box.y1) return { ...base, mode: "move", origin: p };
    return null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const state = useEditor.getState();
    if (state.playing) state.setPlaying(false);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Pointer already gone (or synthetic); the gesture still works without capture.
    }

    // Pan: middle button, the hand tool, or Space held down.
    if (e.button === 1 || state.tool === "hand" || spaceKey.held) {
      if (spaceKey.held) spaceKey.usedForPan = true;
      gestureRef.current = { kind: "pan", startX: e.clientX, startY: e.clientY, panX: state.view.panX, panY: state.view.panY };
      setPanning(true);
      return;
    }

    const p = toCut(e);
    const tool = state.tool;

    // Alt-click picks a colour with any painting tool.
    if (tool === "eyedropper" || (e.altKey && tool !== "select")) {
      pickColor(p);
      gestureRef.current = { kind: "pick" };
      return;
    }

    if (tool === "select") {
      const hit = hitSelection(p);
      if (hit) {
        gestureRef.current = hit;
        return;
      }
      state.setSelection(null);
      gestureRef.current = { kind: "lasso", points: [p] };
      return;
    }

    const layer = getLayer(state.cut, state.activeLayerId);
    if (!layer?.visible) return;

    if (tool === "fill") {
      fillAt(p);
      return;
    }

    const shape = SHAPES[tool];
    const base = {
      color: state.color,
      simulatePressure: e.pointerType === "mouse",
      thinning: brushById(state.brush).thinning,
      streamline: streamlineFor(state.stabilizer),
    };
    if (shape) {
      gestureRef.current = { kind: "shape", shape, from: p };
      liveRef.current = { ...base, points: [], size: state.size, mode: "draw", thinning: 0, streamline: 0, simulatePressure: false };
      return;
    }

    gestureRef.current = { kind: "stroke" };
    liveRef.current =
      tool === "eraser"
        ? { ...base, points: toPoints([e.nativeEvent]), size: state.size * 3, mode: "erase", thinning: 0 }
        : { ...base, points: toPoints([e.nativeEvent]), size: state.size, mode: "draw" };
    predictedRef.current = [];
    scheduleLive();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    const native = e.nativeEvent;

    switch (gesture.kind) {
      case "pan":
        useEditor.getState().setView({
          panX: gesture.panX + e.clientX - gesture.startX,
          panY: gesture.panY + e.clientY - gesture.startY,
        });
        return;
      case "pick":
        pickColor(toCut(e));
        return;
      case "lasso":
        gesture.points.push(toCut(e));
        scheduleLive();
        return;
      case "shape": {
        const live = liveRef.current;
        if (!live) return;
        live.points = shapePoints(gesture.shape, gesture.from, toCut(e), e.shiftKey);
        scheduleLive();
        return;
      }
      case "transform":
        gesture.matrix = transformFor(gesture, toCut(e), e.shiftKey);
        scheduleLive();
        return;
      case "stroke": {
        const live = liveRef.current;
        if (!live) return;
        const coalesced = native.getCoalescedEvents?.() ?? [];
        // Pens report up to 1000 points a second; points closer than MIN_SPACING add cost
        // (outline building is linear in points) without changing the line.
        for (const p of toPoints(coalesced.length ? coalesced : [native])) {
          const last = live.points[live.points.length - 1];
          if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= MIN_SPACING) live.points.push(p);
        }
        // Where the pen is likely to be next frame: shown, but never saved, to hide input lag.
        predictedRef.current = toPoints(native.getPredictedEvents?.() ?? []);
        scheduleLive();
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    const stroke = liveRef.current;
    liveRef.current = null;
    predictedRef.current = [];
    setPanning(false);
    if (!gesture) return;
    const state = useEditor.getState();

    if (gesture.kind === "lasso") {
      const sel = currentSelectionDrawing();
      const indices = sel ? lassoPick(sel.strokes, gesture.points) : [];
      state.setSelection(sel && indices.length ? { drawingId: sel.id, indices } : null);
      drawOverlay(null);
      return;
    }

    if (gesture.kind === "transform") {
      if (gesture.matrix !== IDENTITY) {
        state.edit((c) => {
          const layer = getLayer(c, state.activeLayerId);
          const drawing = layer ? drawingAt(layer, state.frame) : null;
          if (drawing) transformMarks(drawing, gesture.indices, gesture.matrix);
        });
      } else {
        getRenderer().render({ cut: state.cut, frame: state.frame, activeLayerId: state.activeLayerId, onion: state.onion });
      }
      drawOverlay(null);
      return;
    }

    if (!stroke || (gesture.kind !== "stroke" && gesture.kind !== "shape")) return;
    if (gesture.kind === "shape" && stroke.points.length < 2) {
      getRenderer().drawLive(null);
      return;
    }
    // Where the pen lifted, so fast flicks keep their tail. Pen-up reports no pressure,
    // so reuse the last pressure.
    if (gesture.kind === "stroke" && e.type === "pointerup") {
      const [[x, y]] = toPoints([e.nativeEvent]);
      const last = stroke.points[stroke.points.length - 1];
      if (x !== last[0] || y !== last[1]) stroke.points.push([x, y, last[2]]);
    }
    state.edit((c) => {
      const layer = getLayer(c, state.activeLayerId);
      if (layer) addStroke(layer, state.frame, stroke);
    });
  };

  const currentSelectionDrawing = () => {
    const s = useEditor.getState();
    const layer = getLayer(s.cut, s.activeLayerId);
    return layer ? drawingAt(layer, s.frame) : null;
  };

  const cursor = panning ? "grabbing" : tool === "hand" ? "grab" : tool === "select" ? "default" : "crosshair";

  return (
    <div
      className="stage"
      ref={stageRef}
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="paper" style={{ ...fit, transform: paperTransform(view) }}>
        <canvas ref={underRef} width={cut.width} height={cut.height} />
        <canvas ref={activeRef} width={cut.width} height={cut.height} />
        <canvas ref={overRef} width={cut.width} height={cut.height} />
        <canvas ref={uiRef} width={cut.width} height={cut.height} />
      </div>
    </div>
  );
}

function boxCorners(b: Box): Point[] {
  return [
    { x: b.x0, y: b.y0 },
    { x: b.x1, y: b.y0 },
    { x: b.x1, y: b.y1 },
    { x: b.x0, y: b.y1 },
  ];
}

/** Rotate handle: above the top edge's middle, a fixed screen distance away. */
function rotateHandle(box: Box, m: Matrix, unit: number): [number, number] {
  const cx = (box.x0 + box.x1) / 2;
  const [tx, ty] = apply(m, cx, box.y0);
  const [ux, uy] = apply(m, cx, box.y0 - 1);
  const len = Math.hypot(ux - tx, uy - ty) || 1;
  return [tx + ((ux - tx) / len) * ROTATE_OFFSET * unit, ty + ((uy - ty) / len) * ROTATE_OFFSET * unit];
}

function transformFor(g: Extract<Gesture, { kind: "transform" }>, p: Point, constrain: boolean): Matrix {
  if (g.mode === "move") {
    let dx = p.x - g.start.x;
    let dy = p.y - g.start.y;
    if (constrain) Math.abs(dx) > Math.abs(dy) ? (dy = 0) : (dx = 0);
    return translate(dx, dy);
  }
  if (g.mode === "rotate") {
    let angle =
      Math.atan2(p.y - g.origin.y, p.x - g.origin.x) - Math.atan2(g.start.y - g.origin.y, g.start.x - g.origin.x);
    if (constrain) angle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
    return rotateAbout(angle, g.origin);
  }
  const ratio = (a: number, b: number) => (Math.abs(b) < 1e-3 ? 1 : a / b);
  let sx = ratio(p.x - g.origin.x, g.start.x - g.origin.x);
  let sy = ratio(p.y - g.origin.y, g.start.y - g.origin.y);
  if (constrain) sx = sy = Math.max(Math.abs(sx), Math.abs(sy)) * Math.sign(sx || 1);
  return scaleAbout(sx, sy, g.origin);
}
