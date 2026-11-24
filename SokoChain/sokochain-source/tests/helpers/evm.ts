// Minimal in-process EVM harness for contract tests.
// Compiles contracts/SokoChain.sol with solc and executes calls with @ethereumjs/vm,
// with full control over block number and timestamp.
import solc from 'solc';
import { readFileSync } from 'node:fs';
import { createVM, type VM } from '@ethereumjs/vm';
import { Common, Hardfork, Mainnet } from '@ethereumjs/common';
import { createBlock } from '@ethereumjs/block';
import { createAccount, createAddressFromString, type Address } from '@ethereumjs/util';
import {
  bytesToHex,
  decodeErrorResult,
  decodeEventLog,
  decodeFunctionResult,
  encodeFunctionData,
  hexToBytes,
  type Abi,
  type Hex,
} from 'viem';

export function compileSokoChain(): { abi: Abi; bytecode: Hex } {
  const source = readFileSync('contracts/SokoChain.sol', 'utf8');
  const input = {
    language: 'Solidity',
    sources: { 'SokoChain.sol': { content: source } },
    settings: { evmVersion: 'cancun', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors ?? []).filter((error: { severity: string }) => error.severity === 'error');
  if (errors.length) throw new Error(errors.map((error: { formattedMessage: string }) => error.formattedMessage).join('\n'));
  const artifact = output.contracts['SokoChain.sol'].SokoChain;
  return { abi: artifact.abi, bytecode: `0x${artifact.evm.bytecode.object}` };
}

export type CallResult = { ok: boolean; error?: string; result?: unknown; logs: { eventName: string; args: Record<string, unknown> }[] };

export class Chain {
  blockNumber = 1n;
  timestamp = 1_700_000_000n;
  contract!: Address;

  private constructor(private vm: VM, private common: Common, readonly abi: Abi) {}

  static async deploy(): Promise<Chain> {
    const common = new Common({ chain: Mainnet, hardfork: Hardfork.Cancun });
    const vm = await createVM({ common });
    const { abi, bytecode } = compileSokoChain();
    const chain = new Chain(vm, common, abi);
    const deployer = await chain.account('0x00000000000000000000000000000000000000d0');
    const res = await vm.evm.runCall({ caller: deployer, data: hexToBytes(bytecode), gasLimit: 30_000_000n, block: chain.block() });
    if (res.execResult.exceptionError || !res.createdAddress) throw new Error('deploy failed');
    chain.contract = res.createdAddress;
    return chain;
  }

  async account(hex: Hex, balance = 1000n * 10n ** 18n): Promise<Address> {
    const address = createAddressFromString(hex);
    await this.vm.stateManager.putAccount(address, createAccount({ nonce: 0n, balance }));
    return address;
  }

  async balance(address: Address | Hex): Promise<bigint> {
    const target = typeof address === 'string' ? createAddressFromString(address) : address;
    const account = await this.vm.stateManager.getAccount(target);
    return account?.balance ?? 0n;
  }

  /** Advance to the next block (+1 number, +seconds time). */
  mine(seconds = 2n): void {
    this.blockNumber += 1n;
    this.timestamp += seconds;
  }

  private block() {
    return createBlock(
      { header: { number: this.blockNumber, timestamp: this.timestamp, gasLimit: 30_000_000n } },
      { common: this.common },
    );
  }

  async call(from: Address, functionName: string, args: unknown[] = [], value = 0n): Promise<CallResult> {
    const data = encodeFunctionData({ abi: this.abi, functionName, args } as never);
    const res = await this.vm.evm.runCall({
      caller: from,
      to: this.contract,
      data: hexToBytes(data),
      value,
      gasLimit: 30_000_000n,
      block: this.block(),
    });
    const returnData = bytesToHex(res.execResult.returnValue);
    if (res.execResult.exceptionError) {
      let error: string = res.execResult.exceptionError.error;
      try {
        const decoded = decodeErrorResult({ abi: this.abi, data: returnData });
        error = String(decoded.args?.[0] ?? decoded.errorName);
      } catch {
        /* non-string revert */
      }
      return { ok: false, error, logs: [] };
    }
    const logs = (res.execResult.logs ?? []).map(([, topics, logData]) => {
      const decoded = decodeEventLog({
        abi: this.abi,
        topics: topics.map((topic) => bytesToHex(topic)) as [Hex, ...Hex[]],
        data: bytesToHex(logData),
      });
      return { eventName: String(decoded.eventName), args: decoded.args as unknown as Record<string, unknown> };
    });
    let result: unknown;
    try {
      result = decodeFunctionResult({ abi: this.abi, functionName, data: returnData } as never);
    } catch {
      result = undefined;
    }
    return { ok: true, result, logs };
  }

  async read(functionName: string, args: unknown[] = []): Promise<unknown> {
    const caller = createAddressFromString('0x00000000000000000000000000000000000000ee');
    const res = await this.call(caller, functionName, args);
    if (!res.ok) throw new Error(`read ${functionName} failed: ${res.error}`);
    return res.result;
  }
}

export function route(text: string): number[] {
  const map: Record<string, number> = { U: 0, R: 1, D: 2, L: 3 };
  return [...text].map((char) => map[char]);
}

export const CANONICAL: Record<number, string> = {
  1: 'URRDRU',
  2: 'UUULLDDRDRUURUL',
  3: 'RDDLLRRUULLLDLDDRUUULUR',
  4: 'RDDLDLLLUURRDULLDDRR',
  5: 'RDDLLULURRURDDULLDDRR',
  6: 'LDDDRRUULRDDLLUUULURR',
  7: 'RUULLLULDRRRRDDLURULLLDDLLLUURRDRDLUUURDD',
  8: 'DLULDDLLUUUURRRDULLLDDDDRRUULRDRRULUULLLDDDURRDRUU',
};
