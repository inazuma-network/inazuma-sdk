/**
 * Sign-In With Inazuma (SIWI).
 * A gas-free ownership proof: the wallet signs a human-readable message that
 * pins the site domain, a random nonce and an issued-at timestamp. The server
 * verifies the ed25519 signature against the address (a base58 public key).
 */
import * as ed25519 from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";
import { hexToBytes } from "@noble/hashes/utils.js";
import bs58 from "bs58";

ed25519.hashes.sha512 = sha512;

export const SIGNIN_STATEMENT =
  "Sign in to prove you own this wallet. This is free, costs no gas and can never move funds.";

/** How long a signed message stays valid. */
export const SIGNIN_TTL_MS = 5 * 60 * 1000;

export type SignInPayload = {
  domain: string;
  address: string;
  nonce: string;
  issuedAt: string;
};

export function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function buildSignInMessage(p: SignInPayload): string {
  return [
    `${p.domain} wants you to sign in with your Inazuma wallet.`,
    "",
    p.address,
    "",
    SIGNIN_STATEMENT,
    "",
    "Chain: Inazuma",
    `Nonce: ${p.nonce}`,
    `Issued At: ${p.issuedAt}`,
  ].join("\n");
}

export function parseSignInMessage(message: string): SignInPayload {
  const lines = message.split("\n");
  const domain = lines[0]?.replace(/ wants you to sign in.*$/, "").trim() ?? "";
  const address = lines[2]?.trim() ?? "";
  const field = (name: string) =>
    lines.find((l) => l.startsWith(`${name}: `))?.slice(name.length + 2).trim() ?? "";
  const payload = { domain, address, nonce: field("Nonce"), issuedAt: field("Issued At") };
  if (!payload.domain || !payload.address || !payload.nonce || !payload.issuedAt) {
    throw new Error("Malformed sign-in message.");
  }
  if (buildSignInMessage(payload) !== message) throw new Error("Sign-in message was tampered with.");
  return payload;
}

/** Verifies an ed25519 signature made by the owner of `address`. */
export function verifySignInSignature(
  address: string,
  message: string,
  signatureHex: string,
): boolean {
  try {
    const pubkey = bs58.decode(address);
    if (pubkey.length !== 32) return false;
    return ed25519.verify(
      hexToBytes(signatureHex.replace(/^0x/, "")),
      new TextEncoder().encode(message),
      pubkey,
    );
  } catch {
    return false;
  }
}