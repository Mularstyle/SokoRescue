import { createPublicClient, createWalletClient, custom, http, parseEventLogs, type Hex, type PublicClient, type TransactionReceipt } from 'viem';
import { NETWORKS, type Network, type NetworkId } from './networks';
import type { Move } from './game';
import type { OnchainLevel } from './levelCodec';


export const ABI = [
  { type: 'function', name: 'submitSolution', stateMutability: 'nonpayable', inputs: [{ name: 'levelId', type: 'uint8' }, { name: 'moves', type: 'uint8[]' }], outputs: [] },
  { type: 'function', name: 'bestMoves', stateMutability: 'view', inputs: [{ name: '', type: 'address' }, { name: '', type: 'uint8' }], outputs: [{ name: '', type: 'uint16' }] },
  { type: 'function', name: 'globalBestMoves', stateMutability: 'view', inputs: [{ name: '', type: 'uint8' }], outputs: [{ name: '', type: 'uint16' }] },
  { type: 'function', name: 'globalBestPlayer', stateMutability: 'view', inputs: [{ name: '', type: 'uint8' }], outputs: [{ name: '', type: 'address' }] },
  { type: 'function', name: 'validSubmissions', stateMutability: 'view', inputs: [{ name: '', type: 'uint8' }], outputs: [{ name: '', type: 'uint256' }] },
  // Puzzle Bounty
  { type: 'function', name: 'createBounty', stateMutability: 'payable', inputs: [{ name: 'levelId', type: 'uint8' }, { name: 'creatorCommit', type: 'bytes32' }, { name: 'deadline', type: 'uint64' }], outputs: [{ name: 'bountyId', type: 'uint256' }] },
  {
    type: 'function', name: 'createCustomBounty', stateMutability: 'payable',
    inputs: [{ name: 'level', type: 'tuple', components: [
        { name: 'floor', type: 'uint128' }, { name: 'goals', type: 'uint128' }, { name: 'boxes', type: 'uint128' },
        { name: 'width', type: 'uint8' }, { name: 'height', type: 'uint8' }, { name: 'player', type: 'uint8' },
      ] }, { name: 'creatorCommit', type: 'bytes32' }, { name: 'deadline', type: 'uint64' }],
    outputs: [{ name: 'bountyId', type: 'uint256' }],
  },
  {
    type: 'function', name: 'getBountyLevel', stateMutability: 'view', inputs: [{ name: 'bountyId', type: 'uint256' }],
    outputs: [{ name: '', type: 'tuple', components: [
        { name: 'floor', type: 'uint128' }, { name: 'goals', type: 'uint128' }, { name: 'boxes', type: 'uint128' },
        { name: 'width', type: 'uint8' }, { name: 'height', type: 'uint8' }, { name: 'player', type: 'uint8' },
      ] }],
  },
  { type: 'function', name: 'commit', stateMutability: 'nonpayable', inputs: [{ name: 'bountyId', type: 'uint256' }, { name: 'commitHash', type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'reveal', stateMutability: 'nonpayable', inputs: [{ name: 'bountyId', type: 'uint256' }, { name: 'moves', type: 'uint8[]' }, { name: 'salt', type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'reclaim', stateMutability: 'nonpayable', inputs: [{ name: 'bountyId', type: 'uint256' }, { name: 'moves', type: 'uint8[]' }, { name: 'salt', type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'bountyCount', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'commitments', stateMutability: 'view', inputs: [{ name: '', type: 'uint256' }, { name: '', type: 'address' }], outputs: [{ name: 'hash', type: 'bytes32' }, { name: 'blockNumber', type: 'uint64' }] },
  {
    type: 'function', name: 'getBounty', stateMutability: 'view', inputs: [{ name: 'bountyId', type: 'uint256' }],
    outputs: [{
      name: '', type: 'tuple', components: [
        { name: 'creator', type: 'address' }, { name: 'levelId', type: 'uint8' }, { name: 'deadline', type: 'uint64' },
        { name: 'solved', type: 'bool' }, { name: 'reclaimed', type: 'bool' }, { name: 'reward', type: 'uint256' },
        { name: 'creatorCommit', type: 'bytes32' }, { name: 'winner', type: 'address' },
      ],
    }],
  },
  { type: 'event', name: 'BountyCreated', anonymous: false, inputs: [{ name: 'bountyId', type: 'uint256', indexed: true }, { name: 'creator', type: 'address', indexed: true }, { name: 'levelId', type: 'uint8', indexed: true }, { name: 'reward', type: 'uint256', indexed: false }, { name: 'deadline', type: 'uint64', indexed: false }] },
] as const;

// --- Network ----------------------------------------------------------------
// Live bindings: importers always see the current network, client and explorer.

export let network: Network = NETWORKS.fuji;
export let publicClient: PublicClient = createPublicClient({ chain: network.chain, transport: http() }) as PublicClient;
export let EXPLORER_TX = `${network.explorer}/tx/`;

export function setNetwork(id: NetworkId): void {
  network = NETWORKS[id];
  publicClient = createPublicClient({ chain: network.chain, transport: http() }) as PublicClient;
  EXPLORER_TX = `${network.explorer}/tx/`;
}

function requireContractAddress(): `0x${string}` {
  if (!network.contract) throw new Error(`No SokoChain contract configured for ${network.label}`);
  return network.contract;
}

/** Ask the wallet to switch to the selected network, adding it first if the wallet doesn't know it. */
async function switchWalletChain(): Promise<void> {
  if (!window.ethereum) throw new Error('Core Wallet not found');
  const chainId = `0x${network.chainId.toString(16)}`;
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] });
  } catch (error: any) {
    if (error?.code !== 4902) throw error;
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId,
        chainName: network.testnet ? 'Avalanche Fuji Testnet' : 'Avalanche C-Chain',
        nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
        rpcUrls: [network.rpcUrl],
        blockExplorerUrls: [`${network.explorer}/`],
      }],
    });
  }
}

export async function connectWallet(): Promise<`0x${string}`> {
  if (!window.ethereum) throw new Error('Core Wallet not found');
  const wallet = createWalletClient({ chain: network.chain, transport: custom(window.ethereum) });
  const [account] = await wallet.requestAddresses();
  await switchWalletChain();
  return account;
}

/** Wallet client on the selected network; switches the wallet first so a tx never lands on the wrong chain. */
async function walletClient() {
  await switchWalletChain();
  return createWalletClient({ chain: network.chain, transport: custom(window.ethereum!) });
}

export async function submitSolution(levelId: number, moves: readonly Move[], account: `0x${string}`): Promise<`0x${string}`> {
  return (await walletClient()).writeContract({ account, address: requireContractAddress(), abi: ABI, functionName: 'submitSolution', args: [levelId, [...moves]] });
}

// --- Puzzle Bounty -----------------------------------------------------------

export type OnchainBounty = {
  id: bigint; creator: Hex; levelId: number; deadline: bigint; solved: boolean;
  reclaimed: boolean; reward: bigint; creatorCommit: Hex; winner: Hex;
};

export async function listBounties(): Promise<OnchainBounty[]> {
  const address = requireContractAddress();
  const count = await publicClient.readContract({ address, abi: ABI, functionName: 'bountyCount' });
  const ids = Array.from({ length: Number(count) }, (_, index) => BigInt(index + 1)).reverse();
  return Promise.all(ids.map(async (id) => ({
    id,
    ...(await publicClient.readContract({ address, abi: ABI, functionName: 'getBounty', args: [id] })),
  })));
}

export async function readCommitment(bountyId: bigint, account: Hex): Promise<{ hash: Hex; blockNumber: bigint }> {
  const [hash, blockNumber] = await publicClient.readContract({ address: requireContractAddress(), abi: ABI, functionName: 'commitments', args: [bountyId, account] });
  return { hash, blockNumber };
}

export async function chainTime(): Promise<bigint> {
  return (await publicClient.getBlock()).timestamp;
}

export async function createBounty(levelId: number, creatorCommit: Hex, deadline: bigint, reward: bigint, account: Hex): Promise<Hex> {
  return (await walletClient()).writeContract({ account, address: requireContractAddress(), abi: ABI, functionName: 'createBounty', args: [levelId, creatorCommit, deadline], value: reward });
}

export async function createCustomBounty(level: OnchainLevel, creatorCommit: Hex, deadline: bigint, reward: bigint, account: Hex): Promise<Hex> {
  return (await walletClient()).writeContract({ account, address: requireContractAddress(), abi: ABI, functionName: 'createCustomBounty', args: [level, creatorCommit, deadline], value: reward });
}

export async function readBountyLevel(bountyId: bigint): Promise<OnchainLevel> {
  return publicClient.readContract({ address: requireContractAddress(), abi: ABI, functionName: 'getBountyLevel', args: [bountyId] });
}

export async function commitAnswer(bountyId: bigint, commitHash: Hex, account: Hex): Promise<Hex> {
  return (await walletClient()).writeContract({ account, address: requireContractAddress(), abi: ABI, functionName: 'commit', args: [bountyId, commitHash] });
}

export async function revealAnswer(bountyId: bigint, moves: readonly number[], salt: Hex, account: Hex): Promise<Hex> {
  return (await walletClient()).writeContract({ account, address: requireContractAddress(), abi: ABI, functionName: 'reveal', args: [bountyId, [...moves], salt] });
}

export async function reclaimBounty(bountyId: bigint, moves: readonly number[], salt: Hex, account: Hex): Promise<Hex> {
  return (await walletClient()).writeContract({ account, address: requireContractAddress(), abi: ABI, functionName: 'reclaim', args: [bountyId, [...moves], salt] });
}

export function bountyIdFromReceipt(receipt: TransactionReceipt): bigint | null {
  const [event] = parseEventLogs({ abi: ABI, eventName: 'BountyCreated', logs: receipt.logs });
  return event ? event.args.bountyId : null;
}

/** reveal() must land in a later block than commit(); wait until the chain moves past it. */
export async function waitForBlockAfter(blockNumber: bigint): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt++) {
    if ((await publicClient.getBlockNumber()) > blockNumber) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Fuji did not produce a new block in time — try Reveal again');
}

export async function readScores(account: `0x${string}`, levelId: number): Promise<{ personal: number; global: number }> {
  const address = requireContractAddress();
  const [personal, global] = await Promise.all([
    publicClient.readContract({ address, abi: ABI, functionName: 'bestMoves', args: [account, levelId] }),
    publicClient.readContract({ address, abi: ABI, functionName: 'globalBestMoves', args: [levelId] }),
  ]);
  return { personal: Number(personal), global: Number(global) };
}

declare global {
  interface Window {
    ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
  }
}
