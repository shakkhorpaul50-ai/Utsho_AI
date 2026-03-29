/**
 * mathGraphService.ts
 * 
 * Lightweight 2D & 3D math graph renderer using HTML5 Canvas.
 * Parses expressions from AI-generated graph blocks and renders
 * Desmos-like interactive graphs.
 */

// ─── Expression Parser & Evaluator ─────────────────────────────────────────

/** Safe math functions available in expressions */
const MATH_FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  atan2: Math.atan2,
  abs: Math.abs,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  log: Math.log,
  log2: Math.log2,
  log10: Math.log10,
  ln: Math.log,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
  sign: Math.sign,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
};

const MATH_CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  PI: Math.PI,
  e: Math.E,
  E: Math.E,
  tau: Math.PI * 2,
  phi: (1 + Math.sqrt(5)) / 2,
};

/**
 * Tokenize and evaluate a math expression with given variable values.
 * Supports: +, -, *, /, ^, parentheses, functions, constants.
 */
export function evaluateExpression(expr: string, vars: Record<string, number>): number {
  // Preprocess: handle implicit multiplication, unicode symbols
  let processed = expr
    .replace(/\s+/g, '')
    .replace(/\u00B2/g, '^2')
    .replace(/\u00B3/g, '^3')
    .replace(/\u221A/g, 'sqrt')
    .replace(/\u03C0/g, 'pi')
    // Implicit multiplication: 2x -> 2*x, x(... -> x*(, )(... -> )*(
    .replace(/(\d)([a-zA-Z(])/g, '$1*$2')
    .replace(/\)(\(|[a-zA-Z\d])/g, ')*$1');

  let pos = 0;

  function peek(): string { return processed[pos] || ''; }
  function consume(): string { return processed[pos++]; }
  function expect(ch: string): void {
    if (consume() !== ch) throw new Error(`Expected '${ch}'`);
  }

  function parseExpr(): number {
    let result = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      result = op === '+' ? result + right : result - right;
    }
    return result;
  }

  function parseTerm(): number {
    let result = parsePower();
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parsePower();
      result = op === '*' ? result * right : result / right;
    }
    return result;
  }

  function parsePower(): number {
    let result = parseUnary();
    if (peek() === '^') {
      consume();
      const right = parsePower(); // right-associative
      result = Math.pow(result, right);
    }
    return result;
  }

  function parseUnary(): number {
    if (peek() === '-') {
      consume();
      return -parseUnary();
    }
    if (peek() === '+') {
      consume();
      return parseUnary();
    }
    return parseAtom();
  }

  function parseAtom(): number {
    // Parenthesized expression
    if (peek() === '(') {
      consume();
      const result = parseExpr();
      expect(')');
      return result;
    }

    // Number
    if (/\d|\./.test(peek())) {
      let numStr = '';
      while (/[\d.]/.test(peek())) numStr += consume();
      return parseFloat(numStr);
    }

    // Identifier (variable, constant, or function)
    let name = '';
    while (/[a-zA-Z_\d]/.test(peek()) && pos < processed.length) name += consume();

    if (!name) throw new Error(`Unexpected character: ${peek()}`);

    // Check for function call
    if (peek() === '(') {
      consume();
      const args: number[] = [parseExpr()];
      while (peek() === ',') { consume(); args.push(parseExpr()); }
      expect(')');
      const fn = MATH_FUNCTIONS[name];
      if (!fn) throw new Error(`Unknown function: ${name}`);
      return fn(...args);
    }

    // Check constants first, then variables
    if (name in MATH_CONSTANTS) return MATH_CONSTANTS[name];
    if (name in vars) return vars[name];

    throw new Error(`Unknown identifier: ${name}`);
  }

  try {
    const result = parseExpr();
    return result;
  } catch {
    return NaN;
  }
}

// ─── Graph Data Types ───────────────────────────────────────────────────────

export interface GraphExpression {
  id: string;
  raw: string;           // Original expression text
  expr: string;          // Cleaned expression (right side of y= or z=)
  color: string;
  type: '2d' | '3d' | 'parametric' | 'polar' | 'inequality';
  label?: string;
  visible: boolean;
}

export interface GraphConfig {
  expressions: GraphExpression[];
  xRange: [number, number];
  yRange: [number, number];
  zRange?: [number, number];
  gridEnabled: boolean;
  is3D: boolean;
  title?: string;
}

const GRAPH_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
];

// ─── Parse Graph Block Content ──────────────────────────────────────────────

/**
 * Parse the content of a ```graph block into a GraphConfig.
 * Expected format:
 *   title: My Graph
 *   y = x^2
 *   y = sin(x)
 *   z = x^2 + y^2   (triggers 3D mode)
 *   r = 2*cos(theta) (polar)
 *   range: x[-10,10] y[-10,10]
 */
export function parseGraphBlock(content: string): GraphConfig {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const expressions: GraphExpression[] = [];
  let xRange: [number, number] = [-10, 10];
  let yRange: [number, number] = [-10, 10];
  let zRange: [number, number] = [-5, 5];
  let is3D = false;
  let title: string | undefined;
  let colorIdx = 0;

  for (const line of lines) {
    // Title line
    if (/^title\s*:/i.test(line)) {
      title = line.replace(/^title\s*:\s*/i, '').trim();
      continue;
    }

    // Range line
    if (/^range\s*:/i.test(line)) {
      const rangeStr = line.replace(/^range\s*:\s*/i, '');
      const xMatch = rangeStr.match(/x\s*\[\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\]/);
      const yMatch = rangeStr.match(/y\s*\[\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\]/);
      const zMatch = rangeStr.match(/z\s*\[\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\]/);
      if (xMatch) xRange = [parseFloat(xMatch[1]), parseFloat(xMatch[2])];
      if (yMatch) yRange = [parseFloat(yMatch[1]), parseFloat(yMatch[2])];
      if (zMatch) zRange = [parseFloat(zMatch[1]), parseFloat(zMatch[2])];
      continue;
    }

    // Color directive
    if (/^color\s*:/i.test(line)) continue;

    // Label directive
    const labelMatch = line.match(/^label\s*:\s*(.+)/i);
    if (labelMatch) continue;

    // Expression: y = ..., z = ..., r = ..., or just bare expression
    let exprType: GraphExpression['type'] = '2d';
    let exprStr = line;
    let label: string | undefined;

    // Check for label suffix: y = x^2 | "Parabola"
    const labelSuffix = line.match(/\|\s*"?([^"]+)"?\s*$/);
    if (labelSuffix) {
      label = labelSuffix[1].trim();
      exprStr = line.replace(/\|\s*"?[^"]*"?\s*$/, '').trim();
    }

    // y = ... form
    const yMatch = exprStr.match(/^y\s*=\s*(.+)/i);
    if (yMatch) {
      exprStr = yMatch[1].trim();
      exprType = '2d';
    }

    // z = ... form (3D)
    const zMatch = exprStr.match(/^z\s*=\s*(.+)/i);
    if (zMatch) {
      exprStr = zMatch[1].trim();
      exprType = '3d';
      is3D = true;
    }

    // r = ... form (polar)
    const rMatch = exprStr.match(/^r\s*=\s*(.+)/i);
    if (rMatch) {
      exprStr = rMatch[1].trim();
      exprType = 'polar';
    }

    // Inequality check
    if (/[<>]/.test(exprStr) && !/[=]/.test(exprStr.replace(/[<>]=/, ''))) {
      exprType = 'inequality';
    }

    // Skip comment lines
    if (exprStr.startsWith('#') || exprStr.startsWith('//')) continue;

    expressions.push({
      id: `expr_${expressions.length}`,
      raw: line,
      expr: exprStr,
      color: GRAPH_COLORS[colorIdx % GRAPH_COLORS.length],
      type: exprType,
      label: label || line,
      visible: true,
    });
    colorIdx++;
  }

  // Auto-detect 3D if any expression references both x and y as independent vars
  if (!is3D) {
    for (const e of expressions) {
      if (e.type === '3d') { is3D = true; break; }
    }
  }

  return { expressions, xRange, yRange, zRange, gridEnabled: true, is3D, title };
}

// ─── 2D Graph Renderer ──────────────────────────────────────────────────────

export function render2DGraph(
  canvas: HTMLCanvasElement,
  config: GraphConfig,
  colors: { bg: string; grid: string; axis: string; text: string },
  panOffset: { x: number; y: number } = { x: 0, y: 0 },
  zoomLevel: number = 1,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height } = canvas;
  const { xRange, yRange, expressions, gridEnabled } = config;

  // Apply zoom and pan
  const xSpan = (xRange[1] - xRange[0]) / zoomLevel;
  const ySpan = (yRange[1] - yRange[0]) / zoomLevel;
  const xCenter = (xRange[0] + xRange[1]) / 2 - panOffset.x;
  const yCenter = (yRange[0] + yRange[1]) / 2 + panOffset.y;
  const xMin = xCenter - xSpan / 2;
  const xMax = xCenter + xSpan / 2;
  const yMin = yCenter - ySpan / 2;
  const yMax = yCenter + ySpan / 2;

  // Coordinate transform
  const toScreenX = (x: number) => ((x - xMin) / (xMax - xMin)) * width;
  const toScreenY = (y: number) => height - ((y - yMin) / (yMax - yMin)) * height;

  // Clear
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);

  // Grid
  if (gridEnabled) {
    const gridStep = calculateGridStep(xMax - xMin);
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.3;

    // Vertical grid lines
    const xStart = Math.ceil(xMin / gridStep) * gridStep;
    for (let x = xStart; x <= xMax; x += gridStep) {
      const sx = toScreenX(x);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
      ctx.stroke();
    }

    // Horizontal grid lines
    const yStart = Math.ceil(yMin / gridStep) * gridStep;
    for (let y = yStart; y <= yMax; y += gridStep) {
      const sy = toScreenY(y);
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Axis labels
    ctx.fillStyle = colors.text;
    ctx.font = '11px "Inter", "SF Pro", sans-serif';
    ctx.globalAlpha = 0.6;
    for (let x = xStart; x <= xMax; x += gridStep) {
      if (Math.abs(x) < gridStep * 0.01) continue;
      const sx = toScreenX(x);
      const label = formatAxisNumber(x);
      ctx.fillText(label, sx + 3, toScreenY(0) + 14);
    }
    for (let y = yStart; y <= yMax; y += gridStep) {
      if (Math.abs(y) < gridStep * 0.01) continue;
      const sy = toScreenY(y);
      const label = formatAxisNumber(y);
      ctx.fillText(label, toScreenX(0) + 6, sy - 4);
    }
    ctx.globalAlpha = 1;
  }

  // Axes
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.7;

  // X-axis
  const yAxisScreen = toScreenY(0);
  if (yAxisScreen >= 0 && yAxisScreen <= height) {
    ctx.beginPath();
    ctx.moveTo(0, yAxisScreen);
    ctx.lineTo(width, yAxisScreen);
    ctx.stroke();
  }

  // Y-axis
  const xAxisScreen = toScreenX(0);
  if (xAxisScreen >= 0 && xAxisScreen <= width) {
    ctx.beginPath();
    ctx.moveTo(xAxisScreen, 0);
    ctx.lineTo(xAxisScreen, height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Origin label
  if (xAxisScreen >= 0 && xAxisScreen <= width && yAxisScreen >= 0 && yAxisScreen <= height) {
    ctx.fillStyle = colors.text;
    ctx.font = '11px "Inter", sans-serif';
    ctx.globalAlpha = 0.5;
    ctx.fillText('0', xAxisScreen + 5, yAxisScreen + 14);
    ctx.globalAlpha = 1;
  }

  // Plot expressions
  const step = (xMax - xMin) / (width * 2); // 2 samples per pixel

  for (const expr of expressions) {
    if (!expr.visible) continue;

    ctx.strokeStyle = expr.color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (expr.type === 'polar') {
      // Polar: r = f(theta)
      ctx.beginPath();
      let started = false;
      for (let theta = 0; theta <= Math.PI * 4; theta += 0.01) {
        try {
          const r = evaluateExpression(expr.expr, { theta, t: theta, ...MATH_CONSTANTS });
          if (!isFinite(r)) { started = false; continue; }
          const px = r * Math.cos(theta);
          const py = r * Math.sin(theta);
          const sx = toScreenX(px);
          const sy = toScreenY(py);
          if (!started) { ctx.moveTo(sx, sy); started = true; }
          else ctx.lineTo(sx, sy);
        } catch { started = false; }
      }
      ctx.stroke();
    } else {
      // Standard y = f(x)
      ctx.beginPath();
      let started = false;
      let prevY = NaN;
      for (let x = xMin; x <= xMax; x += step) {
        try {
          const y = evaluateExpression(expr.expr, { x, X: x, ...MATH_CONSTANTS });
          if (!isFinite(y) || Math.abs(y) > 1e6) { started = false; prevY = NaN; continue; }
          // Detect discontinuities (asymptotes)
          if (started && !isNaN(prevY) && Math.abs(y - prevY) > (yMax - yMin) * 0.5) {
            started = false;
          }
          const sx = toScreenX(x);
          const sy = toScreenY(y);
          if (!started) { ctx.moveTo(sx, sy); started = true; }
          else ctx.lineTo(sx, sy);
          prevY = y;
        } catch { started = false; prevY = NaN; }
      }
      ctx.stroke();
    }
  }

  // Legend
  if (expressions.length > 0) {
    const legendX = 12;
    let legendY = 20;
    ctx.font = 'bold 12px "Inter", "SF Pro", sans-serif';
    for (const expr of expressions) {
      if (!expr.visible) continue;
      ctx.fillStyle = expr.color;
      ctx.fillRect(legendX, legendY - 8, 14, 3);
      ctx.fillStyle = colors.text;
      ctx.globalAlpha = 0.8;
      ctx.fillText(expr.label || expr.raw, legendX + 20, legendY);
      ctx.globalAlpha = 1;
      legendY += 20;
    }
  }

  // Title
  if (config.title) {
    ctx.fillStyle = colors.text;
    ctx.font = 'bold 14px "Inter", "SF Pro", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(config.title, width / 2, 24);
    ctx.textAlign = 'start';
  }
}

// ─── 3D Graph Renderer ──────────────────────────────────────────────────────

export function render3DGraph(
  canvas: HTMLCanvasElement,
  config: GraphConfig,
  colors: { bg: string; grid: string; axis: string; text: string },
  rotation: { angleX: number; angleY: number } = { angleX: 0.6, angleY: 0.8 },
  zoomLevel: number = 1,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height } = canvas;
  const { xRange, yRange, zRange = [-5, 5], expressions } = config;

  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2;
  const scale = Math.min(width, height) / 5 * zoomLevel;

  const cosA = Math.cos(rotation.angleX);
  const sinA = Math.sin(rotation.angleX);
  const cosB = Math.cos(rotation.angleY);
  const sinB = Math.sin(rotation.angleY);

  // 3D to 2D projection with rotation
  const project = (x: number, y: number, z: number): [number, number] => {
    // Normalize to [-1, 1]
    const nx = (2 * (x - xRange[0]) / (xRange[1] - xRange[0]) - 1);
    const ny = (2 * (y - yRange[0]) / (yRange[1] - yRange[0]) - 1);
    const nz = (2 * (z - zRange[0]) / (zRange[1] - zRange[0]) - 1);

    // Rotate around Y axis then X axis
    const x1 = nx * cosB - ny * sinB;
    const y1 = nx * sinB * cosA + ny * cosB * cosA - nz * sinA;

    return [cx + x1 * scale, cy - y1 * scale];
  };

  // Draw 3D axes
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.4;
  const axisLen = 1.2;
  const axes = [
    { from: [-axisLen, 0, 0], to: [axisLen, 0, 0], color: '#ef4444', label: 'x' },
    { from: [0, -axisLen, 0], to: [0, axisLen, 0], color: '#22c55e', label: 'y' },
    { from: [0, 0, -axisLen], to: [0, 0, axisLen], color: '#3b82f6', label: 'z' },
  ];
  for (const axis of axes) {
    // Map normalized coords back for projection
    const mapBack = (v: number[]) => [
      xRange[0] + (v[0] + 1) / 2 * (xRange[1] - xRange[0]),
      yRange[0] + (v[1] + 1) / 2 * (yRange[1] - yRange[0]),
      zRange[0] + (v[2] + 1) / 2 * (zRange[1] - zRange[0]),
    ];
    const from = mapBack(axis.from);
    const to = mapBack(axis.to);
    const [sx1, sy1] = project(from[0], from[1], from[2]);
    const [sx2, sy2] = project(to[0], to[1], to[2]);
    ctx.strokeStyle = axis.color;
    ctx.beginPath();
    ctx.moveTo(sx1, sy1);
    ctx.lineTo(sx2, sy2);
    ctx.stroke();
    // Label
    ctx.fillStyle = axis.color;
    ctx.font = 'bold 13px "Inter", sans-serif';
    ctx.fillText(axis.label, sx2 + 5, sy2 - 5);
  }
  ctx.globalAlpha = 1;

  // Render surface for each 3D expression
  const gridSize = 40;
  for (const expr of expressions) {
    if (!expr.visible || expr.type !== '3d') continue;

    const xStep = (xRange[1] - xRange[0]) / gridSize;
    const yStep = (yRange[1] - yRange[0]) / gridSize;

    // Collect grid points
    const points: (number | null)[][] = [];
    for (let i = 0; i <= gridSize; i++) {
      points[i] = [];
      const x = xRange[0] + i * xStep;
      for (let j = 0; j <= gridSize; j++) {
        const y = yRange[0] + j * yStep;
        try {
          const z = evaluateExpression(expr.expr, { x, y, X: x, Y: y, ...MATH_CONSTANTS });
          if (!isFinite(z) || z < zRange[0] * 2 || z > zRange[1] * 2) {
            points[i][j] = null;
          } else {
            points[i][j] = z;
          }
        } catch {
          points[i][j] = null;
        }
      }
    }

    // Draw wireframe
    ctx.strokeStyle = expr.color;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.6;

    // Lines along x direction
    for (let j = 0; j <= gridSize; j += 2) {
      ctx.beginPath();
      let started = false;
      const y = yRange[0] + j * yStep;
      for (let i = 0; i <= gridSize; i++) {
        const z = points[i][j];
        if (z === null) { started = false; continue; }
        const x = xRange[0] + i * xStep;
        const [sx, sy] = project(x, y, z);
        if (!started) { ctx.moveTo(sx, sy); started = true; }
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    // Lines along y direction
    for (let i = 0; i <= gridSize; i += 2) {
      ctx.beginPath();
      let started = false;
      const x = xRange[0] + i * xStep;
      for (let j = 0; j <= gridSize; j++) {
        const z = points[i][j];
        if (z === null) { started = false; continue; }
        const y = yRange[0] + j * yStep;
        const [sx, sy] = project(x, y, z);
        if (!started) { ctx.moveTo(sx, sy); started = true; }
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Title
  if (config.title) {
    ctx.fillStyle = colors.text;
    ctx.font = 'bold 14px "Inter", "SF Pro", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(config.title, width / 2, 24);
    ctx.textAlign = 'start';
  }

  // Expression legend
  let legendY = height - 20;
  ctx.font = '11px "Inter", sans-serif';
  for (const expr of expressions) {
    if (!expr.visible) continue;
    ctx.fillStyle = expr.color;
    ctx.fillRect(12, legendY - 8, 14, 3);
    ctx.fillStyle = colors.text;
    ctx.globalAlpha = 0.8;
    ctx.fillText(expr.label || expr.raw, 32, legendY);
    ctx.globalAlpha = 1;
    legendY -= 18;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function calculateGridStep(range: number): number {
  const rawStep = range / 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function formatAxisNumber(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  const s = n.toFixed(2);
  return s.replace(/\.?0+$/, '');
}
