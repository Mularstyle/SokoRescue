// Characterization tests for the legacy leaderboard (submitSolution),
// executed on an in-process EVM. Guards the _simulate refactor.
import { beforeEach, describe, expect, it } from 'vitest';
import { CANONICAL, Chain, route } from './helpers/evm';
import type { Address } from '@ethereumjs/util';

describe('submitSolution on EVM', () => {
  let chain: Chain;
  let alice: Address;

  beforeEach(async () => {
    chain = await Chain.deploy();
    alice = await chain.account('0x00000000000000000000000000000000000a11ce');
  });

  it('accepts the canonical solution of every level', async () => {
    for (const [levelId, text] of Object.entries(CANONICAL)) {
      const res = await chain.call(alice, 'submitSolution', [Number(levelId), route(text)]);
      expect(res.ok, `level ${levelId}: ${res.error}`).toBe(true);
      expect(await chain.read('bestMoves', [alice.toString(), Number(levelId)])).toBe(text.length);
    }
    expect(await chain.read('playerCount')).toBe(1n);
  });

  it.each([
    ['walking into wall', 1, [3], 'Invalid move'],
    ['unsolved route', 1, [0, 1], 'Unsolved'],
    ['invalid direction', 1, [4], 'Invalid direction'],
    ['empty route', 1, [], 'Unsolved'],
    ['invalid level', 9, [0], 'Invalid level'],
  ])('rejects %s', async (_name, levelId, moves, reason) => {
    const res = await chain.call(alice, 'submitSolution', [levelId, moves]);
    expect(res.ok).toBe(false);
    expect(res.error).toBe(reason);
  });

  it('rejects more than 128 moves', async () => {
    const res = await chain.call(alice, 'submitSolution', [1, new Array(129).fill(0)]);
    expect(res).toMatchObject({ ok: false, error: 'Too many moves' });
  });
});
