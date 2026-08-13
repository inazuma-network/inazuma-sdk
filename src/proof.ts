/**
 * Inazuma light-client state proof verifier.
 *
 * Mirrors `inazuma-core/src/smt.rs` exactly: sparse Merkle tree, depth 128,
 * sha256 nodes, domain-separated leaves. Anyone (browser light client, bridge
 * relayer, indexer) can verify a single account/token/storage value against a
 * block's state root without trusting the RPC node.
 */

export const PROOF_DEPTH = 128;
const PATH_BYTES = PROOF_DEPTH / 8;

export type StateProof = {
  domain: string;
  key: string;
  root: string;
  value: string | null;
  siblings: string[];
  siblingBitmap: string;
};

const enc = new TextEncoder();

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const buf = bytes.slice().buffer as ArrayBuffer;
  return new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
}

function fromHex(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

let emptyCache: Uint8Array[] | null = null;

/** Hash of an empty subtree at each depth (0 = root level). */
async function emptyHashes(): Promise<Uint8Array[]> {
  if (emptyCache) return emptyCache;
  const out: Uint8Array[] = new Array(PROOF_DEPTH + 1);
  out[PROOF_DEPTH] = new Uint8Array(32);
  for (let d = PROOF_DEPTH - 1; d >= 0; d--) {
    const below = out[d + 1]!;
    out[d] = await sha256(concat(below, below));
  }
  emptyCache = out;
  return out;
}

/** sha256("<domain>|<key>") — the first 128 bits are the tree path. */
export async function leafKey(domain: string, key: string): Promise<Uint8Array> {
  return sha256(concat(enc.encode(domain), enc.encode("|"), enc.encode(key)));
}

async function leafHash(lk: Uint8Array, value: Uint8Array | null): Promise<Uint8Array> {
  if (value === null) return (await emptyHashes())[PROOF_DEPTH]!;
  return sha256(concat(enc.encode("inzleaf|"), lk, enc.encode("|"), value));
}

function bit(path: Uint8Array, index: number): number {
  return (path[index >> 3]! >> (7 - (index % 8))) & 1;
}

/**
 * Recompute the state root from one leaf and its sibling path.
 * `value: null` in the proof is a valid non-inclusion proof.
 */
export async function verifyStateProof(proof: StateProof): Promise<boolean> {
  const bitmap = fromHex(proof.siblingBitmap);
  if (bitmap.length !== PATH_BYTES) return false;
  const sibs = proof.siblings.map(fromHex);
  if (sibs.some((s) => s.length !== 32)) return false;

  const empties = await emptyHashes();
  const lk = await leafKey(proof.domain, proof.key);
  const path = lk.slice(0, PATH_BYTES);
  let cur = await leafHash(lk, proof.value ? fromHex(proof.value) : null);
  let next = 0;

  for (let depth = PROOF_DEPTH; depth >= 1; depth--) {
    const idx = depth - 1;
    const provided = ((bitmap[idx >> 3]! >> (7 - (idx % 8))) & 1) === 1;
    let sib: Uint8Array;
    if (provided) {
      if (next >= sibs.length) return false;
      sib = sibs[next++]!;
    } else {
      sib = empties[depth]!;
    }
    cur = bit(path, idx) === 0 ? await sha256(concat(cur, sib)) : await sha256(concat(sib, cur));
  }

  return next === sibs.length && toHex(cur) === proof.root.replace(/^0x/, "").toLowerCase();
}

/** Fetch a proof from an Inazuma RPC endpoint and verify it locally. */
export async function fetchAndVerifyProof(
  rpcUrl: string,
  domain: string,
  key: string,
): Promise<{ proof: StateProof & { exists: boolean; height: number }; valid: boolean }> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "inaz_getProof",
      params: { domain, key },
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? "proof request failed");
  const proof = json.result as StateProof & { exists: boolean; height: number };
  return { proof, valid: await verifyStateProof(proof) };
}