export type Position = Readonly<{ x: number; y: number }>;
export type Move = 0 | 1 | 2 | 3;

export type LevelDefinition = Readonly<{
  id: number;
  name: string;
  width: number;
  height: number;
  floor: ReadonlySet<number>;
  goals: readonly Position[];
  player: Position;
  boxes: readonly Position[];
  verifiedMinimumMoves: number;
}>;

export type GameState = Readonly<{
  levelId: number;
  player: Position;
  boxes: readonly Position[];
  goals: readonly Position[];
  moves: number;
  history: readonly Move[];
  solved: boolean;
}>;

const RAW_LEVELS = [
  { id: 1, name: 'First Push', minimum: 6, map: ['#######', '#     #', '# ##. #', '#  $  #', '#@    #', '#     #', '#######'] },
  { id: 2, name: 'Around the Pillar', minimum: 15, map: ['#######', '#  .  #', '#  #  #', '#  $  #', '# # @ #', '#     #', '#######'] },
  { id: 3, name: 'Long Route', minimum: 23, map: ['#######', '#  .  #', '#   @ #', '#  ## #', '#  $  #', '#  #  #', '#######'] },
  { id: 4, name: 'Winding Path', minimum: 20, map: ['#######', '#    ##', '## #@ #', '#   # #', '# # $ #', '#   . #', '#######'] },
  { id: 5, name: 'Crossroads', minimum: 21, map: ['#######', '##   ##', '# $@  #', '#  #  #', '##   .#', '# #   #', '#######'] },
  { id: 6, name: 'Narrow Return', minimum: 21, map: ['#######', '#   .##', '#  @###', '#  $  #', '## # ##', '#     #', '#######'] },
  { id: 7, name: 'Two-Box Planning', minimum: 41, map: ['  ####', '###  ####', '#     $ #', '# #  #$ #', '# . .#@ #', '#########'] },
  { id: 8, name: 'Tight Corners', minimum: 50, map: ['######', '#   .#', '# ## ##', '#  $$@#', '# #   #', '#.  ###', '#####'] },
] as const;

function toIndex(x: number, y: number, width: number): number {
  return y * width + x;
}

function parseLevel(raw: (typeof RAW_LEVELS)[number]): LevelDefinition {
  const width = Math.max(...raw.map.map((row) => row.length));
  const height = raw.map.length;
  const floor = new Set<number>();
  const goals: Position[] = [];
  const boxes: Position[] = [];
  let player: Position | undefined;

  raw.map.forEach((row, y) => {
    for (let x = 0; x < width; x++) {
      const tile = row[x] ?? '#';
      if (tile === '#') continue;
      floor.add(toIndex(x, y, width));
      if (tile === '.') goals.push({ x, y });
      if (tile === '$') boxes.push({ x, y });
      if (tile === '@') player = { x, y };
    }
  });

  if (!player || boxes.length === 0 || boxes.length !== goals.length) throw new Error(`Invalid level ${raw.id}`);
  return { id: raw.id, name: raw.name, width, height, floor, goals, player, boxes, verifiedMinimumMoves: raw.minimum };
}

export const LEVELS = RAW_LEVELS.map(parseLevel);

const DELTAS: Record<Move, Position> = {
  0: { x: 0, y: -1 },
  1: { x: 1, y: 0 },
  2: { x: 0, y: 1 },
  3: { x: -1, y: 0 },
};

export function getLevel(levelId: number): LevelDefinition {
  const level = LEVELS.find((candidate) => candidate.id === levelId);
  if (!level) throw new Error('Invalid level');
  return level;
}

export function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

export function isWalkable(level: LevelDefinition, position: Position): boolean {
  return level.floor.has(toIndex(position.x, position.y, level.width));
}

export function createInitialState(levelId = 1): GameState {
  const level = getLevel(levelId);
  return { levelId, player: level.player, boxes: level.boxes.map((box) => ({ ...box })), goals: level.goals, moves: 0, history: [], solved: false };
}

export function applyMove(state: GameState, move: number): GameState {
  if (!(move in DELTAS)) throw new Error('Invalid move');
  if (state.solved) return state;

  const level = getLevel(state.levelId);
  const delta = DELTAS[move as Move];
  const nextPlayer = { x: state.player.x + delta.x, y: state.player.y + delta.y };
  if (!isWalkable(level, nextPlayer)) return state;

  const pushedIndex = state.boxes.findIndex((box) => samePosition(box, nextPlayer));
  let nextBoxes = state.boxes;
  if (pushedIndex !== -1) {
    const pushedBox = { x: nextPlayer.x + delta.x, y: nextPlayer.y + delta.y };
    if (!isWalkable(level, pushedBox) || state.boxes.some((box, index) => index !== pushedIndex && samePosition(box, pushedBox))) return state;
    nextBoxes = state.boxes.map((box, index) => index === pushedIndex ? pushedBox : box);
  }

  const solved = nextBoxes.every((box) => state.goals.some((goal) => samePosition(box, goal)));
  return { levelId: state.levelId, player: nextPlayer, boxes: nextBoxes, goals: state.goals, moves: state.moves + 1, history: [...state.history, move as Move], solved };
}

export function replayMoves(moves: readonly number[], levelId = 1): GameState {
  return moves.reduce((state, move) => applyMove(state, move), createInitialState(levelId));
}
