# Air Methods prototype — handoff

Written 2026-09-28 when work moved from Cowork to Claude Code. Read `CLAUDE.md` first for the
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
| · What We Do | `146:2732` |
| · Join the Team | `146:2747` |
| · Patient CTA | `146:2739` |
| · Newsfeed | `146:2941` |
| · Footer | `146:2751` |
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
| Hero | `src/patterns/hero/` | `min-height: 100svh`, copy bottom-aligned so it sits near the bottom of the viewport on load. Keep that. |
| Coverage `#missions` | `src/patterns/coverage/` + `site/js/mission-globe.js`, `site/js/partner-field.js` | Pinned WebGL globe (three.js + GSAP ScrollTrigger from cdnjs) with two beats: intro statement, then partners. Story sits in `container-large`; the partner logo field keeps Container/Medium width and is centred; heading and CTA row span the container. The HUD/legend fade out while partners are on screen (`#stage.is-partners`). |
| What We Do | `src/patterns/services/` | Container/Large, lead card plus two cards with small right-aligned tinted images. |
| Join the Team | `src/patterns/story/` | |
| Patient CTA | `src/patterns/cta/` | |
| Newsfeed | `src/patterns/newsfeed/` | |
| Footer | `src/patterns/footer/` | |

Source artifacts that were ported (tuning GUIs removed):

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
3. **Placeholder content:** the partner logos (18 invented names) and the globe base list/volumes
   are placeholders. Both are marked with "Prototype ·" pills. Swap them when real data arrives.
4. **Dropdown info column** only has a Learn More link; the design may want more there.
5. Optional: a fade from the hero bottom into navy.

## Ways of working

- Talk decisions through with Phillip rather than deciding silently. Explain before implementing.
- Figma is the authority for design; check the Figma node before changing a section.
- No upstream links to the SC library from this file.
- Test at 390, 768, 1440 and 1920 wide.
