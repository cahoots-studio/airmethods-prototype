# Changelog

## v0.3.0 — 2026-09-23

### Components

- **Navigation rebuilt** — four states (Default, Hover, Current, Pressed) living on Scheme 2. Navigation is now a full pattern rather than a placeholder block.
- **Footer added** — section pattern on Scheme 3.
- **SC_Logo and SC_Marks** — brand asset components for logo lockups and icon marks.

### Tokens

- **Corners/Tag normalised** — now resolves to `radius.tiny` uniformly across all six modes (previously had per-mode overrides).

### Specs

- Updated `spec/components.md` with Navigation detail, Footer, SC_Logo/SC_Marks, and expanded component inventory.

### Known issues

- **Figma schemes don't cascade to nested components.** A section set to Scheme 2 does not propagate that scheme to component instances nested inside it — Figma's variable mode scoping stops at the first component boundary. Workaround: set the mode explicitly on each nested instance, or rely on the CSS cascade (which does propagate correctly).

## v0.2.0 — 2026-09-22

### Token changes

- **Control padding scale** — new `padding.control.*` group (none/tiny/small/medium/large/huge). Non-responsive: control padding is fixed across breakpoints, unlike block and gap padding which scale with viewport.
- **Focus tokens** — `color.focus` (aliases Electric Violet) and `color.focus-contrast` (aliases White) for consistent focus ring styling.
- **Key Colors rename** — `color.light` / `color.dark` renamed to `color.ground` / `color.top`. The old names implied a light/dark mode relationship; Ground and Top describe what they actually are — the two ends of the neutral ramp.
- **Gap/Tiny tightened** — wide mode removed (was 8px), xwide reduced from 12px to 8px.
- **Corners/Tag simplified** — xwide mode override removed; now uses `radius.tiny` at all breakpoints.

### Components

- **Card absorbed into Supercomponent** — Card is no longer a standalone block. It is now a variant of Supercomponent (`Type: Default | Card`), keeping the same visual treatment but removing a separate component that was really a container for Supercomponent anyway.
- **Navigation and Navigation Link** — new block components for site navigation.
- **Button touch target** — `min-height: 44px` added. Padding tokens shrink with viewport (monotonicity rule), so the touch target must be a fixed floor.

### Specs

- Added `spec/spacing-and-type.md`, `spec/components.md`, `spec/colour-schemes.md` — handoff specs covering the spacing philosophy, component inventory, and colour scheme rules.

## v0.1.0 — 2026-08-25

Initial release. One token source, four delivery targets.

### Token architecture

Three-layer system: **primitives** (layout geometry — space, size, radius,
breakpoints), **themes** (brand expression — color ramps, typefaces, type scale),
and **semantics** (roles — the contract components bind to). New client = copy a
theme file, change the values. Every component inherits.

CSS custom properties follow `--sc-{path}`. Names are identical across Astro,
Webflow, and WordPress.

Token groups:

| Group | Prefix | What it carries |
|---|---|---|
| Color scales | `color.*` | Neutral, Flush Orange, Electric Violet, Sky Blue ramps |
| Spacing | `padding.gap.*`, `padding.block.*`, `padding.section.*` | Gap, block padding, section padding |
| Width | `width.container.*`, `width.column.*` | Container and column max-widths |
| Typography | `typeface.family.*`, `typeface.weight.*`, `font-size.*` | Families, weights, size scale |
| Radius | `radius.*`, `corners.*` | Primitive radii and semantic corner aliases |
| Opacity | `opacity.*` | Transparency scale for text hierarchy |

### Six responsive modes

Matching Webflow's breakpoint set (1280 deliberately skipped):

| Mode | Query |
|---|---|
| `xwide` | `min-width: 1920px` |
| `wide` | `min-width: 1440px` |
| `default` | Desktop 992+ (base) |
| `tablet` | `max-width: 991px` |
| `landscape` | `max-width: 767px` |
| `portrait` | `max-width: 479px` |

Display type scales up on large screens; body type does not. Page padding grows,
containers cap at 1600px, and content fills 89-90% of the viewport through the
range.

### Three colour schemes

| Scheme | Derivation |
|---|---|
| Scheme 1 — Primary | Authored; the source |
| Scheme 2 — Subtle | Background and Foreground swapped from Scheme 1 |
| Scheme 3 — Contrast | High-contrast surface for CTAs and featured content |

Two axes: `data-sc-scheme` varies section to section, `data-sc-mode` is the
light/dark toggle. Schemes derive from Scheme 1 at build time — a brand change
propagates automatically.

Eight roles per scheme: Background, Foreground, Text, Accent, Border,
Button Surface, Button Text, Button Border.

### Component library

**Blocks** (base-level elements):
- `button` — Primary, secondary, ghost variants; small and large sizes
- `card` — Media + content stack with image treatment
- `media` — Responsive image/video container with aspect ratio and corner radius
- `action-row` — Horizontal button cluster, stacks full-width on mobile

**Patterns** (section compositions):
- `hero` — Headline, subtext, action row
- `supercomponent` — The core composition: media, headline, text, actions

**Text styles**: headline-hero through headline-tiny, text-huge through
text-tiny, subhead, label. Structure (heading level) is independent of
appearance (text style class).

### Build pipeline

- `npm run sync` — pull Figma variables, diff with blast-radius display, rebuild
- `npm run tokens:build` — CSS, WordPress theme.json, Webflow variables
- `npm run tokens:seed-figma` — seed a fresh Figma file from committed tokens
- Cascade layers: `@layer sc-tokens, sc-base, sc-components, sc-utilities`

### Figma integration

Tokens authored in Figma, pulled via MCP. Collections: Color Primitives,
Typography, UI + Spacing, Color Schemes. Sync shows downstream impact of every
change and blocks breaking removals.
