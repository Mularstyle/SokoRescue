import { describe, expect, it } from 'vitest';
import { applyMove, createInitialState, LEVELS, replayMoves } from '../src/game';

const moveFromLetter: Record<string, number> = { U: 0, R: 1, D: 2, L: 3 };

const canonicalSolutions = [
  'URRDRU',
  'UUULLDDRDRUURUL',
  'RDDLLRRUULLLDLDDRUUULUR',
  'RDDLDLLLUURRDULLDDRR',
  'RDDLLULURRURDDULLDDRR',
  'LDDDRRUULRDDLLUUULURR',
  'RUULLLULDRRRRDDLURULLLDDLLLUURRDRDLUUURDD',
  'DLULDDLLUUUURRRDULLLDDDDRRUULRDRRULUULLLDDDURRDRUU',
];

describe('SokoChain game rules', () => {
  it('defines eight selectable levels with three medium levels before the two-box challenge', () => {
    expect(LEVELS).toHaveLength(8);
    expect(LEVELS.map((level) => level.verifiedMinimumMoves)).toEqual([6, 15, 23, 20, 21, 21, 41, 50]);
    expect(LEVELS.slice(0, 6).map((level) => level.boxes.length)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(LEVELS.slice(6).map((level) => level.boxes.length)).toEqual([2, 2]);
  });

  it.each(canonicalSolutions.map((route, index) => [index + 1, route] as const))(
    'solves level %i with its canonical route',
    (levelId, route) => {
      const result = replayMoves([...route].map((letter) => moveFromLetter[letter]), levelId);
      expect(result.solved).toBe(true);
      expect(result.moves).toBe(route.length);
      expect(result.boxes.every((box) => result.goals.some((goal) => goal.x === box.x && goal.y === box.y))).toBe(true);
    },
  );

  it('keeps the selected level when resetting its state', () => {
    const moved = applyMove(createInitialState(3), 1);
    const reset = createInitialState(moved.levelId);
    expect(reset.levelId).toBe(3);
    expect(reset.moves).toBe(0);
    expect(reset.history).toEqual([]);
  });

  it('does not move through a wall', () => {
    const initial = createInitialState(1);
    expect(applyMove(initial, 3)).toEqual(initial);
  });

  it('does not push one box into another box', () => {
    const level = LEVELS[6];
    const state = {
      ...createInitialState(7),
      player: { x: 5, y: 3 },
      boxes: [{ x: 6, y: 3 }, { x: 7, y: 3 }],
    };
    expect(level.boxes).toHaveLength(2);
    expect(applyMove(state, 1)).toEqual(state);
  });

  it('rejects unknown move values', () => {
    expect(() => replayMoves([4], 1)).toThrow('Invalid move');
  });
});
