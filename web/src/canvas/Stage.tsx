import { useEffect, useRef, useState } from "react";
import { addStroke, getLayer } from "../model/cut";
import { useEditor } from "../model/store";
import type { Stroke, StrokePoint } from "../model/types";
import { StageRenderer } from "./render";

const round = (n: number, step: number) => Math.round(n / step) * step;

/** Minimum distance in cut pixels between recorded stroke points. */
const MIN_SPACING = 1.5;

export function Stage() {
  const cut = useEditor((s) => s.cut);
  const frame = useEditor((s) => s.frame);
  const activeLayerId = useEditor((s) => s.activeLayerId);
  const onion = useEditor((s) => s.onion);
  const playing = useEditor((s) => s.playing);

  const underRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef<HTMLCanvasElement>(null);
  const overRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<StageRenderer | null>(null);
  const liveRef = useRef<Stroke | null>(null);
  const predictedRef = useRef<StrokePoint[]>([]);
  const rafRef = useRef(0);

  const getRenderer = () =>
    (rendererRef.current ??= new StageRenderer(underRef.current!, activeRef.current!, overRef.current!));

  useEffect(() => {
    getRenderer().render({ cut, frame, activeLayerId, onion: onion && !playing });
  }, [cut, frame, activeLayerId, onion, playing]);

  // A different cut was opened: prepare its drawings in the background.
  useEffect(() => getRenderer().prewarm(useEditor.getState().cut), [cut.id]);

  // Fit the canvases inside the stage while keeping the cut's aspect ratio.
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

  // At most one repaint per display frame, however many pointer events arrive.
  const scheduleLive = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const live = liveRef.current;
      const predicted = predictedRef.current;
      rendererRef.current?.drawLive(
        live && predicted.length ? { ...live, points: [...live.points, ...predicted] } : live,
      );
    });
  };

  const toPoints = (events: PointerEvent[], rect: DOMRect): StrokePoint[] => {
    const sx = cut.width / rect.width;
    const sy = cut.height / rect.height;
    return events.map((ev) => [
      round((ev.clientX - rect.left) * sx, 0.01),
      round((ev.clientY - rect.top) * sy, 0.01),
      round(ev.pressure || 0.5, 0.001),
    ]);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const state = useEditor.getState();
    const layer = getLayer(state.cut, state.activeLayerId);
    if (!layer?.visible) return;
    if (state.playing) state.setPlaying(false);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Pointer already gone (or synthetic); drawing still works without capture.
    }
    liveRef.current = {
      points: toPoints([e.nativeEvent], e.currentTarget.getBoundingClientRect()),
      color: state.color,
      size: state.tool === "eraser" ? state.size * 3 : state.size,
      mode: state.tool === "eraser" ? "erase" : "draw",
      simulatePressure: e.pointerType === "mouse",
    };
    predictedRef.current = [];
    scheduleLive();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const live = liveRef.current;
    if (!live) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const native = e.nativeEvent;
    const coalesced = native.getCoalescedEvents?.() ?? [];
    // Pens report up to 1000 points a second; points closer than MIN_SPACING add cost
    // (outline building is linear in points) without changing the line.
    for (const p of toPoints(coalesced.length ? coalesced : [native], rect)) {
      const last = live.points[live.points.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= MIN_SPACING) live.points.push(p);
    }
    // Where the pen is likely to be next frame: shown, but never saved, to hide input lag.
    predictedRef.current = toPoints(native.getPredictedEvents?.() ?? [], rect);
    scheduleLive();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const stroke = liveRef.current;
    liveRef.current = null;
    predictedRef.current = [];
    if (!stroke) return;
    // Where the pen lifted, so fast flicks keep their tail. Pen-up reports no pressure,
    // so reuse the last pressure.
    if (e.type === "pointerup") {
      const [[x, y]] = toPoints([e.nativeEvent], e.currentTarget.getBoundingClientRect());
      const last = stroke.points[stroke.points.length - 1];
      if (x !== last[0] || y !== last[1]) stroke.points.push([x, y, last[2]]);
    }
    const { edit, activeLayerId: layerId, frame: f } = useEditor.getState();
    edit((c) => {
      const layer = getLayer(c, layerId);
      if (layer) addStroke(layer, f, stroke);
    });
  };

  return (
    <div className="stage" ref={stageRef}>
      <div
        className="paper"
        style={fit}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <canvas ref={underRef} width={cut.width} height={cut.height} />
        <canvas ref={activeRef} width={cut.width} height={cut.height} />
        <canvas ref={overRef} width={cut.width} height={cut.height} />
      </div>
    </div>
  );
}
