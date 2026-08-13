/** Print chain status and a balance:  bun run examples/balance.ts <address> */
import { InazumaClient, formatInaz, isAddress } from "../src/index";

const address = process.argv[2];
const inaz = new InazumaClient();

const info = await inaz.chainInfo();
console.log(`Inazuma height ${info.height} · finalized ${info.finalizedHeight} · ${info.validators} validators`);

if (address) {
  if (!isAddress(address)) throw new Error("Not an Inazuma address");
  console.log(`${address} = ${formatInaz(BigInt(await inaz.getBalance(address)))} INAZ`);
}
