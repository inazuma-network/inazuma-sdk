/**
 * Client-safe helpers for the Inazuma Core chain (our own L1, not EVM).
 * Addresses are base58-encoded ed25519 public keys, Solana style.
 */

export const ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const isAddress = (value: string) => ADDRESS_RE.test(value.trim());

export const shortAddress = (value: string, size = 4) =>
  value.length > size * 2 + 2 ? `${value.slice(0, size)}…${value.slice(-size)}` : value;

export const shortHash = (value: string) => shortAddress(value, 6);

export type ChainInfo = {
  chain: string;
  chainId: number;
  symbol: string;
  decimals: number;
  blockTimeMs: number;
  height: number;
  tipHash: string;
  finalizedHeight: number;
  peers: number;
  mode: string;
  accounts: number;
  totalTxs: number;
  mempool: number;
  totalSupply: string;
  totalStaked: string;
  validators: number;
  minStake: string;
  blockReward: string;
  tokens: number;
};

export type BlockSummary = {
  height: number;
  hash: string;
  parentHash?: string | undefined;
  timestampMs?: number | undefined;
  producer?: string | undefined;
  txCount?: number | undefined;
  transactions?: TxSummary[] | undefined;
  stateRoot?: string | undefined;
  finalized?: boolean | undefined;
};

export type TxSummary = {
  hash: string;
  kind: string;
  from?: string | undefined;
  to?: string | undefined;
  amountInaz?: string | undefined;
  feeInaz?: string | undefined;
  nonce?: number | undefined;
  blockHeight?: number | undefined;
  status?: string | undefined;
};

export type AccountInfo = {
  address: string;
  balanceInaz: string;
  stakedInaz: string;
  unbondingInaz: string;
  rewardsInaz: string;
  isValidator: boolean;
  blocksProduced: number;
  nonce: number;
};

export function timeAgo(ms?: number) {
  if (!ms) return "—";
  const secs = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
  return `${Math.round(secs / 86400)}d ago`;
}
