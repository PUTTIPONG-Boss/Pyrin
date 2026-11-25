import { useEffect } from "react";
import { useEditor } from "../model/store";

/** Advances the playhead at the cut's fps while `playing` is on. Holds come from the exposure itself. */
export function usePlayback() {
  const playing = useEditor((s) => s.playing);

  useEffect(() => {
    if (!playing) return;
    const start = performance.now();
    const startFrame = useEditor.getState().frame;
    let raf = 0;
    const tick = (now: number) => {
      const { cut, frame, setFrame } = useEditor.getState();
      const next = (startFrame + Math.floor(((now - start) * cut.fps) / 1000)) % cut.length;
      if (next !== frame) setFrame(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
}
