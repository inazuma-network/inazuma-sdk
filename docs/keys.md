# Keys, backups and quantum policy

## Three ways to hold the same wallet

| Form | Looks like | Use |
| --- | --- | --- |
| 24-word phrase | `pistol frame ocean …` | Human backup, written on paper |
| Inazuma key string | `inazkey1…` | Import/export between Inazuma apps |
| Encrypted vault | AES-GCM blob | What apps store on disk (password protected) |

The address itself is a base58 Ed25519 public key.

## Why the format is Inazuma-only

A raw hex private key can be pasted into wallets on other networks, which
confuses users and leaks the same secret across chains. Inazuma avoids that:

- Backups carry the `inazkey1` prefix with a version byte and checksum. Other
  wallets reject the string, and a typo fails the checksum instead of silently
  producing a wrong wallet.
- The signing key is derived from the master secret with domain separation
  (`inazuma/v2/sig-ed25519`), and the recovery phrase uses an Inazuma-specific
  passphrase. So the same 24 words derive a *different* key here than anywhere
  else. Words are portable; addresses are not.

## Quantum resistance

Every transaction carries two signatures:

1. **Ed25519** — classical, cheap, verified today.
2. **ML-DSA-65** (FIPS 204, lattice-based) — derived from the same master secret
   under the `inazuma/v2/pq-mldsa65` tag and attached to the transaction.

Accounts are therefore already bound to a post-quantum key. When the network
enables enforcement, existing wallets need no migration and no re-keying.

`pqFingerprint(masterHex)` gives a short displayable fingerprint of the
quantum key so a user can compare it across devices.

## Storage rules for app developers

- Never send a secret, phrase or `inazkey1` string to a server. Sign locally.
- Store only the encrypted vault; derive keys with the provided PBKDF2 helper
  (210,000 iterations, AES-GCM).
- Show the phrase exactly once, at creation, and require confirmation.
- Prefer the [wallet extension](https://github.com/inazuma-network/inazuma-wallet)
  so your app never touches key material at all.
