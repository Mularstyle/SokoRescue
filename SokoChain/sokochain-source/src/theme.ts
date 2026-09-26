export type FloodTileState = Readonly<{
  player: boolean;
  box: boolean;
  goal: boolean;
  blocked: boolean;
}>;

export function floodTileClasses(state: FloodTileState): string[] {
  if (state.blocked) return ['tile', 'pixel-sprite', 'obstacle', 'roof'];

  const classes = ['tile', 'pixel-sprite', 'water'];
  if (state.goal) classes.push('survivor', 'rescue-point', 'gps-pin');
  if (state.box) classes.push('supply', 'supply-crate');
  if (state.player) classes.push('boat', 'boat-craft');
  return classes;
}
