// On-chain level format (mirrors SokoChain.Level): up to 10x10 cells as 128-bit boards.
// Cell index = y * width + x. Rows use classic Sokoban notation:
// '#' wall, ' ' water, '.' rescue point, '$' crate, '*' crate on rescue point, '@' boat, '+' boat on rescue point.
import { encodeAbiParameters, keccak256 } from 'viem';
import type { LevelDefinition, Position } from './game';

export const MAX_SIZE = 10;
export const MIN_SIZE = 3;
export const MAX_BOXES = 6;

export type OnchainLevel = {
  floor: bigint;
  goals: bigint;
  boxes: bigint;
  width: number;
  height: number;
  player: number;
};

export const LEVEL_TUPLE = {
  type: 'tuple',
  components: [
    { name: 'floor', type: 'uint128' },
    { name: 'goals', type: 'uint128' },
    { name: 'boxes', type: 'uint128' },
    { name: 'width', type: 'uint8' },
    { name: 'height', type: 'uint8' },
    { name: 'player', type: 'uint8' },
  ],
} as const;

const bit = (index: number) => 1n << BigInt(index);
const has = (board: bigint, index: number) => ((board >> BigInt(index)) & 1n) === 1n;

function popcount(board: bigint): number {
  let count = 0;
  for (let rest = board; rest > 0n; rest &= rest - 1n) count++;
  return count;
}

export function encodeRows(rows: readonly string[]): OnchainLevel {
  const height = rows.length;
  const width = Math.max(...rows.map((row) => row.length));
  const level: OnchainLevel = { floor: 0n, goals: 0n, boxes: 0n, width, height, player: 0 };
  rows.forEach((row, y) => {
    for (let x = 0; x < width; x++) {
      const tile = row[x] ?? '#';
      if (tile === '#') continue;
      const index = y * width + x;
      level.floor |= bit(index);
      if (tile === '.' || tile === '*' || tile === '+') level.goals |= bit(index);
      if (tile === '$' || tile === '*') level.boxes |= bit(index);
      if (tile === '@' || tile === '+') level.player = index;
    }
  });
  return level;
}

export function levelToRows(level: OnchainLevel): string[] {
  const rows: string[] = [];
  for (let y = 0; y < level.height; y++) {
    let row = '';
    for (let x = 0; x < level.width; x++) {
      const index = y * level.width + x;
      const goal = has(level.goals, index);
      if (!has(level.floor, index)) row += '#';
      else if (index === level.player) row += goal ? '+' : '@';
      else if (has(level.boxes, index)) row += goal ? '*' : '$';
      else row += goal ? '.' : ' ';
    }
    rows.push(row);
  }
  return rows;
}

export function encodeDefinition(definition: LevelDefinition): OnchainLevel {
  const index = (position: Position) => position.y * definition.width + position.x;
  let floor = 0n;
  for (const cell of definition.floor) floor |= bit(cell);
  return {
    floor,
    goals: definition.goals.reduce((board, position) => board | bit(index(position)), 0n),
    boxes: definition.boxes.reduce((board, position) => board | bit(index(position)), 0n),
    width: definition.width,
    height: definition.height,
    player: index(definition.player),
  };
}

export function decodeLevel(level: OnchainLevel, id: number, name: string): LevelDefinition {
  const floor = new Set<number>();
  const goals: Position[] = [];
  const boxes: Position[] = [];
  const cells = level.width * level.height;
  for (let index = 0; index < cells; index++) {
    const position = { x: index % level.width, y: Math.floor(index / level.width) };
    if (has(level.floor, index)) floor.add(index);
    if (has(level.goals, index)) goals.push(position);
    if (has(level.boxes, index)) boxes.push(position);
  }
  return {
    id,
    name,
    width: level.width,
    height: level.height,
    floor,
    goals,
    boxes,
    player: { x: level.player % level.width, y: Math.floor(level.player / level.width) },
    verifiedMinimumMoves: 0,
  };
}

/** Same rules and messages as SokoChain._validateLevel. Returns null when valid. */
export function validateLevel(level: OnchainLevel): string | null {
  const { width, height } = level;
  if (width < MIN_SIZE || width > MAX_SIZE || height < MIN_SIZE || height > MAX_SIZE) return 'Bad size';
  const cells = width * height;
  const mask = bit(cells) - 1n;
  if ((level.floor & ~mask) !== 0n) return 'Bad floor';
  if ((level.goals & ~level.floor) !== 0n || (level.boxes & ~level.floor) !== 0n) return 'Off floor';
  if (level.player >= cells || !has(level.floor, level.player) || has(level.boxes, level.player)) return 'Bad player';
  const boxCount = popcount(level.boxes);
  if (boxCount < 1 || boxCount > MAX_BOXES || boxCount !== popcount(level.goals)) return 'Bad boxes';
  if (level.boxes === level.goals) return 'Already solved';
  return null;
}

/** Key the creator's commit is bound to for a custom map: uint256(keccak256(abi.encode(level))). */
export function customLevelKey(level: OnchainLevel): bigint {
  return BigInt(keccak256(encodeAbiParameters([LEVEL_TUPLE], [level])));
}
