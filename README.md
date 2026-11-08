# Wonder Pick Log

**Live:** https://diegomarty.github.io/pocket-wonder-pick/

A log and stats page for **Wonder Pick** in Pokémon TCG Pocket. Record the five cards
before the shuffle, which ones you wanted and which one you picked, and see whether the
positions really are random.

English by default, Spanish in Settings or with `?lang=es` in the URL (the choice is
remembered).

## What it does

- **Log** — pick the pack, place the five cards as they appear before the shuffle, mark
  the ones you want with ♥, then say where each card landed after the shuffle and which one
  you picked.
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
hand-written dictionaries for trainers and items. Names of the newest packs (and some
Spanish trainer names) are our own translations and may not match the game yet; the page
says so.

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

Every push to `main` is deployed to GitHub Pages by `.github/workflows/pages.yml`.

Code layout: pure domain logic with tests in `src/domain/`, storage and sync in
`src/infra/`, views in `src/ui/`, all strings in `src/i18n.ts`.

## Disclaimer

This is an unofficial fan-made tool. It is not affiliated with, endorsed by or sponsored
by Nintendo, The Pokémon Company, Creatures, GAME FREAK or DeNA. Pokémon and Pokémon TCG
Pocket are trademarks of their respective owners.

## License

[MIT](LICENSE)
