const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

let ROWS = 80, COLS = 160;
const MIN_FPS = 1, MAX_FPS = 30;
const IDLE_TIMEOUT_MS = 60_000;
const WATCHDOG_INTERVAL_MS = 15_000;

let grid = makeEmptyGrid();
let ages = makeAgeGrid();
let genCount = 0;
let running = false;
let fps = 8;
let intervalHandle = null;
let lastClientSeen = Date.now();

function makeEmptyGrid() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function makeAgeGrid() {
  return Array.from({ length: ROWS }, () => new Uint32Array(COLS));
}

function makeAgesFromGrid() {
  return grid.map(row => Uint32Array.from(row, cell => (cell ? 1 : 0)));
}

function serializeAges() {
  return ages.map(row => Array.from(row));
}

function countNeighbors(g, r, c) {
  let count = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = (r + dr + ROWS) % ROWS;
      const nc = (c + dc + COLS) % COLS;
      count += g[nr][nc];
    }
  }
  return count;
}

function step() {
  const next = makeEmptyGrid();
  const nextAges = makeAgeGrid();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const alive = grid[r][c] === 1;
      const n = countNeighbors(grid, r, c);
      next[r][c] = alive ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0);
      nextAges[r][c] = next[r][c] ? (alive ? ages[r][c] + 1 : 1) : 0;
    }
  }
  grid = next;
  ages = nextAges;
  genCount++;
}

function startLoop() {
  if (intervalHandle) clearInterval(intervalHandle);
  running = true;
  intervalHandle = setInterval(step, 1000 / fps);
}

function stopLoop() {
  running = false;
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
}

function clampFps(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fps;
  return Math.min(MAX_FPS, Math.max(MIN_FPS, Math.round(n)));
}

// A closed browser tab used to leave the sim running forever, burning the
// only vCPU this box has for no one. Auto-pause once nobody has polled in a while.
setInterval(() => {
  if (running && Date.now() - lastClientSeen > IDLE_TIMEOUT_MS) {
    stopLoop();
  }
}, WATCHDOG_INTERVAL_MS);

const api = express.Router();

api.get('/state', (req, res) => {
  lastClientSeen = Date.now();
  res.json({ grid, ages: serializeAges(), genCount, running, fps, rows: ROWS, cols: COLS });
});

api.post('/toggle', (req, res) => {
  const row = Number(req.body.row);
  const col = Number(req.body.col);
  if (Number.isInteger(row) && Number.isInteger(col) &&
      row >= 0 && row < ROWS && col >= 0 && col < COLS) {
    grid[row][col] = grid[row][col] ? 0 : 1;
    ages[row][col] = grid[row][col] ? 1 : 0;
  }
  res.json({ ok: true });
});

api.post('/grid', (req, res) => {
  const incomingGrid = req.body.grid;
  if (!Array.isArray(incomingGrid) || incomingGrid.length !== ROWS ||
      incomingGrid.some(row => !Array.isArray(row) || row.length !== COLS)) {
    return res.status(400).json({ ok: false, error: 'Invalid grid dimensions' });
  }

  grid = incomingGrid.map(row => row.map(cell => (cell ? 1 : 0)));
  ages = makeAgesFromGrid();
  genCount = 0;
  res.json({ ok: true });
});

api.post('/size', (req, res) => {
  const rows = Number(req.body.rows);
  const cols = Number(req.body.cols);
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 10 || rows > 300 || cols < 10 || cols > 400) {
    return res.status(400).json({ ok: false, error: 'Grid size must be between 10x10 and 300x400' });
  }

  ROWS = rows;
  COLS = cols;
  grid = makeEmptyGrid();
  ages = makeAgeGrid();
  genCount = 0;
  res.json({ ok: true, rows, cols });
});

api.post('/play', (req, res) => { startLoop(); res.json({ ok: true }); });
api.post('/pause', (req, res) => { stopLoop(); res.json({ ok: true }); });
api.post('/step', (req, res) => { stopLoop(); step(); res.json({ ok: true }); });
api.post('/random', (req, res) => {
  grid = grid.map(row => row.map(() => (Math.random() < 0.25 ? 1 : 0)));
  ages = makeAgesFromGrid();
  genCount = 0;
  res.json({ ok: true });
});
api.post('/clear', (req, res) => {
  grid = makeEmptyGrid();
  ages = makeAgeGrid();
  genCount = 0;
  res.json({ ok: true });
});
api.post('/speed', (req, res) => {
  fps = clampFps(req.body.fps);
  if (running) startLoop();
  res.json({ ok: true, fps });
});

app.use('/api', api);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Game of Life running on port ${PORT}`));
