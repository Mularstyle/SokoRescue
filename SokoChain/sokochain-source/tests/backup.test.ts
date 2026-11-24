import { beforeEach, describe, expect, it } from 'vitest';
import { exportSecrets, importSecrets, loadCreatorSecret, loadSolverSecret, saveCreatorSecret, saveSolverSecret } from '../src/bounty';
import { NETWORKS, allowsPresetBounties } from '../src/networks';

const ALICE = '0x00000000000000000000000000000000000A11CE' as const;
const COMMIT = `0x${'ab'.repeat(32)}` as const;
const SALT = `0x${'cd'.repeat(32)}` as const;

describe('answer backup', () => {
  beforeEach(() => localStorage.clear());

  it('exports only SokoRescue answers', () => {
    saveCreatorSecret(COMMIT, { levelId: 0, moves: [1, 2], salt: SALT });
    saveSolverSecret(ALICE, 3n, { moves: [0], salt: SALT }, 43114);
    localStorage.setItem('sokorescue:draft', '["#"]');
    localStorage.setItem('unrelated', 'x');
    const backup = JSON.parse(exportSecrets());
    expect(backup.app).toBe('sokorescue-answers');
    expect(Object.keys(backup.entries).sort()).toEqual([
      `sokorescue:creator:${COMMIT}`,
      `sokorescue:solver:43114:${ALICE.toLowerCase()}:3`,
    ]);
  });

  it('restores answers on another browser', () => {
    saveCreatorSecret(COMMIT, { levelId: 0, moves: [1, 2], salt: SALT });
    saveSolverSecret(ALICE, 3n, { moves: [0], salt: SALT }, 43114);
    const backup = exportSecrets();
    localStorage.clear();
    expect(importSecrets(backup)).toBe(2);
    expect(loadCreatorSecret(COMMIT)).toEqual({ levelId: 0, moves: [1, 2], salt: SALT });
    expect(loadSolverSecret(ALICE, 3n, 43114)).toEqual({ moves: [0], salt: SALT });
  });

  it('never overwrites an answer that is already stored', () => {
    saveCreatorSecret(COMMIT, { levelId: 0, moves: [1, 2], salt: SALT });
    const backup = exportSecrets();
    saveCreatorSecret(COMMIT, { levelId: 0, moves: [3], salt: SALT });
    expect(importSecrets(backup)).toBe(0);
    expect(loadCreatorSecret(COMMIT)?.moves).toEqual([3]);
  });

  it.each([
    ['not json', '{oops'],
    ['wrong app', JSON.stringify({ app: 'other', entries: {} })],
    ['foreign key', JSON.stringify({ app: 'sokorescue-answers', version: 1, entries: { 'evil:key': { moves: [], salt: SALT } } })],
    ['bad salt', JSON.stringify({ app: 'sokorescue-answers', version: 1, entries: { [`sokorescue:creator:${COMMIT}`]: { levelId: 0, moves: [1], salt: '0x12' } } })],
    ['bad move', JSON.stringify({ app: 'sokorescue-answers', version: 1, entries: { [`sokorescue:creator:${COMMIT}`]: { levelId: 0, moves: [9], salt: SALT } } })],
  ])('rejects a malformed backup: %s', (_name, text) => {
    expect(() => importSecrets(text)).toThrow();
    expect(localStorage.length).toBe(0);
  });
});

describe('preset bounty policy', () => {
  it('allows preset-level bounties only on testnet (their solutions are public)', () => {
    expect(allowsPresetBounties(NETWORKS.fuji)).toBe(true);
    expect(allowsPresetBounties(NETWORKS.mainnet)).toBe(false);
  });
});
