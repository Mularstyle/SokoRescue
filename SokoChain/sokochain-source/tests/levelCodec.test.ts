import { describe, expect, it } from 'vitest';
import { LEVELS, createInitialState, getLevel, registerLevel, replayMoves } from '../src/game';
import { decodeLevel, encodeDefinition, encodeRows, levelToRows, validateLevel, MAX_BOXES } from '../src/levelCodec';

export const TEN_BY_TEN = [
  '##########',
  '#        #',
  '# @ $  . #',
  '#        #',
  '#   $  . #',
  '#        #',
  '#  $   . #',
  '#        #',
  '#        #',
  '##########',
];
export const TEN_BY_TEN_ROUTE = 'RRRRDLLLDRRRDLLLLDRRRR';

const toMoves = (route: string) => [...route].map((char) => ({ U: 0, R: 1, D: 2, L: 3 })[char as 'U']);

describe('level codec', () => {
  it('encodes a 10x10 map into 100-bit boards', () => {
    const level = encodeRows(TEN_BY_TEN);
    expect(level).toMatchObject({ width: 10, height: 10, player: 22 });
    expect(level.boxes).toBe((1n << 24n) | (1n << 44n) | (1n << 63n));
    expect(level.goals).toBe((1n << 27n) | (1n << 47n) | (1n << 67n));
    expect(level.floor >> 100n).toBe(0n);
    expect(validateLevel(level)).toBeNull();
  });

  it('round-trips rows and decodes into a playable level', () => {
    const level = encodeRows(TEN_BY_TEN);
    expect(levelToRows(level)).toEqual(TEN_BY_TEN);
    const definition = decodeLevel(level, 1001, 'Custom #1');
    registerLevel(definition);
    expect(getLevel(1001)).toBe(definition);
    expect(createInitialState(1001).boxes).toHaveLength(3);
    expect(replayMoves(toMoves(TEN_BY_TEN_ROUTE), 1001).solved).toBe(true);
  });

  it('re-encodes every preset level losslessly', () => {
    for (const definition of LEVELS) {
      const decoded = decodeLevel(encodeDefinition(definition), definition.id, definition.name);
      expect(decoded.floor).toEqual(definition.floor);
      expect(decoded.boxes).toEqual(definition.boxes);
      expect(decoded.goals).toEqual(definition.goals);
      expect(decoded.player).toEqual(definition.player);
    }
  });

  it.each([
    ['too wide', () => ({ ...encodeRows(TEN_BY_TEN), width: 11 }), 'Bad size'],
    ['floor outside the grid', () => ({ ...encodeRows(TEN_BY_TEN), floor: encodeRows(TEN_BY_TEN).floor | (1n << 100n) }), 'Bad floor'],
    ['box on a wall', () => ({ ...encodeRows(TEN_BY_TEN), boxes: encodeRows(TEN_BY_TEN).boxes | 1n, goals: encodeRows(TEN_BY_TEN).goals | (1n << 11n) }), 'Off floor'],
    ['player on a wall', () => ({ ...encodeRows(TEN_BY_TEN), player: 0 }), 'Bad player'],
    ['box and goal counts differ', () => ({ ...encodeRows(TEN_BY_TEN), goals: 1n << 27n }), 'Bad boxes'],
    ['already solved', () => ({ ...encodeRows(TEN_BY_TEN), boxes: encodeRows(TEN_BY_TEN).goals }), 'Already solved'],
  ])('rejects %s', (_name, make, reason) => {
    expect(validateLevel(make())).toBe(reason);
  });

  it(`rejects more than ${MAX_BOXES} boxes`, () => {
    const rows = ['##########', '#@$$$$$$$#', '#........#', '##########'];
    expect(validateLevel(encodeRows(rows))).toBe('Bad boxes');
  });
});
