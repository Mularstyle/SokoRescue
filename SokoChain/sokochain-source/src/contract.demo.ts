// Demo-mode stand-in for ./contract (used only with `vite --mode demo`).
// Same exports as contract.ts, but all "chain" state lives in localStorage and the
// wallet is simulated with an on-screen prompt. Nothing is signed or sent anywhere.
// Used to record the launch video and as an offline backup for live demos.
import type { Hex, TransactionReceipt } from 'viem';
import type { Move } from './game';
import { encodeRows, type OnchainLevel } from './levelCodec';
import { NETWORKS, type Network, type NetworkId } from './networks';

export type OnchainBounty = {
  id: bigint; creator: Hex; levelId: number; deadline: bigint; solved: boolean;
  reclaimed: boolean; reward: bigint; creatorCommit: Hex; winner: Hex;
};

const WALLETS: Hex[] = [
  '0x7c3e9a1f4b2d5e6c8a9b0d1e2f3a4b5c6d7e8f90',
  '0x2b5de8f1a9c4b7e0d3a6f9c2e5b8a1d4c7f0e3b6',
];
const ZERO = '0x0000000000000000000000000000000000000000' as Hex;
const STATE_KEY = 'sokorescue:demo:state';
const WALLET_KEY = 'sokorescue:demo:wallet';

type Stored = {
  block: number;
  bounties: { id: string; creator: Hex; levelId: number; deadline: string; solved: boolean; reclaimed: boolean; reward: string; creatorCommit: Hex; winner: Hex }[];
  levels: Record<string, { floor: string; goals: string; boxes: string; width: number; height: number; player: number }>;
  commitments: Record<string, { hash: Hex; blockNumber: number }>;
  scores: Record<string, number>;
};

const nowSeconds = () => Math.floor(Date.now() / 1000);
const AVAX = 10n ** 18n;

function seed(): Stored {
  const custom = encodeRows([
    '##########',
    '#        #',
    '# @ $  . #',
    '#        #',
    '#   $  . #',
    '#        #',
    '#  $   . #',
    '#        #',
    '#        #',
    '##########',
  ]);
  const extra: [string, number, bigint, number, string[]][] = [
    // [creator, hours left, reward, -, map]
    ['0x51ab3c9e2d7f4a6b8c0e1f2a3b4c5d6e7f8a9b0c', 3, AVAX / 4n, 0, ['########', '#@  #  #', '# $$  .#', '#  # . #', '##   ###', '########']],
    ['0x3e7d1a9c5b2f8e4d6a0c1b3e5f7a9c2d4e6f8a1b', 18, AVAX, 0, ['##########', '#  #   . #', '# $#  #  #', '#    $   #', '## ### ###', '#  .  $ .#', '#@   #   #', '##########']],
    ['0xa8c2e4f6b1d3a5c7e9f0b2d4c6a8e1f3b5d7c9a2', 6, (AVAX * 3n) / 20n, 0, ['#########', '#.  #   #', '#  $  $ #', '## # #  #', '#  @  .##', '#########']],
    ['0x6f1e3d5c7b9a2e4d6c8b0a1f3e5d7c9b2a4f6e8d', 47, AVAX * 2n, 0, ['##########', '#.   #  .#', '#  $   $ #', '### ## ###', '#   $    #', '#  ##  # #', '#.   @   #', '##########']],
  ];
  const levels: Stored['levels'] = { '1': { floor: String(custom.floor), goals: String(custom.goals), boxes: String(custom.boxes), width: custom.width, height: custom.height, player: custom.player } };
  const more = extra.map(([creator, hours, reward, , rows], i) => {
    const id = String(3 + i);
    const level = encodeRows(rows);
    levels[id] = { floor: String(level.floor), goals: String(level.goals), boxes: String(level.boxes), width: level.width, height: level.height, player: level.player };
    return { id, creator: creator as Hex, levelId: 0, deadline: String(nowSeconds() + hours * 3600), solved: false, reclaimed: false, reward: String(reward), creatorCommit: `0x${String(i + 3).repeat(64)}` as Hex, winner: ZERO };
  });
  return {
    block: 61_600_000,
    bounties: [
      { id: '1', creator: WALLETS[0], levelId: 0, deadline: String(nowSeconds() - 3600), solved: true, reclaimed: false, reward: String(AVAX / 20n), creatorCommit: `0x${'1a'.repeat(32)}`, winner: '0x9f1c3b5a7d9e2c4b6a8f0e1d3c5b7a9e1d3f5b7c' },
      { id: '2', creator: '0x9f1c3b5a7d9e2c4b6a8f0e1d3c5b7a9e1d3f5b7c', levelId: 7, deadline: String(nowSeconds() + 20 * 3600), solved: false, reclaimed: false, reward: String(AVAX / 10n), creatorCommit: `0x${'2b'.repeat(32)}`, winner: ZERO },
      ...more,
    ],
    levels,
    commitments: {},
    scores: {},
  };
}

function load(): Stored {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) return JSON.parse(raw) as Stored;
  } catch {
    /* fall through to seed */
  }
  const fresh = seed();
  save(fresh);
  return fresh;
}

function save(state: Stored): void {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

const currentWallet = (): Hex => WALLETS[Number(localStorage.getItem(WALLET_KEY) ?? '0')] ?? WALLETS[0];
const fakeHash = (): Hex => `0x${[...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --- Simulated wallet prompt --------------------------------------------------

function walletPrompt(title: string, detail: string): Promise<void> {
  const box = document.createElement('div');
  box.setAttribute('role', 'dialog');
  box.style.cssText = [
    'position:fixed', 'top:96px', 'left:50%', 'z-index:9999', 'width:380px', 'padding:18px 20px',
    'background:#160a10', 'color:#f6e7dd', 'font-family:VT323,monospace', 'font-size:22px',
    'box-shadow:0 -4px 0 0 #e8334a,0 4px 0 0 #e8334a,-4px 0 0 0 #e8334a,4px 0 0 0 #e8334a,10px 10px 0 0 #000',
    'transform:translate(-50%,-12px)', 'opacity:0', 'transition:transform .18s steps(3),opacity .18s steps(3)',
  ].join(';');
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;font-family:Silkscreen,monospace;font-size:14px;letter-spacing:.08em;color:#9b7f83;text-transform:uppercase"><span>Wallet · ${network.short}</span><span>simulated</span></div>
    <div style="margin:10px 0 4px;font-family:'Press Start 2P',monospace;font-size:14px;line-height:1.5;color:#ffb199">${title}</div>
    <div style="color:#d9c4bc">${detail}</div>
    <div style="display:flex;gap:12px;margin-top:14px;font-family:Silkscreen,monospace;font-size:14px;text-transform:uppercase">
      <span style="flex:1;text-align:center;padding:8px;background:#2a0e17;color:#9b7f83">Reject</span>
      <span data-approve style="flex:1;text-align:center;padding:8px;background:#b81d36;color:#f6e7dd">Approve</span>
    </div>`;
  document.body.append(box);
  requestAnimationFrame(() => {
    box.style.opacity = '1';
    box.style.transform = 'translate(-50%,0)';
  });
  return sleep(900).then(async () => {
    const approve = box.querySelector<HTMLElement>('[data-approve]')!;
    approve.style.background = '#ffb199';
    approve.style.color = '#160a10';
    approve.textContent = 'Approved ✓';
    await sleep(450);
    box.style.opacity = '0';
    await sleep(200);
    box.remove();
  });
}

// --- Network / clients ----------------------------------------------------------

export let network: Network = NETWORKS.fuji;
export let EXPLORER_TX = `${network.explorer}/tx/`;

export function setNetwork(id: NetworkId): void {
  network = NETWORKS[id];
  EXPLORER_TX = `${network.explorer}/tx/`;
}

type DemoReceipt = TransactionReceipt & { bountyId?: bigint };
const receipts = new Map<Hex, DemoReceipt>();

function mine(extra: Partial<DemoReceipt> = {}): Hex {
  const state = load();
  state.block += 1;
  save(state);
  const hash = fakeHash();
  receipts.set(hash, { status: 'success', blockNumber: BigInt(state.block), logs: [], transactionHash: hash, ...extra } as DemoReceipt);
  return hash;
}

export const publicClient = {
  async waitForTransactionReceipt({ hash }: { hash: Hex }): Promise<DemoReceipt> {
    await sleep(700);
    const receipt = receipts.get(hash);
    if (!receipt) throw new Error('Unknown demo transaction');
    return receipt;
  },
};

// --- Wallet -------------------------------------------------------------------

let connected = false;

export async function connectWallet(): Promise<Hex> {
  if (!connected) {
    await walletPrompt('Connect to SokoRescue', `Share address ${currentWallet().slice(0, 6)}…${currentWallet().slice(-4)}`);
    connected = true;
  }
  return currentWallet();
}

// --- Leaderboard ----------------------------------------------------------------

export async function submitSolution(levelId: number, moves: readonly Move[], account: Hex): Promise<Hex> {
  await walletPrompt('Log score', `District ${levelId} · ${moves.length} moves · replayed on-chain`);
  const state = load();
  const key = `${account.toLowerCase()}:${levelId}`;
  if (!state.scores[key] || moves.length < state.scores[key]) state.scores[key] = moves.length;
  if (!state.scores[`global:${levelId}`] || moves.length < state.scores[`global:${levelId}`]) state.scores[`global:${levelId}`] = moves.length;
  save(state);
  return mine();
}

export async function readScores(account: Hex, levelId: number): Promise<{ personal: number; global: number }> {
  const state = load();
  return { personal: state.scores[`${account.toLowerCase()}:${levelId}`] ?? 0, global: state.scores[`global:${levelId}`] ?? 0 };
}

// --- Bounties -------------------------------------------------------------------

const toBounty = (b: Stored['bounties'][number]): OnchainBounty => ({
  id: BigInt(b.id), creator: b.creator, levelId: b.levelId, deadline: BigInt(b.deadline), solved: b.solved,
  reclaimed: b.reclaimed, reward: BigInt(b.reward), creatorCommit: b.creatorCommit, winner: b.winner,
});

export async function listBounties(): Promise<OnchainBounty[]> {
  await sleep(150);
  return load().bounties.map(toBounty).reverse();
}

export async function chainTime(): Promise<bigint> {
  return BigInt(nowSeconds());
}

function addBounty(levelId: number, creatorCommit: Hex, deadline: bigint, reward: bigint, account: Hex, level?: OnchainLevel): Hex {
  const state = load();
  const id = String(state.bounties.length + 1);
  state.bounties.push({ id, creator: account, levelId, deadline: String(deadline), solved: false, reclaimed: false, reward: String(reward), creatorCommit, winner: ZERO });
  if (level) state.levels[id] = { floor: String(level.floor), goals: String(level.goals), boxes: String(level.boxes), width: level.width, height: level.height, player: level.player };
  save(state);
  return mine({ bountyId: BigInt(id) });
}

const avax = (wei: bigint) => `${Number(wei) / 1e18} AVAX`;

export async function createBounty(levelId: number, creatorCommit: Hex, deadline: bigint, reward: bigint, account: Hex): Promise<Hex> {
  await walletPrompt('Post bounty', `Lock ${avax(reward)} in escrow · District ${levelId}`);
  return addBounty(levelId, creatorCommit, deadline, reward, account);
}

export async function createCustomBounty(level: OnchainLevel, creatorCommit: Hex, deadline: bigint, reward: bigint, account: Hex): Promise<Hex> {
  await walletPrompt('Post bounty', `Lock ${avax(reward)} in escrow · ${level.width}×${level.height} map stored on-chain`);
  return addBounty(0, creatorCommit, deadline, reward, account, level);
}

export async function readBountyLevel(bountyId: bigint): Promise<OnchainLevel> {
  const level = load().levels[String(bountyId)];
  if (!level) throw new Error('No custom map for this bounty');
  return { floor: BigInt(level.floor), goals: BigInt(level.goals), boxes: BigInt(level.boxes), width: level.width, height: level.height, player: level.player };
}

export async function commitAnswer(bountyId: bigint, commitHash: Hex, account: Hex): Promise<Hex> {
  await walletPrompt('Commit answer', `Only a hash is sent: ${commitHash.slice(0, 10)}…${commitHash.slice(-6)}`);
  const hash = mine();
  const state = load();
  state.commitments[`${bountyId}:${account.toLowerCase()}`] = { hash: commitHash, blockNumber: state.block };
  save(state);
  return hash;
}

export async function readCommitment(bountyId: bigint, account: Hex): Promise<{ hash: Hex; blockNumber: bigint }> {
  const commitment = load().commitments[`${bountyId}:${account.toLowerCase()}`];
  return { hash: commitment?.hash ?? (`0x${'0'.repeat(64)}` as Hex), blockNumber: BigInt(commitment?.blockNumber ?? 0) };
}

export async function waitForBlockAfter(blockNumber: bigint): Promise<void> {
  const state = load();
  if (BigInt(state.block) <= blockNumber) {
    await sleep(500);
    state.block = Number(blockNumber) + 1;
    save(state);
  }
}

export async function revealAnswer(bountyId: bigint, moves: readonly number[], _salt: Hex, account: Hex): Promise<Hex> {
  await walletPrompt('Reveal & claim', `Contract replays ${moves.length} moves, then pays the solver`);
  const state = load();
  const bounty = state.bounties.find((b) => b.id === String(bountyId));
  if (!bounty || bounty.solved) throw new Error('Already solved');
  bounty.solved = true;
  bounty.winner = account;
  delete state.commitments[`${bountyId}:${account.toLowerCase()}`];
  save(state);
  return mine();
}

export async function reclaimBounty(bountyId: bigint, _moves: readonly number[], _salt: Hex, account: Hex): Promise<Hex> {
  await walletPrompt('Reclaim', 'Reveal the creator answer and refund the reward');
  const state = load();
  const bounty = state.bounties.find((b) => b.id === String(bountyId));
  if (!bounty || bounty.creator.toLowerCase() !== account.toLowerCase()) throw new Error('Not creator');
  bounty.reclaimed = true;
  save(state);
  return mine();
}

export function bountyIdFromReceipt(receipt: TransactionReceipt): bigint | null {
  return (receipt as DemoReceipt).bountyId ?? null;
}

// --- Demo controls (for recordings) ----------------------------------------------

(window as unknown as { __demo: unknown }).__demo = {
  /** 1 = creator wallet, 2 = solver wallet. Reload afterwards. */
  useWallet(n: 1 | 2) {
    localStorage.setItem(WALLET_KEY, String(n - 1));
  },
  reset() {
    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem(WALLET_KEY);
  },
};
