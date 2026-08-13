# Getting started

## 1. Requirements

- Node 18+, Bun 1.1+, or any modern browser
- No compiler, no native modules, no EVM tooling

## 2. Install

```bash
bun add github:inazuma-network/inazuma-sdk
```

## 3. Connect

```ts
import { InazumaClient } from "@inazuma/sdk";

// public endpoint
const inaz = new InazumaClient();

// your own node or a paid provider, optionally with an API key for a higher tier
const mine = new InazumaClient({ url: "http://127.0.0.1:9933", apiKey: process.env.INAZ_API_KEY });
```

## 4. Read state

```ts
await inaz.chainInfo();          // height, supply, validators, fee market
await inaz.blockNumber();
await inaz.getBlockByNumber(1000);
await inaz.getBalance(address);  // string, in rai
await inaz.tokenHoldings(address);
```

Amounts are always **rai** — the smallest unit. `1 INAZ = 1_000_000_000 rai`.
Use `formatInaz(BigInt(rai))` to display and `parseInaz("1.25")` to build.

## 5. Write state

Signing happens locally; the RPC node never sees your secret.

```ts
const tx = signTransfer({ secret, to, amountRai: parseInaz("1"), nonce });
const hash = await inaz.sendTransaction(tx);
```

Nonces are per-account and strictly increasing. Read the current nonce from
`inaz.getAccount(address)` right before signing, or track it yourself when
submitting many transactions in a row (then use `sendTransactions` for batches).

## 6. Handle errors

Every failure throws `RpcError` with `code` and `method`:

```ts
import { RpcError } from "@inazuma/sdk";

try {
  await inaz.sendTransaction(tx);
} catch (e) {
  if (e instanceof RpcError) console.error(e.code, e.method, e.message);
}
```

Common ones:

| Message | Meaning | Fix |
| --- | --- | --- |
| `invalid nonce` | Nonce reused or skipped | Re-read `getAccount().nonce` |
| `fee below minimum` | Fee under 1,000 rai | Leave `feeRai` unset, or raise it |
| `insufficient balance` | Amount + fee exceeds balance | Reduce the amount |
| `rate limit exceeded` | Too many requests for your tier | Add an API key or run your own node |
