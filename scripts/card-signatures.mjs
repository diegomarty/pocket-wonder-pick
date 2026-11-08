/**
 * Builds `public/card-sigs.bin`: the artwork fingerprint of every card in
 * `src/data/packs.json`, which the page compares with the cards on a screenshot.
 * Run with `node scripts/card-signatures.mjs` after the card list changes.
 *
 * Needs Node 22.18+ (it imports the TypeScript of `src/domain/screenshot.ts` directly,
 * so the fingerprints are made by the very code the page runs) and Python 3 with
 * Pillow, which decodes the WebP pictures; Node has no decoder of its own.
 *
 * Pictures come from the pokemon-tcg-pocket-cards data set, pinned to the commit the
 * page loads them from, and are kept in a cache folder between runs.
 *
 * File layout: "WPS1", then the fingerprint length and the card count (uint16 each, little
 * endian), then per card an 8-byte ASCII key ("a1/001", zero-padded) and the fingerprint,
 * one signed byte per value (value × 32, clamped).
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SIG_LEN, signature } from "../src/domain/screenshot.ts";

const COMMIT = "7c654076f51f94ee45e6bbadc73d5834ee79c597";
const BASE = `https://raw.githubusercontent.com/PocketDecks/pokemon-tcg-pocket-cards/${COMMIT}/images/webp/cards/`;
const CACHE = join(tmpdir(), "pocket-wonder-pick-art");
const OUT = new URL("../public/card-sigs.bin", import.meta.url);
/** Size the pictures are scaled to before taking the fingerprint: about a card on a phone screenshot. */
const W = 184;
const H = 256;

const packs = JSON.parse(await readFile(new URL("../src/data/packs.json", import.meta.url), "utf8"));
const keys = packs.flatMap((p) => p.cards.map((c) => `${p.code.toLowerCase()}/${String(c[0]).padStart(3, "0")}`));

await mkdir(CACHE, { recursive: true });
const missing = keys.filter((k) => !existsSync(join(CACHE, k.replace("/", "-") + ".webp")));
console.log(`${keys.length} cards, ${missing.length} pictures to download`);
let next = 0;
await Promise.all(
  Array.from({ length: 16 }, async () => {
    while (next < missing.length) {
      const k = missing[next++];
      const res = await fetch(BASE + k + ".webp");
      if (!res.ok) throw new Error(`${k}: ${res.status}`);
      await writeFile(join(CACHE, k.replace("/", "-") + ".webp"), Buffer.from(await res.arrayBuffer()));
    }
  }),
);

// One Python run decodes and scales every picture to raw RGBA next to it.
execFileSync(
  "python3",
  [
    "-I",
    "-c",
    `import sys, glob, os
from PIL import Image
for f in glob.glob(os.path.join(sys.argv[1], "*.webp")):
    out = f[:-5] + ".rgba"
    if os.path.exists(out): continue
    open(out, "wb").write(Image.open(f).convert("RGBA").resize((${W}, ${H}), Image.BOX).tobytes())`,
    CACHE,
  ],
  { stdio: "inherit" },
);

const rec = 8 + SIG_LEN;
const buf = Buffer.alloc(8 + keys.length * rec);
buf.write("WPS1", 0, "ascii");
buf.writeUInt16LE(SIG_LEN, 4);
buf.writeUInt16LE(keys.length, 6);
for (const [i, k] of keys.entries()) {
  const data = await readFile(join(CACHE, k.replace("/", "-") + ".rgba"));
  const sig = signature({ width: W, height: H, data }, { x: 0, y: 0, w: W, h: H });
  const at = 8 + i * rec;
  buf.write(k, at, "ascii");
  for (let j = 0; j < SIG_LEN; j++) buf.writeInt8(Math.max(-127, Math.min(127, Math.round(sig[j] * 32))), at + 8 + j);
}
await writeFile(OUT, buf);
console.log(`Wrote ${keys.length} fingerprints, ${(buf.length / 1024).toFixed(0)} KB.`);
