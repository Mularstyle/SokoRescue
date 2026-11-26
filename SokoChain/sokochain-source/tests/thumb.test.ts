import { describe, expect, it } from 'vitest';
import { decodeLevel, encodeRows } from '../src/levelCodec';
import { thumbCells } from '../src/thumb';

describe('bounty card map thumbnail', () => {
  it('marks walls, water, rings, crates, crates on rings and the boat', () => {
    const level = decodeLevel(encodeRows(['#####', '#@$.#', '#*  #', '#####']), 1000, 'x');
    expect(thumbCells(level)).toEqual([
      'w', 'w', 'w', 'w', 'w',
      'w', 'p', 'b', 'g', 'w',
      'w', 'bg', '', '', 'w',
      'w', 'w', 'w', 'w', 'w',
    ]);
  });
});
