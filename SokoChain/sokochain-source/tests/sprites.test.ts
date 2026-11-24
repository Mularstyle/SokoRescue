import { describe, expect, it } from 'vitest';
import { PALETTE, SPRITES, installSprites, toDataUrl, toSvg, type Sprite } from '../src/sprites';

const opaquePixels = (sprite: Sprite) => sprite.rows.join('').split('').filter((char) => char !== '.').length;

describe('pixel sprites', () => {
  it.each(Object.entries(SPRITES))('%s is a rectangle drawn only with palette colours', (_name, sprite) => {
    expect(sprite.rows.length).toBe(sprite.height);
    for (const [index, row] of sprite.rows.entries()) {
      expect(row.length, `row ${index}: "${row}"`).toBe(sprite.width);
      for (const char of row) expect(char === '.' || char in PALETTE, `char "${char}"`).toBe(true);
    }
    expect(opaquePixels(sprite)).toBeGreaterThan(0);
  });

  it('renders crisp SVG whose rects cover exactly the opaque pixels', () => {
    for (const sprite of Object.values(SPRITES)) {
      const svg = toSvg(sprite);
      expect(svg).toContain(`viewBox='0 0 ${sprite.width} ${sprite.height}'`);
      expect(svg).toContain("shape-rendering='crispEdges'");
      const area = [...svg.matchAll(/width='(\d+)' height='1'/g)].reduce((sum, match) => sum + Number(match[1]), 0);
      expect(area).toBe(opaquePixels(sprite));
    }
  });

  it('uses a black/red palette (every colour has red >= green and red >= blue)', () => {
    const neutralsAllowed = new Set(['9', 'a']);
    for (const [char, hex] of Object.entries(PALETTE)) {
      if (neutralsAllowed.has(char)) continue;
      const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
      expect(r >= g && r >= b, `${char} ${hex}`).toBe(true);
    }
  });

  it('installs every sprite as a CSS custom property', () => {
    installSprites(document.documentElement);
    for (const name of Object.keys(SPRITES)) {
      expect(document.documentElement.style.getPropertyValue(`--spr-${name}`)).toBe(`url("${toDataUrl(SPRITES[name as keyof typeof SPRITES])}")`);
    }
  });
});
