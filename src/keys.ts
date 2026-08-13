/**
 * Browser-side wallet crypto for Inazuma Core.
 * Shared by the web wallet (/wallet) and the Chrome extension — no server ever
 * sees the secret key.
 *
 * Key model (v2, Inazuma-only):
 *  - The user's backup is an Inazuma Key String: `inazkey1<base58check>` — it is
 *    NOT a raw hex/base58 private key, so it cannot be pasted into an EVM or
 *    Solana wallet. Those wallets reject the format outright.
 *  - From the 32-byte master secret we derive, with domain separation:
 *      · the ed25519 signing key (classical, chain-native)
 *      · an ML-DSA-65 post-quantum signing key (FIPS 204)
 *    So the master secret is never itself a usable secp256k1/ed25519 key on any
 *    other chain: the same backup on another network derives nothing.
 *  - Every transaction is dual-signed: ed25519 today, ML-DSA-65 attached
 *    alongside so accounts are already quantum-bound when the node enforces it.
 */
import * as ed25519 from "@noble/ed25519";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import { sha512 } from "@noble/hashes/sha2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import bs58 from "bs58";
import {
  generateMnemonic,
  mnemonicToSeedSync,
  validateMnemonic as bip39Validate,
} from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";

ed25519.hashes.sha512 = sha512;

export const CHAIN_ID = 7777;
export const DECIMALS = 9;
export const ONE_INAZ = 10n ** BigInt(DECIMALS);
export const MIN_FEE = 1_000n;

/* ---------- Inazuma Key String (inazkey1…) ---------- */

export const KEY_PREFIX = "inazkey1";
/** Version byte: distinguishes future key generations. */
const KEY_VERSION = 0x1a;

const checksum = (b: Uint8Array) => sha256(sha256(b)).slice(0, 4);

/** Encodes a 32-byte master secret as an Inazuma-only key string. */
export function encodeKey(masterHex: string): string {
  const master = hexToBytes(masterHex.trim().replace(/^0x/, ""));
  if (master.length !== 32) throw new Error("Master secret must be 32 bytes.");
  const body = new Uint8Array(33);
  body[0] = KEY_VERSION;
  body.set(master, 1);
  const out = new Uint8Array(37);
  out.set(body, 0);
  out.set(checksum(body), 33);
  return KEY_PREFIX + bs58.encode(out);
}

/** Decodes an Inazuma key string back to the master secret hex. */
export function decodeKey(key: string): string {
  const raw = key.trim();
  if (!raw.toLowerCase().startsWith(KEY_PREFIX)) {
    throw new Error(`Not an Inazuma key — it must start with "${KEY_PREFIX}".`);
  }
  let bytes: Uint8Array;
  try {
    bytes = bs58.decode(raw.slice(KEY_PREFIX.length));
  } catch {
    throw new Error("Malformed Inazuma key.");
  }
  if (bytes.length !== 37) throw new Error("Malformed Inazuma key (bad length).");
  const body = bytes.slice(0, 33);
  if (bytesToHex(checksum(body)) !== bytesToHex(bytes.slice(33))) {
    throw new Error("Key checksum failed — check for a typo.");
  }
  if (body[0] !== KEY_VERSION) throw new Error("Unsupported key version.");
  return bytesToHex(body.slice(1));
}

/* ---------- domain-separated derivation ---------- */

const derive = (tag: string, master: Uint8Array) => {
  const input = new Uint8Array(tag.length + master.length);
  input.set(new TextEncoder().encode(tag), 0);
  input.set(master, tag.length);
  return sha512(input).slice(0, 32);
};

/* ---------- 24-word recovery phrase (Inazuma derivation) ---------- */

/**
 * The phrase uses the standard English word list, but the master secret is
 * derived through an Inazuma-only passphrase + domain tag. So the same 24 words
 * produce a completely different key on our chain than on EVM/Solana — words
 * are portable, addresses are not.
 */
const MNEMONIC_PASSPHRASE = "inazuma/v2/mnemonic";

export const createMnemonic = () => generateMnemonic(wordlist, 256);

export const isMnemonic = (input: string) => input.trim().split(/\s+/).length >= 12;

export function validateMnemonic(phrase: string) {
  return bip39Validate(normalizeMnemonic(phrase), wordlist);
}

export const normalizeMnemonic = (phrase: string) =>
  phrase.trim().toLowerCase().split(/\s+/).join(" ");

/** 24 words -> 32-byte Inazuma master secret (hex). */
export function masterFromMnemonic(phrase: string): string {
  const words = normalizeMnemonic(phrase);
  if (!bip39Validate(words, wordlist)) {
    throw new Error("Invalid recovery phrase — check the words and their order.");
  }
  const seed = mnemonicToSeedSync(words, MNEMONIC_PASSPHRASE);
  return bytesToHex(derive("inazuma/v2/master", seed));
}

export type Keypair = {
  /** Base58 ed25519 public key — the on-chain address. */
  address: string;
  /** Master secret, hex. Internal + vault only; never shown to the user. */
  secretHex: string;
  /** User-facing backup string: inazkey1… */
  key: string;
  /** 24-word recovery phrase when the wallet was created/imported from one. */
  mnemonic?: string;
  pubkeyHex: string;
  /** True for pre-v2 raw-hex keys imported for backwards compatibility. */
  legacy: boolean;
};

/** Signing seed for the classical ed25519 key. */
function edSeed(masterHex: string, legacy: boolean): Uint8Array {
  const master = hexToBytes(masterHex);
  return legacy ? master : derive("inazuma/v2/sig-ed25519", master);
}

/**
 * Accepts an Inazuma key string (preferred) or a legacy 64-hex secret.
 * Legacy hex keeps its original address so early wallets keep working.
 */
export function keypairFromSecret(input: string): Keypair {
  const raw = input.trim();
  if (isMnemonic(raw)) {
    const phrase = normalizeMnemonic(raw);
    const kp = keypairFromSecret(encodeKey(masterFromMnemonic(phrase)));
    return { ...kp, mnemonic: phrase };
  }
  const legacy = !raw.toLowerCase().startsWith(KEY_PREFIX);
  const masterHex = legacy ? raw.replace(/^0x/, "").toLowerCase() : decodeKey(raw);
  if (!/^[0-9a-f]{64}$/.test(masterHex)) {
    throw new Error(
      `Paste a 24-word recovery phrase or an Inazuma key (starts with "${KEY_PREFIX}").`,
    );
  }
  const pubkey = ed25519.getPublicKey(edSeed(masterHex, legacy));
  return {
    address: bs58.encode(pubkey),
    pubkeyHex: bytesToHex(pubkey),
    secretHex: masterHex,
    key: legacy ? masterHex : encodeKey(masterHex),
    legacy,
  };
}

export function createKeypair(): Keypair {
  return keypairFromSecret(createMnemonic());
}

/* ---------- post-quantum layer (ML-DSA-65, FIPS 204) ---------- */

export function pqKeypair(masterHex: string) {
  const seed = derive("inazuma/v2/pq-mldsa65", hexToBytes(masterHex));
  return ml_dsa65.keygen(seed);
}

/** Short, displayable fingerprint of the quantum-resistant public key. */
export function pqFingerprint(masterHex: string): string {
  return bytesToHex(sha256(pqKeypair(masterHex).publicKey).slice(0, 8));
}

export const formatInaz = (rai: bigint, places = 4) => {
  const neg = rai < 0n;
  const abs = neg ? -rai : rai;
  const whole = abs / ONE_INAZ;
  const frac = (abs % ONE_INAZ).toString().padStart(DECIMALS, "0").slice(0, places);
  return `${neg ? "-" : ""}${whole.toLocaleString("en-US")}${places ? `.${frac}` : ""}`;
};

export function parseInaz(value: string): bigint {
  const [w, f = ""] = value.trim().split(".");
  if (!/^\d*$/.test(w ?? "") || !/^\d*$/.test(f)) throw new Error("Invalid amount.");
  const frac = (f + "0".repeat(DECIMALS)).slice(0, DECIMALS);
  return BigInt(w || "0") * ONE_INAZ + BigInt(frac || "0");
}

/** Canonical signing preimage — must match the node's `signing_bytes`. */
function signingBytes(tx: {
  chainId: number;
  kind: string;
  fromPubkey: string;
  to: string;
  amount: bigint;
  fee: bigint;
  nonce: number;
}) {
  return new TextEncoder().encode(
    `inazuma-tx|${tx.chainId}|${tx.kind}|${tx.fromPubkey}|${tx.to}|${tx.amount}|${tx.fee}|${tx.nonce}`,
  );
}

/** Builds the node payload for a signed native transfer. */
export function signTransfer(opts: {
  /** Inazuma key string (preferred) or legacy hex secret. */
  secret: string;
  to: string;
  amountRai: bigint;
  nonce: number;
  feeRai?: bigint;
  chainId?: number;
}) {
  const kp = keypairFromSecret(opts.secret);
  const chainId = opts.chainId ?? CHAIN_ID;
  const fee = opts.feeRai ?? MIN_FEE;
  const msg = signingBytes({
    chainId,
    kind: "transfer",
    fromPubkey: kp.pubkeyHex,
    to: opts.to,
    amount: opts.amountRai,
    fee,
    nonce: opts.nonce,
  });
  const signature = bytesToHex(ed25519.sign(msg, edSeed(kp.secretHex, kp.legacy)));
  // Quantum-resistant co-signature. Legacy hex keys have no PQ half.
  const pq = kp.legacy ? null : pqKeypair(kp.secretHex);
  return {
    kind: "transfer",
    from_pubkey: kp.pubkeyHex,
    to: opts.to,
    amount: Number(opts.amountRai),
    fee: Number(fee),
    nonce: opts.nonce,
    chain_id: chainId,
    signature,
    ...(pq
      ? {
          pq_scheme: "ml-dsa-65",
          pq_pubkey: bytesToHex(pq.publicKey),
          pq_signature: bytesToHex(ml_dsa65.sign(msg, pq.secretKey)),
        }
      : {}),
  };
}

/* ---------- password-encrypted vault (AES-GCM + PBKDF2) ---------- */

/**
 * Signs an arbitrary UTF-8 message with the wallet's classical ed25519 key.
 * Used for gas-free ownership proofs (sign-in), never for transactions.
 */
export function signMessage(secret: string, message: string) {
  const kp = keypairFromSecret(secret);
  const signature = bytesToHex(
    ed25519.sign(new TextEncoder().encode(message), edSeed(kp.secretHex, kp.legacy)),
  );
  return { address: kp.address, pubkeyHex: kp.pubkeyHex, signature };
}

const ITERATIONS = 210_000;

async function deriveKey(password: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export type Vault = { v: 1; address: string; salt: string; iv: string; data: string };

export async function encryptVault(secret: string, password: string): Promise<Vault> {
  const kp = keypairFromSecret(secret);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    // Store the canonical key string so legacy/v2 derivation survives a reload.
    new TextEncoder().encode(kp.key),
  );
  return {
    v: 1,
    address: kp.address,
    salt: bytesToHex(salt),
    iv: bytesToHex(iv),
    data: bytesToHex(new Uint8Array(cipher)),
  };
}

export async function decryptVault(vault: Vault, password: string): Promise<Keypair> {
  const key = await deriveKey(password, hexToBytes(vault.salt));
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: hexToBytes(vault.iv) as unknown as BufferSource },
      key,
      hexToBytes(vault.data) as unknown as BufferSource,
    );
    return keypairFromSecret(new TextDecoder().decode(plain));
  } catch {
    throw new Error("Wrong password.");
  }
}