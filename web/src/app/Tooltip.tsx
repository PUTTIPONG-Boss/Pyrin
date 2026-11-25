import { useEffect, useRef, useState } from "react";

const DELAY_MS = 350;
const GAP = 8;

interface Tip {
  label: string;
  keys: string[];
  anchor: DOMRect;
}

/**
 * One tooltip for the whole app. Any element with `data-tip` (and optionally `data-keys`)
 * shows it on hover; see `tip()` in commands.ts.
 */
export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer = 0;
    let current: Element | null = null;
    const hide = () => {
      clearTimeout(timer);
      current = null;
      setTip(null);
    };
    const onOver = (e: PointerEvent) => {
      const el = (e.target as Element).closest?.("[data-tip]");
      if (el === current) return;
      hide();
      if (!el || e.buttons) return;
      current = el;
      timer = window.setTimeout(() => {
        const { tip: label = "", keys } = (el as HTMLElement).dataset;
        setTip({ label, keys: keys ? keys.split(" ") : [], anchor: el.getBoundingClientRect() });
      }, DELAY_MS);
    };
    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerdown", hide);
    document.addEventListener("keydown", hide);
    window.addEventListener("blur", hide);
    window.addEventListener("scroll", hide, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerdown", hide);
      document.removeEventListener("keydown", hide);
      window.removeEventListener("blur", hide);
      window.removeEventListener("scroll", hide, true);
    };
  }, []);

  // Place below the element, or above when there is no room; keep inside the window.
  useEffect(() => {
    const box = boxRef.current;
    if (!tip || !box) return setPos(null);
    const { width, height } = box.getBoundingClientRect();
    const a = tip.anchor;
    let top = a.bottom + GAP;
    if (top + height > window.innerHeight - GAP) top = a.top - height - GAP;
    const left = Math.min(Math.max(GAP, a.left + a.width / 2 - width / 2), window.innerWidth - width - GAP);
    setPos({ left, top });
  }, [tip]);

  if (!tip) return null;
  return (
    <div
      ref={boxRef}
      className="tooltip"
      role="tooltip"
      style={pos ?? { left: -9999, top: -9999 }}
    >
      <span>{tip.label}</span>
      {tip.keys.length > 0 && (
        <span className="keys">
          {tip.keys.map((k) => (
            <kbd key={k}>{k}</kbd>
          ))}
        </span>
      )}
    </div>
  );
}
