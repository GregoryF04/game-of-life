let canvas = document.getElementById('simulation');
const matrixElement = document.getElementById('matrix');
const speciesSelect = document.getElementById('speciesCount');
const particleCountInput = document.getElementById('particleCount');
const radiusInput = document.getElementById('radius');
const frictionInput = document.getElementById('friction');
const particleValue = document.getElementById('particleValue');
const radiusValue = document.getElementById('radiusValue');
const frictionValue = document.getElementById('frictionValue');
const fpsValue = document.getElementById('fpsValue');
const fpsWarning = document.getElementById('fpsWarning');
const compatibilityNote = document.getElementById('compatibilityNote');
const totalParticleValue = document.getElementById('totalParticleValue');
const presetShareInput = document.getElementById('presetShare');
const presetShareStatus = document.getElementById('presetShareStatus');
const pauseButton = document.getElementById('pauseBtn');
const colors = ['#ff4d6d', '#35d0ba', '#ffd166', '#5aa9ff', '#c77dff', '#f9844a'];
const colorValues = colors.map((color) => {
  const value = Number.parseInt(color.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
});

const presets = {
  clusters: (count) => Array.from({ length: count }, (_, row) =>
    Array.from({ length: count }, (_, column) => row === column ? 0.78 : -0.18)),
  chains: (count) => Array.from({ length: count }, (_, row) =>
    Array.from({ length: count }, (_, column) => row === column ? -0.24 :
      (Math.abs(row - column) === 1 ? 0.88 : -0.34))),
  cells: (count) => Array.from({ length: count }, (_, row) =>
    Array.from({ length: count }, (_, column) => row === column ? 0.35 :
      ((row + column) % 3 === 0 ? 0.7 : -0.58))),
  chaos: (count) => Array.from({ length: count }, () =>
    Array.from({ length: count }, () => Math.random() * 2 - 1)),
};

let width = 1;
let height = 1;
let pixelRatio = 1;
let speciesCount = Number(speciesSelect.value);
const isSmallScreen = window.matchMedia('(max-width: 760px)').matches;
let particlesPerSpecies = isSmallScreen
  ? Math.min(80, Number(particleCountInput.value))
  : Number(particleCountInput.value);
let interactionRadius = Number(radiusInput.value);
let friction = Number(frictionInput.value);
let matrix = presets.clusters(speciesCount);
let context = null;
let gl = null;
let gpu = null;
let useGpu = false;

let particleX;
let particleY;
let particleVX;
let particleVY;
let particleSpecies;
let cellCountX = 1;
let cellCountY = 1;
let cellStart = new Int32Array(2);
let cellParticles = new Int32Array(0);
let cellOf = new Int32Array(0);
let cellCounts = new Int32Array(2);
let cellCursor = new Int32Array(1);
let paused = false;
let lastFrame = performance.now();
let fpsTimestamp = lastFrame;
let frameCount = 0;
let savedSettings = null;
try { savedSettings = JSON.parse(localStorage.getItem('particle-life-settings') || 'null'); } catch { savedSettings = null; }

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(1, bounds.width);
  height = Math.max(1, bounds.height);
  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  if (gl) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (gpu) gpu.pointSize = 4.5 * pixelRatio;
  } else if (context) {
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }
}

function createCpuParticles() {
  const total = speciesCount * particlesPerSpecies;
  particleX = new Float32Array(total);
  particleY = new Float32Array(total);
  particleVX = new Float32Array(total);
  particleVY = new Float32Array(total);
  particleSpecies = new Uint8Array(total);
  let index = 0;
  for (let species = 0; species < speciesCount; species += 1) {
    for (let particle = 0; particle < particlesPerSpecies; particle += 1) {
      particleX[index] = Math.random() * width;
      particleY[index] = Math.random() * height;
      particleVX[index] = (Math.random() - 0.5) * 0.7;
      particleVY[index] = (Math.random() - 0.5) * 0.7;
      particleSpecies[index] = species;
      index += 1;
    }
  }
}

function wrappedDelta(value, size) {
  if (value > size / 2) return value - size;
  if (value < -size / 2) return value + size;
  return value;
}

function buildCpuBuckets() {
  cellCountX = Math.max(1, Math.ceil(width / interactionRadius));
  cellCountY = Math.max(1, Math.ceil(height / interactionRadius));
  const cellCount = cellCountX * cellCountY;
  const total = particleX.length;
  if (cellOf.length !== total) cellOf = new Int32Array(total);
  if (cellCounts.length !== cellCount + 1) cellCounts = new Int32Array(cellCount + 1);
  else cellCounts.fill(0);
  if (cellStart.length !== cellCount + 1) cellStart = new Int32Array(cellCount + 1);
  if (cellParticles.length !== total) cellParticles = new Int32Array(total);
  if (cellCursor.length !== cellCount) cellCursor = new Int32Array(cellCount);
  for (let i = 0; i < total; i += 1) {
    const cx = Math.min(cellCountX - 1, (particleX[i] / interactionRadius) | 0);
    const cy = Math.min(cellCountY - 1, (particleY[i] / interactionRadius) | 0);
    const cell = cy * cellCountX + cx;
    cellOf[i] = cell;
    cellCounts[cell + 1] += 1;
  }
  for (let cell = 0; cell < cellCount; cell += 1) cellCounts[cell + 1] += cellCounts[cell];
  cellStart.set(cellCounts);
  cellCursor.set(cellCounts.subarray(0, cellCount));
  for (let i = 0; i < total; i += 1) {
    const cell = cellOf[i];
    cellParticles[cellCursor[cell]] = i;
    cellCursor[cell] += 1;
  }
}

function updateCpu() {
  buildCpuBuckets();
  const closeRange = Math.min(18, interactionRadius * 0.22);
  for (let particleIndex = 0; particleIndex < particleX.length; particleIndex += 1) {
    let forceX = 0;
    let forceY = 0;
    const cellX = Math.min(cellCountX - 1, (particleX[particleIndex] / interactionRadius) | 0);
    const cellY = Math.min(cellCountY - 1, (particleY[particleIndex] / interactionRadius) | 0);
    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        const neighborCellX = (cellX + offsetX + cellCountX) % cellCountX;
        const neighborCellY = (cellY + offsetY + cellCountY) % cellCountY;
        const cell = neighborCellY * cellCountX + neighborCellX;
        for (let bucketIndex = cellStart[cell]; bucketIndex < cellStart[cell + 1]; bucketIndex += 1) {
          const neighborIndex = cellParticles[bucketIndex];
          if (neighborIndex === particleIndex) continue;
          const deltaX = wrappedDelta(particleX[neighborIndex] - particleX[particleIndex], width);
          const deltaY = wrappedDelta(particleY[neighborIndex] - particleY[particleIndex], height);
          const distance = Math.hypot(deltaX, deltaY);
          if (distance === 0 || distance >= interactionRadius) continue;
          const strength = distance < closeRange
            ? -1.4 * (1 - distance / closeRange)
            : matrix[particleSpecies[particleIndex]][particleSpecies[neighborIndex]] *
              (1 - distance / interactionRadius);
          forceX += (deltaX / distance) * strength;
          forceY += (deltaY / distance) * strength;
        }
      }
    }
    particleVX[particleIndex] = (particleVX[particleIndex] + forceX * 0.045) * friction;
    particleVY[particleIndex] = (particleVY[particleIndex] + forceY * 0.045) * friction;
    particleX[particleIndex] = (particleX[particleIndex] + particleVX[particleIndex] + width) % width;
    particleY[particleIndex] = (particleY[particleIndex] + particleVY[particleIndex] + height) % height;
  }
}

function drawCpu() {
  context.fillStyle = '#050807';
  context.fillRect(0, 0, width, height);
  for (let species = 0; species < speciesCount; species += 1) {
    context.fillStyle = colors[species];
    context.beginPath();
    for (let i = 0; i < particleX.length; i += 1) {
      if (particleSpecies[i] !== species) continue;
      context.moveTo(particleX[i] + 2.3, particleY[i]);
      context.arc(particleX[i], particleY[i], 2.3, 0, Math.PI * 2);
    }
    context.fill();
  }
}

function createShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

function createProgram(vertexSource, fragmentSource, varyings = null) {
  const program = gl.createProgram();
  gl.attachShader(program, createShader(gl.VERTEX_SHADER, vertexSource));
  if (fragmentSource) gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fragmentSource));
  if (varyings) gl.transformFeedbackVaryings(program, varyings, gl.INTERLEAVED_ATTRIBS);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  return program;
}

function createStateBuffer(state) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, state, gl.DYNAMIC_COPY);
  return buffer;
}

function bindStateAttributes(buffer) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 8);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 20, 16);
}

function flattenMatrix() {
  const values = new Float32Array(36);
  for (let row = 0; row < 6; row += 1) {
    for (let column = 0; column < 6; column += 1) values[row * 6 + column] = matrix[row]?.[column] ?? 0;
  }
  return values;
}

function uploadGpuMatrix() {
  if (!gpu) return;
  gl.useProgram(gpu.physicsProgram);
  gl.uniform1fv(gpu.physicsUniforms.attractionMatrix, flattenMatrix());
}

function createGpuEngine() {
  const physicsVertex = `#version 300 es
    precision highp float;
    precision highp int;
    layout(location = 0) in vec2 position;
    layout(location = 1) in vec2 velocity;
    layout(location = 2) in float species;
    uniform sampler2D positionTexture;
    uniform sampler2D speciesTexture;
    uniform float attractionMatrix[36];
    uniform float interactionRadius;
    uniform float closeRange;
    uniform float friction;
    uniform vec2 worldSize;
    uniform int particleCount;
    uniform int textureSide;
    out vec2 outPosition;
    out vec2 outVelocity;
    out float outSpecies;
    float wrappedDelta(float value, float size) {
      if (value > size * 0.5) return value - size;
      if (value < -size * 0.5) return value + size;
      return value;
    }
    void main() {
      vec2 force = vec2(0.0);
      int selfSpecies = int(species + 0.5);
      for (int index = 0; index < particleCount; index++) {
        if (index == gl_VertexID) continue;
        int textureX = index % textureSide;
        int textureY = index / textureSide;
        vec2 other = texelFetch(positionTexture, ivec2(textureX, textureY), 0).xy;
        int otherSpecies = int(texelFetch(speciesTexture, ivec2(textureX, textureY), 0).r + 0.5);
        vec2 delta = vec2(wrappedDelta(other.x - position.x, worldSize.x), wrappedDelta(other.y - position.y, worldSize.y));
        float distance = length(delta);
        if (distance == 0.0 || distance >= interactionRadius) continue;
        float strength = distance < closeRange ? -1.4 * (1.0 - distance / closeRange) :
          attractionMatrix[selfSpecies * 6 + otherSpecies] * (1.0 - distance / interactionRadius);
        force += (delta / distance) * strength;
      }
      vec2 nextVelocity = (velocity + force * 0.045) * friction;
      outPosition = mod(position + nextVelocity + worldSize, worldSize);
      outVelocity = nextVelocity;
      outSpecies = species;
    }`;
  const physicsFragment = `#version 300 es
    precision highp float;
    void main() { }
  `;
  const physicsProgram = createProgram(physicsVertex, physicsFragment, ['outPosition', 'outVelocity', 'outSpecies']);

  const packVertex = `#version 300 es
    precision highp float;
    layout(location = 0) in vec2 position;
    layout(location = 2) in float species;
    out vec2 packedPosition;
    flat out float packedSpecies;
    uniform int particleCount;
    uniform int textureSide;
    void main() {
      int textureX = gl_VertexID % textureSide;
      int textureY = gl_VertexID / textureSide;
      float x = (float(textureX) + 0.5) / float(textureSide) * 2.0 - 1.0;
      float y = (float(textureY) + 0.5) / float(textureSide) * 2.0 - 1.0;
      gl_Position = vec4(x, y, 0.0, 1.0);
      gl_PointSize = 1.0;
      packedPosition = position;
      packedSpecies = species;
    }`;
  const packFragment = `#version 300 es
    precision highp float;
    layout(location = 0) out vec4 packedOutput;
    in vec2 packedPosition;
    flat in float packedSpecies;
    uniform int packSpecies;
    void main() {
      packedOutput = packSpecies == 0
        ? vec4(packedPosition, 0.0, 1.0)
        : vec4(packedSpecies, 0.0, 0.0, 1.0);
    }`;
  const packProgram = createProgram(packVertex, packFragment);

  const renderVertex = `#version 300 es
    precision highp float;
    layout(location = 0) in vec2 position;
    layout(location = 2) in float species;
    uniform vec2 worldSize;
    uniform float pointSize;
    flat out int particleSpecies;
    void main() {
      vec2 clipPosition = position / worldSize * 2.0 - 1.0;
      gl_Position = vec4(clipPosition.x, -clipPosition.y, 0.0, 1.0);
      gl_PointSize = pointSize;
      particleSpecies = int(species + 0.5);
    }`;
  const renderFragment = `#version 300 es
    precision highp float;
    uniform vec3 speciesColors[6];
    flat in int particleSpecies;
    out vec4 color;
    void main() {
      vec2 point = gl_PointCoord * 2.0 - 1.0;
      float distanceFromCenter = length(point);
      if (distanceFromCenter > 1.0) discard;
      float alpha = 1.0 - smoothstep(0.72, 1.0, distanceFromCenter);
      color = vec4(speciesColors[particleSpecies], alpha);
    }`;
  const renderProgram = createProgram(renderVertex, renderFragment);
  const vao = gl.createVertexArray();
  const transformFeedback = gl.createTransformFeedback();
  const framebuffer = gl.createFramebuffer();
  return {
    physicsProgram,
    packProgram,
    renderProgram,
    vao,
    transformFeedback,
    framebuffer,
    positionTexture: gl.createTexture(),
    speciesTexture: gl.createTexture(),
    buffers: [],
    particleCount: 0,
    textureSide: 1,
    sourceIndex: 0,
    pointSize: 4.5,
    physicsUniforms: {
      positionTexture: gl.getUniformLocation(physicsProgram, 'positionTexture'),
      speciesTexture: gl.getUniformLocation(physicsProgram, 'speciesTexture'),
      attractionMatrix: gl.getUniformLocation(physicsProgram, 'attractionMatrix'),
      interactionRadius: gl.getUniformLocation(physicsProgram, 'interactionRadius'),
      closeRange: gl.getUniformLocation(physicsProgram, 'closeRange'),
      friction: gl.getUniformLocation(physicsProgram, 'friction'),
      worldSize: gl.getUniformLocation(physicsProgram, 'worldSize'),
      particleCount: gl.getUniformLocation(physicsProgram, 'particleCount'),
      textureSide: gl.getUniformLocation(physicsProgram, 'textureSide'),
    },
    packParticleCount: gl.getUniformLocation(packProgram, 'particleCount'),
    packTextureSide: gl.getUniformLocation(packProgram, 'textureSide'),
    packSpecies: gl.getUniformLocation(packProgram, 'packSpecies'),
    renderUniforms: {
      worldSize: gl.getUniformLocation(renderProgram, 'worldSize'),
      pointSize: gl.getUniformLocation(renderProgram, 'pointSize'),
      speciesColors: gl.getUniformLocation(renderProgram, 'speciesColors'),
    },
  };
}

function configureGpuTextures() {
  const { particleCount, positionTexture, speciesTexture, framebuffer } = gpu;
  const side = Math.max(1, Math.ceil(Math.sqrt(particleCount)));
  gpu.textureSide = side;
  for (const texture of [positionTexture, speciesTexture]) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  gl.bindTexture(gl.TEXTURE_2D, positionTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, side, side, 0, gl.RGBA, gl.FLOAT, null);
  gl.bindTexture(gl.TEXTURE_2D, speciesTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, side, side, 0, gl.RGBA, gl.FLOAT, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, positionTexture, 0);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Float texture framebuffer is incomplete');
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, speciesTexture, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Float species framebuffer is incomplete');
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function createGpuParticles() {
  const total = speciesCount * particlesPerSpecies;
  const state = new Float32Array(total * 5);
  let index = 0;
  for (let species = 0; species < speciesCount; species += 1) {
    for (let particle = 0; particle < particlesPerSpecies; particle += 1) {
      const offset = index * 5;
      state[offset] = Math.random() * width;
      state[offset + 1] = Math.random() * height;
      state[offset + 2] = (Math.random() - 0.5) * 0.7;
      state[offset + 3] = (Math.random() - 0.5) * 0.7;
      state[offset + 4] = species;
      index += 1;
    }
  }
  gpu.buffers.forEach((buffer) => gl.deleteBuffer(buffer));
  gpu.buffers = [createStateBuffer(state), createStateBuffer(state)];
  gpu.particleCount = total;
  gpu.sourceIndex = 0;
  configureGpuTextures();
}

function packGpuState() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, gpu.framebuffer);
  gl.viewport(0, 0, gpu.textureSide, gpu.textureSide);
  gl.useProgram(gpu.packProgram);
  gl.bindVertexArray(gpu.vao);
  bindStateAttributes(gpu.buffers[gpu.sourceIndex]);
  gl.uniform1i(gpu.packParticleCount, gpu.particleCount);
  gl.uniform1i(gpu.packTextureSide, gpu.textureSide);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, gpu.positionTexture, 0);
  gl.uniform1i(gpu.packSpecies, 0);
  gl.drawArrays(gl.POINTS, 0, gpu.particleCount);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, gpu.speciesTexture, 0);
  gl.uniform1i(gpu.packSpecies, 1);
  gl.drawArrays(gl.POINTS, 0, gpu.particleCount);
  gl.bindVertexArray(null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function updateGpu() {
  packGpuState();
  const destinationIndex = 1 - gpu.sourceIndex;
  const uniforms = gpu.physicsUniforms;
  gl.useProgram(gpu.physicsProgram);
  gl.bindVertexArray(gpu.vao);
  bindStateAttributes(gpu.buffers[gpu.sourceIndex]);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, gpu.positionTexture);
  gl.uniform1i(uniforms.positionTexture, 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, gpu.speciesTexture);
  gl.uniform1i(uniforms.speciesTexture, 1);
  gl.uniform1f(uniforms.interactionRadius, interactionRadius);
  gl.uniform1f(uniforms.closeRange, Math.min(18, interactionRadius * 0.22));
  gl.uniform1f(uniforms.friction, friction);
  gl.uniform2f(uniforms.worldSize, width, height);
  gl.uniform1i(uniforms.particleCount, gpu.particleCount);
  gl.uniform1i(uniforms.textureSide, gpu.textureSide);
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, gpu.transformFeedback);
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, gpu.buffers[destinationIndex]);
  gl.enable(gl.RASTERIZER_DISCARD);
  gl.beginTransformFeedback(gl.POINTS);
  gl.drawArrays(gl.POINTS, 0, gpu.particleCount);
  gl.endTransformFeedback();
  gl.disable(gl.RASTERIZER_DISCARD);
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
  gl.bindVertexArray(null);
  gpu.sourceIndex = destinationIndex;
}

function drawGpu() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(5 / 255, 8 / 255, 7 / 255, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(gpu.renderProgram);
  gl.bindVertexArray(gpu.vao);
  bindStateAttributes(gpu.buffers[gpu.sourceIndex]);
  gl.uniform2f(gpu.renderUniforms.worldSize, width, height);
  gl.uniform1f(gpu.renderUniforms.pointSize, gpu.pointSize);
  gl.uniform3fv(gpu.renderUniforms.speciesColors, new Float32Array(colorValues.flat()));
  gl.drawArrays(gl.POINTS, 0, gpu.particleCount);
  gl.bindVertexArray(null);
}

function canUseGpu() {
  const probe = document.createElement('canvas');
  const probeContext = probe.getContext('webgl2');
  return Boolean(probeContext && probeContext.getExtension('EXT_color_buffer_float'));
}

function initializeEngine() {
  if (canUseGpu()) {
    try {
      gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
      if (!gl || !gl.getExtension('EXT_color_buffer_float')) {
        throw new Error('EXT_color_buffer_float not available on this context');
      }
      gpu = createGpuEngine();
      useGpu = true;
      compatibilityNote.hidden = true;
      resizeCanvas();
      uploadGpuMatrix();
      restart();
      return;
    } catch (error) {
      console.warn('GPU Particle Life initialization failed:', error);
      gl = null;
      gpu = null;
      useGpu = false;
      const replacement = canvas.cloneNode(true);
      canvas.replaceWith(replacement);
      canvas = replacement;
    }
  }
  context = canvas.getContext('2d');
  compatibilityNote.hidden = false;
  resizeCanvas();
  restart();
}

function restart() {
  resizeCanvas();
  if (useGpu) createGpuParticles();
  else createCpuParticles();
}

function renderMatrix() {
  matrixElement.style.gridTemplateColumns = `repeat(${speciesCount + 1}, minmax(58px, 1fr))`;
  matrixElement.innerHTML = '';
  const corner = document.createElement('div');
  corner.className = 'matrixCorner';
  corner.textContent = 'to / from';
  matrixElement.appendChild(corner);
  for (let species = 0; species < speciesCount; species += 1) {
    const label = document.createElement('div');
    label.className = 'matrixLabel';
    label.style.setProperty('--species-color', colors[species]);
    label.textContent = `Species ${species + 1}`;
    matrixElement.appendChild(label);
  }
  for (let row = 0; row < speciesCount; row += 1) {
    const rowLabel = document.createElement('div');
    rowLabel.className = 'matrixLabel';
    rowLabel.style.setProperty('--species-color', colors[row]);
    rowLabel.textContent = `Species ${row + 1}`;
    matrixElement.appendChild(rowLabel);
    for (let column = 0; column < speciesCount; column += 1) {
      const input = document.createElement('input');
      input.className = 'matrixCell';
      input.type = 'number';
      input.min = '-1';
      input.max = '1';
      input.step = '0.01';
      input.value = matrix[row][column].toFixed(2);
      updateMatrixCellColor(input, matrix[row][column]);
      input.addEventListener('input', () => {
        const value = Math.max(-1, Math.min(1, Number(input.value) || 0));
        matrix[row][column] = value;
        input.value = value.toFixed(2);
        updateMatrixCellColor(input, value);
        uploadGpuMatrix();
      });
      matrixElement.appendChild(input);
    }
  }
  uploadGpuMatrix();
}

function updateMatrixCellColor(input, value) {
  const neutral = [112, 112, 112];
  const repel = [196, 66, 78];
  const attract = [54, 176, 112];
  const target = value < 0 ? repel : attract;
  const amount = Math.abs(value);
  const color = neutral.map((channel, index) => Math.round(channel + (target[index] - channel) * amount));
  input.style.background = `rgb(${color.join(', ')})`;
}

function updateLabels() {
  particleValue.textContent = particlesPerSpecies;
  totalParticleValue.textContent = speciesCount * particlesPerSpecies;
  radiusValue.textContent = interactionRadius;
  frictionValue.textContent = friction.toFixed(2);
  localStorage.setItem('particle-life-settings', serializePreset());
}

function serializePreset() {
  return JSON.stringify({
    version: 1,
    species: speciesCount,
    particles: particlesPerSpecies,
    radius: interactionRadius,
    friction,
    matrix,
  });
}

function applySharedPreset(serialized) {
  const preset = JSON.parse(serialized);
  if (!preset || preset.version !== 1 || ![4, 5, 6].includes(preset.species) ||
      !Number.isInteger(preset.particles) || preset.particles < 50 || preset.particles > 5000 ||
      !Number.isFinite(preset.radius) || preset.radius < 45 || preset.radius > 160 ||
      !Number.isFinite(preset.friction) || preset.friction < 0.82 || preset.friction > 0.98 ||
      !Array.isArray(preset.matrix) || preset.matrix.length !== preset.species ||
      preset.matrix.some((row) => !Array.isArray(row) || row.length !== preset.species ||
        row.some((value) => !Number.isFinite(value) || value < -1 || value > 1))) {
    throw new Error('Invalid preset');
  }

  speciesCount = preset.species;
  particlesPerSpecies = preset.particles;
  interactionRadius = preset.radius;
  friction = preset.friction;
  matrix = preset.matrix.map((row) => row.map((value) => Number(value)));
  speciesSelect.value = String(speciesCount);
  particleCountInput.value = String(particlesPerSpecies);
  radiusInput.value = String(interactionRadius);
  frictionInput.value = String(friction);
  renderMatrix();
  updateLabels();
  restart();
}

speciesSelect.addEventListener('change', () => {
  speciesCount = Number(speciesSelect.value);
  matrix = presets[document.getElementById('preset').value](speciesCount);
  renderMatrix();
  updateLabels();
  restart();
});

particleCountInput.addEventListener('input', () => {
  particlesPerSpecies = Number(particleCountInput.value);
  updateLabels();
  restart();
});

radiusInput.addEventListener('input', () => {
  interactionRadius = Number(radiusInput.value);
  updateLabels();
});

frictionInput.addEventListener('input', () => {
  friction = Number(frictionInput.value);
  updateLabels();
});

document.getElementById('preset').addEventListener('change', (event) => {
  matrix = presets[event.target.value](speciesCount);
  renderMatrix();
});

document.getElementById('randomizeBtn').addEventListener('click', () => {
  matrix = presets.chaos(speciesCount);
  renderMatrix();
  restart();
});

document.getElementById('copyPresetBtn').addEventListener('click', async () => {
  const serialized = serializePreset();
  presetShareInput.value = serialized;
  try {
    await navigator.clipboard.writeText(serialized);
    presetShareStatus.textContent = 'Copied';
  } catch {
    presetShareInput.select();
    presetShareStatus.textContent = 'Select and copy the line';
  }
});

document.getElementById('loadPresetBtn').addEventListener('click', async () => {
  let serialized = presetShareInput.value.trim();
  if (!serialized) {
    try {
      serialized = await navigator.clipboard.readText();
      presetShareInput.value = serialized;
    } catch {
      presetShareStatus.textContent = 'Paste a preset line first';
      return;
    }
  }
  try {
    applySharedPreset(serialized);
    presetShareStatus.textContent = 'Loaded';
  } catch {
    presetShareStatus.textContent = 'Invalid preset';
  }
});

document.getElementById('restartBtn').addEventListener('click', restart);
pauseButton.addEventListener('click', () => {
  paused = !paused;
  pauseButton.textContent = paused ? 'Resume' : 'Pause';
});

if ('ResizeObserver' in window) {
  new ResizeObserver(resizeCanvas).observe(canvas.parentElement);
} else {
  window.addEventListener('resize', resizeCanvas);
}
if (isSmallScreen) particleCountInput.value = String(particlesPerSpecies);
if (savedSettings && savedSettings.version === 1) {
  try { applySharedPreset(JSON.stringify(savedSettings)); } catch { /* use defaults */ }
}
renderMatrix();
updateLabels();
initializeEngine();

function frame(now) {
  const elapsed = Math.min(32, now - lastFrame);
  lastFrame = now;
  if (!paused && elapsed > 0) {
    if (useGpu) updateGpu();
    else updateCpu();
  }
  if (useGpu) drawGpu();
  else drawCpu();
  frameCount += 1;
  if (now - fpsTimestamp >= 500) {
    const currentFps = Math.round(frameCount * 1000 / (now - fpsTimestamp));
    fpsValue.textContent = `${currentFps} FPS`;
    fpsWarning.hidden = currentFps >= 30;
    frameCount = 0;
    fpsTimestamp = now;
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
