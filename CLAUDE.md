# Supercomponent

A portable design system for marketing sites. One token source, one component
library, four delivery targets: Astro, Webflow, WordPress Gutenberg, static HTML.

Maintained by Cahoots Studio. Naming follows Finsweet Client-First.

---

## Source of truth — read this before changing anything

| Layer | Authored in | Canonical copy | How it moves |
|---|---|---|---|
| Tokens (color, space, type, size) | **Figma variables** | `tokens/*.json` in this repo | `npm run tokens:pull` → commit |
| Motion (duration, easing, stagger) | **This repo only** | `tokens/motion.json` | Figma can't express curves. Never overwritten by pull. |
| Components & blocks | **This repo** | `src/` | Figma components are mirrors, linked by Code Connect |
| Page composition | Figma while exploring, repo once real | `src/pages/` | One deliberate handoff, not a sync |

**Figma is the authoring surface. This repo is the build artifact.** A token is
not live until it has been pulled and committed. That gap is a release
boundary, not a bug — it is what gives tokens a diff, a history, and a revert.

Never hand-edit `tokens/primitive.json`, `tokens/semantic.json`, or
`tokens/themes/*.json`. Change them in Figma and pull. The one exception is
`tokens/motion.json`, which is repo-native.

---

## Commands

```bash
npm run sync               # pull from Figma -> diff -> confirm -> rebuild -> deploy
npm run tokens:pull        # same, minus the deploy
npm run tokens:build       # regenerate dist/ from committed tokens
npm run tokens:seed-figma  # ONE-TIME: emit the payload that seeds a fresh Figma file
npm run dev                # local preview of docs/
```

### The sync loop

Figma's REST variables endpoint is Enterprise-only; the MCP tool is not. So:

1. Dump variables **with all their modes** to `tokens/.figma-raw.json`. Run this
   via `use_figma` rather than `get_variable_defs`, because that tool returns one
   value per variable and modes are how the responsive layer and light/dark exist
   at all:

   ```js
   const collections = await figma.variables.getLocalVariableCollectionsAsync();
   const dump = {};
   for (const c of collections) {
     for (const id of c.variableIds) {
       const v = await figma.variables.getVariableByIdAsync(id);
       const byMode = {};
       for (const m of c.modes) byMode[m.name] = v.valuesByMode[m.modeId];
       dump[`${c.name}/${v.name}`] = byMode;
     }
   }
   return dump;
   ```

   A flat `{ name: value }` dump still works — mode overrides are then carried
   forward from what is committed rather than read from Figma.

2. `npm run sync`

Sync normalises into a temp directory first and **writes nothing until you
confirm**. It shows changed / added / removed, and for each change the semantic
roles downstream of it:

```
  CHANGED  2
    color.brand.500      #FF8400 → #FF7A00
      ↳ affects color.action, color.text-brand
    space.4xl            6rem → 7rem
      ↳ affects space.section-md
```

That blast radius line is the point. A primitive edit in Figma looks local and
isn't — this is what shows you the reach before it ships.

Flags: `--theme=<name>`, `--yes` (skip the prompt), `--no-deploy`.

**Mode changes are reported.** A mode override is invisible to a plain value
comparison — the base value is unchanged, so a stripped mode reads as no change
at all. The diff compares mode maps separately and prints added, changed and
removed modes per token.

**Breaking removals are blocked.** If Figma no longer has a token that
`semantic.json` still references, sync refuses and writes nothing — you get the
list of orphaned roles instead of a build that fails three steps later.

Figma collections must be named `Primitive`, `Brand`, and `UI + Spacing`.
Anything else is skipped and reported.

### Deploying

Sync runs `npm run deploy` at the end if that script exists. It isn't configured
yet — add one, e.g.:

```json
"deploy": "npx wrangler pages deploy docs --project-name=supercomponent"
```

Until then sync builds and tells you nothing was published.

---

## Token architecture

Three layers. Components bind to semantics only.

```
primitive.json     LAYOUT GEOMETRY — space, size, radius, breakpoints
                   IDENTICAL for every client
themes/<name>.json BRAND — color ramps, typefaces, type scale, weights,
                   leading, tracking. THIS is what changes per client.
semantic.json      ROLES — surface, text-primary, action, section-md
                   the contract; components reference ONLY these
textstyles.json    NAMED TEXT STYLES — composites of the above
```

The primitive/theme line is: geometry vs. expression. A 4pt spacing rhythm is
structural and survives any rebrand. A type scale is not — a fashion client and
a fintech client want different ones — so it lives in the theme.

Adding a role to `semantic.json` is a breaking change to every theme. Do it
deliberately.

**New client = copy `tokens/themes/cahoots.json`, change the values, done.**
Every component and text style inherits without modification.

CSS custom properties are `--sc-{path-with-dashes}`:
`color.text-primary` → `--sc-color-text-primary`. These names are identical in
Astro, Webflow, and WordPress. That is the whole portability thesis.

---

## Responsive modes

Six modes, matching Webflow's breakpoints so the two panels read the same. 1280
is deliberately skipped — it sits close enough to the base to be noise, and a
larger breakpoint cannot be removed from a Webflow site once added.

| Mode | Query | Figma / Webflow | Direction |
|---|---|---|---|
| `xwide` | `min-width: 1920px` | 1920 | cascades up |
| `wide` | `min-width: 1440px` | 1440 | cascades up |
| `default` | — | Desktop (992+) | base |
| `tablet` | `max-width: 991px` | Tablet | cascades down |
| `landscape` | `max-width: 767px` | Mobile Landscape | cascades down |
| `portrait` | `max-width: 479px` | Mobile Portrait | cascades down |

Note **479** — Webflow's API reports this as the tiny breakpoint value.

```json
"headline-hero": {
  "$value": "8rem",
  "$modes": { "wide": "9rem", "xwide": "10.5rem", "tablet": "6rem",
              "landscape": "4rem", "portrait": "3.25rem" }
}
```

Only overridden tokens appear in a mode block; everything else cascades.
Emission order decides the winner when two queries match — ascending min-widths
so 1920 beats 1440, descending max-widths so portrait beats tablet. The two
groups can never both match, so they do not compete.

Ports natively three ways: Figma variable modes, CSS media queries, and Webflow
breakpoint-bound modes (`tiny · small · medium · xl · xxl`).

### What scales on large screens, and what does not

Designing at 1440 and developing for a 27" monitor is where marketing sites
usually fall apart — the container caps, gutters balloon, and the composition
that read as confident at 1440 reads as empty at 2560. Three separate things are
involved:

**Page padding grows.** 64px reads generous at 1440 and stingy at 1920.

**Containers grow, with a ceiling.** 1280 → 1440 → 1600. The ceiling is about
reading, not layout: prose past roughly 75 characters is hard to track on any
screen. Extra width goes to media, columns and whitespace while text stays
capped by the `ch`-based max-widths.

**Display type grows. Body type does not.** This is the lever most systems miss.
A 128px headline is commanding at 1440 and timid inside a 1600 container on a
large monitor. Body copy is different — 18px is 18px because it is about reading
distance, not viewport.

Result: content fills 89–90% of the viewport from mobile through 1600px, where
it previously degraded to 50%.

**Above 1920 nothing more can change**, because that is Webflow's largest
breakpoint. At 2560 the container is still 1600 and fill drops to 63%. Fixing
that needs a `min(1600px, 84vw)` on the container, which cannot be expressed as
a Figma or Webflow variable — so it would be CSS-only and break parity. Left
undone on purpose; revisit if large-monitor traffic justifies the split.

---

## Text styles

**Heading tags carry structure. Text styles carry appearance. They are
independent.**

```html
<h2 class="text-style-headline-huge">   <!-- correct outline, big type -->
<h1 class="text-style-headline-tiny">   <!-- correct outline, small type -->
```

This is why the scale is named `headline-huge … headline-tiny` rather than
`h1 … h6`. Never pick a heading level to get a size — pick the level the
document outline needs, then apply the style the design needs.

Defined in `tokens/textstyles.json`:

| Style | Size |
|---|---|
| `headline-huge` / `-large` / `-medium` / `-small` / `-tiny` | 6xl → 2xl |
| `subhead` | xl |
| `body-large` / `body` / `body-small` | lg / md / sm |
| `label` | xs, mono, wide tracking |

`$headingDefaults` maps bare `<h1>`–`<h6>` to a style. That exists for CMS
content — Gutenberg emits unclassed headings, and they need to look right
without anyone adding classes. Utilities sit in a later cascade layer, so an
explicit `.text-style-*` always wins over the default.

To restyle per client: change the theme's `fontsize` scale, or remap a style in
`textstyles.json`. Both flow through every block automatically.

---

## Colour

### Ramps

Brands do not arrive as tidy scales. They arrive as a light colour used for
backgrounds, a dark colour used for text, and one or more accents. That is two
different generation problems, so there are two strategies.

**Accents radiate from a key.** A mid orange mixed outward stays orange, so the
key is an input and sits in the middle of its ramp.

```bash
npm run color:add -- "Sky Blue" "#2E9BFF"
```

**Neutrals interpolate between two ends.** There is no meaningful middle key —
the mid is an output. The brand's own light and dark are the inputs.

```bash
npm run color:add -- "Neutral" --scale
```

**Both, plus a whole theme, from what a brand hands you:**

```bash
npm run theme:new -- acme --light="#FFFFFF" --dark="#111318" \
  --accent="Coral:#FF5A5F" --accent="Deep Sea:#0B5F6B"
```

Flags across all three: `--dry` previews, `--theme=<name>` targets, `--force`
overwrites.

#### Why it looks the way it does

**Everything interpolates in OKLab, not sRGB.** sRGB is gamma-encoded, so a 50%
channel mix lands visually darker than halfway — which is why naive ramps bunch
up at the light end and go muddy in the middle.

**Tints mix toward the theme's own White, shades toward its own Black.** Never
pure `#FFF` / `#000`. A warm brand mixed toward pure white goes chalky and cold.

**Accent tints hold some of the key's chroma** (`chromaHold`). A straight lerp
toward white drops chroma linearly and pale tints come out washed grey rather
than recognisably the brand.

**Neutral chroma follows an envelope, not the interpolation.** This one matters.
If the brand's dark end is chromatic — warm blacks usually are — linear a/b
interpolation makes chroma rise toward the dark end and the deep greys come out
brown, which is what makes a neutral ramp look cheap. The envelope peaks
mid-ramp where large surfaces live and falls to near-neutral at both ends. Hue
comes from whichever endpoint carries more chroma, since the other is near-grey
and its hue angle is mostly rounding noise.

**Neutral steps are front-loaded.** Light surfaces need more steps close
together — a page background and a card sitting on it differ slightly but must
be distinguishable. Dark steps can spread out.

Tunables live in `SCALE_POSITIONS`, `KEY_STOPS`, `peakChroma` and `chromaHold`
in `build/lib/color.mjs`. Generated stops are written to the theme file and are
hand-tunable from there; `color:add` refuses to overwrite existing stops without
`--force`, because they may have been tuned or pulled back from Figma.

### Roles

Five, in order: **Background** (the section surface), **Foreground** (a raised
surface on top of it), **Text**, **Accent**, **Border**.

Transparency is primitive too — `opacity.faint` through `opacity.full`, stored
0–1 so Figma can bind layer opacity, emitted as percentages so they drop into
`color-mix()` without `calc()`. Text hierarchy uses these rather than extra
colour roles:

```css
.text-color-secondary { color: color-mix(in srgb, var(--sc-color-text) var(--sc-opacity-strong), transparent); }
```

That stays correct in every scheme, because it tints whatever Text currently is.

### Schemes

Three. **Scheme 1 is authored; 2 and 3 are derived from it.**

```json
"scheme-2": {
  "$label": "Scheme 2 — Subtle",
  "$derive": { "from": "scheme-1", "swap": ["background", "foreground"] }
}
```

`$derive` is evaluated at build time, so editing Scheme 1 genuinely moves the
others — there are no duplicated values to drift apart. Scheme 3 swaps
Background and Text, and additionally overrides Foreground and Border to the
far end of the neutral ramp: a straight swap would leave a light raised surface
on a dark background, which reads as a hole rather than something raised.

**Scheme 1 in its default mode is also `:root`.** `semantic.json` does not
declare colour at all. It used to, which meant one change needed two edits and
a guard to catch the times it did not.

Two axes: **scheme** (`data-sc-scheme`) varies section to section, **mode**
(`data-sc-mode`) is the light/dark axis. `mode-1` is whatever the brand defines
as default, `mode-2` its inverse — named neutrally so a dark-first brand is not
fighting the labels.

Figma allows one mode axis per collection and UI + Spacing spends its modes on
Desktop/Mobile, so schemes get their own collection.

**Button colour is not here.** It lives on the button component as
`--button-surface` / `--button-text` / `--button-border` and varies by variant.

---|---|
| **Scheme 1 — Primary** | the source |
| **Scheme 2 — Subtle** | Background and Foreground swapped from Scheme 1 |
| **Scheme 3 — Inverse** | Background and Text swapped from Scheme 1 |

Deriving means a brand change to Scheme 1 propagates, and every value has a
stated reason. Scheme 3 also steps Foreground and Border to the opposite end of
the neutral ramp — a light raised surface on a dark background would not read
as raised.

Two axes: **scheme** (`data-sc-scheme`) varies section to section, **mode**
(`data-sc-mode`) is the light/dark axis. `mode-1` is whatever the brand defines
as default and `mode-2` is its inverse — named neutrally so a dark-first brand
is not fighting the labels.

Figma allows one mode axis per collection and UI + Spacing spends its modes on
Desktop/Mobile, so schemes get their own collection. Same constraint Relume
hit, same solution.

**Button colour is not here.** It lives on the button component as
`--button-surface` / `--button-text` / `--button-border` and varies by variant,
so an accent button on an accent section is solved by choosing a variant rather
than by the scheme guessing.

---

## Naming

Figma carries Title Case (`Color/Neutral Darkest`). The repo carries
lowercase-dashed (`color.neutral-darkest`). Both are correct — they are the
same token in two vocabularies.

The mapping is not a reversible transform. Every token stores `$figmaName` with
the exact Figma label, and seeding writes that back verbatim. Consequences:

- **Rename in Figma once and it sticks.** The next pull records the new label;
  nothing re-derives it.
- **Acronyms survive.** `CTA Orange` stays `CTA Orange`, never `Cta Orange`.
- **Collisions are refused.** If two Figma variables normalise to the same
  token path (`Neutral Darkest` and `neutral darkest`), sync fails and names
  both rather than silently dropping one.

Only the derived fallback used when seeding a fresh file needs the transform,
and it uppercases scale abbreviations (`XS`, `2XL`) rather than title-casing
them into `Xs`.

---

## Client-First conventions

Client-First is the **interchange format**, not a style preference. It is why a
Webflow port is mechanical instead of a rebuild.

**Hard rule: no Tailwind, no CSS-in-JS, no utility framework.** Plain CSS
classes driven by custom properties. Anything else breaks portability.

Page structure — every block follows this nesting exactly:

```html
<section class="<block>_wrap section_wrap" data-sc-block="<block>">
  <div class="padding-global">
    <div class="container-large">
      <div class="padding-section-large">
        <div class="<block>_component"> … </div>
```

Class types:
- `block_element` — component-scoped: `hero_component`, `hero_heading`
- `is-variant` — combo classes: `is-secondary`, `is-large`
- utilities — generated: `padding-section-large`, `text-style-h2`, `container-large`

### Cascade layers

Declared in the generated token CSS:

```css
@layer sc-tokens, sc-base, sc-components, sc-utilities;
```

Utilities land last so a CF utility always beats a component's own rule without
`!important`. Put block styles in `@layer sc-components`. This is the fix for
the classic CF problem where section padding and component padding cancel out.

---

## Vocabulary

Three levels, borrowed from Gutenberg because it is the only vocabulary that
distinguishes them:

| Term | What it is | Examples |
|---|---|---|
| **Block** | base-level element | button, card, form field, media |
| **Pattern** | blocks composed into a section | hero, gallery, testimonial, CTA, footer |
| **Section / container** | Client-First page structure | `padding-global`, `container-large` |

Figma and Webflow call both blocks and patterns "Components" — one word for two
things. We keep them separate in the repo and let each target flatten as it
likes:

| Repo | Figma | Webflow | Gutenberg |
|---|---|---|---|
| Block | Component | Component | Block |
| Pattern | Component | Component | Pattern |

**Headings and body text are not blocks.** They are text styles applied to
semantic tags (`<h2 class="text-style-headline-large">`). Wrapping them in a
component adds a layer with no behaviour. The Gutenberg adapter maps text
styles onto `core/heading` and `core/paragraph` at the boundary — that
translation belongs in the adapter, not the source.

---

## Layout

There is no shared layout class. Each pattern declares its own layout in its own
CSS file, using `--sc-*` spacing tokens.

That is a deliberate reversal — a `.grid` primitive existed and was removed. The
argument for one is deduplication; the argument against is that it adds a
vocabulary you have to hold in your head that does not correspond to how the
design was actually made. Auto layout in Figma and flex settings in Webflow are
the working model, and pattern-level CSS translates from them directly.

Consequences worth knowing:

- Pattern CSS is longer, and that is expected. A pattern file carrying twenty
  lines of layout is normal now.
- Responsive collapse is per pattern. No behaviour comes for free.
- `min-width: 0` on flex and grid children is worth setting by hand. The default
  is `min-width: auto`, which refuses to shrink below content size — the cause
  of nearly every unexplained horizontal scrollbar.

**Horizontal clusters are still blocks.** An action row is one recognisable
element with its own mobile behaviour — see `src/blocks/action-row/`. Reach for
a block before writing the same flex rules into a third pattern.

---

## Responsive behaviour lives in the class

Not in the target's UI. Webflow lets you set flex direction per breakpoint;
Gutenberg core has no breakpoint controls at all. Configuring responsive
behaviour per target means writing it two or three times, and one of those
times is impossible without a plugin.

So: collapse rules belong in `.grid` and the block CSS, where one definition
ships identically to Astro, Webflow and WordPress. Set it once in the class,
never in the breakpoint panel.

`is-auto-fit` is the strongest version of this — `repeat(auto-fit, minmax())`
responds continuously with no breakpoint at all, so there is nothing to
reconfigure anywhere. Prefer it when the column count is not load-bearing.

---

## Adding a pattern

Copy `src/patterns/hero/`. Checklist:

- [ ] Markup follows wrap → padding-global → container → padding-section nesting
- [ ] `data-sc-pattern="<name>"` on the section
- [ ] `data-sc-slot="…"` on every element a client should be able to edit
- [ ] Inner layout uses `.grid` / `.column` rather than bespoke flex
- [ ] Styles in `@layer sc-components`, `--sc-*` tokens only — **no raw hex, no raw rem**
- [ ] No margin on the outer element; section rhythm belongs to CF utilities
- [ ] Motion via `data-sc-motion` only — never inline GSAP
- [ ] Responsive to 479px, visible `:focus-visible`, reduced motion honoured
- [ ] `<name>.figma.ts` Code Connect mapping to the matching Figma component

Adding a **block** is the same, in `src/blocks/`, minus the section nesting —
blocks have no outer wrapper because patterns provide it. See
`src/blocks/button/`.

The folder name is the whole naming convention:

```
folder:     src/patterns/testimonial/
classes:    .testimonial_wrap  .testimonial_component
attribute:  data-sc-pattern="testimonial"
```

The Figma component and the code pattern **must share a name**. That shared
vocabulary is what makes round-tripping work.

---

## Motion

Blocks declare intent, not implementation:

```html
<h1 data-sc-motion="reveal-up">
<ul data-sc-motion="stagger-in" data-sc-motion-stagger="loose">
<div data-sc-motion="parallax" data-sc-motion-depth="0.5">
```

Presets live in `src/motion/presets.js` and read their values from motion
tokens. Change `tokens/motion.json` and every animation on every site updates.

Adding a bespoke animation? Add a named preset. Do not write one-off GSAP in a
block file — that is the thing this system exists to prevent.

---

## Delivery targets

**Astro (default).** `dist/supercomponent.tokens.css` + `src/styles/base.css` +
block CSS. Content in markdown/JSON, edited through a git-based CMS.

**Webflow.** `npm run tokens:build` → `dist/webflow-variables.json`, then use
the Webflow MCP `data_variable_tool` to create them. Blocks port via
`data_whtml_builder`, which accepts HTML/CSS strings. Class names carry over
unchanged. Motion tokens go in Site Settings → Custom Code → Head using the
`motionEmbed.css` string in that same file.

**WordPress Gutenberg.** `dist/theme.json` drives the editor UI. Enqueue the
same generated CSS. Each block becomes a registered block pattern using the
identical markup and class names.

---

## Don't

- Don't add Tailwind or any utility framework
- Don't hand-edit generated files (`dist/`, pulled token files)
- Don't use raw color or spacing values in component CSS
- Don't write inline GSAP in a block
- Don't add a semantic role without checking every theme still resolves
- Don't rename a Figma component without updating its Code Connect mapping
