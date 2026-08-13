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

---

## Why Inazuma exists

Inazuma is a sovereign layer 1 — our own consensus, state machine, networking and VM, not
a rollup or a fork. The goal is narrow and deliberate: **be the home chain for memes,
NFTs, collectibles, games and communities.**

That use case is high volume and low value per transaction. A 500-piece mint, a game
writing a move a second, a community handing out collectibles — none of them can pay
dollars in fees or wait seconds for a confirmation. So the whole design is bent around
being fast and near-free:

| | |
| --- | --- |
| Block time | 400 ms, finalised in the same block |
| Transfer fee | ~0.000001 INAZ — fractions of a cent |
| Throughput | ~2,500 tx/s ingest; 20k-36k tx/s execution in bench |
| Tokens & NFTs | first-class chain records — no contract needed to mint |
| Contracts | gas-metered WASM |
| Accounts | Ed25519, base58 addresses, optional ML-DSA-65 co-signature |
| Light clients | sparse Merkle state proofs |

Getting to top-tier means three things, in this order: enough independent validators that
nobody can stop the chain, tooling good enough that a first-time builder ships in an
afternoon, and fees that stay boring even when a collection goes viral. Every repo below
is one part of that.

## The Inazuma repos

| Repo | What's in it |
| --- | --- |
| [inazuma-core](https://github.com/inazuma-network/inazuma-core) | The Rust L1: consensus, state, staking, P2P, JSON-RPC, WASM VM |
| [inazuma-validator](https://github.com/inazuma-network/inazuma-validator) | Node operators: one-command installer, systemd units, health checks, full guide |
| **inazuma-sdk** (here) | TypeScript client: RPC, keys, signing, sign-in, state proofs |
| [inazuma-wallet](https://github.com/inazuma-network/inazuma-wallet) | Self-custody wallet: browser extension, web and Android |
| [inazuma-contracts](https://github.com/inazuma-network/inazuma-contracts) | WASM contract examples, host ABI and deploy scripts |
| [inazuma-faucet](https://github.com/inazuma-network/inazuma-faucet) | Test-token faucet service |
| [inazuma-docs](https://github.com/inazuma-network/inazuma-docs) | All written guides, organised by role |
| [inazuma-improvement-proposals](https://github.com/inazuma-network/inazuma-improvement-proposals) | INAZIPs — how the chain changes |

## Getting started, whoever you are

| I want to… | Go to |
| --- | --- |
| Use a wallet and send INAZ | [inazuma-wallet](https://github.com/inazuma-network/inazuma-wallet) |
| Get test INAZ | [inazuma-faucet](https://github.com/inazuma-network/inazuma-faucet) |
| Build an app | [inazuma-sdk](https://github.com/inazuma-network/inazuma-sdk) · [inazuma-contracts](https://github.com/inazuma-network/inazuma-contracts) |
| Run a node or stake | [inazuma-validator](https://github.com/inazuma-network/inazuma-validator) |
| Understand the internals | [inazuma-core](https://github.com/inazuma-network/inazuma-core) |
| Propose a protocol change | [INAZIPs](https://github.com/inazuma-network/inazuma-improvement-proposals) |
