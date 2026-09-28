# Figma sync log

Prototype changes that did not come from Figma, and whether Figma has caught
up. Figma is the source of truth; this list is how nothing gets lost between
a chat decision and the design file. Worked through by the `end-of-session`
skill (`.claude/skills/end-of-session/`).

Add a row whenever a change is made in the prototype through chat.

## Pending

| Date | Section | Prototype change | Figma target |
|---|---|---|---|
| 2026-09-28 | Coverage (map) | Background: linear gradient Royal Blue → Top (navy), 178°. Dots + streaks `#DCE740`. Land = Elevation lines (spacing 0.19). Zoom 0.92, tilt 21, shift 23. Commit 8e38164 | Section / Coverage `146:2655` — gradient, scrim and wash done; **globe still pending** (needs the browser pane visible to capture) — placeholder layer `237:466` |

## Synced

| Date | Section | Change | Figma node |
|---|---|---|---|
| 2026-09-28 | Newsfeed | Rest / Hover card states, "Read Article" link | Newsfeed Item `234:500` (Rest), `234:521` (Hover); homepage cards set to Rest |
| 2026-09-28 | Coverage | HUD (clock, counts, legend) beside the statement, editable, bound to Decorative / Text Tiny / Text Medium / Scheme 3 Text | `237:468` |
| 2026-09-28 | Partners | Wash + editable logo field (18 placeholder logos, ExtraBold names) | wash `237:467`, field `237:487` in `237:1079` |
| 2026-09-28 | What We Do | Resolved the other way: Figma's growing card is right, so the prototype now matches it (row centred at Figma height, hovered card grows up and down past it) | `200:616` unchanged |
