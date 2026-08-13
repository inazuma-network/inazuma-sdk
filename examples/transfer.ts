/**
 * Send INAZ:  INAZ_KEY=inazkey1... bun run examples/transfer.ts <to> <amount>
 * The key never leaves this process — signing is local.
 */
import { InazumaClient, signTransfer, parseInaz, keypairFromSecret } from "../src/index";

const [to, amount] = process.argv.slice(2);
const secret = process.env.INAZ_KEY;
if (!secret || !to || !amount) throw new Error("usage: INAZ_KEY=... bun run examples/transfer.ts <to> <amount>");

const inaz = new InazumaClient();
const me = keypairFromSecret(secret);
const account = (await inaz.getAccount(me.address)) as { nonce: number };

const tx = signTransfer({ secret, to, amountRai: parseInaz(amount), nonce: account.nonce });
await inaz.simulateTransaction(tx);
const hash = await inaz.sendTransaction(tx);
console.log("submitted", hash);
console.log("confirmed", await inaz.waitForTransaction(hash));
