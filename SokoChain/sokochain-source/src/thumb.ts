// Tiny map preview for bounty cards.
import { isWalkable, samePosition, type LevelDefinition } from './game';

/** One class per cell, row by row: w wall, g ring, b crate, bg crate on ring, p boat, pg boat on ring, '' water. */
export function thumbCells(level: LevelDefinition): string[] {
  const cells: string[] = [];
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      const point = { x, y };
      if (!isWalkable(level, point)) {
        cells.push('w');
        continue;
      }
      const goal = level.goals.some((g) => samePosition(g, point));
      const box = level.boxes.some((b) => samePosition(b, point));
      const boat = samePosition(level.player, point);
      cells.push(boat ? (goal ? 'pg' : 'p') : box ? (goal ? 'bg' : 'b') : goal ? 'g' : '');
    }
  }
  return cells;
}

export function thumbElement(level: LevelDefinition): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'bounty-thumb';
  grid.style.gridTemplateColumns = `repeat(${level.width}, var(--thumb-tile))`;
  grid.setAttribute('aria-hidden', 'true');
  grid.append(...thumbCells(level).map((kind) => {
    const cell = document.createElement('i');
    if (kind) cell.className = kind;
    return cell;
  }));
  return grid;
}
