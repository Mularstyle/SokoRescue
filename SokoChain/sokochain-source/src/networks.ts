// Networks the site can talk to. Mainnet is offered only once its contract address is configured.
import { avalanche, avalancheFuji } from 'viem/chains';
import type { Chain, Hex } from 'viem';

export type NetworkId = 'fuji' | 'mainnet';

export type Network = Readonly<{
  id: NetworkId;
  label: string;
  short: string;
  chain: Chain;
  chainId: number;
  testnet: boolean;
  contract?: Hex;
  explorer: string;
  rpcUrl: string;
}>;

const isAddress = (value: string | undefined): value is Hex => !!value && /^0x[a-fA-F0-9]{40}$/.test(value);

export function buildNetworks(addresses: { fuji?: string; mainnet?: string }): Record<NetworkId, Network> {
  return {
    fuji: {
      id: 'fuji',
      label: 'Fuji Testnet',
      short: 'Fuji',
      chain: avalancheFuji,
      chainId: 43113,
      testnet: true,
      contract: isAddress(addresses.fuji) ? addresses.fuji : undefined,
      explorer: 'https://testnet.snowtrace.io',
      rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    },
    mainnet: {
      id: 'mainnet',
      label: 'Avalanche C-Chain',
      short: 'Mainnet',
      chain: avalanche,
      chainId: 43114,
      testnet: false,
      contract: isAddress(addresses.mainnet) ? addresses.mainnet : undefined,
      explorer: 'https://snowtrace.io',
      rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    },
  };
}

/** URL `?network=` beats the saved choice; anything unknown or not deployed falls back to Fuji. */
export function resolveNetwork(networks: Record<NetworkId, Network>, saved: string | null, fromUrl: string | null): NetworkId {
  for (const candidate of [fromUrl, saved]) {
    if ((candidate === 'fuji' || candidate === 'mainnet') && networks[candidate].contract) return candidate;
  }
  return 'fuji';
}

export const NETWORKS = buildNetworks({
  // VITE_CONTRACT_ADDRESS is the original (Fuji) variable; keep it working.
  fuji: import.meta.env.VITE_CONTRACT_ADDRESS_FUJI || import.meta.env.VITE_CONTRACT_ADDRESS,
  mainnet: import.meta.env.VITE_CONTRACT_ADDRESS_MAINNET,
});

/** Preset levels have public solutions, so bounties on them are only offered where money is fake. */
export function allowsPresetBounties(network: Network): boolean {
  return network.testnet;
}
