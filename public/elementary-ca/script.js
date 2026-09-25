const COLUMN_COUNT = 200;
const MAX_ROWS = 200;
const DEFAULT_RULE = 30;

const canvas = document.getElementById('board');
const context = canvas.getContext('2d');
const ruleBits = document.getElementById('ruleBits');
const ruleNumber = document.getElementById('ruleNumber');
const presetSelect = document.getElementById('presetSelect');
const randomInitial = document.getElementById('randomInitial');
const generateButton = document.getElementById('generateBtn');
const animateButton = document.getElementById('animateBtn');

let rule = DEFAULT_RULE;
let cellSize = 4;
let rows = [];
let visibleRows = 0;
let animationFrame = null;
let lastAnimationTime = 0;
let savedSettings = {};
try { savedSettings = JSON.parse(localStorage.getItem('elementary-ca-settings') || '{}'); } catch { savedSettings = {}; }

function bitForPattern(patternIndex) {
  return (rule >> (7 - patternIndex)) & 1;
}

function updateRuleBits() {
  [...ruleBits.querySelectorAll('input')].forEach((input, index) => {
    const bit = Boolean(bitForPattern(index));
    input.checked = bit;
    input.parentElement.querySelector('output').textContent = bit ? '1' : '0';
  });
}

function setRule(value, regenerate = true) {
  stopAnimation();
  rule = Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
  ruleNumber.value = rule;
  updateRuleBits();
  presetSelect.value = [30, 90, 110, 184, 54].includes(rule) ? String(rule) : '';
  localStorage.setItem('elementary-ca-settings', JSON.stringify({ rule, randomInitial: randomInitial.checked }));
  if (regenerate) generate();
}

function createRuleBits() {
  const patterns = ['111', '110', '101', '100', '011', '010', '001', '000'];
  patterns.forEach((pattern, index) => {
    const item = document.createElement('label');
    item.className = 'ruleBit';
    item.innerHTML = `<span class="patternLabel" aria-label="${pattern}">${[...pattern].map(bit => `<i class="bit bit-${bit}"></i>`).join('')}</span><input type="checkbox" aria-label="Output for ${pattern}"><output>0</output>`;
    const toggle = item.querySelector('input');
    toggle.addEventListener('change', () => {
      const bit = 7 - index;
      rule = toggle.checked ? rule | (1 << bit) : rule & ~(1 << bit);
      ruleNumber.value = rule;
      presetSelect.value = '';
      item.querySelector('output').textContent = toggle.checked ? '1' : '0';
      generate();
    });
    ruleBits.appendChild(item);
  });
}

function createInitialRow() {
  if (randomInitial.checked) {
    return Array.from({ length: COLUMN_COUNT }, () => Math.random() > 0.5 ? 1 : 0);
  }
  const row = new Array(COLUMN_COUNT).fill(0);
  row[Math.floor(COLUMN_COUNT / 2)] = 1;
  return row;
}

function nextRow(previous) {
  return previous.map((_, index) => {
    const left = previous[(index - 1 + COLUMN_COUNT) % COLUMN_COUNT];
    const center = previous[index];
    const right = previous[(index + 1) % COLUMN_COUNT];
    const pattern = (left << 2) | (center << 1) | right;
    return (rule >> pattern) & 1;
  });
}

function resizeCanvas() {
  cellSize = Math.max(2, Math.floor(window.innerWidth / COLUMN_COUNT));
  canvas.width = COLUMN_COUNT * cellSize;
  canvas.height = MAX_ROWS * cellSize;
  draw();
}

function generate() {
  stopAnimation();
  rows = [createInitialRow()];
  visibleRows = 1;
  draw();
}

function stopAnimation() {
  if (animationFrame !== null) cancelAnimationFrame(animationFrame);
  animationFrame = null;
  animateButton.textContent = 'Animate';
}

function animate(timestamp) {
  if (animationFrame === null) return;
  if (!lastAnimationTime || timestamp - lastAnimationTime >= 45) {
    lastAnimationTime = timestamp;
    if (visibleRows < MAX_ROWS) {
      rows.push(nextRow(rows[rows.length - 1]));
      visibleRows++;
      draw();
    } else {
      stopAnimation();
      return;
    }
  }
  animationFrame = requestAnimationFrame(animate);
}

function startAnimation() {
  if (visibleRows >= MAX_ROWS) generate();
  if (animationFrame !== null) return;
  animateButton.textContent = 'Pause';
  lastAnimationTime = 0;
  animationFrame = requestAnimationFrame(animate);
}

function draw() {
  context.fillStyle = '#050807';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#00ff66';
  rows.slice(0, visibleRows).forEach((row, rowIndex) => row.forEach((alive, columnIndex) => {
    if (alive) context.fillRect(columnIndex * cellSize, rowIndex * cellSize, cellSize, cellSize);
  }));
}

ruleNumber.addEventListener('input', () => {
  const value = Number(ruleNumber.value);
  if (Number.isInteger(value) && value >= 0 && value <= 255) setRule(value);
});

presetSelect.addEventListener('change', () => {
  if (presetSelect.value) setRule(presetSelect.value);
});

randomInitial.addEventListener('change', () => {
  localStorage.setItem('elementary-ca-settings', JSON.stringify({ rule, randomInitial: randomInitial.checked }));
  generate();
});
generateButton.addEventListener('click', generate);
animateButton.addEventListener('click', () => {
  if (animationFrame === null) startAnimation();
  else stopAnimation();
});
window.addEventListener('resize', resizeCanvas);

createRuleBits();
randomInitial.checked = Boolean(savedSettings.randomInitial);
setRule(Number.isInteger(savedSettings.rule) ? savedSettings.rule : DEFAULT_RULE, false);
resizeCanvas();
generate();
