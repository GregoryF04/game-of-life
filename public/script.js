const API = '/api';
const COLS = 160, ROWS = 80, CELL_SIZE = 12;
const DISPLAY_UPDATE_MS = 50;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
canvas.width = COLS * CELL_SIZE;
canvas.height = ROWS * CELL_SIZE;

const playPauseBtn = document.getElementById('playPauseBtn');
const speedRange = document.getElementById('speedRange');
const speedValue = document.getElementById('speedValue');
const generationValue = document.getElementById('generationValue');
const copyPatternBtn = document.getElementById('copyPatternBtn');
const pastePatternBtn = document.getElementById('pastePatternBtn');

let grid = [];
let ages = [];
let revision = 0;
let running = false;
let pollTimer = null;
let pendingPattern = null;
let pendingPatternPosition = null;
let drawing = false;
let selecting = false;
let selectionStart = null;
let selectionEnd = null;
let activePointerId = null;
let drawRequests = [];
let cellColor = localStorage.getItem('gol-cell-color') || '#00ff66';
let backgroundColor = localStorage.getItem('gol-background-color') || '#050807';
let lastGeneration = null;
let lastGenerationTime = null;
let actualFps = 0;

// The server auto-pauses if nobody polls it for a while (so it doesn't spin
// the CPU forever after you close the tab), so we only need to poll on a
// timer while the sim is actually running. Otherwise every user action
// already refreshes the state itself.
function syncPolling() {
  if (running && !pollTimer) {
    pollTimer = setInterval(fetchChanges, DISPLAY_UPDATE_MS);
  } else if (!running && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function fetchState() {
  const res = await fetch(`${API}/state`);
  const data = await res.json();
  grid = data.grid;
  ages = data.ages || grid.map(row => row.map(cell => (cell ? 1 : 0)));
  revision = data.revision ?? revision;
  running = data.running;
  const now = performance.now();
  if (lastGeneration !== null && data.genCount > lastGeneration && lastGenerationTime !== null) {
    actualFps = (data.genCount - lastGeneration) / ((now - lastGenerationTime) / 1000);
  }
  lastGeneration = data.genCount;
  lastGenerationTime = now;
  generationValue.textContent = `Generation ${data.genCount} | ${actualFps.toFixed(1)} FPS`;
  speedRange.value = data.fps;
  speedValue.textContent = `${data.fps} FPS`;
  draw();
  playPauseBtn.textContent = running ? 'Pause' : 'Play';
  syncPolling();
}

async function fetchChanges() {
  if (!running || fetchChanges.inFlight) return;
  fetchChanges.inFlight = true;
  try {
    const res = await fetch(`${API}/changes?since=${revision}`);
    const data = await res.json();
    if (data.full) {
      grid = data.grid;
      ages = data.ages || grid.map(row => row.map(cell => (cell ? 1 : 0)));
    } else {
      data.changes.forEach(change => {
        grid[change.row][change.col] = change.alive;
        ages[change.row][change.col] = change.age;
      });
    }
    revision = data.revision;
    running = data.running;
    const now = performance.now();
    if (lastGeneration !== null && data.genCount > lastGeneration && lastGenerationTime !== null) {
      actualFps = (data.genCount - lastGeneration) / ((now - lastGenerationTime) / 1000);
    }
    lastGeneration = data.genCount;
    lastGenerationTime = now;
    generationValue.textContent = `Generation ${data.genCount} | ${actualFps.toFixed(1)} FPS`;
    speedRange.value = data.fps;
    speedValue.textContent = `${data.fps} FPS`;
    draw();
    playPauseBtn.textContent = running ? 'Pause' : 'Play';
    syncPolling();
  } finally {
    fetchChanges.inFlight = false;
  }
}

function draw() {
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = cellColor;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r] && grid[r][c]) {
        ctx.fillStyle = getCellColor(ages[r]?.[c] || 1);
        ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
      }
    }
  }
}

function getCellColor(age) {
  const red = parseInt(cellColor.slice(1, 3), 16);
  const green = parseInt(cellColor.slice(3, 5), 16);
  const blue = parseInt(cellColor.slice(5, 7), 16);
  const brightness = 0.52 + 0.48 * Math.exp(-age / 10);
  return `rgb(${Math.round(red * brightness)}, ${Math.round(green * brightness)}, ${Math.round(blue * brightness)})`;
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

function createPattern(selection = null) {
  const liveCells = [];
  const minRow = selection ? Math.min(selection.start.row, selection.end.row) : 0;
  const maxRow = selection ? Math.max(selection.start.row, selection.end.row) : ROWS - 1;
  const minCol = selection ? Math.min(selection.start.col, selection.end.col) : 0;
  const maxCol = selection ? Math.max(selection.start.col, selection.end.col) : COLS - 1;

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (grid[row] && grid[row][col]) liveCells.push([row, col]);
    }
  }

  return {
    version: 1,
    width: maxCol - minCol + 1,
    height: maxRow - minRow + 1,
    cells: liveCells.map(([row, col]) => [row - minRow, col - minCol]),
  };
}

async function copyPattern(selection) {
  await navigator.clipboard.writeText(JSON.stringify(createPattern(selection)));
}

function parsePattern(patternText) {
  const pattern = JSON.parse(patternText);
  if (!pattern || pattern.version !== 1 || !Array.isArray(pattern.cells)) {
    throw new Error('Clipboard does not contain a Game of Life pattern');
  }

  const validCells = pattern.cells.filter(cell =>
    Array.isArray(cell) && cell.length === 2 &&
    Number.isInteger(cell[0]) && Number.isInteger(cell[1]) &&
    cell[0] >= 0 && cell[1] >= 0,
  );
  const height = Number.isInteger(pattern.height) ? pattern.height :
    (validCells.length ? Math.max(...validCells.map(([row]) => row)) + 1 : 0);
  const width = Number.isInteger(pattern.width) ? pattern.width :
    (validCells.length ? Math.max(...validCells.map(([, col]) => col)) + 1 : 0);
  return { cells: validCells, height, width };
}

function drawSelection() {
  draw();
  if (!selectionStart || !selectionEnd) return;
  const minRow = Math.min(selectionStart.row, selectionEnd.row);
  const minCol = Math.min(selectionStart.col, selectionEnd.col);
  const width = Math.abs(selectionEnd.col - selectionStart.col) + 1;
  const height = Math.abs(selectionEnd.row - selectionStart.row) + 1;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.9;
  ctx.strokeRect(minCol * CELL_SIZE + 1, minRow * CELL_SIZE + 1,
    width * CELL_SIZE - 2, height * CELL_SIZE - 2);
  ctx.globalAlpha = 1;
}

function drawPendingPattern() {
  draw();
  if (!pendingPattern || !pendingPatternPosition) return;

  ctx.fillStyle = cellColor;
  pendingPattern.cells.forEach(([row, col]) => {
    const targetRow = pendingPatternPosition.row + row;
    const targetCol = pendingPatternPosition.col + col;
    if (targetRow >= 0 && targetRow < ROWS && targetCol >= 0 && targetCol < COLS) {
      ctx.globalAlpha = 0.55;
      ctx.fillRect(targetCol * CELL_SIZE, targetRow * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
      ctx.globalAlpha = 1;
    }
  });
}

async function pastePatternAt(row, col) {
  const nextGrid = Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLS }, (_, col) => grid[row]?.[col] ? 1 : 0),
  );

  pendingPattern.cells.forEach(([patternRow, patternCol]) => {
    const targetRow = row + patternRow;
    const targetCol = col + patternCol;
    if (targetRow >= 0 && targetRow < ROWS && targetCol >= 0 && targetCol < COLS) {
      nextGrid[targetRow][targetCol] = 1;
    }
  });
  await replaceGrid(nextGrid);
  pendingPattern = null;
  pendingPatternPosition = null;
  pastePatternBtn.textContent = 'Paste pattern';
  canvas.style.cursor = 'default';
}

function getBoardCell(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    col: Math.max(0, Math.min(COLS - 1, Math.floor((e.clientX - rect.left) / CELL_SIZE))),
    row: Math.max(0, Math.min(ROWS - 1, Math.floor((e.clientY - rect.top) / CELL_SIZE))),
  };
}

function releasePointer(e) {
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  activePointerId = null;
}

function drawCell(row, col) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS || !grid[row] || grid[row][col]) return;
  grid[row][col] = 1;
  draw();
  drawRequests.push(fetch(`${API}/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ row, col }),
  }));
}

canvas.addEventListener('pointerdown', async (e) => {
  e.preventDefault();
  const { row, col } = getBoardCell(e);
  if (pendingPattern) {
    await pastePatternAt(row, col);
    return;
  }
  if (selecting) {
    activePointerId = e.pointerId;
    selectionStart = { row, col };
    selectionEnd = { row, col };
    canvas.setPointerCapture(activePointerId);
    drawSelection();
    return;
  }
  drawing = true;
  activePointerId = e.pointerId;
  canvas.setPointerCapture(activePointerId);
  drawCell(row, col);
});

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== activePointerId) return;
  e.preventDefault();
  const { row, col } = getBoardCell(e);
  if (selecting) {
    selectionEnd = { row, col };
    drawSelection();
    return;
  }
  if (!drawing) return;
  drawCell(row, col);
});

async function finishDrawing(e) {
  if ((!drawing && !selecting) || e.pointerId !== activePointerId) return;
  if (selecting) {
    selectionEnd = getBoardCell(e);
    selecting = false;
    releasePointer(e);
    try {
      await copyPattern({ start: selectionStart, end: selectionEnd });
      copyPatternBtn.textContent = 'Copy pattern';
    } catch (error) {
      console.error(error);
    }
    selectionStart = null;
    selectionEnd = null;
    canvas.style.cursor = 'default';
    draw();
    return;
  }
  drawing = false;
  releasePointer(e);
  await Promise.all(drawRequests);
  drawRequests = [];
  await fetchState();
}

canvas.addEventListener('pointerup', finishDrawing);
canvas.addEventListener('pointercancel', finishDrawing);

canvas.addEventListener('mousemove', (e) => {
  if (!pendingPattern) return;
  const rect = canvas.getBoundingClientRect();
  pendingPatternPosition = {
    col: Math.floor((e.clientX - rect.left) / CELL_SIZE),
    row: Math.floor((e.clientY - rect.top) / CELL_SIZE),
  };
  drawPendingPattern();
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

copyPatternBtn.addEventListener('click', () => {
  selecting = true;
  selectionStart = null;
  selectionEnd = null;
  copyPatternBtn.textContent = 'Drag to select';
  canvas.style.cursor = 'crosshair';
});

pastePatternBtn.addEventListener('click', async () => {
  try {
    pendingPattern = parsePattern(await navigator.clipboard.readText());
    pendingPatternPosition = null;
    pastePatternBtn.textContent = 'Click board to place';
    canvas.style.cursor = 'crosshair';
  } catch (error) {
    console.error(error);
  }
});

speedRange.addEventListener('input', async () => {
  const fps = Number(speedRange.value);
  speedValue.textContent = `${fps} FPS`;

  await fetch('/api/speed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fps })
  });
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
  try {
    pendingPattern = parsePattern(patternText);
    pendingPatternPosition = null;
    pastePatternBtn.textContent = 'Click board to place';
    canvas.style.cursor = 'crosshair';
  } catch (error) {
    console.error(error);
  }
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
