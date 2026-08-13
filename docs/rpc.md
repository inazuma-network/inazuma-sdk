# RPC reference

Endpoint: `https://rpc.inazuma.network` (HTTP JSON-RPC 2.0) and
`wss://rpc.inazuma.network/ws` (subscriptions).

Every method below has a typed wrapper on `InazumaClient`; anything new can be
called with `client.call(method, params)`.

## Chain

| Method | Returns |
| --- | --- |
| `inaz_chainInfo` | Height, finalized height, supply, staked, validators, fee market, peers |
| `inaz_blockNumber` | Current height |
| `inaz_finalizedBlockNumber` | Last finalized height |
| `inaz_feeMarket` | Base fee, target/limit occupancy (dynamic fee state) |
| `inaz_priorityFee` | Suggested tip for fast inclusion |
| `inaz_nodeStatus` / `inaz_netInfo` | Node health, peer list, sync state |
| `inaz_rpcLimits` | Your current rate-limit tier and remaining budget |

## Accounts & tokens

`inaz_getBalance`, `inaz_getAccount`, `inaz_tokens`, `inaz_getToken`,
`inaz_tokenBalance`, `inaz_tokenHoldings`

## Blocks & transactions

`inaz_getBlockByNumber`, `inaz_latestBlocks`, `inaz_getTransaction`,
`inaz_getReceipt`, `inaz_signatureStatuses`, `inaz_simulateTransaction`,
`inaz_sendTransaction`, `inaz_sendTransactions`

## Staking & security

`inaz_validators`, `inaz_slashing`, `inaz_previewSlash`, `inaz_reportEquivocation`

## Contracts

`inaz_contracts`, `inaz_getContract`, `inaz_contractStorage`, `inaz_query`

## State proofs

`inaz_stateRoot`, `inaz_getProof`, `inaz_verifyProof` — see
[`src/proof.ts`](../src/proof.ts) to verify a proof locally instead of trusting
the node that served it.

## Subscriptions

```json
{ "jsonrpc": "2.0", "id": 1, "method": "inaz_subscribe", "params": ["heads"] }
```

Topics: `heads`, `finality`, `mempool`, `logs`. Events arrive as
`inaz_subscription` notifications.

## Rate limits

Requests are metered by cost, not just count. Anonymous traffic gets a shared
budget; an API key raises it; bonded stake raises it further (stake-weighted
QoS, up to 8x). Read your live budget with `inaz_rpcLimits`. For heavy workloads
run your own node — see
[inazuma-core/docs/validator.md](https://github.com/inazuma-network/inazuma-core/blob/main/docs/validator.md).
