<h1 align="center">Inazuma SDK</h1>

<p align="center">
  The official TypeScript toolkit for the <b>Inazuma</b> layer-1 blockchain.<br/>
  JSON-RPC client · key management · transaction signing · sign-in · state proofs
</p>

<p align="center">
  <img alt="typescript" src="https://img.shields.io/badge/typescript-5.6-000000">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-000000">
  <img alt="runtime" src="https://img.shields.io/badge/runtime-browser%20%7C%20node%2018%2B%20%7C%20bun%20%7C%20edge-000000">
</p>

---

## What is this?

Everything an app needs to talk to Inazuma, in one small dependency-light package.
No EVM, no web3.js — Inazuma has its own account model (Ed25519, base58 addresses)
and its own JSON-RPC, and this SDK speaks it natively.

| Module | What it does |
| --- | --- |
| [`src/rpc.ts`](src/rpc.ts) | `InazumaClient` — every JSON-RPC method, typed, plus WebSocket subscriptions |
| [`src/keys.ts`](src/keys.ts) | Create/import wallets, `inazkey1…` backups, 24-word phrases, sign transactions & messages, encrypted vault |
| [`src/siwi.ts`](src/siwi.ts) | Sign-In With Inazuma — prove wallet ownership without gas |
| [`src/proof.ts`](src/proof.ts) | Verify sparse-Merkle state proofs client-side (trustless reads) |
| [`src/types.ts`](src/types.ts) | Shared types + address/amount helpers |

## Install

```bash
# bun
bun add github:inazuma-network/inazuma-sdk
# npm
npm install github:inazuma-network/inazuma-sdk
```

## 60-second quick start

```ts
import { InazumaClient, formatInaz } from "@inazuma/sdk";

const inaz = new InazumaClient(); // defaults to https://rpc.inazuma.network

const info = await inaz.chainInfo();
console.log(`height ${info.height} · ${info.validators} validators`);

const rai = await inaz.getBalance("9xQee...address");
console.log(`${formatInaz(BigInt(rai))} INAZ`);
```

## Create a wallet

```ts
import { createKeypair, keypairFromSecret } from "@inazuma/sdk";

const wallet = createKeypair();
console.log(wallet.address);   // base58 ed25519 address
console.log(wallet.mnemonic);  // 24-word recovery phrase — show once, never store
console.log(wallet.key);       // inazkey1… backup string

// later
const same = keypairFromSecret(wallet.key);
```

Inazuma keys are deliberately **not** interchangeable with other chains: the backup
string starts with `inazkey1`, and the signing key is derived through
Inazuma-specific domain tags, so the same phrase gives a different address elsewhere.

## Send INAZ

```ts
import { InazumaClient, signTransfer, parseInaz } from "@inazuma/sdk";

const inaz = new InazumaClient();
const account = await inaz.getAccount(wallet.address) as { nonce: number };

const tx = signTransfer({
  secret: wallet.key,
  to: "recipientAddress",
  amountRai: parseInaz("1.5"),
  nonce: account.nonce,
});

await inaz.simulateTransaction(tx);          // optional dry-run, catches errors for free
const hash = await inaz.sendTransaction(tx);
await inaz.waitForTransaction(hash);         // ~400 ms
```

Every transfer is dual-signed: Ed25519 today plus an ML-DSA-65 (FIPS 204)
co-signature, so accounts are already bound to a quantum-resistant key.

## Live data over WebSocket

```ts
import { subscribe } from "@inazuma/sdk";

const stop = subscribe("heads", (head) => console.log("new block", head.height));
// topics: "heads" | "finality" | "mempool" | "logs"
```

## Prove wallet ownership (sign-in)

```ts
import { buildSignInMessage, randomNonce, signMessage, verifySignInSignature } from "@inazuma/sdk";

const message = buildSignInMessage({
  address: wallet.address,
  nonce: randomNonce(),
  issuedAt: new Date().toISOString(),
  domain: "your-app",
});
const { signature } = signMessage(wallet.key, message);
const ok = verifySignInSignature(wallet.address, message, signature);
```

## Guides

- [Getting started](docs/getting-started.md)
- [RPC reference & rate limits](docs/rpc.md)
- [Keys, backups and quantum policy](docs/keys.md)
- [Examples](examples/)

## Ecosystem

| Repo | Purpose |
| --- | --- |
| [inazuma-core](https://github.com/inazuma-network/inazuma-core) | The Rust L1 node: consensus, state, P2P, RPC |
| [inazuma-sdk](https://github.com/inazuma-network/inazuma-sdk) | TypeScript SDK (this repo) |
| [inazuma-wallet](https://github.com/inazuma-network/inazuma-wallet) | Chrome extension + injected provider |
| [inazuma-docs](https://github.com/inazuma-network/inazuma-docs) | Written documentation for the whole network |
| [inazuma-faucet](https://github.com/inazuma-network/inazuma-faucet) | Faucet service for test INAZ |
| [inazuma-contracts](https://github.com/inazuma-network/inazuma-contracts) | WASM smart-contract examples & tooling |

MIT licensed. See [LICENSE](LICENSE).
