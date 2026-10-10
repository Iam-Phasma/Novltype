// ══════════════════════════════════════════════════════════════════════
//  BACKGROUND GRID — interactive canvas with skyline cutout
// ══════════════════════════════════════════════════════════════════════

import { GRID_CELL, getGridClearAreas, isGridCellVisible } from "./grid-layout.js";

(function initBgGrid() {
  const canvas = document.getElementById("bg-grid");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const CELL = GRID_CELL;
  const protectedElements = [...document.querySelectorAll(".hint, .toolbar")];
  const app = document.getElementById("app");
  const MOUSE_RADIUS = 3;
  const MOUSE_PEAK = 0.18;
  const FADE_SPEED = 0.08;

  let cols, rows, cells;
  let mouseCol = -999, mouseRow = -999;
  let mouseX = -9999, mouseY = -9999;
  let isLight = document.body.classList.contains("light");

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    cols = Math.ceil(canvas.width / CELL) + 1;
    rows = Math.ceil(canvas.height / CELL) + 1;
    buildCells();
  }

  let edges;

  function buildSkyline() {
    // Keep the random steps stable between frames, always outside the clear area.
    const offsets = length => Array.from({ length }, () => Math.floor(Math.random() * 3));
    edges = {
      top: offsets(cols),
      bottom: offsets(cols),
      left: offsets(rows),
      right: offsets(rows),
    };
  }

  function buildCells() {
    cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells.push({ r, c, alpha: 0, target: 0 });
      }
    }
    buildSkyline();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-CELL, 0);
    isLight = document.body.classList.contains("light");

    const lineColor = isLight
      ? "rgba(0,0,0,0.09)"
      : "rgba(255,255,255,0.09)";
    const blockR = isLight ? 0 : 107;
    const blockG = isLight ? 122 : 107;
    const blockB = 255;

    // Measure current positions so wrapping, animations, and font loading are covered.
    const clearAreas = getGridClearAreas(
      protectedElements.map(element => element.getBoundingClientRect()),
      app?.classList.contains("prestart"),
    );
    function cellVisible(c, r) {
      return clearAreas.every(area => isGridCellVisible(c, r, area, edges));
    }

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;

    for (let r = 0; r <= rows; r++) {
      let start = null;
      for (let c = 0; c <= cols; c++) {
        const vis = cellVisible(c, r - 1) || cellVisible(c, r);
        if (vis && start === null) start = c;
        if (!vis && start !== null) {
          ctx.beginPath();
          ctx.moveTo(start * CELL + 0.5, r * CELL + 0.5);
          ctx.lineTo(c * CELL + 0.5, r * CELL + 0.5);
          ctx.stroke();
          start = null;
        }
      }
      if (start !== null) {
        ctx.beginPath();
        ctx.moveTo(start * CELL + 0.5, r * CELL + 0.5);
        ctx.lineTo(cols * CELL + 0.5, r * CELL + 0.5);
        ctx.stroke();
      }
    }

    for (let c = 0; c <= cols; c++) {
      let start = null;
      for (let r = 0; r <= rows; r++) {
        const vis = cellVisible(c - 1, r) || cellVisible(c, r);
        if (vis && start === null) start = r;
        if (!vis && start !== null) {
          ctx.beginPath();
          ctx.moveTo(c * CELL + 0.5, start * CELL + 0.5);
          ctx.lineTo(c * CELL + 0.5, r * CELL + 0.5);
          ctx.stroke();
          start = null;
        }
      }
      if (start !== null) {
        ctx.beginPath();
        ctx.moveTo(c * CELL + 0.5, start * CELL + 0.5);
        ctx.lineTo(c * CELL + 0.5, rows * CELL + 0.5);
        ctx.stroke();
      }
    }

    cells.forEach((cell) => {
      const dc = cell.c - mouseCol;
      const dr = cell.r - mouseRow;
      const dist = Math.sqrt(dc * dc + dr * dr);
      cell.target =
        dist < MOUSE_RADIUS ? MOUSE_PEAK * (1 - dist / MOUSE_RADIUS) : 0;

      const diff = cell.target - cell.alpha;
      cell.alpha += diff * (diff > 0 ? 0.18 : FADE_SPEED);
      if (cell.alpha < 0.005) return;

      if (!cellVisible(cell.c, cell.r)) return;

      ctx.fillStyle = `rgba(${blockR},${blockG},${blockB},${cell.alpha})`;
      ctx.fillRect(cell.c * CELL + 1, cell.r * CELL + 1, CELL - 2, CELL - 2);
    });

    if (mouseX > -9000) {
      const LINE_RADIUS = 4.0;
      const LINE_PEAK = isLight ? 0.62 : 0.58;
      const LINE_BASE = isLight ? 0.08 : 0.07;
      const lr = blockR;
      const lg = blockG;
      const lb = blockB;

      const cMin = Math.max(0, Math.floor((mouseX - LINE_RADIUS * CELL) / CELL));
      const cMax = Math.min(cols, Math.ceil((mouseX + LINE_RADIUS * CELL) / CELL));
      const rMin = Math.max(0, Math.floor((mouseY - LINE_RADIUS * CELL) / CELL));
      const rMax = Math.min(rows, Math.ceil((mouseY + LINE_RADIUS * CELL) / CELL));

      ctx.lineWidth = 1;
      for (let r = rMin; r <= rMax; r++) {
        for (let c = cMin; c <= cMax; c++) {
          if (c < cols && (cellVisible(c, r - 1) || cellVisible(c, r))) {
            const dx = (c + 0.5) * CELL - mouseX;
            const dy = r * CELL - mouseY;
            const dist = Math.sqrt(dx * dx + dy * dy) / CELL;
            if (dist < LINE_RADIUS) {
              const a = LINE_BASE + (LINE_PEAK - LINE_BASE) * (1 - dist / LINE_RADIUS);
              ctx.strokeStyle = `rgba(${lr},${lg},${lb},${a})`;
              ctx.beginPath();
              ctx.moveTo(c * CELL + 0.5, r * CELL + 0.5);
              ctx.lineTo((c + 1) * CELL + 0.5, r * CELL + 0.5);
              ctx.stroke();
            }
          }
          if (r < rows && (cellVisible(c - 1, r) || cellVisible(c, r))) {
            const dx = c * CELL - mouseX;
            const dy = (r + 0.5) * CELL - mouseY;
            const dist = Math.sqrt(dx * dx + dy * dy) / CELL;
            if (dist < LINE_RADIUS) {
              const a = LINE_BASE + (LINE_PEAK - LINE_BASE) * (1 - dist / LINE_RADIUS);
              ctx.strokeStyle = `rgba(${lr},${lg},${lb},${a})`;
              ctx.beginPath();
              ctx.moveTo(c * CELL + 0.5, r * CELL + 0.5);
              ctx.lineTo(c * CELL + 0.5, (r + 1) * CELL + 0.5);
              ctx.stroke();
            }
          }
        }
      }
    }

    ctx.restore();
    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX + CELL;
    mouseY = e.clientY;
    mouseCol = Math.floor(mouseX / CELL);
    mouseRow = Math.floor(e.clientY / CELL);
  });
  window.addEventListener("mouseleave", () => {
    mouseX = -9999;
    mouseY = -9999;
    mouseCol = -999;
    mouseRow = -999;
  });

  resize();
  draw();
})();
