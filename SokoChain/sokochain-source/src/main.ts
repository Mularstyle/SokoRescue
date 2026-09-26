import './style.css';
import { LEVELS, applyMove, createInitialState, getLevel, isWalkable, samePosition, type GameState, type Move } from './game';
import { connectWallet, publicClient, readScores, submitSolution } from './contract';
import { floodTileClasses } from './theme';

let state: GameState = createInitialState();
let account: `0x${string}` | null = null;

const board = document.querySelector<HTMLDivElement>('#board')!;
const moveCount = document.querySelector<HTMLElement>('#move-count')!;
const status = document.querySelector<HTMLElement>('#status')!;
const walletLabel = document.querySelector<HTMLElement>('#wallet-label')!;
const submitButton = document.querySelector<HTMLButtonElement>('#submit-score')!;
const scorePanel = document.querySelector<HTMLElement>('#scores')!;
const levelSelect = document.querySelector<HTMLElement>('#level-select')!;

function renderLevelPicker(): void {
  levelSelect.replaceChildren(...LEVELS.map((level) => {
    const button = document.createElement('button');
    button.className = `level-button${level.id === state.levelId ? ' selected' : ''}`;
    button.textContent = `${level.id}. ${level.name}`;
    button.addEventListener('click', () => {
      state = createInitialState(level.id);
      scorePanel.textContent = '';
      render();
      void refreshScores();
    });
    return button;
  }));
}

async function refreshScores(): Promise<void> {
  if (!account) return;
  try {
    const scores = await readScores(account, state.levelId);
    scorePanel.textContent = `Level ${state.levelId}: Your Score ${scores.personal || '—'} · World Record ${scores.global || '—'} moves`;
  } catch {
    scorePanel.textContent = 'Unable to read scores from Fuji';
  }
}

function render(): void {
  board.replaceChildren();
  const level = getLevel(state.levelId);
  board.style.gridTemplateColumns = `repeat(${level.width}, 1fr)`;
  board.style.aspectRatio = `${level.width} / ${level.height}`;
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      const tile = document.createElement('div');
      const point = { x, y };
      tile.className = floodTileClasses({
        blocked: !isWalkable(level, point),
        goal: state.goals.some((goal) => samePosition(point, goal)),
        box: state.boxes.some((box) => samePosition(point, box)),
        player: samePosition(point, state.player),
      }).join(' ');
      board.append(tile);
    }
  }
  moveCount.textContent = String(state.moves);
  submitButton.disabled = !state.solved;
  status.textContent = state.solved ? `Mission ${state.levelId} Complete! Supplies delivered` : `Mission ${state.levelId}: Deliver supplies to survivors`;
  renderLevelPicker();
}

function move(direction: Move): void {
  const next = applyMove(state, direction);
  if (next === state) status.textContent = 'Path blocked';
  state = next;
  render();
}

document.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((button) => {
  button.addEventListener('click', () => move(Number(button.dataset.move) as Move));
});

document.addEventListener('keydown', (event) => {
  const keys: Record<string, Move> = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
  if (event.key in keys) {
    event.preventDefault();
    move(keys[event.key]);
  }
});

document.querySelector('#reset')!.addEventListener('click', () => {
  state = createInitialState(state.levelId);
  scorePanel.textContent = '';
  render();
});

document.querySelector('#connect-wallet')!.addEventListener('click', async () => {
  try {
    account = await connectWallet();
    walletLabel.textContent = `${account.slice(0, 6)}…${account.slice(-4)}`;
    await refreshScores();
  } catch (error: any) {
    console.error('Wallet Connection Error:', error);
    status.textContent = error?.message || 'Failed to connect wallet';
  }
});

submitButton.addEventListener('click', async () => {
  try {
    if (!account) account = await connectWallet();
    status.textContent = 'Please confirm transaction in Core Wallet…';
    const hash = await submitSolution(state.levelId, state.history, account);
    status.textContent = 'Waiting for Avalanche confirmation…';
    await publicClient.waitForTransactionReceipt({ hash });
    const scores = await readScores(account, state.levelId);
    scorePanel.innerHTML = `Level ${state.levelId}: Saved ${scores.personal} moves · World Record ${scores.global} moves · <a href="https://subnets-test.avax.network/c-chain/tx/${hash}" target="_blank" rel="noreferrer">View Tx</a>`;
    status.textContent = 'Successfully saved on Fuji';
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Failed to submit';
  }
});



const sharedParameters = new URLSearchParams(location.search);
const sharedMoves = sharedParameters.get('moves');
const sharedLevel = Number(sharedParameters.get('level') ?? '1');
if (sharedMoves) {
  try {
    const moves = sharedMoves.split(',').filter(Boolean).map(Number);
    if (!LEVELS.some((level) => level.id === sharedLevel) || moves.some((move) => !Number.isInteger(move) || move < 0 || move > 3)) throw new Error('Invalid shared game');
    state = moves.reduce((current, value) => applyMove(current, value), createInitialState(sharedLevel));
  } catch {
    state = createInitialState();
  }
}

render();
