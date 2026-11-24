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
const FUJI_CHAIN_ID = 43113;
const solverKey = (account: Hex, bountyId: bigint, chainId: number) => `sokorescue:solver:${chainId}:${account.toLowerCase()}:${bountyId}`;
/** Fuji answers saved before secrets were namespaced by chain. */
const legacySolverKey = (account: Hex, bountyId: bigint) => `sokorescue:solver:${account.toLowerCase()}:${bountyId}`;

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

export function saveSolverSecret(account: Hex, bountyId: bigint, secret: SolverSecret, chainId: number): void {
  localStorage.setItem(solverKey(account, bountyId, chainId), JSON.stringify(secret));
}

export function loadSolverSecret(account: Hex, bountyId: bigint, chainId: number): SolverSecret | null {
  return readJson<SolverSecret>(solverKey(account, bountyId, chainId))
    ?? (chainId === FUJI_CHAIN_ID ? readJson<SolverSecret>(legacySolverKey(account, bountyId)) : null);
}

export type BountyStatus = 'open' | 'expired' | 'solved' | 'reclaimed';

/** Mirrors the contract: open while now <= deadline. */
export function bountyStatus(bounty: { deadline: bigint; solved: boolean; reclaimed: boolean }, now: bigint): BountyStatus {
  if (bounty.solved) return 'solved';
  if (bounty.reclaimed) return 'reclaimed';
  return now <= bounty.deadline ? 'open' : 'expired';
}

// ---------------------------------------------------------------------------
// Backup / restore of answers (salts + routes). Without them a commit can't be
// revealed and an unsolved bounty can't be reclaimed.
// ---------------------------------------------------------------------------

const BACKUP_APP = 'sokorescue-answers';
const SECRET_PREFIXES = ['sokorescue:creator:', 'sokorescue:solver:'];
const isSecretKey = (key: string) => SECRET_PREFIXES.some((prefix) => key.startsWith(prefix));

function isValidSecret(value: unknown): value is SolverSecret {
  if (typeof value !== 'object' || value === null) return false;
  const { moves, salt } = value as { moves?: unknown; salt?: unknown };
  return typeof salt === 'string' && /^0x[0-9a-fA-F]{64}$/.test(salt)
    && Array.isArray(moves) && moves.length <= 400
    && moves.every((move) => Number.isInteger(move) && move >= 0 && move <= 3);
}

export function exportSecrets(): string {
  const entries: Record<string, unknown> = {};
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (!key || !isSecretKey(key)) continue;
    const value = readJson<unknown>(key);
    if (isValidSecret(value)) entries[key] = value;
  }
  return JSON.stringify({ app: BACKUP_APP, version: 1, exportedAt: new Date().toISOString(), entries }, null, 2);
}

/** Validates the whole file first, then adds answers that are not already stored. Returns how many were added. */
export function importSecrets(text: string): number {
  const backup = JSON.parse(text) as { app?: unknown; entries?: unknown };
  if (backup?.app !== BACKUP_APP || typeof backup.entries !== 'object' || backup.entries === null) {
    throw new Error('Not a SokoRescue answer backup');
  }
  const entries = Object.entries(backup.entries as Record<string, unknown>);
  for (const [key, value] of entries) {
    if (!isSecretKey(key) || !isValidSecret(value)) throw new Error(`Invalid entry in backup: ${key}`);
  }
  let added = 0;
  for (const [key, value] of entries) {
    if (localStorage.getItem(key) !== null) continue;
    localStorage.setItem(key, JSON.stringify(value));
    added++;
  }
  return added;
}
