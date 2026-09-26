import { describe, expect, it } from 'vitest';
import solc from 'solc';
import { readFile } from 'node:fs/promises';

describe('SokoChain contract artifact', () => {
  it('compiles for Cancun and exposes the eight-level public interface', async () => {
    const source = await readFile('contracts/SokoChain.sol', 'utf8');
    const input = {
      language: 'Solidity',
      sources: { 'SokoChain.sol': { content: source } },
      settings: {
        evmVersion: 'cancun',
        outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
      },
    };
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    const errors = (output.errors ?? []).filter((error: { severity: string }) => error.severity === 'error');
    expect(errors).toEqual([]);
    expect(source).toContain('levelId >= 1 && levelId <= 8');
    const artifact = output.contracts['SokoChain.sol'].SokoChain;
    const functions = artifact.abi.filter((item: { type: string }) => item.type === 'function');
    const names = functions.map((item: { name: string }) => item.name);
    expect(names).toEqual(expect.arrayContaining(['submitSolution', 'bestMoves', 'globalBestMoves', 'globalBestPlayer', 'validSubmissions', 'playerCount']));
    const submitSolution = functions.find((item: { name: string }) => item.name === 'submitSolution');
    expect(submitSolution.inputs.map((input: { type: string }) => input.type)).toEqual(['uint8', 'uint8[]']);
    const bestMoves = functions.find((item: { name: string }) => item.name === 'bestMoves');
    expect(bestMoves.inputs.map((input: { type: string }) => input.type)).toEqual(['address', 'uint8']);
    const globalBestMoves = functions.find((item: { name: string }) => item.name === 'globalBestMoves');
    expect(globalBestMoves.inputs.map((input: { type: string }) => input.type)).toEqual(['uint8']);
    expect(artifact.evm.bytecode.object.length).toBeGreaterThan(0);
  });
});
