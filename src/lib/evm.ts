import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  type Eip1193Provider,
  type Provider,
  type Signer,
} from "ethers";
import { EVM } from "@/config/chains";
import bridgeAbi from "@/abi/BridgeContract.json";

export const ContractState = { ADMIN_CONTROL: 0n, NORMAL_OPERATION: 1n } as const;

/** Read-only provider against the active EVM chain's RPC (no wallet needed). */
export function getReadProvider(): JsonRpcProvider {
  return new JsonRpcProvider(EVM.rpcUrl, EVM.chainIdNum);
}

export function getInjectedProvider(): BrowserProvider {
  if (!window.ethereum) throw new Error("MetaMask (window.ethereum) not found");
  return new BrowserProvider(window.ethereum as Eip1193Provider);
}

export function getBridgeContract(runner: Provider | Signer): Contract {
  return new Contract(EVM.bridgeAddress, bridgeAbi, runner);
}

export function getErc20Contract(address: string, runner: Provider | Signer): Contract {
  const abi = [
    "function transfer(address to, uint256 value) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
  ];
  return new Contract(address, abi, runner);
}

/** Ensure the injected wallet is on the active EVM chain; switches (adds) if needed. */
export async function ensureEvmNetwork(provider: BrowserProvider): Promise<void> {
  const net = await provider.getNetwork();
  if (net.chainId === BigInt(EVM.chainIdNum)) return;
  try {
    await provider.send("wallet_switchEthereumChain", [{ chainId: EVM.chainIdHex }]);
  } catch (err: unknown) {
    // 4902 = chain not added to the wallet yet.
    if ((err as { code?: number })?.code === 4902) {
      await provider.send("wallet_addEthereumChain", [
        {
          chainId: EVM.chainIdHex,
          chainName: EVM.name,
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: [EVM.rpcUrl],
          blockExplorerUrls: [EVM.explorer],
        },
      ]);
    } else {
      throw err;
    }
  }
}

export interface BridgeState {
  state: bigint;
  stateLabel: "ADMIN_CONTROL" | "NORMAL_OPERATION";
  latestEpochId: bigint;
  submissionTimestamp: bigint;
}

export async function readBridgeState(provider: Provider): Promise<BridgeState> {
  const bridge = getBridgeContract(provider);
  const [state, latest] = await Promise.all([
    bridge.getCurrentState() as Promise<bigint>,
    bridge.getLatestEpochInfo() as Promise<{ epochId: bigint; timestamp: bigint }>,
  ]);
  return {
    state,
    stateLabel: state === ContractState.NORMAL_OPERATION ? "NORMAL_OPERATION" : "ADMIN_CONTROL",
    latestEpochId: latest.epochId,
    submissionTimestamp: latest.timestamp,
  };
}

// Custom-error selectors computed from the actual BridgeContract ABI
// (keccak256 of the error signature, first 4 bytes). The values in the official
// withdraw-tokens.js were stale and did NOT match this contract — always derive
// from the ABI.
const ERR_REQUEST_ALREADY_PROCESSED = "0xa6bc74c4";
const BRIDGE_ERROR_SELECTORS: Record<string, string> = {
  "0x2745ed2e": "BridgeNotOperational — contract is not in NORMAL_OPERATION",
  "0xd5b25b63": "InvalidEpoch — epoch has no group key / not found",
  "0x2c5211c6": "InvalidAmount — amount is zero or invalid",
  [ERR_REQUEST_ALREADY_PROCESSED]: "RequestAlreadyProcessed — this withdrawal was already completed",
  "0x8baa579f": "InvalidSignature — BLS signature verification failed",
  "0x9d2a9928": "MustBeInAdminControl",
  "0x4ee7e029": "InvalidEpochSequence — epochs must be submitted sequentially",
  "0x89555472": "NoValidGenesisEpoch",
  "0x9b0056ac": "TimeoutNotReached",
};

/** Selector for RequestAlreadyProcessed — the withdrawal already settled on-chain. */
export function isAlreadyProcessed(err: unknown): boolean {
  const e = err as { data?: string; info?: { error?: { data?: string } } };
  const data = e?.data ?? e?.info?.error?.data;
  return typeof data === "string" && data.slice(0, 10) === ERR_REQUEST_ALREADY_PROCESSED;
}

export interface WithdrawCommand {
  epochId: number;
  requestId: string; // 0x hex, 32 bytes
  recipient: string;
  tokenContract: string;
  amount: bigint;
  signature: string; // 0x hex, 128 bytes
}

/** Thrown when the bridge reports the withdrawal was already settled on-chain. */
export class AlreadyProcessedError extends Error {
  constructor() {
    super("RequestAlreadyProcessed");
    this.name = "AlreadyProcessedError";
  }
}

/** Release the ERC-20 with the validator BLS signature. */
export async function submitWithdraw(
  provider: BrowserProvider,
  cmd: WithdrawCommand,
): Promise<string> {
  await ensureEvmNetwork(provider);
  const signer = await provider.getSigner();
  const bridge = getBridgeContract(signer);
  try {
    const tx = await bridge.withdraw(cmd);
    const receipt = await tx.wait();
    return receipt?.hash ?? tx.hash;
  } catch (err) {
    if (isAlreadyProcessed(err)) throw new AlreadyProcessedError();
    throw new Error(decodeBridgeError(err));
  }
}

export interface MintCommand {
  epochId: number;
  requestId: string; // 0x hex, 32 bytes
  recipient: string;
  amount: bigint;
  signature: string; // 0x hex, 128 bytes
}

/** Mint WGNK on Sepolia for a native-GNK bridge (no tokenContract — WGNK is the bridge). */
export async function submitMint(provider: BrowserProvider, cmd: MintCommand): Promise<string> {
  await ensureEvmNetwork(provider);
  const signer = await provider.getSigner();
  const bridge = getBridgeContract(signer);
  try {
    const tx = await bridge.mintWithSignature(cmd);
    const receipt = await tx.wait();
    return receipt?.hash ?? tx.hash;
  } catch (err) {
    if (isAlreadyProcessed(err)) throw new AlreadyProcessedError();
    throw new Error(decodeBridgeError(err));
  }
}

/** Defensive epoch catch-up: submit one missing group key (must be latest+1). */
export async function submitGroupKey(
  provider: BrowserProvider,
  epochId: number,
  groupKeyHex: string,
  validationSigHex: string,
): Promise<string> {
  await ensureEvmNetwork(provider);
  const signer = await provider.getSigner();
  const bridge = getBridgeContract(signer);
  try {
    const tx = await bridge.submitGroupKey(epochId, groupKeyHex, validationSigHex);
    const receipt = await tx.wait();
    return receipt?.hash ?? tx.hash;
  } catch (err) {
    throw new Error(decodeBridgeError(err));
  }
}

/** Best-effort decode of a revert into a readable bridge error, else raw message. */
export function decodeBridgeError(err: unknown): string {
  const e = err as {
    code?: string | number;
    data?: string;
    info?: { error?: { code?: number; data?: string } };
    message?: string;
  };
  // User cancelled the wallet prompt — not a failure, surface it gently.
  if (e?.code === "ACTION_REJECTED" || e?.info?.error?.code === 4001) {
    return "You cancelled the transaction in MetaMask.";
  }
  const data = e?.data ?? e?.info?.error?.data;
  if (typeof data === "string" && data.startsWith("0x") && data.length >= 10) {
    const named = BRIDGE_ERROR_SELECTORS[data.slice(0, 10)];
    if (named) return named;
  }
  return e?.message ?? "Unknown EVM error";
}
