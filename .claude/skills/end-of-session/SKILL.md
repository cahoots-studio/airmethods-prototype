---
name: end-of-session
description: End-of-session process for the Air Methods prototype — write every chat-made prototype change back to Figma (interaction states as component variants, static stills for the globe and logo field), run the non-destructive code checks, refresh HANDOFF/CHANGELOG, then commit and push on confirmation. Use when Phillip says "end of session", "cleanup workflow", "wrap up", or asks to sync Figma with the prototype.
---

# End of session — Air Methods prototype

Figma (file `18WKlxwsAYNi1EVrq21obj`, page frame `146:2642`) is the source of
truth. Anything changed in the prototype through chat must be reflected back
into Figma before the session ends. Work in the least destructive way: add,
don't replace; flag, don't delete.

## 0. Inventory

1. Read `spec/figma-sync.md`. Every row under **Pending** is a prototype
   change Figma doesn't have yet.
2. Cross-check `git log` since the last `End of session` commit for anything
   made through chat that isn't listed, and add it.

## 1. Figma sync (load the `figma:figma-use` skill first)

For each pending row:

- **Interaction states** (hover, focus, reveal): add them to the existing
  component set as *new* variants (e.g. `State=Rest` / `State=Hover`); never
  edit or remove existing variants. Wire `ON_HOVER → CHANGE_TO` with Smart
  Animate at the prototype's duration (motion tokens: base = 400ms). Switch
  the homepage instances to the new resting variant and check their text
  overrides survived.
- **Copy / colour / layout** changes: edit the instance or frame on the
  homepage; bind to existing variables — no raw values.
- **Things Figma can't render** (the WebGL globe, the moving logo field):
  capture a still from the running prototype (browser pane must be visible —
  a hidden pane doesn't paint) and place it as an image fill behind real,
  editable layers (text, HUD, headings). Name the layer `Still — <what> —
  <date>` so it's obviously a stand-in.
- Screenshot each changed node with `get_screenshot` and compare to the
  prototype at 1920.

Move each finished row to **Synced** with the Figma node id.

## 2. Code checks (report, don't delete)

- Unused images in `site/img` (not referenced from `site/` or `src/`).
- Pattern/block CSS with no matching class in `site/index.html`.
- JS hooks toggling classes no CSS uses.
- `npm run lint` and `npm run check:scales` (the latter is known to fail —
  open item 1 in HANDOFF.md).
- List anything unused under "Known unused" in HANDOFF.md. Only delete when
  Phillip asks for that specific item.

## 3. Docs

- `CHANGELOG.md`: one dated entry summarising the session.
- `HANDOFF.md`: page structure, open items, known unused.
- Project memory: update the handoff memory's "State at end of …" line.

## 4. Commit and push

Show the summary and ask before pushing — a push to `main` deploys to
https://airmethods-phase1-v1.netlify.app/. Commit message starts with
`End of session:`.
