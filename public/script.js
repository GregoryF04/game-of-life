const API = '/api';
const COLS = 160, ROWS = 80, CELL_SIZE = 12;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
canvas.width = COLS * CELL_SIZE;
canvas.height = ROWS * CELL_SIZE;

const playPauseBtn = document.getElementById('playPauseBtn');

let grid = [];
let running = false;
let pollTimer = null;
let cellColor = localStorage.getItem('gol-cell-color') || '#00ff66';
let backgroundColor = localStorage.getItem('gol-background-color') || '#050807';

// The server auto-pauses if nobody polls it for a while (so it doesn't spin
// the CPU forever after you close the tab), so we only need to poll on a
// timer while the sim is actually running. Otherwise every user action
// already refreshes the state itself.
function syncPolling() {
  if (running && !pollTimer) {
    pollTimer = setInterval(fetchState, 200);
  } else if (!running && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function fetchState() {
  const res = await fetch(`${API}/state`);
  const data = await res.json();
  grid = data.grid;
  running = data.running;
  draw();
  playPauseBtn.textContent = running ? 'Pause' : 'Play';
  syncPolling();
}

function draw() {
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = cellColor;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r] && grid[r][c]) {
        ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
      }
    }
  }
}

async function replaceGrid(nextGrid) {
  const res = await fetch(`${API}/grid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grid: nextGrid }),
  });
  if (!res.ok) throw new Error('Could not update the board');
  await fetchState();
}

function createPattern() {
  const liveCells = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (grid[row] && grid[row][col]) liveCells.push([row, col]);
    }
  }

  if (!liveCells.length) return { version: 1, cells: [] };
  const minRow = Math.min(...liveCells.map(([row]) => row));
  const minCol = Math.min(...liveCells.map(([, col]) => col));
  return {
    version: 1,
    cells: liveCells.map(([row, col]) => [row - minRow, col - minCol]),
  };
}

async function copyPattern() {
  await navigator.clipboard.writeText(JSON.stringify(createPattern()));
}

async function pastePattern(patternText) {
  const pattern = JSON.parse(patternText);
  if (!pattern || pattern.version !== 1 || !Array.isArray(pattern.cells)) {
    throw new Error('Clipboard does not contain a Game of Life pattern');
  }

  const validCells = pattern.cells.filter(cell =>
    Array.isArray(cell) && cell.length === 2 &&
    Number.isInteger(cell[0]) && Number.isInteger(cell[1]) &&
    cell[0] >= 0 && cell[1] >= 0,
  );
  const height = validCells.length ? Math.max(...validCells.map(([row]) => row)) + 1 : 0;
  const width = validCells.length ? Math.max(...validCells.map(([, col]) => col)) + 1 : 0;
  const startRow = Math.floor((ROWS - height) / 2);
  const startCol = Math.floor((COLS - width) / 2);
  const nextGrid = Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLS }, (_, col) => grid[row]?.[col] ? 1 : 0),
  );

  validCells.forEach(([row, col]) => {
    const targetRow = startRow + row;
    const targetCol = startCol + col;
    if (targetRow >= 0 && targetRow < ROWS && targetCol >= 0 && targetCol < COLS) {
      nextGrid[targetRow][targetCol] = 1;
    }
  });
  await replaceGrid(nextGrid);
}

canvas.addEventListener('click', async (e) => {
  const rect = canvas.getBoundingClientRect();
  const col = Math.floor((e.clientX - rect.left) / CELL_SIZE);
  const row = Math.floor((e.clientY - rect.top) / CELL_SIZE);
  await fetch(`${API}/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ row, col }),
  });
  fetchState();
});

playPauseBtn.addEventListener('click', async () => {
  await fetch(`${API}/${running ? 'pause' : 'play'}`, { method: 'POST' });
  await fetchState();
});
document.getElementById('stepBtn').addEventListener('click', async () => {
  await fetch(`${API}/step`, { method: 'POST' });
  fetchState();
});
document.getElementById('randomBtn').addEventListener('click', async () => {
  await fetch(`${API}/random`, { method: 'POST' });
  fetchState();
});
document.getElementById('clearBtn').addEventListener('click', async () => {
  await fetch(`${API}/clear`, { method: 'POST' });
  fetchState();
});

document.getElementById('copyPatternBtn').addEventListener('click', async () => {
  try {
    await copyPattern();
  } catch (error) {
    console.error(error);
  }
});

document.getElementById('pastePatternBtn').addEventListener('click', async () => {
  try {
    await pastePattern(await navigator.clipboard.readText());
  } catch (error) {
    console.error(error);
  }
});

document.addEventListener('paste', async (e) => {
  const patternText = e.clipboardData.getData('text/plain');
  if (!patternText) return;
  try {
    JSON.parse(patternText);
  } catch {
    return;
  }
  e.preventDefault();
  await pastePattern(patternText);
});

document.getElementById('cellColor').addEventListener('input', (e) => {
  cellColor = e.target.value;
  localStorage.setItem('gol-cell-color', cellColor);
  draw();
});

document.getElementById('backgroundColor').addEventListener('input', (e) => {
  backgroundColor = e.target.value;
  localStorage.setItem('gol-background-color', backgroundColor);
  draw();
});

document.getElementById('cellColor').value = cellColor;
document.getElementById('backgroundColor').value = backgroundColor;

fetchState();
