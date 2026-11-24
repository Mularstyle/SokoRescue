import { beforeEach, describe, expect, it } from 'vitest';
import { buildNetworks, resolveNetwork } from '../src/networks';
import { loadSolverSecret, saveSolverSecret } from '../src/bounty';

const FUJI_ADDR = '0x550389FA1204B5C4968d6C4942D4F3996940217f';
const MAIN_ADDR = '0x1111111111111111111111111111111111111111';

describe('networks', () => {
  it('describes Fuji and Avalanche C-Chain with their chain ids and explorers', () => {
    const networks = buildNetworks({ fuji: FUJI_ADDR, mainnet: MAIN_ADDR });
    expect(networks.fuji).toMatchObject({ chainId: 43113, testnet: true, contract: FUJI_ADDR, explorer: 'https://testnet.snowtrace.io' });
    expect(networks.mainnet).toMatchObject({ chainId: 43114, testnet: false, contract: MAIN_ADDR, explorer: 'https://snowtrace.io' });
  });

  it('treats a missing or malformed address as "not deployed"', () => {
    const networks = buildNetworks({ fuji: FUJI_ADDR, mainnet: '' });
    expect(networks.mainnet.contract).toBeUndefined();
    expect(buildNetworks({ fuji: '0x123', mainnet: undefined }).fuji.contract).toBeUndefined();
  });

  it('defaults to Fuji and only picks mainnet when it is deployed', () => {
    const deployed = buildNetworks({ fuji: FUJI_ADDR, mainnet: MAIN_ADDR });
    const notDeployed = buildNetworks({ fuji: FUJI_ADDR, mainnet: '' });
    expect(resolveNetwork(deployed, null, null)).toBe('fuji');
    expect(resolveNetwork(deployed, 'mainnet', null)).toBe('mainnet');
    expect(resolveNetwork(deployed, 'fuji', 'mainnet')).toBe('mainnet'); // ?network= wins over saved choice
    expect(resolveNetwork(notDeployed, 'mainnet', 'mainnet')).toBe('fuji');
    expect(resolveNetwork(deployed, 'bogus', null)).toBe('fuji');
  });
});

describe('solver secrets are kept per chain', () => {
  beforeEach(() => localStorage.clear());
  const ALICE = '0x00000000000000000000000000000000000A11CE' as const;
  const SALT = `0x${'cd'.repeat(32)}` as const;

  it('does not leak a Fuji answer into the same bounty id on mainnet', () => {
    saveSolverSecret(ALICE, 1n, { moves: [1], salt: SALT }, 43113);
    expect(loadSolverSecret(ALICE, 1n, 43113)).toEqual({ moves: [1], salt: SALT });
    expect(loadSolverSecret(ALICE, 1n, 43114)).toBeNull();
  });

  it('still finds Fuji answers saved before chains were tracked', () => {
    localStorage.setItem(`sokorescue:solver:${ALICE.toLowerCase()}:2`, JSON.stringify({ moves: [3], salt: SALT }));
    expect(loadSolverSecret(ALICE, 2n, 43113)).toEqual({ moves: [3], salt: SALT });
    expect(loadSolverSecret(ALICE, 2n, 43114)).toBeNull();
  });
});
