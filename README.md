# Wonder Pick Log

**Live:** https://diegomarty.github.io/pocket-wonder-pick/

A log and stats page for **Wonder Pick** in Pokémon TCG Pocket. Record the five cards
before the shuffle, which ones you wanted and which one you picked, and see whether the
positions really are random.

English by default, Spanish in Settings or with `?lang=es` in the URL (the choice is
remembered).

## What it does

- **Log** — pick the pack, place the five cards as they appear before the shuffle (from
  a grid of the pack's cards, filtered by rarity and type), mark
  the ones you want with ♥, then say where each card landed after the shuffle and which one
  you picked.
- **Read from a screenshot** — instead of placing the cards by hand, choose a screenshot
  of the Wonder Pick (the list of picks or a single one): the page finds the five cards,
  works out the pack and fills in the board. A second screenshot after the shuffle fills in
  where each card landed. It all runs on the device; the picture is never sent anywhere.
- **Prediction** — before you pick, the face-down cards show where your ♥ cards tend to
  end up, from your own logs or from the community's.
- **History** — every log you saved, with undoable delete.
- **Stats** — hit rate against a blind tap, hit rate by picked position, where a card
  travels during the shuffle (with a χ² test that flags when the spread drifts from
  random), by rarity and by pack.
- **Settings** — language, optional community server, a code to link your devices, and
  JSON export/import.

## Privacy and the community server

Without a server, everything stays in your browser's `localStorage`. Nothing is sent
anywhere.

The community server is optional: a Google Apps Script web app that collects logs in a
Google Sheet so stats can be pooled across players. The script and setup instructions are
in [`apps-script/wonder-pick.gs`](apps-script/wonder-pick.gs); paste the web app URL in
Settings. No game ID or social handle is ever asked for — your logs are identified by a
random code created on your device.

## Card data

The catalogue (`src/data/packs.json`) covers 23 packs. Wonder Pick never offers ☆3,
shiny or crown cards, so those are left out. Set codes, numbers, rarities and HP come from
the Japanese list kept by the
[card-request-box](https://card-request-box.github.io/getchallenge.html) Get Challenge
log, which this tool is modelled on. English and Spanish names come from
[TCGdex](https://tcgdex.dev/), species names from [PokeAPI](https://pokeapi.co/), and
hand-written dictionaries for trainers and items. Booster art (`public/packs/`, one image per expansion,
resized) comes from the community-maintained
[pokemon-tcg-pocket-cards](https://github.com/PocketDecks/pokemon-tcg-pocket-cards) data set. Names of the newest packs (and some
Spanish trainer names) are our own translations and may not match the game yet; the page
says so.

Each card's type (Grass, Fire, … or Trainer) comes from the MIT-licensed v4 list of
the same data set, added to `packs.json` by `node scripts/add-card-types.mjs`. That list
stops before Dual Fusion (C1), so its Pokémon have no type yet and only show under "All
types"; its trainers are recognised by having no HP. Card pictures load from that data set
on GitHub, pinned to one commit, as you scroll (shipping them would add some 40 MB); if
one does not load, the card is drawn in CSS instead.

### How screenshots are read

`src/domain/screenshot.ts` finds the cards: the game draws them on a pale background, so
whatever is not pale forms blobs, and blobs shaped like a card, three over two, make a
board. Each card's artwork is reduced to a fingerprint (a 12 × 7 grid of colours,
normalised so brightness does not matter), and `src/domain/read-shot.ts` compares it with
the fingerprint of every card in `public/card-sigs.bin` (about 1 MB, loaded the first
time a screenshot is read). The pack is the one whose cards fit all five best. A slot
whose best match is weak stays empty rather than guessing. Card text plays no part, so the
game's language does not matter.

`public/card-sigs.bin` is built by `node scripts/card-signatures.mjs` (Node 22.18+ and
Python 3 with Pillow) from the same pictures the page shows; rerun it when the card list
changes.

## Development

Requires Node 24 (see `.nvmrc`).

```sh
npm install
npm run dev           # dev server
npm run build         # production build into dist/
npm run preview       # serve the build
npm run check         # type check
npm test              # unit tests
npm run format        # format with Prettier (format:check to verify)
```

Every push to `main` is deployed to GitHub Pages by `.github/workflows/pages.yml`. In
the repository's Settings → Pages, **Source must be "GitHub Actions"**. With "Deploy
from a branch", GitHub also publishes the raw repository on every push, after the
workflow, and the site serves the unbuilt `index.html` (which asks for `/src/main.ts`)
and stays blank.

Code layout: pure domain logic with tests in `src/domain/`, storage and sync in
`src/infra/`, views in `src/ui/`, all strings in `src/i18n.ts`.

## Disclaimer

This is an unofficial fan-made tool. It is not affiliated with, endorsed by or sponsored
by Nintendo, The Pokémon Company, Creatures, GAME FREAK or DeNA. Pokémon and Pokémon TCG
Pocket are trademarks of their respective owners.

## License

[MIT](LICENSE)
