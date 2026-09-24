const canvas = document.getElementById('board');
const context = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const bestScoreElement = document.getElementById('bestScore');
const message = document.getElementById('message');
const messageIcon = message.querySelector('.messageIcon');
const messageTitle = message.querySelector('h2');
const messageText = message.querySelector('p');
const startButton = document.getElementById('startButton');
const pauseButton = document.getElementById('pauseButton');
const restartButton = document.getElementById('restartButton');
const aiButton = document.getElementById('aiButton');

const gridSize = 20;
const cellSize = canvas.width / gridSize;
const tickDuration = 115;
let snake;
let food;
let direction;
let nextDirection;
let score = 0;
let bestScore = Number(localStorage.getItem('snake-best-score')) || 0;
let gameState = 'ready';
let aiEnabled = false;
let lastTick = 0;
let animationFrame;

bestScoreElement.textContent = bestScore;

function resetGame() {
  snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  direction = { x: 1, y: 0 };
  nextDirection = direction;
  score = 0;
  scoreElement.textContent = score;
  food = createFood();
  draw();
}

function createFood() {
  const freeCells = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (!snake.some(segment => segment.x === x && segment.y === y)) freeCells.push({ x, y });
    }
  }
  return freeCells[Math.floor(Math.random() * freeCells.length)];
}

function setDirection(newDirection) {
  if (gameState === 'ready' || gameState === 'over') startGame();
  if (newDirection.x + direction.x === 0 && newDirection.y + direction.y === 0) return;
  nextDirection = newDirection;
}

function startGame() {
  if (gameState === 'over') resetGame();
  gameState = 'playing';
  message.classList.add('hidden');
  pauseButton.textContent = 'Pause';
  lastTick = performance.now();
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(gameLoop);
}

function togglePause() {
  if (gameState === 'ready' || gameState === 'over') {
    startGame();
    return;
  }
  if (gameState === 'paused') {
    startGame();
    return;
  }
  gameState = 'paused';
  pauseButton.textContent = 'Resume';
  showMessage('Paused', 'Take a breath, then keep going.', 'Resume');
}

function showMessage(title, text, buttonText) {
  messageTitle.textContent = title;
  messageText.textContent = text;
  startButton.textContent = buttonText;
  messageIcon.textContent = gameState === 'over' ? '!' : '+';
  message.classList.remove('hidden');
}

function endGame() {
  gameState = 'over';
  if (score > bestScore) {
    bestScore = score;
    bestScoreElement.textContent = bestScore;
    localStorage.setItem('snake-best-score', String(bestScore));
  }
  showMessage('Game over', `You scored ${score}. Ready for another run?`, 'Try again');
}

function update() {
  if (aiEnabled) nextDirection = chooseAiDirection();
  direction = nextDirection;
  const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
  const hitsWall = head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize;
  const eatsFood = head.x === food.x && head.y === food.y;
  const bodyToCheck = eatsFood ? snake : snake.slice(0, -1);
  const hitsSelf = bodyToCheck.some(segment => segment.x === head.x && segment.y === head.y);

  if (hitsWall || hitsSelf) {
    endGame();
    return;
  }

  snake.unshift(head);
  if (eatsFood) {
    score += 1;
    scoreElement.textContent = score;
    food = createFood();
  } else {
    snake.pop();
  }
}

function chooseAiDirection() {
  const possibleDirections = getDirections().filter(candidate =>
    !(candidate.x + direction.x === 0 && candidate.y + direction.y === 0),
  );
  const head = snake[0];
  const occupied = new Set(snake.slice(0, -1).map(segment => `${segment.x},${segment.y}`));
  const foodMove = findPathFirstMove(head, food, occupied, possibleDirections);

  if (foodMove) {
    const projectedSnake = projectMove(foodMove);
    if (projectedSnake && canReachTail(projectedSnake)) return foodMove;
  }

  const tail = snake[snake.length - 1];
  const tailMove = findPathFirstMove(head, tail, occupied, possibleDirections);
  if (tailMove) return tailMove;

  return possibleDirections
    .map(candidate => ({ candidate, projectedSnake: projectMove(candidate) }))
    .filter(result => result.projectedSnake)
    .sort((left, right) => countOpenArea(right.projectedSnake) - countOpenArea(left.projectedSnake))[0]?.candidate || direction;
}

function getDirections() {
  return [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];
}

function findPathFirstMove(start, target, blocked, firstDirections) {
  if (start.x === target.x && start.y === target.y) return null;
  const queue = [];
  const visited = new Set([`${start.x},${start.y}`]);

  firstDirections.forEach(candidate => {
    const next = { x: start.x + candidate.x, y: start.y + candidate.y };
    const key = `${next.x},${next.y}`;
    if (isOpenCell(next, blocked) && !visited.has(key)) {
      visited.add(key);
      queue.push({ position: next, firstMove: candidate });
    }
  });

  while (queue.length) {
    const current = queue.shift();
    if (current.position.x === target.x && current.position.y === target.y) return current.firstMove;
    getDirections().forEach(candidate => {
      const next = {
        x: current.position.x + candidate.x,
        y: current.position.y + candidate.y,
      };
      const key = `${next.x},${next.y}`;
      if (isOpenCell(next, blocked) && !visited.has(key)) {
        visited.add(key);
        queue.push({ position: next, firstMove: current.firstMove });
      }
    });
  }
  return null;
}

function projectMove(candidate) {
  const nextHead = { x: snake[0].x + candidate.x, y: snake[0].y + candidate.y };
  const eatsFood = nextHead.x === food.x && nextHead.y === food.y;
  const blocked = new Set((eatsFood ? snake : snake.slice(0, -1)).map(segment => `${segment.x},${segment.y}`));
  if (!isOpenCell(nextHead, blocked)) return null;
  const projectedSnake = [nextHead, ...snake];
  if (!eatsFood) projectedSnake.pop();
  return projectedSnake;
}

function canReachTail(projectedSnake) {
  if (projectedSnake.length < 2) return true;
  const blocked = new Set(projectedSnake.slice(0, -1).map(segment => `${segment.x},${segment.y}`));
  return Boolean(findPathFirstMove(projectedSnake[0], projectedSnake[projectedSnake.length - 1], blocked, getDirections()));
}

function countOpenArea(projectedSnake) {
  const blocked = new Set(projectedSnake.slice(0, -1).map(segment => `${segment.x},${segment.y}`));
  const queue = [projectedSnake[0]];
  const visited = new Set([`${projectedSnake[0].x},${projectedSnake[0].y}`]);
  while (queue.length) {
    const current = queue.shift();
    getDirections().forEach(candidate => {
      const next = { x: current.x + candidate.x, y: current.y + candidate.y };
      const key = `${next.x},${next.y}`;
      if (isOpenCell(next, blocked) && !visited.has(key)) {
        visited.add(key);
        queue.push(next);
      }
    });
  }
  return visited.size;
}

function isOpenCell(cell, occupied) {
  return cell.x >= 0 && cell.x < gridSize && cell.y >= 0 && cell.y < gridSize && !occupied.has(`${cell.x},${cell.y}`);
}

function gameLoop(timestamp) {
  if (gameState !== 'playing') return;
  if (timestamp - lastTick >= tickDuration) {
    update();
    draw();
    lastTick = timestamp;
  }
  if (gameState === 'playing') animationFrame = requestAnimationFrame(gameLoop);
}

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

  context.fillStyle = '#ff8a4c';
  context.shadowColor = '#ff8a4c';
  context.shadowBlur = 12;
  context.beginPath();
  context.arc(food.x * cellSize + cellSize / 2, food.y * cellSize + cellSize / 2, cellSize * .28, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 0;

  snake.forEach((segment, index) => {
    context.fillStyle = index === 0 ? '#ecff91' : '#b7d34e';
    const inset = index === 0 ? 2 : 3;
    context.fillRect(segment.x * cellSize + inset, segment.y * cellSize + inset, cellSize - inset * 2, cellSize - inset * 2);
  });
}

function restart() {
  cancelAnimationFrame(animationFrame);
  resetGame();
  if (aiEnabled) {
    startGame();
  } else {
    gameState = 'ready';
    showMessage('Ready?', 'Use the arrow keys or WASD to move.', 'Start game');
  }
}

function toggleAi() {
  aiEnabled = !aiEnabled;
  aiButton.textContent = aiEnabled ? 'AI: On' : 'AI play';
  aiButton.setAttribute('aria-pressed', String(aiEnabled));
  if (aiEnabled && (gameState === 'ready' || gameState === 'over')) startGame();
}

const directions = {
  ArrowUp: { x: 0, y: -1 },
  w: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  s: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  a: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  d: { x: 1, y: 0 },
};

document.addEventListener('keydown', event => {
  if (event.key === ' ' || event.key === 'p') {
    event.preventDefault();
    togglePause();
    return;
  }
  const newDirection = directions[event.key];
  if (newDirection) {
    event.preventDefault();
    setDirection(newDirection);
  }
});

startButton.addEventListener('click', startGame);
pauseButton.addEventListener('click', togglePause);
restartButton.addEventListener('click', restart);
aiButton.addEventListener('click', toggleAi);
document.querySelectorAll('[data-direction]').forEach(button => {
  button.addEventListener('click', () => setDirection(directions[button.dataset.direction === 'up' ? 'ArrowUp' : button.dataset.direction === 'down' ? 'ArrowDown' : button.dataset.direction === 'left' ? 'ArrowLeft' : 'ArrowRight']));
});

resetGame();
showMessage('Ready?', 'Use the arrow keys or WASD to move.', 'Start game');
