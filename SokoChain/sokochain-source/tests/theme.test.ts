import { describe, expect, it } from 'vitest';
import { floodTileClasses } from '../src/theme';

describe('SokoRescue flood theme', () => {
  it('maps the player, supply crate, and rescue destination to their visual roles', () => {
    expect(floodTileClasses({ player: true, box: false, goal: false, blocked: false })).toEqual(['tile', 'pixel-sprite', 'water', 'boat', 'boat-craft']);
    expect(floodTileClasses({ player: false, box: true, goal: false, blocked: false })).toEqual(['tile', 'pixel-sprite', 'water', 'supply', 'supply-crate']);
    expect(floodTileClasses({ player: false, box: false, goal: true, blocked: false })).toEqual(['tile', 'pixel-sprite', 'water', 'survivor', 'rescue-point', 'gps-pin']);
  });

  it('marks impassable cells as flooded obstacles', () => {
    expect(floodTileClasses({ player: false, box: false, goal: false, blocked: true })).toEqual(['tile', 'pixel-sprite', 'obstacle', 'roof']);
  });
});
