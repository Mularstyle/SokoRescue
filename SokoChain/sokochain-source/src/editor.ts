// Pure map-editor operations on Sokoban rows ('#', ' ', '.', '$', '*', '@', '+').
import { MAX_BOXES, encodeRows, validateLevel } from './levelCodec';

export type Tool = 'wall' | 'water' | 'ring' | 'crate' | 'boat';

const GOAL_OF: Record<string, string> = { ' ': '.', '$': '*', '@': '+', '#': '.' };
const NO_GOAL: Record<string, string> = { '.': ' ', '*': '$', '+': '@' };
const isGoal = (cell: string) => cell === '.' || cell === '*' || cell === '+';

export function blankMap(width: number, height: number): string[] {
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      if (y === 0 || x === 0 || y === height - 1 || x === width - 1) return '#';
      return x === 1 && y === 1 ? '@' : ' ';
    }).join(''),
  );
}

function setCell(rows: readonly string[], x: number, y: number, cell: string): string[] {
  return rows.map((row, rowY) => (rowY === y ? row.slice(0, x) + cell + row.slice(x + 1) : row));
}

function withoutBoat(rows: readonly string[]): string[] {
  return rows.map((row) => row.replace('@', ' ').replace('+', '.'));
}

export function paint(rows: readonly string[], x: number, y: number, tool: Tool): string[] {
  const cell = rows[y]?.[x];
  if (cell === undefined) return [...rows];
  switch (tool) {
    case 'wall':
      return cell === '@' || cell === '+' ? [...rows] : setCell(rows, x, y, '#');
    case 'water':
      return cell === '@' || cell === '+' ? [...rows] : setCell(rows, x, y, ' ');
    case 'ring':
      return setCell(rows, x, y, isGoal(cell) ? NO_GOAL[cell] : GOAL_OF[cell]);
    case 'crate':
      if (cell === '@' || cell === '+') return [...rows];
      return setCell(rows, x, y, isGoal(cell) ? '*' : '$');
    case 'boat': {
      const cleared = withoutBoat(rows);
      return setCell(cleared, x, y, isGoal(cleared[y][x]) ? '+' : '@');
    }
  }
}

/** Crop or pad with walls. If the boat is cropped away it moves to the first water cell. */
export function resize(rows: readonly string[], width: number, height: number): string[] {
  let next = Array.from({ length: height }, (_, y) => (rows[y] ?? '').padEnd(width, '#').slice(0, width));
  if (!next.some((row) => row.includes('@') || row.includes('+'))) {
    const y = next.findIndex((row) => row.includes(' '));
    if (y >= 0) next = setCell(next, next[y].indexOf(' '), y, '@');
  }
  return next;
}

const MESSAGES: Record<string, string> = {
  'Bad size': 'Map must be 3–10 cells wide and tall.',
  'Bad floor': 'Map has cells outside the grid.',
  'Off floor': 'Crates and rings must sit on water.',
  'Bad player': 'Place the rescue boat on water.',
  'Bad boxes': `Use 1–${MAX_BOXES} crates and the same number of rescue rings.`,
  'Already solved': 'Every crate is already on a ring — move one off.',
};

/** Null when the map can be posted; otherwise a player-facing hint. */
export function describeProblem(rows: readonly string[]): string | null {
  if (!rows.some((row) => row.includes('@') || row.includes('+'))) return MESSAGES['Bad player'];
  const problem = validateLevel(encodeRows(rows));
  return problem ? MESSAGES[problem] : null;
}
