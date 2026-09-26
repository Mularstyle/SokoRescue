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
    scorePanel.textContent = `ด่าน ${state.levelId}: สถิติของคุณ ${scores.personal || '—'} · สถิติโลก ${scores.global || '—'} ก้าว`;
  } catch {
    scorePanel.textContent = 'ยังอ่านสถิติจาก Fuji ไม่ได้';
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
  status.textContent = state.solved ? `ภารกิจ ${state.levelId} สำเร็จ! ส่งเสบียงถึงผู้ประสบภัยแล้ว` : `ภารกิจ ${state.levelId}: ขับเรือส่งเสบียงให้ถึงผู้ประสบภัย`;
  renderLevelPicker();
}

function move(direction: Move): void {
  const next = applyMove(state, direction);
  if (next === state) status.textContent = 'ทางนี้ไปไม่ได้';
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
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'เชื่อม Wallet ไม่สำเร็จ';
  }
});

submitButton.addEventListener('click', async () => {
  try {
    if (!account) account = await connectWallet();
    status.textContent = 'กรุณายืนยันธุรกรรมใน Core Wallet…';
    const hash = await submitSolution(state.levelId, state.history, account);
    status.textContent = 'กำลังรอ Avalanche ยืนยัน…';
    await publicClient.waitForTransactionReceipt({ hash });
    const scores = await readScores(account, state.levelId);
    scorePanel.innerHTML = `ด่าน ${state.levelId}: บันทึกแล้ว ${scores.personal} ก้าว · สถิติโลก ${scores.global} ก้าว · <a href="https://subnets-test.avax.network/c-chain/tx/${hash}" target="_blank" rel="noreferrer">ดูธุรกรรม</a>`;
    status.textContent = 'บันทึกผลบน Fuji สำเร็จ';
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'ส่งผลไม่สำเร็จ';
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
