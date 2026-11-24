// Pure helpers for Puzzle Bounty commit-reveal. Must match SokoChain.sol exactly.
import { encodeAbiParameters, keccak256, type Hex } from 'viem';

const COMMIT_PARAMS = [{ type: 'uint8[]' }, { type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }] as const;

/** keccak256(abi.encode(moves, salt, solver, bountyId)) — binds the answer to the solver's address. */
export function solverCommitHash(moves: readonly number[], salt: Hex, solver: Hex, bountyId: bigint): Hex {
  return keccak256(encodeAbiParameters(COMMIT_PARAMS, [[...moves], salt, solver, bountyId]));
}

/**
 * keccak256(abi.encode(moves, salt, creator, levelKey)) — creator's proof the level is solvable.
 * levelKey is the preset levelId, or customLevelKey(level) for a custom map.
 */
export function creatorCommitHash(moves: readonly number[], salt: Hex, creator: Hex, levelKey: number | bigint): Hex {
  return keccak256(encodeAbiParameters(COMMIT_PARAMS, [[...moves], salt, creator, BigInt(levelKey)]));
}

// ---------------------------------------------------------------------------
// Local secrets. The salt + moves never leave this browser until reveal/reclaim.
// Losing them means the commit can never be revealed (and a creator cannot reclaim).
// ---------------------------------------------------------------------------

export type CreatorSecret = { levelId: number; moves: number[]; salt: Hex };
export type SolverSecret = { moves: number[]; salt: Hex };

export function randomSalt(): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

const creatorKey = (commitHash: Hex) => `sokorescue:creator:${commitHash.toLowerCase()}`;
const solverKey = (account: Hex, bountyId: bigint) => `sokorescue:solver:${account.toLowerCase()}:${bountyId}`;

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveCreatorSecret(commitHash: Hex, secret: CreatorSecret): void {
  localStorage.setItem(creatorKey(commitHash), JSON.stringify(secret));
}

export function loadCreatorSecret(commitHash: Hex): CreatorSecret | null {
  return readJson<CreatorSecret>(creatorKey(commitHash));
}

export function saveSolverSecret(account: Hex, bountyId: bigint, secret: SolverSecret): void {
  localStorage.setItem(solverKey(account, bountyId), JSON.stringify(secret));
}

export function loadSolverSecret(account: Hex, bountyId: bigint): SolverSecret | null {
  return readJson<SolverSecret>(solverKey(account, bountyId));
}

export type BountyStatus = 'open' | 'expired' | 'solved' | 'reclaimed';

/** Mirrors the contract: open while now <= deadline. */
export function bountyStatus(bounty: { deadline: bigint; solved: boolean; reclaimed: boolean }, now: bigint): BountyStatus {
  if (bounty.solved) return 'solved';
  if (bounty.reclaimed) return 'reclaimed';
  return now <= bounty.deadline ? 'open' : 'expired';
}
