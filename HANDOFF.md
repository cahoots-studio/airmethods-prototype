# Air Methods prototype — handoff

Written 2026-09-28 when work moved from Cowork to Claude Code; updated at the end of that session. Read `CLAUDE.md` first for the
Supercomponent rules (tokens, Client-First naming, cascade layers). This note covers what is
specific to the Air Methods build.

## What this is

A live HTML prototype of the airmethods.com homepage rebuilt with Supercomponent. It is also the
first real client test of the Figma → tokens → code pipeline.

- **Live:** https://airmethods-phase1-v1.netlify.app/
- **Deploy:** push to `main` on GitHub; Netlify builds with `npm run build:netlify` and publishes `_site/`.
- **Commits:** author as `phil@cahoots.studio`. Do not rewrite already-pushed history.

## Figma

File `18WKlxwsAYNi1EVrq21obj`. Use the Figma MCP; read with `use_figma` (figma-use skill) when
you need bound variables, and with `get_screenshot` for visuals.

| What | Node |
|---|---|
| Design being built: **Homepage — Phase 1 Update** | `146:2642` |
| · Hero | `146:2643` |
| · Coverage (globe + partners) | `146:2655` |
| · What We Do (Healthcare Partners set `200:616`, Default/Hover) | `146:2732` |
| · History (layer still named "Section / History"; was Join the Team) | `146:2747` |
| · Team — Join the Team | `204:1191` |
| · Newsfeed (Newsfeed Item set `204:1332`; homepage uses Rest/Hover) | `146:2941` |
| · Footer | `146:2751` |
| · Transition wing (hero / What We Do) | `215:1710` / `215:1717` |
| Patient CTA — no longer on the page | `146:2739` |
| Navigation component set | `36:946` |
| · Layout=Desktop (transparent) / Desktop Expanded | child / `95:148` |
| · Layout=Mobile / Mobile Open | `36:957` / `36:964` |
| Logo set (Color × Type=Logo/Mark) | `87:140` |
| As Is page (original site rebuild) | `70:352`, homepage `70:494` |

The Figma variables are the token source. To re-sync: dump variables with all modes to
`tokens/.figma-raw.json` (snippet in `CLAUDE.md`), then
`node build/sync.mjs --theme=airmethods --no-deploy --yes`.

**Figma gotcha:** if you swap a FONT_FAMILY variable while the outgoing family can't be loaded,
every bound text node drops to Regular. Restore weights explicitly afterwards.

## Page structure (`site/index.html`)

| Section | Pattern CSS | Notes |
|---|---|---|
| Navigation | `src/patterns/navigation/` + `site/js/navigation.js` | Desktop: transparent bar, Royal Blue on hover/focus, dropdown panels on items with a menu (pure CSS). ≤991px: solid Royal bar, Logo Mark, Main Menu/Close toggle, full-height drawer with accordion (JS). |
| Hero | `src/patterns/hero/` + block `transition` | Figma height as a share of width (1085 @1920 → `56.51cqi`), copy bottom-aligned; ≤991px full-screen. Transition wing leaves bottom-right. |
| Coverage `#missions` | `src/patterns/coverage/` + `site/js/mission-globe.js`, `site/js/partner-field.js` | Pinned WebGL globe, two beats. Globe colorway: Royal Blue → Top gradient, `#DCE740` trails, elevation lines. **Tuning panel at `?controls`** ("Copy settings" → new defaults). Intro beat: statement + HUD (clock, counts, legend) top-aligned beside it. Partners beat: transparent → Royal Blue wash, tiles without fill. |
| What We Do | `src/patterns/services/` + block `transition` | Three Healthcare Partners cards; row centred at Figma's height, hovered card grows up and down past it like the Figma Hover variant (image above, CTA below). Wing sweeps in at the top. |
| History | `src/patterns/story/` | Copy left, full-bleed ramp-lines art right (`history-art.webp`). |
| Join the Team | `src/patterns/story/` `.is-media-left` | Vertical shaped photo + cut-out left (`join-the-team-art.webp`), copy right. |
| Newsfeed | `src/patterns/newsfeed/` | Scheme 2. Rest: headline + summary; hover/focus: image rises in, "Read Article" drops in. Stacks ≤991px. |
| Footer | `src/patterns/footer/` | Wordmark left, links right; legal + copyright. |

Hover/focus reveals are desktop-only (`(hover: hover) and (min-width: 992px)`); touch and ≤991px
always show everything.

Source artifacts that were ported (the globe's tuning panel is back behind `?controls`; the logo field's was removed):

- Mission Globe — https://claude.ai/artifact/BKzTHxg7x2r57HYMJe3H7d
- Partner Logo Field — https://claude.ai/artifact/56GMw54cWSzbAL6nUmQ9Js

## Build details worth knowing

- `build:netlify` runs `check:scales` non-blocking (see open items). `build:site` still blocks on it.
- `netlify.toml` serves `/assets/*` as immutable. `build/build-prototype.mjs` appends a content hash
  (`?v=…`) to the CSS and `js/*.js` references, so changes show up without a hard refresh.
- `build-prototype.mjs` copies `site/img` and `site/js` into `_site`.
- Use absolute `/img/...` paths in CSS custom properties. A relative `url()` inside a custom
  property resolves against the stylesheet, not the page.
- Fonts come from the Adobe Fonts kit in `<head>` (Proxima Nova Condensed for headlines, Hanken
  Grotesk for text).

## Open items

1. **check:scales fails.** Figma has `Padding/Section/Global` at 80 @1440 but 56 @1920, so it shrinks
   as the screen grows. Fix in Figma, re-sync, then make `check:scales` blocking again in `build:netlify`.
2. **Mobile nav questions for Phillip:**
   - Top-level links: the weight variable is Black but the font style is ExtraBold. Built as ExtraBold.
   - The drawer list is indented 40px while the logo is at 20px (panel padding nested inside the
     bar padding). Built as drawn.
   - The mobile bar is solid Royal, not transparent. Built as drawn.
3. **Placeholder content:** the partner logos (18 invented names), the globe base list/volumes, and
   the three Newsfeed cards are placeholders. The "Prototype ·" pills were removed on request, so
   nothing on the page flags them any more. Swap them when real data arrives.
4. **Dropdown info column** only has a Learn More link; the design may want more there.
5. **Figma sync backlog** — see `spec/figma-sync.md`. The globe still (Coverage) needs the browser
   pane visible to capture.
6. **Section/Large padding** is 128 in the tokens, 160 in the Figma frames, so sections run 20–45px
   shorter than Figma.
7. **Image resolution:** art exported from Figma via MCP is 1× only (story art, newsfeed photo crop).

## Known unused (kept on purpose — delete only on request)

- `site/img/patient-center.webp`, `site/img/what-we-do-2.webp`
- `src/patterns/cta/` (Patient CTA — removed from the page, may return)
- `src/blocks/placeholder/`, `.mark.is-small` in `src/blocks/mark/`
- `.is-partners` toggle in `site/js/partner-field.js` (annotated)

## End of session

Run the `end-of-session` skill (`.claude/skills/end-of-session/`): Figma sync of every chat-made change
(`spec/figma-sync.md`), non-destructive code checks, this file + CHANGELOG, then commit/push on
confirmation.

## Ways of working

- Talk decisions through with Phillip rather than deciding silently. Explain before implementing.
- Figma is the authority for design; check the Figma node before changing a section.
- No upstream links to the SC library from this file.
- Test at 390, 768, 1440 and 1920 wide.
