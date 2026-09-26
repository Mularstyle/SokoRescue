import { createPublicClient, createWalletClient, custom, http } from 'viem';
import { avalancheFuji } from 'viem/chains';
import type { Move } from './game';

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS as `0x${string}` | undefined;

export const ABI = [
  { type: 'function', name: 'submitSolution', stateMutability: 'nonpayable', inputs: [{ name: 'levelId', type: 'uint8' }, { name: 'moves', type: 'uint8[]' }], outputs: [] },
  { type: 'function', name: 'bestMoves', stateMutability: 'view', inputs: [{ name: '', type: 'address' }, { name: '', type: 'uint8' }], outputs: [{ name: '', type: 'uint16' }] },
  { type: 'function', name: 'globalBestMoves', stateMutability: 'view', inputs: [{ name: '', type: 'uint8' }], outputs: [{ name: '', type: 'uint16' }] },
  { type: 'function', name: 'globalBestPlayer', stateMutability: 'view', inputs: [{ name: '', type: 'uint8' }], outputs: [{ name: '', type: 'address' }] },
  { type: 'function', name: 'validSubmissions', stateMutability: 'view', inputs: [{ name: '', type: 'uint8' }], outputs: [{ name: '', type: 'uint256' }] },
] as const;

export const publicClient = createPublicClient({ chain: avalancheFuji, transport: http() });

function requireContractAddress(): `0x${string}` {
  if (!CONTRACT_ADDRESS || !/^0x[a-fA-F0-9]{40}$/.test(CONTRACT_ADDRESS)) {
    throw new Error('ยังไม่ได้ตั้งค่า VITE_CONTRACT_ADDRESS');
  }
  return CONTRACT_ADDRESS;
}

export async function connectWallet(): Promise<`0x${string}`> {
  if (!window.ethereum) throw new Error('ไม่พบ Core Wallet');
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xa869' }] });
  } catch (error: any) {
    if (error.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0xa869',
          chainName: 'Avalanche Fuji Testnet',
          nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
          rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'],
          blockExplorerUrls: ['https://testnet.snowtrace.io/']
        }]
      });
    } else {
      throw error;
    }
  }
  const wallet = createWalletClient({ chain: avalancheFuji, transport: custom(window.ethereum) });
  const [account] = await wallet.requestAddresses();
  return account;
}

export async function submitSolution(levelId: number, moves: readonly Move[], account: `0x${string}`): Promise<`0x${string}`> {
  if (!window.ethereum) throw new Error('ไม่พบ Core Wallet');
  const wallet = createWalletClient({ chain: avalancheFuji, transport: custom(window.ethereum) });
  return wallet.writeContract({ account, address: requireContractAddress(), abi: ABI, functionName: 'submitSolution', args: [levelId, [...moves]] });
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
