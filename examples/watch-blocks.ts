/** Stream new blocks:  bun run examples/watch-blocks.ts */
import { subscribe } from "../src/index";

subscribe("heads", (head) => console.log(new Date().toISOString(), "block", head.height, head.hash));
