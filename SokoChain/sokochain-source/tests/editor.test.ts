import { describe, expect, it } from 'vitest';
import { blankMap, describeProblem, paint, resize } from '../src/editor';

describe('map editor', () => {
  it('starts as a walled map with the boat inside', () => {
    expect(blankMap(5, 4)).toEqual(['#####', '#@  #', '#   #', '#####']);
  });

  it('paints walls and water', () => {
    expect(paint(['   '], 1, 0, 'wall')).toEqual([' # ']);
    expect(paint([' # '], 1, 0, 'water')).toEqual(['   ']);
  });

  it('stacks crates and boat on rescue rings', () => {
    let rows = paint(['   '], 0, 0, 'ring');
    expect(rows).toEqual(['.  ']);
    rows = paint(rows, 0, 0, 'crate');
    expect(rows).toEqual(['*  ']);
    rows = paint(rows, 0, 0, 'ring'); // ring tool toggles the ring off again
    expect(rows).toEqual(['$  ']);
  });

  it('keeps exactly one boat', () => {
    let rows = paint(['@ .'], 2, 0, 'boat');
    expect(rows).toEqual(['  +']);
    rows = paint(rows, 0, 0, 'boat');
    expect(rows).toEqual(['@ .']);
  });

  it('does not let a crate overwrite the boat', () => {
    expect(paint(['@  '], 0, 0, 'crate')).toEqual(['@  ']);
  });

  it('resizes by cropping or padding with walls, keeping the boat', () => {
    expect(resize(['#####', '#@ $#', '#####'], 3, 4)).toEqual(['###', '#@ ', '###', '###']);
    expect(resize(['###', '# @'], 3, 2)).toEqual(['###', '# @']);
    expect(resize(['####', '#  @'], 3, 3)).toEqual(['###', '#@ ', '###']);
  });

  it('explains what is wrong in player terms', () => {
    expect(describeProblem(['#####', '#   #', '#####'])).toMatch(/boat/i);
    expect(describeProblem(['#####', '#@  #', '#####'])).toMatch(/crate/i);
    expect(describeProblem(['#####', '#@$.#', '#####'])).toBeNull();
    expect(describeProblem(['#####', '#@* #', '#####'])).toMatch(/already/i);
  });
});
