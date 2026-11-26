import { Brush, Circle, Eraser, Hand, Lasso, PaintBucket, Pipette, Slash, Square, type LucideIcon } from "lucide-react";
import { useEditor, type Tool } from "../model/store";
import { runCommand, tip } from "./commands";

const TOOLS: { tool: Tool; icon: LucideIcon }[] = [
  { tool: "brush", icon: Brush },
  { tool: "eraser", icon: Eraser },
  { tool: "line", icon: Slash },
  { tool: "rect", icon: Square },
  { tool: "ellipse", icon: Circle },
  { tool: "fill", icon: PaintBucket },
  { tool: "eyedropper", icon: Pipette },
  { tool: "select", icon: Lasso },
  { tool: "hand", icon: Hand },
];

export function ToolRail() {
  const tool = useEditor((s) => s.tool);
  const color = useEditor((s) => s.color);
  const setColor = useEditor((s) => s.setColor);

  return (
    <nav className="tool-rail" aria-label="Tools">
      {TOOLS.map(({ tool: t, icon: Icon }) => (
        <button
          key={t}
          className={`tool${tool === t ? " on" : ""}`}
          aria-pressed={tool === t}
          onClick={() => runCommand(`tool.${t}`)}
          {...tip(`tool.${t}`)}
        >
          <Icon size={18} strokeWidth={1.75} />
        </button>
      ))}
      <label className="swatch" data-tip="Colour (Alt-click the canvas to pick)" style={{ background: color }}>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
      </label>
    </nav>
  );
}
