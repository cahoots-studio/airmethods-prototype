# Air Methods — homepage prototype

Live HTML prototype of the Air Methods homepage, built on a **fork of
Supercomponent** (`cahoots-studio/supercomponent`, v0.3.0) to test the
Figma → tokens → code connection end to end.

- **Figma source:** "Air Methods Designs" `18WKlxwsAYNi1EVrq21obj`
  (tokens: all four variable collections; layout: Designs → Homepage — Desktop 1920)
- **Theme:** `tokens/themes/airmethods.json` — written by `npm run sync`, never by hand
- **Spec:** `claude/AIRMETHODS-SC-TOKEN-SPEC.md` in the Supercomponent claude.ai project

This repo does **not** link back to Supercomponent. Changes here never flow
upstream; fixes worth keeping are listed below for porting by hand.

## Update tokens from Figma

1. Export every variable with all modes to `tokens/.figma-raw.json`
   (the `use_figma` dump in CLAUDE.md → "The sync loop").
2. `npm run sync -- --theme=airmethods --no-deploy` — review the diff, then re-run with `--yes`.
3. Commit. Netlify rebuilds on push.

## Build

`npm run build:site` → `_site/`
- `/` — the homepage (`site/index.html`)
- `/styleguide/` — the Supercomponent style guide rendered in the Air Methods theme

## Fonts

- Display: Proxima Nova Condensed via Adobe Fonts kit `vir5hey`. The kit must list the
  Netlify domain and include weight **900**; until then headlines fall back to Fira Sans Condensed Black.
- Text: Hanken Grotesk (Google Fonts), matching the Figma Text family.
- Figma family names are mapped to web font stacks in `tokens/font-stacks.json`.

## Changes from Supercomponent v0.3.0 (candidates to port upstream)

1. `tokens/font-stacks.json` + emitter lookup — Figma family names are not web font names.
2. Scheme 1 emitted under `[data-sc-scheme="scheme-1"]` too, so it can nest inside another scheme.
3. Scripts default to the repo's own theme instead of hard-coding `cahoots`.
4. `textstyles.json` supports `case` (emits `text-transform`).
5. `--sc-elevation-card` repo-native token (Figma effect styles cannot sync).
6. `hero_component.is-split`, `supercomponent.is-card`, and patterns: navigation, statement,
   partners, services, story, newsfeed, footer; block: placeholder.
