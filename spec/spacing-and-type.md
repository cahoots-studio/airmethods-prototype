# Supercomponent — Spacing, Sizing and Type

**Last updated:** 27 August 2026 · verified against Figma `2o9qwQhFHuWWQFWZ12mEGG`

The non-colour half of the token system. Read with `colour-schemes.md`.

---

## 1. Why four collections and not one

Figma allows **one mode axis per collection**, and the domains need different axes:

| Collection | Modes | Why |
|---|---|---|
| Color Primitives | 1 | colour does not change with viewport |
| Color Schemes | 2 | light / dark |
| UI + Spacing | 6 | breakpoints |
| Typography | 6 | breakpoints |

The split is forced, not chosen. Colour primitives cannot share a collection
with spacing because one needs six breakpoints and the other needs none.

**Breakpoints**, matching Webflow exactly:

```
1920  min-width 1920      Webflow xxl
1440  min-width 1440      Webflow xl
Desktop  base, unbounded  Webflow main
Tablet   max-width 991    Webflow medium
Mobile Landscape  max 767 Webflow small
Mobile Portrait   max 479 Webflow tiny
```

Webflow's API reports `tiny` as **479**, not the 478 its documentation states.
Match the API.

---

## 2. The four spacing ladders

Each answers a different question. They are not interchangeable.

### Padding/Gap — space *between* things

```
        1920  1440  Desk  Tab   ML   MP
None       0     0     0    0    0    0
Tiny       8     4     4    4    4    4
Small     16    12     8    8    8    8
Medium    24    20    16   16   12   12
Large     40    36    32   24   20   16
Huge      80    72    64   48   40   32
```

Flex and grid gaps, stack rhythm inside a component.

### Padding/Block — space *inside* sections

```
        1920  1440  Desk  Tab   ML   MP
None       0     0     0    0    0    0
Tiny      24    20    16   12   12    8
Small     56    44    32   24   20   16
Medium    96    80    64   48   40   32
Large    160   144   128   96   72   56
Huge     320   288   256  192  144  112
```

Desktop carries the working scale — `16 / 32 / 64 / 128 / 256` — and the other
modes scale outward from it.

### Padding/Control — space inside controls

```
None 0 · Tiny 4 · Small 8 · Medium 16 · Large 24 · Huge 32
```

**Flat across every breakpoint, deliberately.** A button's internal padding is a
function of its own text, not the viewport. Shrinking it on mobile is the wrong
direction — see §4.

### Padding/Section — semantic, aliases Block

```
Global   120 · 80 · 64 · 48 · 32 · 20     the page gutter
Large    → Padding/Block/Large
Medium   → Padding/Block/Medium
Small    → Padding/Block/Small
```

`Global` is the only one holding its own values; the rest are named aliases so a
section's vertical rhythm can be repointed without touching the scale.

---

## 3. Width

```
Width/Container   Small 768 · Medium 1200/1120/1024 · Large 1600/1440/1280 · Full 100%
Width/Column      Widest 1280 · Wider 1024 · Wide 768 · Medium 560
                  Tight 480 · Tighter 400 · Tightest 320
```

`Container/Full` is `100%`, a CSS value. It briefly held `Fill` — Figma's UI
label — which is not valid CSS and would have been silently discarded by the
browser. String tokens are not validated by the linter; treat them with care.

---

## 4. Corners

A scale plus a semantic layer, the same pattern as colour.

```
Radius    None 0 · Tiny 2 · Small 4 · Medium 16 · Large 24 · Huge 32 · Round 9999

Corners   Button → Medium     Card   → Large      Media → Medium
          Input  → Small      Modal  → Large      Tag   → Tiny
          Avatar → Round      Control→ Tiny
```

Components bind to `Corners/*`, never to `Radius/*`. A semantic name pointing at
a scale step is **indirection, not duplication** — it lets a role be repointed
per brand without touching the scale.

`Corners/*` must not vary by breakpoint. A corner is a brand property, not a
responsive one.

`Radius/Tiny` at 2 is the one value deliberately off the 4px grid. Radius is not
spacing and does not need to align to anything; 2px gives a "sharp but not
razor" edge that 4px cannot.

---

## 5. Two rules that govern the ladders

### Ladders ascend within every mode

`Tiny < Small < Medium < Large < Huge`, in all six. Enforced by
`npm run check:scales`.

The usual cause of a break is a step left flat while its neighbours shrink —
`Block/Tiny` frozen at 16 while `Block/Small` dropped to 12 put Small *below*
Tiny on mobile. Unfreeze the frozen step rather than pushing its neighbours further.

### No value grows as the viewport shrinks

A token's value at Tablet must not exceed its value at Desktop. Also enforced by
`check:scales`, which walks the full CSS cascade at each breakpoint rather than
comparing declared values — a token with no Tablet override inherits from
Desktop, and a naive comparison would skip it.

### The conflict these two create

**Touch targets want to grow on small screens.** iOS and Android both recommend
44px; WCAG 2.5.8 sets a 24px floor. But rule two forbids padding from growing as
the screen narrows.

**Resolution: `min-height`, not padding.**

```css
.button { min-height: 44px; }
```

Padding stays flat at `Control/Small` / `Control/Medium` (8 / 16) and the
control simply cannot render shorter than a thumb. This is why Figma shows a
38px button and the browser shows 44px — **the difference is intentional.**

This reasoning is duplicated in the Button component's description in Figma,
because that is where a designer meets the discrepancy.

---

## 6. Typography

```
Typeface/Family   Headline: Inter Tight · Text: Inter · Decorative: Roboto Mono
Typeface/Weight   Regular 400 · Medium 500 · Semibold 600 · Bold 700

Size/Headline     Hero 168…52 · Huge 116…44 · Large 80…36
                  Medium 52…30 · Small 36…24 · Tiny 22…18
Size/Text         Huge 52…30 · Large 38…26 · Medium 24…20
                  Small 18…17 · Tiny 14 (flat)
```

**Typography has no semantic variable layer, by design.** Its semantic layer is
the `Headline` and `Text` components — `Headline Size=Hero` *is* the role. Line
height and tracking live in the repo's `textstyles.json` rather than as
variables, because they are functions of size rather than independent scales.

**Naming:** `Headline` throughout, never `Heading`. `Heading` is the HTML element
name, and a token called `heading-hero` implies a relationship to `<h1>` that
does not exist — visual size and document structure are independent here.

The one exception is `$headingDefaults` in `textstyles.json`, which maps bare
`<h1>`–`<h6>` to styles. That is genuinely about elements, so "heading" is
correct there. Both words appear in the same file meaning different things.

---

## 7. Inter Tight

`Typeface/Family/Headline` is Inter Tight, which **the Figma plugin runtime
cannot load** even when installed locally. Consequences:

- `setBoundVariable('fontSize', …)` works without the font
- `setBoundVariable('fontFamily', …)` requires it and will throw
- Any direct mutation of a text node using it will throw

**Never flip a font variable to work around this.** Text nodes store their style
as a string; if the style name does not exist in the substitute family
(`SemiBold` vs `Semi Bold`), Figma coerces to Regular and flipping back does not
restore it. This destroyed every SemiBold weight in a sibling file.

---

## 8. Two failure modes worth knowing

**Variables can go remote without anything looking wrong.** If a file is
subscribed to a published library containing variables of the same names,
bindings can resolve to the *library* copy while the local collection sits inert.
Names resolve, values match, nothing appears broken — but editing a local
variable changes nothing on canvas.

Check with: does the binding's variable id appear in
`getLocalVariableCollectionsAsync()`? Resolving by name is not the same as being
local. This has happened once, to all 1,281 bindings at once.

**Direct edits silently unbind.** Typing a value over a bound one removes the
binding without warning. A periodic sweep for unbound padding, gap, radius and
font size is worth running before any push — it has caught drift twice.

---

## 9. Variant modes

A variant designed for one breakpoint should be **pinned** to that mode:

```js
node.setExplicitVariableModeForCollection(collection, modeId)
```

Without it, a 390px mobile frame resolves `Padding/Section/Global` at 1920 and
gets 120px of inset instead of 20. The `Navigation` variants are pinned —
Desktop to Desktop, both Mobile variants to Mobile Portrait.
