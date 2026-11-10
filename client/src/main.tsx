import { createRoot } from "react-dom/client";
import App from "./App";
import { sound } from "./lib/sound";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

const unlockAudio = () => sound.unlock();
window.addEventListener("pointerdown", unlockAudio, { passive: true });
window.addEventListener("keydown", unlockAudio);

createRoot(root).render(<App />);
