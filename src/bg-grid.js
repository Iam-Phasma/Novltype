// ══════════════════════════════════════════════════════════════════════
//  BACKGROUND GRID — interactive canvas with skyline cutout
// ══════════════════════════════════════════════════════════════════════

(function initBgGrid() {
  const canvas = document.getElementById("bg-grid");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const CELL = 48;
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

  let colTopCut = [];
  let colBotCut = [];
  let rowLeftCut = [];
  let rowRightCut = [];

  function buildSkyline() {
    colTopCut = [];
    colBotCut = [];
    rowLeftCut = [];
    rowRightCut = [];
    const baseTop = Math.round(rows * 0.3) - 1;
    const baseBot = Math.round(rows * 0.7) - 1;
    const baseLeft = Math.round(cols * 0.18);
    const baseRight = Math.round(cols * 0.82);
    for (let c = 0; c < cols; c++) {
      colTopCut.push(baseTop + Math.floor(Math.random() * 3) - 1);
      colBotCut.push(baseBot + Math.floor(Math.random() * 3) - 1);
    }
    for (let r = 0; r < rows; r++) {
      rowLeftCut.push(baseLeft + Math.floor(Math.random() * 3) - 1);
      rowRightCut.push(baseRight + Math.floor(Math.random() * 3) - 1);
    }
    colTopCut.push(colTopCut[cols - 1]);
    colBotCut.push(colBotCut[cols - 1]);
    rowLeftCut.push(rowLeftCut[rows - 1]);
    rowRightCut.push(rowRightCut[rows - 1]);
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
    const blockR = 107;
    const blockG = 107;
    const blockB = 255;

    function cellVisible(c, r) {
      if (c < 0 || r < 0 || c >= cols || r >= rows) return true;
      const tc = colTopCut[c];
      const bc = colBotCut[c];
      const lc = rowLeftCut[r];
      const rc = rowRightCut[r];
      return !(r >= tc && r < bc && c > lc && c < rc);
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

      const tc = colTopCut[cell.c] ?? 0;
      const bc = colBotCut[cell.c] ?? rows;
      const lc = rowLeftCut[cell.r] ?? 0;
      const rc = rowRightCut[cell.r] ?? cols;
      if (cell.r >= tc && cell.r < bc && cell.c > lc && cell.c < rc) return;

      ctx.fillStyle = `rgba(${blockR},${blockG},${blockB},${cell.alpha})`;
      ctx.fillRect(cell.c * CELL + 1, cell.r * CELL + 1, CELL - 2, CELL - 2);
    });

    if (mouseX > -9000) {
      const LINE_RADIUS = 4.0;
      const LINE_PEAK = isLight ? 0.62 : 0.58;
      const LINE_BASE = isLight ? 0.08 : 0.07;
      const lr = 107;
      const lg = 107;
      const lb = 255;

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
    mouseX = e.clientX;
    mouseY = e.clientY;
    mouseCol = Math.floor(e.clientX / CELL);
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
