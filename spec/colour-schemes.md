# Supercomponent — Colour Scheme Switching

**Status:** verified in Figma, CSS and Webflow · **Last updated:** 27 August 2026

How a section changes its entire palette without any component being modified.
It is what lets one Button work on a light section, a dark section and a
high-contrast one.

Everything below has been tested. Where a claim has not been verified it says so.

---

## 1. The model

**Two independent axes.**

| Axis | Varies | Controlled by |
|---|---|---|
| **Scheme** | section to section on one page | the section |
| **Mode** | the whole page | light/dark preference |

Three schemes, two modes, six combinations.

| Scheme | Purpose |
|---|---|
| **1 — Primary** | most of the page |
| **2 — Subtle** | an eye break; signals a subject change or varies page flow |
| **3 — Contrast** | grabs attention — CTAs, featured content |

Modes are reserved for light/dark and nothing else. A client with a genuine
second axis — a product range, a sub-brand — extends by adding modes, not by
overloading schemes.

## 2. The roles

Eight, and only eight. A component references these and nothing else.

| Role | Job |
|---|---|
| `Background` | the section surface |
| `Foreground` | a raised surface on top of it — cards, panels |
| `Text` | body text |
| `Accent` | the highlight colour for this section |
| `Border` | dividers and outlines |
| `Button Surface` | button fill |
| `Button Text` | button label |
| `Button Border` | button outline |

There is deliberately **no `Accent Text` role**. Accent is scoped to fills,
borders, icons and large display text — never body copy — so no companion text
role is needed. See the accent constraint below.

**The button roles exist because the first five cannot express them.** "The text
colour that sits on top of Accent" has no name in a five-role set, and in a
scheme where Text is near-white, white-on-accent fails contrast badly. Rather
than let each button guess, the scheme states it.

### Invariants

**Foreground is always lighter than Background.** Every scheme, every mode. If
Foreground moves darker in one scheme and lighter in another, the same card
reads recessed in one band and raised in another. When Background already sits
near the light end, Foreground goes to the extreme rather than reversing.

**Border must be visible against both Background and Foreground.** It is
usually two ramp steps from Background, not one. A border equal to Foreground
gives a bordered card an invisible edge against its own surface.

### Measured contrast

| | bg | fg | fg/bg | border/bg | text/bg |
|---|---|---|---|---|---|
| Primary / Light | `#ECE9E3` | `#F6F5F1` | 1.11 | 2.33 | 13.37 |
| Primary / Dark | `#24201A` | `#413C31` | 1.48 | 2.45 | 14.85 |
| Subtle / Light | `#DAD5CC` | `#F6F5F1` | 1.34 | 1.93 | 11.08 |
| Subtle / Dark | `#413C31` | `#645C4E` | 1.66 | 3.88 | 10.05 |
| Contrast / Light | `#24201A` | `#413C31` | 1.48 | 2.45 | 14.85 |
| Contrast / Dark | `#ECE9E3` | `#F6F5F1` | 1.11 | 2.33 | 13.37 |

Button text sits at 14.85 in every combination.

### Focus

Focus lives in `Color Primitives / Utility`, not as a scheme role:

```
Utility/Focus           → Key Colors/Electric Violet
Utility/Focus Contrast  → Utility/White
```

**Two colours because one cannot work.** Surfaces in this system span `#F6F5F1`
to `#24201A`. A ring clearing 3:1 against the lightest needs L ≤ 0.27; against
`#645C4E` it needs L ≥ 0.40. Those do not overlap — no single value clears 3:1
on every surface. A two-tone ring always has one visible edge, which is what
browsers do natively and why.

It sits in Utility rather than in the schemes because a focus ring that changes
colour per section is a ring users stop recognising.

### The accent constraint

**Flush Orange cannot be accessible body text on a light background.** It sits
at 0.378 relative luminance; clearing 4.5:1 above it would need luminance 1.87,
and white is 1.0. Nothing in any palette can do it.

So Accent is scoped: **fills, borders, icons and large display text** — all of
which need 3:1 and pass. Body-size accent text uses `Text` instead.

The same arithmetic governs buttons. On a Flush Orange surface:

| Label | Ratio |
|---|---|
| `Neutral Darkest` | **6.60** |
| Pure white | 2.46 |

Dark labels on orange, always. White fails even the 3:1 large-text bar.

**Icons are the exception.** WCAG holds UI components to 3:1 rather than 4.5:1,
and a solid glyph gets latitude a paragraph does not. An icon-only button can
carry a light label where a worded one cannot.

## 3. Figma

**Schemes are variable groups. Modes are light/dark.**

```
Collection: Color Schemes          modes: Light (Primary) · Dark
  Scheme 1 - Primary/   Background · Foreground · Text · Accent · Border
                        Button Surface · Button Text · Button Border
  Scheme 2 - Subtle/    (same eight)
  Scheme 3 - Contrast/  (same eight)
```

Every role aliases a primitive in `Color Primitives`. None holds a raw hex.

**Known limitation:** a component binds to one specific scheme's group, so it
does not adapt automatically when dropped into a different scheme's section on
canvas. Figma allows one mode axis per collection and it is spent on light/dark.

The alternative — schemes as modes — adapts automatically but leaves light/dark
nowhere to live. The current arrangement was chosen deliberately: light/dark is
a real user-facing toggle, scheme is an authoring choice.

**This limitation is Figma-only.** In CSS each scheme emits its own selector
block, so components adapt without knowing anything.

## 4. CSS

```html
<body data-sc-mode="dark">
  <section class="section_wrap" data-sc-scheme="scheme-3">
```

```css
[data-sc-scheme="scheme-2"] { --sc-color-background: …; … }
[data-sc-mode="dark"] [data-sc-scheme="scheme-2"] { … }

[data-sc-scheme], [data-sc-mode] {
  background-color: var(--sc-color-background);
  color: var(--sc-color-text);
}
```

That last rule is load-bearing: tagging a section *paints* it rather than
redefining variables and waiting for something to consume them. It mirrors
Figma, where setting a frame's mode changes what you see immediately.

Scheme 1 in light mode is `:root` and carries no attribute.

## 5. Webflow

Verified end to end, 13 Aug 2026. Native throughout, no custom code.

**Variables alias variables** — a colour variable takes `existing_variable_id`
rather than a hex, so the layered architecture survives.

**Classes bind to variables** — a style property takes `variable_as_value`
rather than `property_value`.

**A style carries a variable mode.** This is the switching mechanism:

```
1. create the Color Schemes collection
2. one variable per role, each aliasing a primitive
3. one mode per scheme/mode combination
4. set each role's value per mode
5. create .section_wrap with background-color and color bound to the roles
6. create combo class .is-scheme-3 under .section_wrap
7. set_style_variable_mode on the combo, targeting the collection
```

`set_style_variable_mode` also accepts `breakpoint_id` and `pseudo`, so a scheme
can be scoped to a breakpoint or a hover state. Available, not yet used.

**Webflow generates its own CSS variable names** — `--_color-schemes---background`,
not `--sc-color-background`. The two systems coexist rather than merge, so each
site picks one:

| Approach | Editable in Webflow UI | Names |
|---|---|---|
| Native Webflow variables | yes | Webflow's |
| Paste `supercomponent.css` | no | ours |

For client sites where someone else edits, native variables are right.

## 6. Rules for component authors

- Reference the eight roles. Never a primitive, never a hex.
- Do not build a light/dark variant. The mode handles it.
- Buttons use the Button roles, not Text and Background borrowed.
- Accent is for fills, borders, icons and large text. Not body copy.
- If a component needs a colour the eight roles cannot express, the role set is
  incomplete — raise it rather than reaching past the contract.

## 7. Known constraints

**Figma:** one mode axis per collection. Fill opacity cannot bind to a number
variable — only whole-node opacity can, and that dims children too. Translucent
surfaces with solid text need an alpha colour from `Transparency`.

**Webflow:** larger breakpoints (1280 / 1440 / 1920) must be added by hand in
the Designer; there is no API. **Once added they cannot be removed.** The
Designer must be open with the MCP bridge running — it is a live session, not a
background API.

**Webflow's `tiny` breakpoint is 479px**, despite documentation saying 478.
Match the API.

## 8. Changelog

- **14 Aug 2026** — schemes restructured from 8 roles × 6 modes to 3 groups × 8
  roles × 2 modes. Modes reserved for light/dark. Foreground direction and
  border visibility corrected across all six combinations. Accent constraint
  documented with measurements.
- **13 Aug 2026** — verified the full mechanism in Webflow. Documented the CSS
  variable naming divergence and the breakpoint constraints.
