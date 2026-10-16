'use strict';

const canvas = document.getElementById('board');
const context = canvas.getContext('2d');
const boardFrame = document.querySelector('.boardFrame');
const scoreElement = document.getElementById('score');
const bestScoreElement = document.getElementById('bestScore');
const message = document.getElementById('message');
const messageTitle = message.querySelector('h2');
const messageText = message.querySelector('p');
const startButton = document.getElementById('startButton');
const pauseButton = document.getElementById('pauseButton');
const restartButton = document.getElementById('restartButton');
const aiButton = document.getElementById('aiButton');
const hamiltonianButton = document.getElementById('hamiltonianButton');
const aiPreviewToggle = document.getElementById('aiPreviewToggle');
const speedRange = document.getElementById('speedRange');
const speedValue = document.getElementById('speedValue');

const gridSize = 20;
const cellCount = gridSize * gridSize;
const cellSize = canvas.width / gridSize;
const speedLevels = [200, 150, 115, 85, 60, 40, 25, 12]; // ms per tick, level 1..8
const defaultSpeedLevel = 3;
const maxQueuedInputs = 3;
const shortcutMaxFill = 0.5; // Hamiltonian shortcuts are used only while snake is shorter than this share of the board
const swipeThreshold = 24;

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const directionList = [DIRS.up, DIRS.right, DIRS.down, DIRS.left];
const keyDirections = {
  ArrowUp: DIRS.up, KeyW: DIRS.up,
  ArrowDown: DIRS.down, KeyS: DIRS.down,
  ArrowLeft: DIRS.left, KeyA: DIRS.left,
  ArrowRight: DIRS.right, KeyD: DIRS.right,
};

function loadStored(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function saveStored(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* storage unavailable (private mode, blocked cookies) */
  }
}

let snake = [];
let food = null;
let direction = DIRS.right;
let nextDirection = direction;
let inputQueue = [];
let score = 0;
let bestScore = Number(loadStored('snake-best-score', 0)) || 0;
let gameState = 'ready'; // ready | playing | paused | over
let aiMode = 'off'; // off | ai | ham
let hamiltonianCycle = [];
let cycleIndexOf = new Int16Array(cellCount);
let gameTimer = null;
let aiPreviewEnabled = loadStored('snake-ai-preview', 'false') === 'true';
let speedLevel = Math.min(speedLevels.length, Math.max(1, Number(loadStored('snake-speed', defaultSpeedLevel)) || defaultSpeedLevel));
let tickDuration = speedLevels[speedLevel - 1];

bestScoreElement.textContent = bestScore;
aiPreviewToggle.checked = aiPreviewEnabled;
speedRange.value = speedLevel;
speedValue.value = `${speedLevel} / ${speedLevels.length}`;

/* ---------- helpers ---------- */

function idOf(cell) {
  return cell.y * gridSize + cell.x;
}

function cellFromId(id) {
  return { x: id % gridSize, y: Math.floor(id / gridSize) };
}

function dirBetween(from, to) {
  return { x: to.x - from.x, y: to.y - from.y };
}

function isOpenCell(cell, blocked) {
  return cell.x >= 0 && cell.x < gridSize && cell.y >= 0 && cell.y < gridSize && !blocked.has(idOf(cell));
}

function createFood() {
  const occupied = new Set(snake.map(idOf));
  const freeCells = [];
  for (let id = 0; id < cellCount; id++) {
    if (!occupied.has(id)) freeCells.push(cellFromId(id));
  }
  return freeCells.length ? freeCells[Math.floor(Math.random() * freeCells.length)] : null;
}

/* ---------- reset ---------- */

function resetGame() {
  inputQueue = [];
  score = 0;
  scoreElement.textContent = score;
  pauseButton.textContent = 'Pause';

  if (aiMode === 'ham') {
    applyCycle(createHamiltonianCycle());
    const length = hamiltonianCycle.length;
    const headIndex = Math.floor(Math.random() * length);
    snake = [0, 1, 2].map(offset => hamiltonianCycle[(headIndex - offset + length) % length]);
    direction = dirBetween(snake[0], hamiltonianCycle[(headIndex + 1) % length]);
  } else {
    snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    direction = DIRS.right;
  }

  nextDirection = direction;
  food = createFood();
  draw();
}

/* ---------- Hamiltonian cycle ---------- */

function applyCycle(cycle) {
  hamiltonianCycle = cycle;
  cycleIndexOf = new Int16Array(cellCount);
  cycle.forEach((cell, index) => {
    cycleIndexOf[idOf(cell)] = index;
  });
}

function reverseRange(array, from, to) {
  while (from < to) {
    const tmp = array[from];
    array[from] = array[to];
    array[to] = tmp;
    from++;
    to--;
  }
}

// Random Hamiltonian cycle built with the "backbite" algorithm on a Hamiltonian path.
function createHamiltonianCycle() {
  const base = [];
  const add = (x, y) => base.push(y * gridSize + x);
  for (let x = 0; x < gridSize; x++) add(x, 0);
  for (let y = 1; y < gridSize; y++) {
    if (y % 2 === 1) {
      for (let x = gridSize - 1; x >= 1; x--) add(x, y);
    } else {
      for (let x = 1; x < gridSize; x++) add(x, y);
    }
  }
  for (let y = gridSize - 1; y >= 1; y--) add(0, y);

  const path = base.slice();
  const last = path.length - 1;
  const position = new Int16Array(cellCount);
  const reindex = (from, to) => {
    for (let i = from; i <= to; i++) position[path[i]] = i;
  };
  reindex(0, last);

  const minimumMutations = cellCount * 2;
  const maximumMutations = cellCount * 20;
  let closed = false;

  for (let attempt = 0; attempt < maximumMutations; attempt++) {
    const fromEnd = Math.random() < 0.5;
    const end = path[fromEnd ? last : 0];
    const step = directionList[Math.floor(Math.random() * 4)];
    const nx = (end % gridSize) + step.x;
    const ny = Math.floor(end / gridSize) + step.y;
    if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) continue;

    const index = position[ny * gridSize + nx];
    if (fromEnd) {
      if (index >= last - 1) continue;
      reverseRange(path, index + 1, last);
      reindex(index + 1, last);
    } else {
      if (index <= 1) continue;
      reverseRange(path, 0, index - 1);
      reindex(0, index - 1);
    }

    if (attempt >= minimumMutations) {
      const a = path[0];
      const b = path[last];
      const distance = Math.abs((a % gridSize) - (b % gridSize)) + Math.abs(Math.floor(a / gridSize) - Math.floor(b / gridSize));
      if (distance === 1) {
        closed = true;
        break;
      }
    }
  }

  const cycleIds = closed ? path : base;
  const offset = Math.floor(Math.random() * cycleIds.length);
  const cells = cycleIds.slice(offset).concat(cycleIds.slice(0, offset)).map(cellFromId);
  return Math.random() < 0.5 ? cells.reverse() : cells;
}

// Looks for a cycle along which the current snake can safely continue:
// body segments must appear behind the head in the same order as in the snake.
function configureHamiltonianForCurrentSnake() {
  const head = snake[0];
  let fallback = null;

  for (let attempt = 0; attempt < 24; attempt++) {
    const generated = createHamiltonianCycle();
    for (const cycle of [generated, generated.slice().reverse()]) {
      const length = cycle.length;
      const index = new Int16Array(cellCount);
      cycle.forEach((cell, i) => {
        index[idOf(cell)] = i;
      });
      const headIndex = index[idOf(head)];

      let previousBehind = 0;
      let ordered = true;
      for (let i = 1; i < snake.length; i++) {
        const behind = (headIndex - index[idOf(snake[i])] + length) % length;
        if (behind <= previousBehind) {
          ordered = false;
          break;
        }
        previousBehind = behind;
      }
      if (!ordered) continue;

      const nextCell = cycle[(headIndex + 1) % length];
      const continuesDirection = nextCell.x - head.x === direction.x && nextCell.y - head.y === direction.y;
      const candidate = { cycle };
      if (continuesDirection) return candidate;
      fallback = fallback || candidate;
    }
  }

  return fallback;
}

function planHamiltonian() {
  const length = hamiltonianCycle.length;
  if (!length) return null;

  const head = snake[0];
  const headIndex = cycleIndexOf[idOf(head)];
  let target = hamiltonianCycle[(headIndex + 1) % length];

  // Safe shortcut: jump ahead along the cycle toward the food without passing it or the tail.
  if (food && snake.length < cellCount * shortcutMaxFill) {
    const tail = snake[snake.length - 1];
    const tailDistance = (cycleIndexOf[idOf(tail)] - headIndex + length) % length;
    const foodDistance = (cycleIndexOf[idOf(food)] - headIndex + length) % length;
    const body = new Set(snake.map(idOf));
    let best = 1;
    for (const step of directionList) {
      const neighbor = { x: head.x + step.x, y: head.y + step.y };
      if (!isOpenCell(neighbor, body)) continue;
      const distance = (cycleIndexOf[idOf(neighbor)] - headIndex + length) % length;
      if (distance > best && distance <= foodDistance && distance < tailDistance - 1) {
        best = distance;
        target = neighbor;
      }
    }
  }

  const targetIndex = cycleIndexOf[idOf(target)];
  const path = [target];
  const previewLength = Math.min(80, length - 1);
  for (let offset = 1; offset < previewLength; offset++) {
    path.push(hamiltonianCycle[(targetIndex + offset) % length]);
  }
  return { direction: dirBetween(head, target), path };
}

/* ---------- AI ---------- */

function isMoveSafe(move) {
  const next = { x: snake[0].x + move.x, y: snake[0].y + move.y };
  if (next.x < 0 || next.x >= gridSize || next.y < 0 || next.y >= gridSize) return false;
  const eatsFood = Boolean(food) && next.x === food.x && next.y === food.y;
  const body = eatsFood ? snake : snake.slice(0, -1);
  return !body.some(segment => segment.x === next.x && segment.y === next.y);
}

// Returns { direction, path } — exactly what the AI will do, so the preview is truthful.
function planAi(allowResync) {
  if (aiMode === 'ham') {
    const plan = planHamiltonian();
    if (plan && isMoveSafe(plan.direction)) return plan;
    if (allowResync) {
      const configured = configureHamiltonianForCurrentSnake();
      if (configured) {
        applyCycle(configured.cycle);
        const retry = planHamiltonian();
        if (retry && isMoveSafe(retry.direction)) return retry;
      }
    }
  }
  return planRegularAi();
}

function planRegularAi() {
  const head = snake[0];
  const tail = snake[snake.length - 1];
  const possible = directionList.filter(candidate => !(candidate.x + direction.x === 0 && candidate.y + direction.y === 0));
  const occupied = new Set(snake.slice(0, -1).map(idOf));

  const foodPath = food ? findPath(head, food, occupied, possible) : null;
  if (foodPath) {
    const move = dirBetween(head, foodPath[0]);
    const projected = projectMove(move);
    if (projected && canReachTail(projected)) return { direction: move, path: foodPath };
  }

  const tailPath = findPath(head, tail, occupied, possible);
  if (tailPath) return { direction: dirBetween(head, tailPath[0]), path: tailPath };

  const options = possible
    .map(candidate => ({ candidate, projected: projectMove(candidate) }))
    .filter(option => option.projected)
    .map(option => ({ ...option, area: countOpenArea(option.projected) }))
    .sort((left, right) => right.area - left.area);

  if (!options.length) return { direction, path: [] };
  const choice = options[0].candidate;
  return { direction: choice, path: [{ x: head.x + choice.x, y: head.y + choice.y }] };
}

// BFS; returns the list of cells from the first step up to the target, or null.
function findPath(start, target, blocked, firstDirections) {
  const startId = idOf(start);
  const targetId = idOf(target);
  if (startId === targetId) return null;

  const parents = new Map([[startId, -1]]);
  const queue = [];

  for (const step of firstDirections) {
    const next = { x: start.x + step.x, y: start.y + step.y };
    const id = idOf(next);
    if (isOpenCell(next, blocked) && !parents.has(id)) {
      parents.set(id, startId);
      queue.push(next);
    }
  }

  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    const currentId = idOf(current);
    if (currentId === targetId) {
      const path = [];
      let id = currentId;
      while (id !== startId) {
        path.push(cellFromId(id));
        id = parents.get(id);
      }
      return path.reverse();
    }
    for (const step of directionList) {
      const next = { x: current.x + step.x, y: current.y + step.y };
      const id = idOf(next);
      if (isOpenCell(next, blocked) && !parents.has(id)) {
        parents.set(id, currentId);
        queue.push(next);
      }
    }
  }
  return null;
}

function projectMove(candidate) {
  const nextHead = { x: snake[0].x + candidate.x, y: snake[0].y + candidate.y };
  const eatsFood = Boolean(food) && nextHead.x === food.x && nextHead.y === food.y;
  const blocked = new Set((eatsFood ? snake : snake.slice(0, -1)).map(idOf));
  if (!isOpenCell(nextHead, blocked)) return null;
  const projected = [nextHead, ...snake];
  if (!eatsFood) projected.pop();
  return projected;
}

function canReachTail(projected) {
  if (projected.length < 2) return true;
  const blocked = new Set(projected.slice(0, -1).map(idOf));
  return Boolean(findPath(projected[0], projected[projected.length - 1], blocked, directionList));
}

function countOpenArea(projected) {
  const blocked = new Set(projected.slice(0, -1).map(idOf));
  const visited = new Set([idOf(projected[0])]);
  const queue = [projected[0]];
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    for (const step of directionList) {
      const next = { x: current.x + step.x, y: current.y + step.y };
      const id = idOf(next);
      if (isOpenCell(next, blocked) && !visited.has(id)) {
        visited.add(id);
        queue.push(next);
      }
    }
  }
  return visited.size;
}

/* ---------- input ---------- */

function setDirection(requested) {
  if (gameState === 'ready' || gameState === 'over') startGame();
  if (aiMode !== 'off') setAiMode('off');

  // Compare with the last queued move so fast "up, then left" presses are not lost.
  const reference = inputQueue.length ? inputQueue[inputQueue.length - 1] : direction;
  if (requested.x === reference.x && requested.y === reference.y) return;
  if (requested.x + reference.x === 0 && requested.y + reference.y === 0) return;
  if (inputQueue.length >= maxQueuedInputs) return;
  inputQueue.push(requested);
}

function syncAiButtons() {
  aiButton.textContent = aiMode === 'ai' ? 'AI: On' : 'AI play';
  aiButton.setAttribute('aria-pressed', String(aiMode === 'ai'));
  hamiltonianButton.textContent = aiMode === 'ham' ? 'Hamiltonian: On' : 'Hamiltonian cycle';
  hamiltonianButton.setAttribute('aria-pressed', String(aiMode === 'ham'));
}

function setAiMode(mode) {
  aiMode = mode;
  syncAiButtons();

  if (mode === 'ham') {
    if (gameState === 'playing' || gameState === 'paused') {
      const configured = configureHamiltonianForCurrentSnake();
      if (configured) applyCycle(configured.cycle);
      else if (!hamiltonianCycle.length) applyCycle(createHamiltonianCycle());
      draw();
    } else {
      restart();
    }
    return;
  }

  if (mode === 'ai' && (gameState === 'ready' || gameState === 'over')) startGame();
  draw();
}

function toggleAi() {
  setAiMode(aiMode === 'ai' ? 'off' : 'ai');
}

function toggleHamiltonian() {
  setAiMode(aiMode === 'ham' ? 'off' : 'ham');
}

/* ---------- game flow ---------- */

function startGame() {
  if (gameState === 'over') resetGame();
  gameState = 'playing';
  message.classList.add('hidden');
  pauseButton.textContent = 'Pause';
  restartTimer();
}

function restartTimer() {
  stopGameTimer();
  gameTimer = setInterval(gameLoop, tickDuration);
}

function stopGameTimer() {
  if (gameTimer) {
    clearInterval(gameTimer);
    gameTimer = null;
  }
}

function togglePause() {
  if (gameState === 'ready' || gameState === 'over' || gameState === 'paused') {
    startGame();
    return;
  }
  gameState = 'paused';
  stopGameTimer();
  pauseButton.textContent = 'Resume';
  showMessage('Paused', 'Take a breath, then keep going.', 'Resume');
}

function showMessage(title, text, buttonText) {
  messageTitle.textContent = title;
  messageText.textContent = text;
  startButton.textContent = buttonText;
  message.classList.remove('hidden');
  startButton.focus({ preventScroll: true });
}

function finishGame(title, text) {
  gameState = 'over';
  stopGameTimer();
  if (score > bestScore) {
    bestScore = score;
    bestScoreElement.textContent = bestScore;
    saveStored('snake-best-score', bestScore);
  }
  showMessage(title, text, 'Try again');
}

function restart() {
  stopGameTimer();
  gameState = 'ready';
  resetGame();
  if (aiMode !== 'off') {
    startGame();
  } else {
    showMessage('Ready?', 'Use the arrow keys, WASD or swipe to move.', 'Start game');
  }
}

function update() {
  if (aiMode !== 'off') nextDirection = planAi(true).direction;
  else if (inputQueue.length) nextDirection = inputQueue.shift();
  direction = nextDirection;

  const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
  const hitsWall = head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize;
  const eatsFood = Boolean(food) && head.x === food.x && head.y === food.y;
  const bodyToCheck = eatsFood ? snake : snake.slice(0, -1);
  const hitsSelf = bodyToCheck.some(segment => segment.x === head.x && segment.y === head.y);

  if (hitsWall || hitsSelf) {
    finishGame('Game over', `You scored ${score}. Ready for another run?`);
    return;
  }

  snake.unshift(head);
  if (eatsFood) {
    score += 1;
    scoreElement.textContent = score;
    food = createFood();
    if (!food) finishGame('You win!', `The whole board is filled. Score: ${score}.`);
  } else {
    snake.pop();
  }
}

function gameLoop() {
  if (gameState !== 'playing') return;
  update();
  draw();
}

/* ---------- rendering ---------- */

function draw() {
  context.fillStyle = '#0b0e0b';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = 'rgba(216, 244, 91, .055)';
  context.lineWidth = 1;
  for (let line = 1; line < gridSize; line++) {
    const position = line * cellSize;
    context.beginPath();
    context.moveTo(position, 0);
    context.lineTo(position, canvas.height);
    context.moveTo(0, position);
    context.lineTo(canvas.width, position);
    context.stroke();
  }

  if (food) {
    context.fillStyle = '#ff8a4c';
    context.shadowColor = '#ff8a4c';
    context.shadowBlur = 12;
    context.beginPath();
    context.arc(food.x * cellSize + cellSize / 2, food.y * cellSize + cellSize / 2, cellSize * 0.28, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
  }

  if (aiPreviewEnabled && aiMode !== 'off' && food && gameState !== 'over') {
    const { path } = planAi(false);
    context.strokeStyle = 'rgba(112, 225, 195, .72)';
    context.lineWidth = 2;
    context.setLineDash([4, 4]);
    context.beginPath();
    context.moveTo(snake[0].x * cellSize + cellSize / 2, snake[0].y * cellSize + cellSize / 2);
    path.forEach(cell => context.lineTo(cell.x * cellSize + cellSize / 2, cell.y * cellSize + cellSize / 2));
    context.stroke();
    context.setLineDash([]);
  }

  snake.forEach((segment, index) => {
    context.fillStyle = index === 0 ? '#ecff91' : '#b7d34e';
    const inset = index === 0 ? 2 : 3;
    context.fillRect(segment.x * cellSize + inset, segment.y * cellSize + inset, cellSize - inset * 2, cellSize - inset * 2);
  });
}

/* ---------- events ---------- */

document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target instanceof Element && event.target.closest('input')) return;

  if (event.code === 'Space' || event.code === 'KeyP') {
    event.preventDefault();
    if (!event.repeat) togglePause();
    return;
  }

  const requested = keyDirections[event.code];
  if (requested) {
    event.preventDefault();
    setDirection(requested);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && gameState === 'playing') togglePause();
});

let touchStart = null;
boardFrame.addEventListener('touchstart', event => {
  const touch = event.changedTouches[0];
  touchStart = { x: touch.clientX, y: touch.clientY };
}, { passive: true });
boardFrame.addEventListener('touchend', event => {
  if (!touchStart) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < swipeThreshold) return;
  if (Math.abs(dx) > Math.abs(dy)) setDirection(dx > 0 ? DIRS.right : DIRS.left);
  else setDirection(dy > 0 ? DIRS.down : DIRS.up);
});

startButton.addEventListener('click', startGame);
pauseButton.addEventListener('click', togglePause);
restartButton.addEventListener('click', restart);
aiButton.addEventListener('click', toggleAi);
hamiltonianButton.addEventListener('click', toggleHamiltonian);

aiPreviewToggle.addEventListener('change', () => {
  aiPreviewEnabled = aiPreviewToggle.checked;
  saveStored('snake-ai-preview', aiPreviewEnabled);
  draw();
});

speedRange.addEventListener('input', () => {
  speedLevel = Number(speedRange.value);
  tickDuration = speedLevels[speedLevel - 1];
  speedValue.value = `${speedLevel} / ${speedLevels.length}`;
  saveStored('snake-speed', speedLevel);
  if (gameState === 'playing') restartTimer();
});

document.querySelectorAll('[data-direction]').forEach(button => {
  button.addEventListener('click', () => setDirection(DIRS[button.dataset.direction]));
});

syncAiButtons();
resetGame();
showMessage('Ready?', 'Use the arrow keys, WASD or swipe to move.', 'Start game');