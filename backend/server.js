const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

let ROWS = 80, COLS = 160;
const MIN_FPS = 1, MAX_FPS = 30;
const IDLE_TIMEOUT_MS = 60_000;
const WATCHDOG_INTERVAL_MS = 15_000;
const STATE_FILE = '/app/data/state.json';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const SHITPOSTS_FILE = path.join(DATA_DIR, 'shitposts.json');
const SAVE_DEBOUNCE_MS = 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1235';

let grid = makeEmptyGrid();
let ages = makeAgeGrid();
let genCount = 0;
let running = false;
let highLife = false;
let fps = 8;
let intervalHandle = null;
let lastClientSeen = Date.now();
let saveTimeout = null;
let shitposts = [];

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

function saveStateNow() {
  const state = {
    ROWS, COLS, genCount, highLife, fps,
    grid,
    ages: serializeAges(),
  };
  fs.writeFile(STATE_FILE, JSON.stringify(state), (err) => {
    if (err) console.error('Failed to save state:', err);
  });
}

function saveStateDebounced() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveStateNow, SAVE_DEBOUNCE_MS);
}

function loadShitposts() {
  try {
    const data = JSON.parse(fs.readFileSync(SHITPOSTS_FILE, 'utf8'));
    if (Array.isArray(data)) shitposts = data.slice(-500);
  } catch {
    shitposts = [];
  }
}

function saveShitposts() {
  fs.mkdir(DATA_DIR, { recursive: true }, (mkdirError) => {
    if (mkdirError) {
      console.error('Failed to create Shitpost data directory:', mkdirError);
      return;
    }
    fs.writeFile(SHITPOSTS_FILE, JSON.stringify(shitposts), (err) => {
      if (err) console.error('Failed to save Shitpost feed:', err);
    });
  });
}

function loadState() {
  try {
    const data = fs.readFileSync(STATE_FILE, 'utf8');
    const state = JSON.parse(data);
    ROWS = state.ROWS ?? ROWS;
    COLS = state.COLS ?? COLS;
    genCount = state.genCount ?? 0;
    highLife = state.highLife ?? false;
    fps = state.fps ?? 8;
    if (Array.isArray(state.grid) && state.grid.length === ROWS) {
      grid = state.grid;
    } else {
      grid = makeEmptyGrid();
    }
    if (Array.isArray(state.ages) && state.ages.length === ROWS) {
      ages = state.ages.map(row => Uint32Array.from(row));
    } else {
      ages = makeAgeGrid();
    }
  } catch {
    // файла нет — используем дефолты, это нормально при первом запуске
  }
}

// Restore saved state (size, grid, rule, speed) now that ROWS/COLS/grid/ages exist.
loadState();
loadShitposts();

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
      next[r][c] = alive ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 || (highLife && n === 6) ? 1 : 0);
      nextAges[r][c] = next[r][c] ? (alive ? ages[r][c] + 1 : 1) : 0;
    }
  }
  grid = next;
  ages = nextAges;
  genCount++;
  saveStateDebounced();
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
  res.json({ grid, ages: serializeAges(), genCount, running, highLife, fps, rows: ROWS, cols: COLS });
});

api.post('/toggle', (req, res) => {
  const row = Number(req.body.row);
  const col = Number(req.body.col);
  if (Number.isInteger(row) && Number.isInteger(col) &&
      row >= 0 && row < ROWS && col >= 0 && col < COLS) {
    grid[row][col] = grid[row][col] ? 0 : 1;
    ages[row][col] = grid[row][col] ? 1 : 0;
  }
  saveStateDebounced();
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
  saveStateDebounced();
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
  saveStateDebounced();
  res.json({ ok: true, rows, cols });
});

api.post('/play', (req, res) => { startLoop(); res.json({ ok: true }); });
api.post('/pause', (req, res) => { stopLoop(); saveStateDebounced(); res.json({ ok: true }); });
api.post('/step', (req, res) => { stopLoop(); step(); res.json({ ok: true }); });
api.post('/random', (req, res) => {
  grid = grid.map(row => row.map(() => (Math.random() < 0.25 ? 1 : 0)));
  ages = makeAgesFromGrid();
  genCount = 0;
  saveStateDebounced();
  res.json({ ok: true });
});
api.post('/clear', (req, res) => {
  grid = makeEmptyGrid();
  ages = makeAgeGrid();
  genCount = 0;
  saveStateDebounced();
  res.json({ ok: true });
});
api.post('/speed', (req, res) => {
  fps = clampFps(req.body.fps);
  if (running) startLoop();
  saveStateDebounced();
  res.json({ ok: true, fps });
});

api.post('/rule', (req, res) => {
  highLife = Boolean(req.body.highLife);
  saveStateDebounced();
  res.json({ ok: true, highLife });
});

api.get('/shitposts', (req, res) => {
  const publicPosts = shitposts.map(({ editToken, ...rest }) => rest);
  res.json({ posts: publicPosts });
});

api.post('/shitposts', (req, res) => {
  const author = String(req.body.author || 'Anonymous').trim().slice(0, 24) || 'Anonymous';
  const content = String(req.body.content || '').trim().slice(0, 280);
  if (!content) return res.status(400).json({ ok: false, error: 'Post cannot be empty' });

  const editToken = crypto.randomBytes(16).toString('hex');
  const post = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    author,
    content,
    createdAt: new Date().toISOString(),
    editToken,
  };
  shitposts.push(post);
  shitposts = shitposts.slice(-500);
  saveShitposts();

  const { editToken: _, ...publicPost } = post;
  res.status(201).json({ ok: true, post: publicPost, editToken });
});

function canModify(post, req) {
  const editToken = String(req.body.editToken || '');
  const adminPassword = String(req.body.adminPassword || '');
  if (ADMIN_PASSWORD && adminPassword === ADMIN_PASSWORD) return true;
  return Boolean(post.editToken) && post.editToken === editToken;
}

api.put('/shitposts/:id', (req, res) => {
  const { id } = req.params;
  const content = String(req.body.content || '').trim().slice(0, 280);
  if (!content) return res.status(400).json({ ok: false, error: 'Post cannot be empty' });

  const post = shitposts.find(p => p.id === id);
  if (!post) return res.status(404).json({ ok: false, error: 'Post not found' });
  if (!canModify(post, req)) {
    return res.status(403).json({ ok: false, error: 'Not allowed to edit this post' });
  }

  post.content = content;
  post.editedAt = new Date().toISOString();
  saveShitposts();

  const { editToken: _, ...publicPost } = post;
  res.json({ ok: true, post: publicPost });
});

api.delete('/shitposts/:id', (req, res) => {
  const { id } = req.params;

  const index = shitposts.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ ok: false, error: 'Post not found' });
  if (!canModify(shitposts[index], req)) {
    return res.status(403).json({ ok: false, error: 'Not allowed to delete this post' });
  }

  shitposts.splice(index, 1);
  saveShitposts();
  res.json({ ok: true });
});

app.use('/api', api);

let lastCpuUsage = process.cpuUsage();
let lastCpuCheckTime = Date.now();

app.get('/health', (req, res) => {
  const currentCpuUsage = process.cpuUsage();
  const currentTime = Date.now();

  const userDiff = currentCpuUsage.user - lastCpuUsage.user;
  const systemDiff = currentCpuUsage.system - lastCpuUsage.system;
  const elapsedMicros = (currentTime - lastCpuCheckTime) * 1000;
  const cpuPercent = elapsedMicros > 0
    ? ((userDiff + systemDiff) / elapsedMicros) * 100
    : 0;

  lastCpuUsage = currentCpuUsage;
  lastCpuCheckTime = currentTime;

  res.json({
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    memory: process.memoryUsage(),
    cpuPercent: Math.round(cpuPercent * 10) / 10,
    game: {
      genCount,
      running,
      rows: ROWS,
      cols: COLS,
    },
  });
});

app.get('/docker-stats', (req, res) => {
  fs.readFile('/app/docker-stats.log', 'utf8', (err, data) => {
    if (err) {
      return res.json({ lines: [], error: 'Log not available yet' });
    }
    const lines = data.trim().split('\n').filter(Boolean);
    res.json({ lines: lines.slice(-30) });
  });
});

app.get('/host-stats', (req, res) => {
  fs.readFile('/app/host-stats.json', 'utf8', (err, data) => {
    if (err) {
      return res.json({ error: 'Host stats not available yet' });
    }
    try {
      res.json(JSON.parse(data));
    } catch {
      res.json({ error: 'Host stats file malformed' });
    }
  });
});

// Save the latest state synchronously before the process exits, so a
// container restart/redeploy doesn't lose whatever happened in the last
// few seconds before the debounced save would have fired.
function shutdown() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveStateNow();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Game of Life running on port ${PORT}`));