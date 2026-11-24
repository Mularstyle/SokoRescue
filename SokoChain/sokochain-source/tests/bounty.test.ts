import { beforeEach, describe, expect, it } from 'vitest';
import {
  bountyStatus,
  loadCreatorSecret,
  loadSolverSecret,
  randomSalt,
  saveCreatorSecret,
  saveSolverSecret,
} from '../src/bounty';
import { ABI } from '../src/contract';
import { compileSokoChain } from './helpers/evm';

const ALICE = '0x00000000000000000000000000000000000A11CE' as const;
const COMMIT = `0x${'ab'.repeat(32)}` as const;
const SALT = `0x${'cd'.repeat(32)}` as const;

describe('bounty secrets in localStorage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips the creator secret by commit hash', () => {
    saveCreatorSecret(COMMIT, { levelId: 3, moves: [0, 1, 2], salt: SALT });
    expect(loadCreatorSecret(COMMIT)).toEqual({ levelId: 3, moves: [0, 1, 2], salt: SALT });
  });

  it('round-trips the solver secret per account and bounty, ignoring address case', () => {
    saveSolverSecret(ALICE, 7n, { moves: [3, 3], salt: SALT });
    expect(loadSolverSecret(ALICE.toLowerCase() as `0x${string}`, 7n)).toEqual({ moves: [3, 3], salt: SALT });
    expect(loadSolverSecret(ALICE, 8n)).toBeNull();
  });

  it('returns null for missing or corrupt entries', () => {
    expect(loadCreatorSecret(COMMIT)).toBeNull();
    localStorage.setItem(`sokorescue:creator:${COMMIT}`, '{not json');
    expect(loadCreatorSecret(COMMIT)).toBeNull();
  });
});

describe('randomSalt', () => {
  it('produces distinct 32-byte hex values', () => {
    const a = randomSalt();
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
    expect(randomSalt()).not.toBe(a);
  });
});

describe('bountyStatus', () => {
  const base = { deadline: 1000n, solved: false, reclaimed: false };
  it.each([
    [{ ...base }, 999n, 'open'],
    [{ ...base }, 1000n, 'open'],
    [{ ...base }, 1001n, 'expired'],
    [{ ...base, solved: true }, 5n, 'solved'],
    [{ ...base, reclaimed: true }, 5000n, 'reclaimed'],
  ] as const)('%o at %s is %s', (bounty, now, expected) => {
    expect(bountyStatus(bounty, now)).toBe(expected);
  });
});

describe('frontend ABI', () => {
  it('matches the compiled contract for every function it declares', () => {
    const compiled = compileSokoChain().abi as unknown as { type: string; name: string; inputs: { type: string }[]; outputs?: unknown[] }[];
    const sig = (item: { name: string; inputs: readonly { type: string }[] }) => `${item.name}(${item.inputs.map((input) => input.type).join(',')})`;
    const compiledSigs = new Set(compiled.filter((item) => item.type !== 'constructor').map(sig));
    for (const item of ABI) expect(compiledSigs, sig(item)).toContain(sig(item));
    const names = ABI.map((item) => item.name);
    expect(names).toEqual(expect.arrayContaining(['createBounty', 'commit', 'reveal', 'reclaim', 'getBounty', 'bountyCount', 'commitments', 'BountyCreated']));
  });
});
