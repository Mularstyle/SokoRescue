import '@fontsource/press-start-2p';
import '@fontsource/silkscreen';
import '@fontsource/vt323';
import './style.css';
import { formatEther, parseEther, type Hex } from 'viem';
import { LEVELS, applyMove, createInitialState, getLevel, isWalkable, samePosition, type GameState, type Move } from './game';
import {
  EXPLORER_TX,
  bountyIdFromReceipt,
  chainTime,
  commitAnswer,
  connectWallet,
  createBounty,
  listBounties,
  publicClient,
  readCommitment,
  readScores,
  reclaimBounty,
  revealAnswer,
  submitSolution,
  waitForBlockAfter,
  type OnchainBounty,
} from './contract';
import {
  bountyStatus,
  creatorCommitHash,
  loadCreatorSecret,
  loadSolverSecret,
  randomSalt,
  saveCreatorSecret,
  saveSolverSecret,
  solverCommitHash,
} from './bounty';
import { installSprites } from './sprites';
import { floodTileClasses } from './theme';

installSprites();

let state: GameState = createInitialState();
let account: Hex | null = null;
let facing: Move = 0;
let bounties: OnchainBounty[] = [];
let now = BigInt(Math.floor(Date.now() / 1000));
let activeBountyId: bigint | null = null;
let busy = false;

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const board = $<HTMLDivElement>('#board');
const moveCount = $('#move-count');
const status = $('#status');
const walletLabel = $('#wallet-label');
const connectButton = $<HTMLButtonElement>('#connect-wallet');
const submitButton = $<HTMLButtonElement>('#submit-score');
const scorePanel = $('#scores');
const levelSelect = $('#level-select');
const activeBanner = $('#active-bounty');
const bountyActions = $('#bounty-actions');
const bountyList = $('#bounty-list');
const createForm = $<HTMLFormElement>('#create-bounty');
const createButton = $<HTMLButtonElement>('#create-bounty-btn');
const createLevel = $('#create-level');
const createLevelName = $('#create-level-name');
const rewardInput = $<HTMLInputElement>('#bounty-reward');
const hoursInput = $<HTMLInputElement>('#bounty-hours');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
const sameAddress = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const txLink = (hash: Hex, label = 'View tx') => `<a href="${EXPLORER_TX}${hash}" target="_blank" rel="noreferrer">${label} ↗</a>`;

function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? ((error as { shortMessage?: string }).shortMessage ?? error.message) : String(error);
  return raw.length > 160 ? `${raw.slice(0, 160)}…` : raw;
}

function setStatus(text: string, html = false): void {
  if (html) status.innerHTML = text;
  else status.textContent = text;
}

async function ensureAccount(): Promise<Hex> {
  if (!account) {
    account = await connectWallet();
    walletLabel.textContent = short(account);
    connectButton.textContent = 'Connected';
  }
  return account;
}

/** Run one wallet action with a shared busy lock and status messages. */
async function withTx(label: string, action: (from: Hex) => Promise<void>): Promise<void> {
  if (busy) return;
  busy = true;
  renderBountyActions();
  try {
    const from = await ensureAccount();
    setStatus(`${label}: confirm in Core Wallet…`);
    await action(from);
  } catch (error) {
    console.error(label, error);
    setStatus(`${label} failed: ${errorMessage(error)}`);
  } finally {
    busy = false;
    renderBountyActions();
    renderBountyList();
  }
}

function formatRemaining(deadline: bigint): string {
  const seconds = Number(deadline - now);
  if (seconds <= 0) return 'ended';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`;
}

// ---------------------------------------------------------------------------
// Game rendering
// ---------------------------------------------------------------------------

function openBountiesFor(levelId: number): number {
  return bounties.filter((bounty) => bounty.levelId === levelId && bountyStatus(bounty, now) === 'open').length;
}

function renderLevelPicker(): void {
  levelSelect.replaceChildren(...LEVELS.map((level) => {
    const button = document.createElement('button');
    button.className = `level-button${level.id === state.levelId ? ' selected' : ''}`;
    const open = openBountiesFor(level.id);
    button.innerHTML = `${level.id}. ${level.name}${open ? ` <span class="bounty-dot" title="${open} open bounty">◆${open}</span>` : ''}`;
    button.addEventListener('click', () => loadLevel(level.id, null));
    return button;
  }));
}

function loadLevel(levelId: number, bountyId: bigint | null): void {
  state = createInitialState(levelId);
  facing = 0;
  activeBountyId = bountyId;
  scorePanel.textContent = '';
  render();
  void refreshScores();
}

async function refreshScores(): Promise<void> {
  if (!account) return;
  try {
    const scores = await readScores(account, state.levelId);
    scorePanel.textContent = `Best ${scores.personal || '—'} · Record ${scores.global || '—'} moves`;
  } catch {
    scorePanel.textContent = 'Scores unavailable';
  }
}

function render(): void {
  const level = getLevel(state.levelId);
  board.style.gridTemplateColumns = `repeat(${level.width}, var(--tile))`;
  board.classList.toggle('solved', state.solved);
  const tiles: HTMLElement[] = [];
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      const tile = document.createElement('div');
      const point = { x, y };
      const isPlayer = samePosition(point, state.player);
      tile.className = floodTileClasses({
        blocked: !isWalkable(level, point),
        goal: state.goals.some((goal) => samePosition(point, goal)),
        box: state.boxes.some((box) => samePosition(point, box)),
        player: isPlayer,
      }).join(' ');
      if (isPlayer) tile.classList.add(`face-${facing}`);
      tiles.push(tile);
    }
  }
  board.replaceChildren(...tiles);
  moveCount.textContent = String(state.moves);
  submitButton.disabled = !state.solved;
  if (!busy) {
    setStatus(state.solved
      ? `District ${state.levelId} secured in ${state.moves} moves!`
      : `District ${state.levelId} · ${level.name}: push every crate onto a life ring.`);
  }
  createLevel.textContent = String(state.levelId);
  createLevelName.textContent = level.name;
  createButton.disabled = !state.solved || activeBountyId !== null;
  createButton.textContent = activeBountyId !== null
    ? 'Leave bounty mode to post'
    : state.solved ? `Post bounty on district ${state.levelId}` : 'Solve this district first';
  renderLevelPicker();
  renderActiveBanner();
  renderBountyActions();
}

function move(direction: Move): void {
  const next = applyMove(state, direction);
  facing = direction;
  if (next === state && !state.solved) setStatus('Path blocked');
  else {
    state = next;
    render();
  }
}

// ---------------------------------------------------------------------------
// Bounty: active bounty (solver flow)
// ---------------------------------------------------------------------------

function activeBounty(): OnchainBounty | undefined {
  return activeBountyId === null ? undefined : bounties.find((bounty) => bounty.id === activeBountyId);
}

function renderActiveBanner(): void {
  const bounty = activeBounty();
  activeBanner.hidden = !bounty;
  if (bounty) activeBanner.textContent = `◆ Bounty #${bounty.id} · ${formatEther(bounty.reward)} AVAX · ${formatRemaining(bounty.deadline)}`;
}

function button(label: string, className: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const element = document.createElement('button');
  element.className = `btn ${className}`;
  element.textContent = label;
  element.disabled = disabled || busy;
  element.addEventListener('click', onClick);
  return element;
}

function renderBountyActions(): void {
  const bounty = activeBounty();
  if (!bounty) {
    bountyActions.replaceChildren();
    return;
  }
  const secret = account ? loadSolverSecret(account, bounty.id) : null;
  const children: HTMLElement[] = [];
  if (bountyStatus(bounty, now) !== 'open') {
    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = `Bounty #${bounty.id} is ${bountyStatus(bounty, now)}.`;
    children.push(note);
  } else {
    children.push(button('1 · Commit answer', 'btn-red', () => void commitActive(), !state.solved));
    children.push(button('2 · Reveal & claim', 'btn-gold', () => void revealBounty(bounty.id), !secret));
  }
  children.push(button('Exit bounty mode', 'btn-ghost btn-sm', () => loadLevel(state.levelId, null)));
  bountyActions.replaceChildren(...children);
}

async function commitActive(): Promise<void> {
  const bounty = activeBounty();
  if (!bounty || !state.solved) return;
  const moves = [...state.history];
  await withTx('Commit', async (from) => {
    const salt = randomSalt();
    // Save BEFORE sending: if the tab dies after the tx, the answer is still recoverable.
    saveSolverSecret(from, bounty.id, { moves, salt });
    const hash = await commitAnswer(bounty.id, solverCommitHash(moves, salt, from, bounty.id), from);
    setStatus('Commit sent. Waiting for Fuji…');
    await publicClient.waitForTransactionReceipt({ hash });
    setStatus(`Committed ✓ — only a hash is on-chain. Now Reveal & claim. ${txLink(hash)}`, true);
  });
}

async function revealBounty(bountyId: bigint): Promise<void> {
  await withTx('Reveal', async (from) => {
    const secret = loadSolverSecret(from, bountyId);
    if (!secret) throw new Error('No saved answer for this bounty in this browser');
    const commitment = await readCommitment(bountyId, from);
    if (commitment.blockNumber === 0n) throw new Error('Commit first');
    setStatus('Waiting for the next block…');
    await waitForBlockAfter(commitment.blockNumber);
    setStatus('Reveal: confirm in Core Wallet…');
    const hash = await revealAnswer(bountyId, secret.moves, secret.salt, from);
    setStatus('Reveal sent. The contract is replaying your route…');
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error('Reveal reverted');
    await refreshBounties();
    setStatus(`Bounty #${bountyId} paid out to you! ${txLink(hash)}`, true);
  });
}

// ---------------------------------------------------------------------------
// Bounty: create / reclaim / list
// ---------------------------------------------------------------------------

createForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!state.solved || activeBountyId !== null) return;
  const moves = [...state.history];
  const levelId = state.levelId;
  void withTx('Create bounty', async (from) => {
    const reward = parseEther(rewardInput.value || '0');
    if (reward <= 0n) throw new Error('Reward must be above 0');
    const hours = Math.max(1, Math.min(720, Number(hoursInput.value) || 24));
    const deadline = (await chainTime()) + BigInt(hours * 3600);
    const salt = randomSalt();
    const commit = creatorCommitHash(moves, salt, from, levelId);
    saveCreatorSecret(commit, { levelId, moves, salt });
    const hash = await createBounty(levelId, commit, deadline, reward, from);
    setStatus('Locking AVAX in escrow…');
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const id = bountyIdFromReceipt(receipt);
    await refreshBounties();
    setStatus(`Bounty #${id ?? '?'} is live with ${formatEther(reward)} AVAX. ${txLink(hash)}`, true);
  });
});

async function reclaim(bounty: OnchainBounty): Promise<void> {
  await withTx('Reclaim', async (from) => {
    const secret = loadCreatorSecret(bounty.creatorCommit);
    if (!secret) throw new Error('Creator answer not found in this browser');
    const hash = await reclaimBounty(bounty.id, secret.moves, secret.salt, from);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error('Reclaim reverted');
    await refreshBounties();
    setStatus(`Bounty #${bounty.id} refunded. ${txLink(hash)}`, true);
  });
}

function renderBountyList(): void {
  if (!bounties.length) {
    bountyList.innerHTML = '<p class="empty">No bounties yet. Solve a district and post the first one.</p>';
    return;
  }
  bountyList.replaceChildren(...bounties.map((bounty) => {
    const phase = bountyStatus(bounty, now);
    const card = document.createElement('article');
    card.className = `bounty-card px-box ${phase}`;
    const level = getLevel(bounty.levelId);
    const mine = sameAddress(bounty.creator, account);
    card.innerHTML = `
      <div class="bounty-top"><span class="bounty-id">#${bounty.id}</span><span class="badge ${phase}">${phase}</span></div>
      <div class="bounty-reward">${formatEther(bounty.reward)} AVAX</div>
      <p class="bounty-meta">District <b>${level.id} · ${level.name}</b></p>
      <p class="bounty-meta">${phase === 'solved' ? `Won by <b>${short(bounty.winner)}</b>` : phase === 'open' ? `<b>${formatRemaining(bounty.deadline)}</b>` : 'Deadline passed'} · by ${mine ? '<b>you</b>' : short(bounty.creator)}</p>`;
    if (phase === 'open') {
      card.append(button(activeBountyId === bounty.id ? 'Playing…' : 'Play bounty', 'btn-red', () => {
        loadLevel(bounty.levelId, bounty.id);
        document.querySelector('#play')?.scrollIntoView();
      }, activeBountyId === bounty.id));
      const secret = account ? loadSolverSecret(account, bounty.id) : null;
      if (secret && activeBountyId !== bounty.id) card.append(button('Reveal & claim', 'btn-gold', () => void revealBounty(bounty.id)));
    }
    if (phase === 'expired' && mine) {
      const canReclaim = !!loadCreatorSecret(bounty.creatorCommit);
      card.append(button(canReclaim ? 'Reclaim AVAX' : 'Answer not in this browser', 'btn-gold', () => void reclaim(bounty), !canReclaim));
    }
    return card;
  }));
}

async function refreshBounties(): Promise<void> {
  try {
    [bounties, now] = await Promise.all([listBounties(), chainTime()]);
    renderBountyList();
    renderLevelPicker();
    renderActiveBanner();
    renderBountyActions();
  } catch (error) {
    console.error('Bounty list', error);
    const notDeployed = errorMessage(error).includes('bountyCount');
    bountyList.innerHTML = notDeployed
      ? '<p class="empty">This contract has no bounty support yet. Deploy the new SokoChain.sol and set VITE_CONTRACT_ADDRESS.</p>'
      : `<p class="empty">Couldn’t read bounties from Fuji (${errorMessage(error)}).</p>`;
  }
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

document.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((element) => {
  element.addEventListener('click', () => move(Number(element.dataset.move) as Move));
});

document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement) return;
  const keys: Record<string, Move> = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
  if (event.key in keys) {
    event.preventDefault();
    move(keys[event.key]);
  }
});

$('#reset').addEventListener('click', () => loadLevel(state.levelId, activeBountyId));
$('#refresh-bounties').addEventListener('click', () => void refreshBounties());

connectButton.addEventListener('click', async () => {
  try {
    await ensureAccount();
    await Promise.all([refreshScores(), refreshBounties()]);
  } catch (error) {
    console.error('Wallet Connection Error:', error);
    setStatus(errorMessage(error) || 'Failed to connect wallet');
  }
});

submitButton.addEventListener('click', () => void withTx('Log score', async (from) => {
  const hash = await submitSolution(state.levelId, state.history, from);
  setStatus('Waiting for Avalanche confirmation…');
  await publicClient.waitForTransactionReceipt({ hash });
  await refreshScores();
  setStatus(`Score saved on Fuji. ${txLink(hash)}`, true);
}));

const sharedParameters = new URLSearchParams(location.search);
const sharedMoves = sharedParameters.get('moves');
const sharedLevel = Number(sharedParameters.get('level') ?? '1');
if (sharedMoves) {
  try {
    const moves = sharedMoves.split(',').filter(Boolean).map(Number);
    if (!LEVELS.some((level) => level.id === sharedLevel) || moves.some((value) => !Number.isInteger(value) || value < 0 || value > 3)) throw new Error('Invalid shared game');
    state = moves.reduce((current, value) => applyMove(current, value), createInitialState(sharedLevel));
  } catch {
    state = createInitialState();
  }
}

// Dev-only hook to preview bounty cards without a deployed contract (stripped from production builds).
if (import.meta.env.DEV) {
  (window as unknown as { __soko: unknown }).__soko = {
    preview(list: OnchainBounty[], at: bigint) {
      bounties = list;
      now = at;
      renderBountyList();
      render();
    },
  };
}

render();
void refreshBounties();
setInterval(() => {
  now += 1n;
  renderActiveBanner();
}, 1000);
