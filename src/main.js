import "./style.css";
import { registerSW } from "virtual:pwa-register";
import { initCtx } from "./state.js";
import { nextWord } from "./words.js";
import "./sounds.js";
import "./render.js";
import "./game.js";
import "./ui.js";
import "./bg-grid.js";

registerSW({ immediate: true });

// Wire the nextWord function into the context buffer system
initCtx(nextWord);
