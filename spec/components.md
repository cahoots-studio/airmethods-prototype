# Supercomponent — Component Inventory

**Last updated:** 28 August 2026 · verified against Figma `2o9qwQhFHuWWQFWZ12mEGG`

What exists, what each property means, and the rules an author follows.
Read with `colour-schemes.md` and `spacing-and-type.md`.

---

## 1. File organisation

One page, `Components`, holding two frames:

```
Primitives   Label · Headline · Text · Tag · Button · Navigation Link
             Action Row · Input · Image · Media · SC_Logo · SC_Marks
Patterns     Supercomponent · Navigation · Footer
```

A **primitive** is a leaf or near-leaf that other things are made of. A
**pattern** is a composition of primitives. `Action Row` is a primitive despite
containing Buttons, because Supercomponent contains *it*.

---

## 2. Primitives

| Component | Property | Values |
|---|---|---|
| `Label` | — | single |
| `Tag` | — | single |
| `Headline` | Headline Size | Hero · Huge · Large · Medium · Small · Tiny |
| `Text` | Text Size | Huge · Large · Medium · Small · Tiny |
| `Button` | Button Priority · State | Primary/Secondary/Link × Default/Hover |
| `Navigation Link` | State | Default · Hover · Current · Focus |
| `Action Row` | Action Type | Buttons · Email Capture |
| `Input` | Field Type | Basic · Email · Long Form |
| `Image` | Source | 01–12 · None |
| `Media` | Ratio · Image | 12 ratios × instance-swap |
| `SC_Logo` | Color | Light · Dark |
| `SC_Marks` | Property 1 | Dark · Light |

### Button

Padding `Control/Medium` vertical, `Control/Huge` horizontal. Radius
`Corners/Button`. Renders ~54px; CSS adds `min-height: 44px` — see
`spacing-and-type.md` §5.

**Link is bare** — `Control/Small` vertical, `Control/None` horizontal, no
radius. It is a text link, not a ghost button. It has drifted into button
padding once; if Link ever measures the same width as Primary, that is the
symptom.

**Hover is an overlay, not a colour swap.** Primary stacks
`Transparency/Neutral Lightest 15` over its surface; Secondary shows the overlay
directly since it has no base fill. In CSS this is an `::after` at `inset: 0`
fading in — which also gives glow and wipe treatments somewhere to live without
restructuring.

Figma cannot express a transition, only its endpoint. How a hover *arrives* is a
named preset in code (`data-sc-hover="glow"`), chosen rather than read off canvas.

### Navigation Link

Four states. **Current uses weight, not colour** — `Semibold` against `Regular`.
WCAG 1.4.1 forbids colour as the only carrier of information, and current-page
indication is information. Weight also avoids layout shift, because current
state is set at load and never changes interactively.

**Focus** carries a 1px `Utility/Focus` stroke. In CSS it becomes a two-tone
ring, because no single colour clears 3:1 against every surface in the system:

```css
.nav-link:focus-visible {
  outline: 1px solid var(--sc-color-focus);
  outline-offset: 2px;
  box-shadow: 0 0 0 3px var(--sc-color-focus-contrast);
}
```

Figma's `strokeAlign: INSIDE` has no CSS equivalent — `outline` always draws
outside. The browser ring sits slightly further out on purpose.

### Media

Twelve ratios, 21:9 through 9:21, plus `Free`.

**Ratio is a native Figma lock**, not a plugin trick. `targetAspectRatio` is
read-only; `lockAspectRatio()` locks to current dimensions. So: size exactly,
then lock. Combined with fill-width, height tracks width at any container size.

Every plugin and tutorial describing rotated spacer frames at trigonometric
angles predates native support and is now actively fragile. Do not use them.

`Free` is genuinely unlocked — it exists to carry the image swap at whatever
shape the container gives it.

**Corners clip** (`clipsContent: true`), or a square-cornered image overhangs
the radius.

`scaleMode: FILL` is CSS `object-fit: cover` — crop to fill, never distort.

### Image

Twelve sources plus `None`. `None` is an explicit empty state: no fills, no
children, so an empty slot keeps its swap property rather than needing the
instance deleted.

**Grading belongs in CSS, not here.** Figma has no image-filter style, so a
house grade baked into variants means editing twelve fills. In CSS it is one
token — `filter: var(--sc-image-treatment)` — that regrades every image
everywhere. The twelve variants exist to give a mockup visual variety, nothing more.

---

## 3. Patterns

### Supercomponent

```
Type: Default | Card
```

Media → Headline → Text → Action Row, vertical, gap `Padding/Gap/Large`.

**`Card` is a variant, not a separate component.** A card is a Supercomponent
with a surface, padding and a radius — not a different thing.

Fills width rather than declaring one. Figma pins a number because a canvas frame
needs one; in code the container decides, which is what "drops into anything"
requires.

**Vertical ratios and stacked layout conflict.** A 9:16 media in a 560px column
makes the card ~1291px tall. That is the composition saying it wants side-by-side,
not a bug. Unresolved.

### Navigation

```
Layout: Desktop | Desktop Expanded | Mobile | Mobile Open
```

Uses **Scheme 2 — Subtle**. `SC_Logo` plus three top-level items, each owning a
dropdown:

```
Tools     → Brand Aligner · Vibe Dialer · Message Maker · Builder
Services  → Digital Brand Systems
Sessions  → Learn · Build · Consult
```

**Desktop** shows top-level items only. **Desktop Expanded** shows all three
dropdowns simultaneously — that is documentation of what each contains, not
behaviour. In use, hovering one item reveals only that item's dropdown.

`Mobile Open` stacks all three groups as an accordion. Its bar is cloned from
the closed variant so the two align exactly, and the trigger's bars rotate ±45°
into a close mark.

**The panel states its own background** rather than inheriting the bar's. If the
nav is later made transparent to sit over a hero — a common treatment — an
inheriting panel would go transparent and become unreadable.

All four variants are **pinned to their breakpoint mode**. Without pinning, the
390px mobile frame resolves `Section/Global` at 1920 and gets 120px of inset.

**Unresolved:**

- Stacked mobile links are still `Size/Text/Small`. Mobile menus usually go
  larger, but Figma cannot cascade font size the way CSS can
  (`.nav_panel .nav-link { font-size: … }`). A `Placement: Bar | Panel` property
  on Navigation Link is the only option that survives an audit.
- The mobile bar uses the full wordmark, rescaled — which leaves fractional
  internal gaps. A mark-only `SC_Logo` variant would remove the rescale.
- Whether `Desktop Expanded` should become three separate states, one per
  hovered item.

### Footer

Single component. Uses **Scheme 3 — Contrast**.

```
Upper    Identity (logo + address) | Navigation (three link columns)
Rule
Lower    Subnav (disclosures) | Credits (copyright + attribution)
```

Nested `Navigation Link` instances carry **instance-level overrides** repointing
their text from Scheme 1 to Scheme 3. See §4.

---

## 4. Schemes do not cascade in Figma

A component binds to **one specific scheme group**. Dropped into a section using
a different scheme, it keeps its original colours — and if the two schemes share
a value, the result can be invisible rather than merely wrong.

This bit twice on the same day. Footer's nav links arrived on
`Scheme 1/Text` (`#24201A`) against `Scheme 3/Background` (`#24201A`) and
vanished entirely. Navigation had twelve fills on Schemes 1 and 3 inside a
Scheme 2 pattern.

**Every pattern using a scheme other than Primary needs its nested components
repointed by hand.** Thirteen overrides in Footer, twelve in Navigation.

**In code this does not exist.** The section carries
`data-sc-scheme="scheme-3"` and every descendant resolves through it. One
attribute against two dozen overrides.

This is the cost of schemes-as-groups, chosen deliberately so that modes could
be reserved for light/dark. It is not a defect, but it recurs on every pattern
and should be expected rather than rediscovered.

## 5. Rules for authors

- Bind everything. No raw numbers for padding, gap, radius or font size.
- Reference scheme roles, never primitives, never hex.
- Reference `Corners/*`, never `Radius/*`.
- Controls use `Padding/Control`; sections use `Padding/Block`; space between
  things uses `Padding/Gap`.
- No light/dark variants. The mode handles it.
- No scheme variants. The scheme handles it.
- Name properties for what they mean — `Placement`, `Field Type`, `Action Type`
  — never `Property 1`. The string becomes the prop name in code.
- No slashes in component names. Figma reads them as folders.
- Pin breakpoint-specific variants to their mode.

---

## 6. Known gaps

- **Button CTA text is placeholder** — this is a system, not a site.
- **Footer address and column headings are placeholder copy.**
- **Footer has no mobile variant** — three nav columns will not fit at 390px.
- **`SC_Logo` and `SC_Marks` carry unbound internal gaps** (8 and 10). A logo's
  internal spacing is arguably not a system value, but it shows in audits.
- **The wordmark vector carries two remote fills** — the only remote bindings
  left in the file.
- **Image sources 01–12 are one photograph**, twelve times.
- **Nav has no scrolled state**; position and treatment are the consumer's call.
- **Mobile panel link size** — see §3.
- **Supercomponent with vertical media** — see §3.
