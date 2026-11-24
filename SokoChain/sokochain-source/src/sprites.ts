// Code-drawn pixel art for SokoRescue (black/red "night flood under emergency flares").
// Each sprite is a grid of palette characters; '.' is transparent.
// Sprites are converted to crisp SVG data URLs and exposed as CSS custom properties (--spr-<name>).

export const PALETTE = {
  '0': '#0a0306', // void
  '1': '#160a10', // ink / outline
  '2': '#2a0e17', // night water
  '3': '#4a111f', // deep red
  '4': '#7d1527', // blood
  '5': '#b81d36', // red
  '6': '#e8334a', // hot red
  '7': '#ff6b6b', // coral
  '8': '#ffb199', // flare glow
  '9': '#f6e7dd', // bone
  a: '#9b7f83', // ash
  b: '#3d2a30', // wood shadow
  c: '#6e4a3c', // wood
  d: '#a8705a', // light wood
} as const;

export type PaletteKey = keyof typeof PALETTE;
export type Sprite = Readonly<{ width: number; height: number; rows: readonly string[] }>;

function sprite(rows: readonly string[]): Sprite {
  return { width: rows[0].length, height: rows.length, rows };
}

/** Build a sprite from a function of (x, y) -> palette char. */
function draw(width: number, height: number, pixel: (x: number, y: number) => string): Sprite {
  const rows: string[] = [];
  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) row += pixel(x, y);
    rows.push(row);
  }
  return sprite(rows);
}

// --- Tiles (16x16) ----------------------------------------------------------

/** Night flood water with red flare reflections; two frames for a 2-step shimmer. */
function water(shift: number): Sprite {
  const ripples: [number, number, number][] = [[2, 2, 3], [11, 5, 3], [3, 9, 3], [10, 13, 3]];
  return draw(16, 16, (x, y) => {
    for (const [rx, ry, length] of ripples) {
      const sx = (rx + shift) % 16;
      if (y === ry && x >= sx && x < sx + length) return '3';
      if (y === ry + 1 && x >= sx + length && x < sx + length + 2) return shift ? '5' : '4';
    }
    return '2';
  });
}

/** Flooded rooftop: dark shingles lit red from below. Used for walls. */
const wall = draw(16, 16, (x, y) => {
  if (y === 0 || x === 0) return '4';
  if (y === 15 || x === 15) return '0';
  const band = Math.floor((y - 1) / 4);
  const offset = band % 2 === 0 ? 0 : 3;
  if ((y - 1) % 4 === 3) return '1';
  if ((x + offset) % 6 === 0) return '1';
  return (y - 1) % 4 === 0 ? '4' : '3';
});

const crateRows = [
  '................',
  '.11111111111111.',
  '.1dddddddddddd1.',
  '.1dc99999999cd1.',
  '.1dc99966999cd1.',
  '.1dc96666669cd1.',
  '.1dc96666669cd1.',
  '.1dc99966999cd1.',
  '.1dc99999999cd1.',
  '.1dddddddddddd1.',
  '.1cccccccccccc1.',
  '.1dddddddddddd1.',
  '.1cccccccccccc1.',
  '.1bbbbbbbbbbbb1.',
  '.11111111111111.',
  '................',
];

/** Supply crate with a medical cross. */
const crate = sprite(crateRows);

/** Crate delivered onto a rescue point: outline glows with flare light. */
const crateGoal = sprite(crateRows.map((row) => row.replace(/1/g, '8')));

/** Red/white life ring marking a rescue point (drawn with circle maths). */
const buoy = draw(16, 16, (x, y) => {
  const dx = x - 7.5;
  const dy = y - 7.5;
  const distance = Math.hypot(dx, dy);
  if (distance > 6.6 || distance < 2.4) return '.';
  if (distance > 5.8 || distance < 3.2) return '1';
  const angle = (Math.atan2(dy, dx) + Math.PI) / (Math.PI / 2); // 0..4 quadrants
  return Math.floor(angle + 0.5) % 2 === 0 ? '6' : '9';
});

/** Top-down rescue boat (the player), bow pointing up, rider in a red life vest. */
const boat = sprite([
  '................',
  '.......11.......',
  '......1991......',
  '.....199991.....',
  '....19966991....',
  '...1999999991...',
  '...1966666691...',
  '...1999559991...',
  '...1995885991...',
  '...1999559991...',
  '...1966666691...',
  '...1999999991...',
  '...1111111111...',
  '.......aa.......',
  '......1aa1......',
  '...3.3....3.3...',
]);

// --- Scenery -----------------------------------------------------------------

/** Side-view rescue boat with a flashing beacon, for the hero section (32x14). */
const heroBoat = sprite([
  '..............1111..............',
  '..............1661..............',
  '..............1771..............',
  '...........1111111111...........',
  '...........199a99a991...........',
  '...........199a99a991...........',
  '...........1999999991...........',
  '.111111111111111111111111111111.',
  '.1999999999999999999999999999991',
  '..16666666666666666666666666661.',
  '...155555555555555555555555551..',
  '....1444444444444444444444441...',
  '.....11111111111111111111111....',
  '................................',
]);

/** Dark storm cloud with a red under-glow (24x8). */
const cloud = sprite([
  '.........1111...........',
  '......1113333111........',
  '....11333333333311111...',
  '..113333333333333333311.',
  '.13333333333333333333331',
  '1333333333333333333333331'.slice(0, 24),
  '.14444444444444444444441',
  '..111111111111111111111.',
]);

/** Flooded city skyline silhouette with a few lit windows (64x24), tiles horizontally. */
const skyline = (() => {
  const buildings: [number, number, number][] = [
    // [x, width, height]
    [0, 7, 14], [8, 10, 20], [19, 6, 11], [26, 9, 17], [36, 12, 23], [49, 6, 13], [56, 8, 18],
  ];
  return draw(64, 24, (x, y) => {
    for (const [bx, width, height] of buildings) {
      const top = 24 - height;
      if (x < bx || x >= bx + width || y < top) continue;
      if (y === top) return '3';
      const lit = (x - bx) % 3 === 1 && (y - top) % 4 === 2 && ((x * 7 + y * 3) % 5 === 0);
      if (lit) return '6';
      return (x - bx) % 3 === 1 && (y - top) % 4 === 2 ? '3' : '1';
    }
    return '.';
  });
})();

export const SPRITES = {
  water: water(0),
  waterAlt: water(2),
  wall,
  crate,
  crateGoal,
  buoy,
  boat,
  heroBoat,
  cloud,
  skyline,
} satisfies Record<string, Sprite>;

export type SpriteName = keyof typeof SPRITES;

/** SVG with one <rect> per horizontal run of the same colour. */
export function toSvg(sprite: Sprite): string {
  const rects: string[] = [];
  sprite.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const char = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === char) end++;
      if (char !== '.') {
        rects.push(`<rect x='${x}' y='${y}' width='${end - x}' height='1' fill='${PALETTE[char as PaletteKey]}'/>`);
      }
      x = end;
    }
  });
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${sprite.width} ${sprite.height}' shape-rendering='crispEdges'>${rects.join('')}</svg>`;
}

export function toDataUrl(sprite: Sprite): string {
  return `data:image/svg+xml,${encodeURIComponent(toSvg(sprite))}`;
}

export function installSprites(root: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(SPRITES)) {
    root.style.setProperty(`--spr-${name}`, `url("${toDataUrl(value)}")`);
  }
}
