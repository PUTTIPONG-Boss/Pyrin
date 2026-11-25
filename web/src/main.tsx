import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { loadAutosave } from "./model/io";
import { useEditor } from "./model/store";
import "./styles.css";

const saved = await loadAutosave();
if (saved) useEditor.getState().replaceCut(saved);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
