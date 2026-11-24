// Puzzle Bounty: escrow + commit-reveal, executed on an in-process EVM.
import { beforeEach, describe, expect, it } from 'vitest';
import type { Address } from '@ethereumjs/util';
import type { Hex } from 'viem';
import { CANONICAL, Chain, route } from './helpers/evm';
import { creatorCommitHash, solverCommitHash } from '../src/bounty';

const AVAX = 10n ** 18n;
const REWARD = 1n * AVAX;
const HOUR = 3600n;
const SALT_CREATOR = `0x${'c1'.repeat(32)}` as Hex;
const SALT_SOLVER = `0x${'51'.repeat(32)}` as Hex;
const LEVEL = 1;
const SOLUTION = route(CANONICAL[LEVEL]);

type Bounty = {
  creator: Hex; levelId: number; deadline: bigint; solved: boolean; reclaimed: boolean;
  reward: bigint; creatorCommit: Hex; winner: Hex;
};

describe('Puzzle Bounty', () => {
  let chain: Chain;
  let creator: Address;
  let solver: Address;
  let attacker: Address;
  let deadline: bigint;

  const hex = (address: Address) => address.toString() as Hex;
  const getBounty = async (id: bigint) => (await chain.read('getBounty', [id])) as Bounty;

  async function createBounty(moves = SOLUTION, value = REWARD) {
    const commit = creatorCommitHash(moves, SALT_CREATOR, hex(creator), LEVEL);
    return chain.call(creator, 'createBounty', [LEVEL, commit, deadline], value);
  }

  async function commitAndMine(who: Address, moves: number[], salt: Hex, bountyId = 1n) {
    const res = await chain.call(who, 'commit', [bountyId, solverCommitHash(moves, salt, hex(who), bountyId)]);
    expect(res.ok, res.error).toBe(true);
    chain.mine();
    return res;
  }

  beforeEach(async () => {
    chain = await Chain.deploy();
    creator = await chain.account('0x00000000000000000000000000000000000c4ea7');
    solver = await chain.account('0x0000000000000000000000000000000000050f7e');
    attacker = await chain.account('0x000000000000000000000000000000000000ba0d');
    deadline = chain.timestamp + HOUR;
  });

  describe('createBounty', () => {
    it('escrows the reward and records the bounty', async () => {
      const before = await chain.balance(creator);
      const res = await createBounty();
      expect(res.ok, res.error).toBe(true);
      expect(res.result).toBe(1n);
      expect(await chain.balance(chain.contract)).toBe(REWARD);
      expect(await chain.balance(creator)).toBe(before - REWARD);
      expect(await chain.read('bountyCount')).toBe(1n);
      expect(await getBounty(1n)).toMatchObject({
        creator: expect.stringMatching(/c4ea7$/i), levelId: LEVEL, deadline, solved: false, reclaimed: false, reward: REWARD,
      });
      expect(res.logs).toEqual([
        { eventName: 'BountyCreated', args: { bountyId: 1n, creator: expect.stringMatching(/c4ea7$/i), levelId: LEVEL, reward: REWARD, deadline } },
      ]);
    });

    it.each([
      ['zero reward', () => [LEVEL, `0x${'11'.repeat(32)}`, deadline] as const, 0n, 'No reward'],
      ['invalid level', () => [9, `0x${'11'.repeat(32)}`, deadline] as const, REWARD, 'Invalid level'],
      ['empty commit', () => [LEVEL, `0x${'00'.repeat(32)}`, deadline] as const, REWARD, 'No commit'],
      ['past deadline', () => [LEVEL, `0x${'11'.repeat(32)}`, chain.timestamp] as const, REWARD, 'Bad deadline'],
    ])('rejects %s', async (_name, args, value, reason) => {
      const res = await chain.call(creator, 'createBounty', [...args()], value);
      expect(res).toMatchObject({ ok: false, error: reason });
    });
  });

  describe('commit + reveal', () => {
    beforeEach(async () => {
      expect((await createBounty()).ok).toBe(true);
    });

    it('pays the full reward to a solver who reveals a valid solution', async () => {
      const commitRes = await commitAndMine(solver, SOLUTION, SALT_SOLVER);
      expect(commitRes.logs[0]).toMatchObject({ eventName: 'Committed', args: { bountyId: 1n } });
      const before = await chain.balance(solver);

      const res = await chain.call(solver, 'reveal', [1n, SOLUTION, SALT_SOLVER]);

      expect(res.ok, res.error).toBe(true);
      expect(await chain.balance(solver)).toBe(before + REWARD);
      expect(await chain.balance(chain.contract)).toBe(0n);
      expect(await getBounty(1n)).toMatchObject({ solved: true, winner: expect.stringMatching(/50f7e$/i) });
      expect(res.logs).toEqual([
        { eventName: 'BountySolved', args: { bountyId: 1n, winner: expect.stringMatching(/50f7e$/i), reward: REWARD, moves: SOLUTION.length } },
      ]);
    });

    it('rejects a reveal whose salt does not match the commit', async () => {
      await commitAndMine(solver, SOLUTION, SALT_SOLVER);
      const res = await chain.call(solver, 'reveal', [1n, SOLUTION, `0x${'99'.repeat(32)}`]);
      expect(res).toMatchObject({ ok: false, error: 'Bad reveal' });
    });

    it('rejects a reveal without any commit', async () => {
      const res = await chain.call(solver, 'reveal', [1n, SOLUTION, SALT_SOLVER]);
      expect(res).toMatchObject({ ok: false, error: 'Bad reveal' });
    });

    it('stops an attacker who copies the commit hash and the revealed moves', async () => {
      const victimHash = solverCommitHash(SOLUTION, SALT_SOLVER, hex(solver), 1n);
      expect((await chain.call(attacker, 'commit', [1n, victimHash])).ok).toBe(true);
      chain.mine();
      const res = await chain.call(attacker, 'reveal', [1n, SOLUTION, SALT_SOLVER]);
      expect(res).toMatchObject({ ok: false, error: 'Bad reveal' });
    });

    it('rejects a reveal in the same block as the commit', async () => {
      await chain.call(solver, 'commit', [1n, solverCommitHash(SOLUTION, SALT_SOLVER, hex(solver), 1n)]);
      const res = await chain.call(solver, 'reveal', [1n, SOLUTION, SALT_SOLVER]);
      expect(res).toMatchObject({ ok: false, error: 'Reveal too early' });
    });

    it('rejects a revealed route that does not solve the level', async () => {
      const wrong = [0, 1];
      await commitAndMine(solver, wrong, SALT_SOLVER);
      const res = await chain.call(solver, 'reveal', [1n, wrong, SALT_SOLVER]);
      expect(res).toMatchObject({ ok: false, error: 'Unsolved' });
      expect(await chain.balance(chain.contract)).toBe(REWARD);
    });

    it('rejects a reveal after the deadline', async () => {
      await commitAndMine(solver, SOLUTION, SALT_SOLVER);
      chain.mine(HOUR);
      const res = await chain.call(solver, 'reveal', [1n, SOLUTION, SALT_SOLVER]);
      expect(res).toMatchObject({ ok: false, error: 'Expired' });
    });

    it('rejects a commit after the deadline', async () => {
      chain.mine(HOUR + 1n);
      const res = await chain.call(solver, 'commit', [1n, solverCommitHash(SOLUTION, SALT_SOLVER, hex(solver), 1n)]);
      expect(res).toMatchObject({ ok: false, error: 'Expired' });
    });

    it('rejects a commit for a bounty that does not exist', async () => {
      const res = await chain.call(solver, 'commit', [2n, `0x${'11'.repeat(32)}`]);
      expect(res).toMatchObject({ ok: false, error: 'No bounty' });
    });

    it('pays only once even if a second solver reveals', async () => {
      await commitAndMine(solver, SOLUTION, SALT_SOLVER);
      await commitAndMine(attacker, SOLUTION, SALT_CREATOR);
      expect((await chain.call(solver, 'reveal', [1n, SOLUTION, SALT_SOLVER])).ok).toBe(true);

      const second = await chain.call(attacker, 'reveal', [1n, SOLUTION, SALT_CREATOR]);
      const again = await chain.call(solver, 'reveal', [1n, SOLUTION, SALT_SOLVER]);

      expect(second).toMatchObject({ ok: false, error: 'Already solved' });
      // The winner's commitment is deleted on payout, so the hash check (first) fails.
      expect(again).toMatchObject({ ok: false, error: 'Bad reveal' });
      expect(await chain.balance(chain.contract)).toBe(0n);
    });

    it('rejects a commit once the bounty is solved', async () => {
      await commitAndMine(solver, SOLUTION, SALT_SOLVER);
      await chain.call(solver, 'reveal', [1n, SOLUTION, SALT_SOLVER]);
      const res = await chain.call(attacker, 'commit', [1n, `0x${'11'.repeat(32)}`]);
      expect(res).toMatchObject({ ok: false, error: 'Already solved' });
    });
  });

  describe('reclaim', () => {
    it('refunds the creator after the deadline with a valid committed solution', async () => {
      await createBounty();
      chain.mine(HOUR + 1n);
      const before = await chain.balance(creator);

      const res = await chain.call(creator, 'reclaim', [1n, SOLUTION, SALT_CREATOR]);

      expect(res.ok, res.error).toBe(true);
      expect(await chain.balance(creator)).toBe(before + REWARD);
      expect(await chain.balance(chain.contract)).toBe(0n);
      expect(await getBounty(1n)).toMatchObject({ reclaimed: true, solved: false });
      expect(res.logs).toEqual([
        { eventName: 'BountyReclaimed', args: { bountyId: 1n, creator: expect.stringMatching(/c4ea7$/i), reward: REWARD } },
      ]);
    });

    it('rejects reclaim before the deadline', async () => {
      await createBounty();
      const res = await chain.call(creator, 'reclaim', [1n, SOLUTION, SALT_CREATOR]);
      expect(res).toMatchObject({ ok: false, error: 'Not expired' });
    });

    it('rejects reclaim by someone other than the creator', async () => {
      await createBounty();
      chain.mine(HOUR + 1n);
      const res = await chain.call(attacker, 'reclaim', [1n, SOLUTION, SALT_CREATOR]);
      expect(res).toMatchObject({ ok: false, error: 'Not creator' });
    });

    it('rejects reclaim with a salt that does not match the creator commit', async () => {
      await createBounty();
      chain.mine(HOUR + 1n);
      const res = await chain.call(creator, 'reclaim', [1n, SOLUTION, SALT_SOLVER]);
      expect(res).toMatchObject({ ok: false, error: 'Bad reveal' });
    });

    it('rejects reclaim when the committed creator route does not solve the level', async () => {
      const wrong = [0, 1];
      await createBounty(wrong);
      chain.mine(HOUR + 1n);
      const res = await chain.call(creator, 'reclaim', [1n, wrong, SALT_CREATOR]);
      expect(res).toMatchObject({ ok: false, error: 'Unsolved' });
      expect(await chain.balance(chain.contract)).toBe(REWARD);
    });

    it('rejects a second reclaim', async () => {
      await createBounty();
      chain.mine(HOUR + 1n);
      expect((await chain.call(creator, 'reclaim', [1n, SOLUTION, SALT_CREATOR])).ok).toBe(true);
      const res = await chain.call(creator, 'reclaim', [1n, SOLUTION, SALT_CREATOR]);
      expect(res).toMatchObject({ ok: false, error: 'Already reclaimed' });
    });

    it('rejects reclaim of a solved bounty', async () => {
      await createBounty();
      await commitAndMine(solver, SOLUTION, SALT_SOLVER);
      await chain.call(solver, 'reveal', [1n, SOLUTION, SALT_SOLVER]);
      chain.mine(HOUR + 1n);
      const res = await chain.call(creator, 'reclaim', [1n, SOLUTION, SALT_CREATOR]);
      expect(res).toMatchObject({ ok: false, error: 'Already solved' });
    });
  });
});
