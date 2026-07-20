export const APP_TYPES = ["generic", "calculator", "snake"];

export const CALCULATOR_KEYS = [
  "C", "±", "%", "÷",
  "7", "8", "9", "×",
  "4", "5", "6", "−",
  "1", "2", "3", "+",
  "0", ".", "⌫", "="
];

const finiteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const formatNumber = (value) => {
  if (!Number.isFinite(value)) return "错误";
  const rounded = Math.abs(value) < 1e-12 ? 0 : Number(value.toPrecision(12));
  return String(rounded).slice(0, 16);
};

export function initialCalculatorState() {
  return { display: "0", accumulator: null, operator: null, waitingForOperand: false, history: [] };
}

export function normalizeCalculatorState(value) {
  const fallback = initialCalculatorState();
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  return {
    display: typeof value.display === "string" ? value.display.slice(0, 16) : fallback.display,
    accumulator: value.accumulator === null ? null : finiteNumber(value.accumulator, null),
    operator: ["+", "−", "×", "÷"].includes(value.operator) ? value.operator : null,
    waitingForOperand: value.waitingForOperand === true,
    history: Array.isArray(value.history) ? value.history.filter((item) => typeof item === "string").slice(-4) : []
  };
}

function calculate(left, right, operator) {
  if (operator === "+") return left + right;
  if (operator === "−") return left - right;
  if (operator === "×") return left * right;
  if (operator === "÷") return right === 0 ? Number.NaN : left / right;
  return right;
}

export function reduceCalculator(value, key) {
  const state = normalizeCalculatorState(value);
  if (key === "C") return initialCalculatorState();
  if (/^\d$/.test(key)) {
    const display = state.waitingForOperand || state.display === "0" || state.display === "错误" ? key : `${state.display}${key}`.slice(0, 16);
    return { ...state, display, waitingForOperand: false };
  }
  if (key === ".") {
    const display = state.waitingForOperand ? "0." : state.display.includes(".") ? state.display : `${state.display}.`;
    return { ...state, display, waitingForOperand: false };
  }
  if (key === "⌫") {
    if (state.waitingForOperand || state.display === "错误") return { ...state, display: "0" };
    return { ...state, display: state.display.length > 1 ? state.display.slice(0, -1) : "0" };
  }
  if (key === "±") {
    if (state.display === "0" || state.display === "错误") return state;
    return { ...state, display: state.display.startsWith("-") ? state.display.slice(1) : `-${state.display}` };
  }
  if (key === "%") return { ...state, display: formatNumber(finiteNumber(state.display) / 100), waitingForOperand: false };
  if (["+", "−", "×", "÷"].includes(key)) {
    const current = finiteNumber(state.display);
    const accumulator = state.accumulator === null || state.waitingForOperand ? current : calculate(state.accumulator, current, state.operator);
    return { ...state, display: formatNumber(accumulator), accumulator, operator: key, waitingForOperand: true };
  }
  if (key === "=" && state.operator && state.accumulator !== null) {
    const right = finiteNumber(state.display);
    const result = calculate(state.accumulator, right, state.operator);
    const display = formatNumber(result);
    const history = [...state.history, `${formatNumber(state.accumulator)} ${state.operator} ${formatNumber(right)} = ${display}`].slice(-4);
    return { display, accumulator: null, operator: null, waitingForOperand: true, history };
  }
  return state;
}

export function initialSnakeState() {
  return { boardSize: 12, snake: [62, 61, 60], food: 68, direction: "right", status: "idle", score: 0, highScore: 0 };
}

export function normalizeSnakeState(value) {
  const fallback = initialSnakeState();
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const boardSize = 12;
  const maxCell = boardSize * boardSize;
  const snake = Array.isArray(value.snake) ? value.snake.filter((cell) => Number.isInteger(cell) && cell >= 0 && cell < maxCell).slice(0, maxCell) : fallback.snake;
  return {
    boardSize,
    snake: snake.length ? snake : fallback.snake,
    food: Number.isInteger(value.food) && value.food >= 0 && value.food < maxCell ? value.food : fallback.food,
    direction: ["up", "down", "left", "right"].includes(value.direction) ? value.direction : fallback.direction,
    status: ["idle", "running", "paused", "over"].includes(value.status) ? value.status : fallback.status,
    score: Math.max(0, Math.floor(finiteNumber(value.score))),
    highScore: Math.max(0, Math.floor(finiteNumber(value.highScore)))
  };
}

const oppositeDirection = { up: "down", down: "up", left: "right", right: "left" };

function nextFood(snake, boardSize, random) {
  const empty = Array.from({ length: boardSize * boardSize }, (_, index) => index).filter((cell) => !snake.includes(cell));
  if (!empty.length) return -1;
  const index = Math.min(empty.length - 1, Math.floor(Math.max(0, Math.min(.999999, random())) * empty.length));
  return empty[index];
}

export function reduceSnake(value, action, random = Math.random) {
  const state = normalizeSnakeState(value);
  if (action === "reset") return { ...initialSnakeState(), highScore: state.highScore };
  if (action === "toggle") {
    if (state.status === "running") return { ...state, status: "paused" };
    if (state.status === "over") return { ...initialSnakeState(), highScore: state.highScore, status: "running" };
    return { ...state, status: "running" };
  }
  if (["up", "down", "left", "right"].includes(action)) {
    return oppositeDirection[state.direction] === action ? state : { ...state, direction: action };
  }
  if (action !== "tick" || state.status !== "running") return state;

  const head = state.snake[0];
  const row = Math.floor(head / state.boardSize);
  const column = head % state.boardSize;
  const nextRow = row + (state.direction === "down" ? 1 : state.direction === "up" ? -1 : 0);
  const nextColumn = column + (state.direction === "right" ? 1 : state.direction === "left" ? -1 : 0);
  const hitWall = nextRow < 0 || nextRow >= state.boardSize || nextColumn < 0 || nextColumn >= state.boardSize;
  if (hitWall) return { ...state, status: "over", highScore: Math.max(state.highScore, state.score) };
  const nextHead = nextRow * state.boardSize + nextColumn;
  const grows = nextHead === state.food;
  const bodyToCheck = grows ? state.snake : state.snake.slice(0, -1);
  if (bodyToCheck.includes(nextHead)) return { ...state, status: "over", highScore: Math.max(state.highScore, state.score) };
  const snake = [nextHead, ...state.snake];
  if (!grows) snake.pop();
  const score = state.score + (grows ? 1 : 0);
  return {
    ...state,
    snake,
    food: grows ? nextFood(snake, state.boardSize, random) : state.food,
    score,
    highScore: Math.max(state.highScore, score),
    status: snake.length === state.boardSize * state.boardSize ? "over" : state.status
  };
}
