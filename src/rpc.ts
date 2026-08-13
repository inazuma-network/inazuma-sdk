/**
 * Inazuma JSON-RPC client.
 * Works in browsers, Node 18+, Bun and edge runtimes — only `fetch` is required.
 */
import type { ChainInfo, BlockSummary, TxSummary } from "./types";

export const MAINNET_RPC = "https://rpc.inazuma.network";
export const MAINNET_WS = "wss://rpc.inazuma.network/ws";

export type ClientOptions = {
  /** RPC endpoint. Defaults to the public mainnet endpoint. */
  url?: string;
  /** Optional API key for a higher rate-limit tier. */
  apiKey?: string;
  /** Request timeout in ms (default 15000). */
  timeoutMs?: number;
};

export class RpcError extends Error {
  constructor(message: string, readonly code?: number, readonly method?: string) {
    super(message);
    this.name = "RpcError";
  }
}

export class InazumaClient {
  private id = 0;
  readonly url: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor(options: ClientOptions = {}) {
    this.url = options.url ?? MAINNET_RPC;
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  /** Low-level call. Use this for any method not wrapped below. */
  async call<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.apiKey ? { "x-api-key": this.apiKey } : {}),
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++this.id, method, params }),
        signal: controller.signal,
      });
      if (!res.ok) throw new RpcError(`HTTP ${res.status}: ${await res.text()}`, res.status, method);
      const json = (await res.json()) as { result?: T; error?: { code: number; message: string } };
      if (json.error) throw new RpcError(json.error.message, json.error.code, method);
      return json.result as T;
    } finally {
      clearTimeout(timer);
    }
  }

  /* ---------- chain ---------- */
  chainInfo = () => this.call<ChainInfo>("inaz_chainInfo");
  blockNumber = () => this.call<number>("inaz_blockNumber");
  finalizedBlockNumber = () => this.call<number>("inaz_finalizedBlockNumber");
  feeMarket = () => this.call("inaz_feeMarket");
  priorityFee = () => this.call<number>("inaz_priorityFee");
  nodeStatus = () => this.call("inaz_nodeStatus");
  netInfo = () => this.call("inaz_netInfo");
  rpcLimits = () => this.call("inaz_rpcLimits");

  /* ---------- accounts ---------- */
  /** Balance in rai (1 INAZ = 1e9 rai). */
  getBalance = (address: string) => this.call<string>("inaz_getBalance", [address]);
  getAccount = (address: string) => this.call("inaz_getAccount", [address]);

  /* ---------- blocks & transactions ---------- */
  getBlockByNumber = (height: number) => this.call<BlockSummary>("inaz_getBlockByNumber", [height]);
  latestBlocks = (limit = 10) => this.call<BlockSummary[]>("inaz_latestBlocks", [limit]);
  getTransaction = (hash: string) => this.call<TxSummary>("inaz_getTransaction", [hash]);
  getReceipt = (hash: string) => this.call("inaz_getReceipt", [hash]);
  signatureStatuses = (hashes: string[]) => this.call("inaz_signatureStatuses", [hashes]);
  /** Dry-run a signed transaction without broadcasting it. */
  simulateTransaction = (tx: unknown) => this.call("inaz_simulateTransaction", [tx]);
  sendTransaction = (tx: unknown) => this.call<string>("inaz_sendTransaction", [tx]);
  sendTransactions = (txs: unknown[]) => this.call<string[]>("inaz_sendTransactions", [txs]);

  /* ---------- staking ---------- */
  validators = () => this.call("inaz_validators");
  slashing = () => this.call("inaz_slashing");

  /* ---------- tokens & contracts ---------- */
  tokens = () => this.call("inaz_tokens");
  getToken = (id: string) => this.call("inaz_getToken", [id]);
  tokenBalance = (id: string, address: string) => this.call<string>("inaz_tokenBalance", [id, address]);
  tokenHoldings = (address: string) => this.call("inaz_tokenHoldings", [address]);
  contracts = () => this.call("inaz_contracts");
  getContract = (address: string) => this.call("inaz_getContract", [address]);
  contractStorage = (address: string, key: string) => this.call("inaz_contractStorage", [address, key]);
  query = (address: string, method: string, args: unknown[] = []) =>
    this.call("inaz_query", [address, method, args]);

  /* ---------- state proofs ---------- */
  stateRoot = (height?: number) => this.call<string>("inaz_stateRoot", height === undefined ? [] : [height]);
  getProof = (address: string) => this.call("inaz_getProof", [address]);
  verifyProof = (proof: unknown) => this.call<boolean>("inaz_verifyProof", [proof]);

  /** Waits until a transaction is included, or throws after `timeoutMs`. */
  async waitForTransaction(hash: string, timeoutMs = 10_000): Promise<TxSummary> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const tx = await this.getTransaction(hash);
        if (tx?.blockHeight) return tx;
      } catch {
        /* not indexed yet */
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    throw new RpcError(`Transaction ${hash} not confirmed within ${timeoutMs} ms`);
  }
}

export type SubscriptionTopic = "heads" | "finality" | "mempool" | "logs";

/**
 * WebSocket subscription helper.
 *
 *   const stop = subscribe("heads", (head) => console.log(head.height));
 */
export function subscribe(
  topic: SubscriptionTopic,
  onEvent: (payload: any) => void,
  options: { url?: string; apiKey?: string } = {},
) {
  const ws = new WebSocket(options.url ?? MAINNET_WS);
  ws.onopen = () =>
    ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "inaz_subscribe", params: [topic] }));
  ws.onmessage = (ev) => {
    const msg = JSON.parse(typeof ev.data === "string" ? ev.data : "{}");
    if (msg.method === "inaz_subscription") onEvent(msg.params?.result ?? msg.params);
  };
  return () => ws.close();
}
