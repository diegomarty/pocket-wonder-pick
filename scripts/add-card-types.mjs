/**
 * Adds each card's type (Grass, Fire, … or Trainer) to `src/data/packs.json`, as a
 * one-letter code at the end of the card's row. Run with `node scripts/add-card-types.mjs`.
 *
 * Types come from the v4 card list of PocketDecks/pokemon-tcg-pocket-cards, which is
 * MIT-licensed (the newer v5 data is AGPL, so it is not used). The commit is pinned so
 * a rerun gives the same file. v4 stops before the newest packs: a card it does not
 * have is a trainer when it has no HP, and a Pokémon is left without a type (the same
 * species is not always the same type from one set to the next, so the name is no guide).
 * The picker shows those under "All" only.
 *
 * Only the card rows are rewritten, in place, so the rest of the file keeps its layout.
 */

import { readFile, writeFile } from "node:fs/promises";

const COMMIT = "7c654076f51f94ee45e6bbadc73d5834ee79c597";
const SOURCE = `https://raw.githubusercontent.com/PocketDecks/pokemon-tcg-pocket-cards/${COMMIT}/data/v4/cards.min.json`;
const FILE = new URL("../src/data/packs.json", import.meta.url);

const CODE = {
  Grass: "G",
  Fire: "R",
  Water: "W",
  Lightning: "L",
  Psychic: "P",
  Fighting: "F",
  Darkness: "D",
  Metal: "M",
  Dragon: "N",
  Colorless: "C",
  Trainer: "T",
};

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`${SOURCE}: ${res.status}`);
const v4 = await res.json();

const byId = new Map();
for (const c of v4) {
  const code = CODE[c.type];
  if (!code) continue;
  byId.set(c.id, code);
}

const text = await readFile(FILE, "utf8");
let pack = "";
const unknown = [];
const out = text.split("\n").map((line) => {
  const p = line.match(/^\s*"code": "([^"]+)"/);
  if (p) pack = p[1];
  const m = line.match(/^(\s*)(\[\d+, .*?)(, "[A-Z]")?\](,?)$/);
  if (!m || !pack) return line;
  const row = JSON.parse(m[2] + "]");
  const [no, en, , , hp] = row;
  const type = byId.get(`${pack.toLowerCase()}-${String(no).padStart(3, "0")}`) ?? (hp ? "" : "T");
  if (!type) {
    unknown.push(`${pack} ${no} ${en}`);
    return m[1] + m[2] + "]" + m[4];
  }
  return `${m[1]}${m[2]}, "${type}"]${m[4]}`;
});

await writeFile(FILE, out.join("\n"));
console.log(unknown.length ? `No type for ${unknown.length} Pokémon: ${unknown.join(", ")}` : "Every card has a type.");
