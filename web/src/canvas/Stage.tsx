import { useEffect, useRef, useState } from "react";
import { addStroke, getLayer } from "../model/cut";
import { useEditor } from "../model/store";
import type { Stroke, StrokePoint } from "../model/types";
import { renderFrame } from "./render";

export function Stage() {
  const cut = useEditor((s) => s.cut);
  const frame = useEditor((s) => s.frame);
  const activeLayerId = useEditor((s) => s.activeLayerId);
  const onion = useEditor((s) => s.onion);
  const playing = useEditor((s) => s.playing);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratchRef = useRef<HTMLCanvasElement | null>(null);
  const liveRef = useRef<Stroke | null>(null);
  const rafRef = useRef(0);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!scratchRef.current) scratchRef.current = document.createElement("canvas");
    const scratch = scratchRef.current;
    if (scratch.width !== cut.width || scratch.height !== cut.height) {
      scratch.width = cut.width;
      scratch.height = cut.height;
    }
    renderFrame(canvas.getContext("2d")!, scratch, cut, frame, {
      activeLayerId,
      onion: onion && !playing,
      liveStroke: liveRef.current,
    });
  };

  useEffect(draw);

  // Fit the canvas inside the stage while keeping the cut's aspect ratio.
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

  const scheduleDraw = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
  };

  const toPoints = (e: React.PointerEvent<HTMLCanvasElement>): StrokePoint[] => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = cut.width / rect.width;
    const sy = cut.height / rect.height;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
    return (events.length ? events : [e.nativeEvent]).map((ev) => [
      (ev.clientX - rect.left) * sx,
      (ev.clientY - rect.top) * sy,
      ev.pressure || 0.5,
    ]);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const state = useEditor.getState();
    const layer = getLayer(state.cut, state.activeLayerId);
    if (!layer?.visible) return;
    if (state.playing) state.setPlaying(false);
    e.currentTarget.setPointerCapture(e.pointerId);
    liveRef.current = {
      points: toPoints(e),
      color: state.color,
      size: state.tool === "eraser" ? state.size * 3 : state.size,
      mode: state.tool === "eraser" ? "erase" : "draw",
      simulatePressure: e.pointerType === "mouse",
    };
    scheduleDraw();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const live = liveRef.current;
    if (!live) return;
    live.points.push(...toPoints(e));
    scheduleDraw();
  };

  const onPointerUp = () => {
    const stroke = liveRef.current;
    liveRef.current = null;
    if (!stroke) return;
    const { edit, activeLayerId: layerId, frame: f } = useEditor.getState();
    edit((c) => {
      const layer = getLayer(c, layerId);
      if (layer) addStroke(layer, f, stroke);
    });
  };

  return (
    <div className="stage" ref={stageRef}>
      <canvas
        ref={canvasRef}
        width={cut.width}
        height={cut.height}
        style={fit}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
    </div>
  );
}
