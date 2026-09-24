# Colour Output Specification — Supercomponent

A handoff for a colour recommendation engine. This describes the **shape** the
output must take, the rules it must satisfy, and a worked reference example.

The engine's job: given a brand's inputs, produce a complete colour system that
drops into this structure without further editing.

---

## 1. Inputs the engine receives

Minimum viable input from a brand:

| Input | Example | Notes |
|---|---|---|
| **Light** | `#FFFDFB` | the brand's off-white — backgrounds in light contexts |
| **Dark** | `#0D0700` | the brand's near-black — text in light contexts |
| **Accent** | `#FF8400` | one or more brand colours |

Light and Dark are the *ends of the neutral ramp*, not members of it. Accents
are ramp *centres*. That distinction drives everything below.

## 2. Required output

Four blocks. Every value is a hex string unless stated.

### 2.1 Key Colors

The unmodified inputs, echoed back.

```
Key Colors/<Accent Name>     e.g. Flush Orange   #FF8400
Key Colors/Light                                 #FFFDFB
Key Colors/Dark                                  #0D0700
```

### 2.2 Scale — the ramps

**Neutral: exactly 7 steps, interpolated between Light and Dark.**

```
Scale/Neutral/Lightest · Lighter · Light · Neutral · Dark · Darker · Darkest
```

**Each accent: exactly 6 steps.** The key colour is NOT repeated here — it
already lives in Key Colors, and duplicating it creates two names for one value.

```
Scale/<Accent>/Lightest · Lighter · Light · Dark · Darker · Darkest
```

The full ramp reads: `Lightest → Lighter → Light → [key] → Dark → Darker → Darkest`

### 2.3 Utility

Absolutes and signals. Not derived from the brand ends.

```
Utility/White      #FFFFFF     true white, for overlays and print
Utility/Black      #000000     true black
Utility/Error      hue ~27°
Utility/Warning    hue ~82°
Utility/Success    hue ~148°
Utility/Info       hue ~245°
```

Signals use canonical hues so red still reads as an error, but take their
**chroma and lightness from the brand accent** — a muted brand should get muted
signals rather than four stock colours pasted in from elsewhere.

### 2.4 Schemes

Three schemes × two modes × eight roles = 48 assignments.

**Values are references to primitives, never hex.** The output must name which
primitive each role points at.

```
Scheme 1 — Primary     most of the page
Scheme 2 — Subtle      an eye break; signals a subject change
Scheme 3 — Contrast    grabs attention; CTAs, featured content

Modes: Light (Primary) · Dark

Roles: Background · Foreground · Text · Accent · Border
       Button Surface · Button Text · Button Border
```

---

## 3. Generation rules

### 3.1 Interpolate in OKLab, not sRGB

sRGB is gamma-encoded, so a 50% channel mix lands visually darker than halfway.
Ramps built that way bunch at the light end and go muddy in the middle. OKLab is
perceptually uniform.

### 3.2 Neutrals interpolate; accents radiate

Two different problems, two different methods.

**Neutral** — the brand's Light and Dark are the inputs and the mid is an
output. There is no meaningful "key neutral" to radiate from.

Positions between Light (0) and Dark (1), front-loaded deliberately — light
surfaces need more steps close together, because the difference between a page
background and a card on it is small but must be visible:

```
Lightest 0.03 · Lighter 0.07 · Light 0.14 · Neutral 0.36
Dark 0.60 · Darker 0.74 · Darkest 0.87
```

**Chroma follows an envelope, not the interpolation.** This one matters. If the
brand's dark end is chromatic — warm blacks usually are — linear interpolation
makes chroma rise toward the dark end and the deep greys come out brown, which
is what makes a neutral ramp look cheap. Chroma should peak mid-ramp and fall to
near-neutral at both ends. Hue comes from whichever endpoint carries more
chroma; the other is near-grey and its hue angle is mostly rounding noise.

Target peak chroma ≈ 0.025 in OKLab.

**Accent** — the key is an input and sits mid-ramp. Tints travel toward the
brand's own **Light**, shades toward its own **Dark**. Never pure `#FFF` / `#000`:
a warm brand mixed toward pure white goes chalky and cold.

Travel distances:

```
Lightest 0.82 · Lighter 0.58 · Light 0.30 · [key] · Dark 0.26 · Darker 0.52 · Darkest 0.76
```

**Tints must hold some of the key's chroma** — roughly 55% at full travel. A
straight lerp toward white drops chroma linearly and pale tints come out washed
grey rather than recognisably the brand.

### 3.3 Gamut-clamp signal chroma

Chroma is not equally achievable at every hue and lightness — yellow reaches far
higher chroma than blue. Requesting the brand's chroma at a green hue can fall
outside sRGB and silently clip to a flat wrong colour. Binary-search down to the
highest chroma that survives conversion.

---

## 4. Scheme constraints

These are hard. An output violating any of them is wrong.

### 4.1 Foreground is always lighter than Background

Every scheme, every mode. If Foreground moves darker in one scheme and lighter
in another, the same card reads recessed in one band and raised in another.

When Background already sits near the light end, Foreground goes to the extreme
rather than reversing direction.

### 4.2 Border must be visible against both Background and Foreground

Usually two ramp steps from Background, not one. A Border equal to Foreground
gives a bordered card an invisible edge against its own surface.

### 4.3 Text must clear 4.5:1 against both Background and Foreground

WCAG AA for body copy. Non-negotiable.

### 4.4 Button Text must clear 4.5:1 against Button Surface

### 4.5 Accent is not body text

**A mid-luminance brand colour cannot be accessible body text on a light
background, and no palette can fix it.** Worked example: Flush Orange sits at
0.378 relative luminance. Clearing 4.5:1 above it would require luminance 1.87.
White is 1.0. Impossible.

So Accent is scoped to **fills, borders, icons and large display text** — all of
which need 3:1 and pass. The engine should not attempt to make Accent
body-text-safe; it should verify Accent clears **3:1** against Background and
flag if not.

Corollary for buttons: an Accent-surfaced button takes a **dark** label. On
`#FF8400`, dark text scores 6.60 and white scores 2.46.

**Icons are the exception.** WCAG holds UI components to 3:1 rather than 4.5:1,
so an icon-only button can carry a light label where a worded one cannot.

### 4.6 Scheme relationships

- **Scheme 2 (Subtle)** — one ramp step off Scheme 1. Not the mid-ramp: a
  mid-tone background puts text, accent and border all within a couple of points
  of the surface and everything fails.
- **Scheme 3 (Contrast)** — inverse of Scheme 1. Its Light mode is dark, its
  Dark mode is light. It exists to break the page, so it inverts relative to the
  page rather than holding an absolute colour.

---

## 5. Also required

**Transparency** — alpha variants of the two ramp ends, at 5 · 10 · 15 · 20 ·
30 · 40 · 50 · 60 percent. Needed because fill opacity cannot bind to a number
variable in Figma, so translucent surfaces with solid text need a colour with
alpha baked in.

```
Transparency/<Neutral Lightest> 5 … 60
Transparency/<Neutral Darkest> 5 … 60
Transparency/Transparent            0%
```

These must track their source colour. If the ramp changes, they go stale
silently — the name says one thing and the value another.

**Opacity** — plain numbers `5 · 10 · 20 · 40 · 60 · 80`, on a **0–100 scale**,
not 0–1. Used for whole-node opacity and CSS `color-mix()`.

---

## 6. Naming

- Ramp steps: `Lightest · Lighter · Light · [key] · Dark · Darker · Darkest`.
  Never a numeric scale — `500` and `700` carry no meaning to a designer.
- Title Case with spaces. `Flush Orange Lighter`, not `flush-orange-lighter`.
- Path separator `/`. Organisational groups (`Key Colors`, `Scale`, `Utility`)
  are collapsed out when converting to code tokens, so leaf names must be unique
  across groups within a collection.
- Accent names are the brand's own. `Flush Orange`, not `Primary` or `Brand`.

---

## 7. Worked reference — Cahoots Studio

Input: Light `#FFFDFB` · Dark `#0D0700` · Accents `#FF8400`, `#8B37FE`

### Neutral

```
Lightest  #F6F5F1     Neutral  #A1998A     Darker   #413C31
Lighter   #ECE9E3     Dark     #645C4E     Darkest  #24201A
Light     #DAD5CC
```

### Flush Orange · key #FF8400

```
Lightest  #FFD9A1     Dark     #C15800
Lighter   #FFC17F     Darker   #862F00
Light     #FFA453     Darkest  #530600
```

### Electric Violet · key #8B37FE

```
Lightest  #EECBFF     Dark     #6918C6
Lighter   #CFA4FF     Darker   #480090
Light     #AD74FF     Darkest  #2D0061
```

### Utility

```
White #FFFFFF · Black #000000
Error #E7544B · Warning #B48300 · Success #0AA944 · Info #0093E7
```

### Schemes

| Role | S1 Light | S1 Dark | S2 Light | S2 Dark | S3 Light | S3 Dark |
|---|---|---|---|---|---|---|
| Background | Neutral Lighter | Neutral Darkest | Neutral Light | Neutral Darker | Neutral Darkest | Neutral Lighter |
| Foreground | Neutral Lightest | Neutral Darker | Neutral Lightest | Neutral Dark | Neutral Darker | Neutral Lightest |
| Text | Neutral Darkest | Neutral Lightest | Neutral Darkest | Neutral Lightest | Neutral Lightest | Neutral Darkest |
| Accent | Flush Orange | E. Violet Lighter | Flush Orange | Flush Orange | E. Violet Lighter | Flush Orange |
| Border | Neutral | Neutral Dark | Neutral | Neutral | Neutral Dark | Neutral |
| Button Surface | Neutral Darkest | Neutral Lightest | Neutral Darkest | Neutral Lightest | Neutral Lightest | Neutral Darkest |
| Button Text | Neutral Lightest | Neutral Darkest | Neutral Lightest | Neutral Darkest | Neutral Darkest | Neutral Lightest |
| Button Border | Neutral Darkest | Neutral Lightest | Neutral Darkest | Neutral Lightest | Neutral Lightest | Neutral Darkest |

Note Accent varies by mode in Schemes 1 and 3 — orange on light surfaces, violet
on dark. Contrast drives that, not preference: neither colour clears the bar in
both directions.

### Measured contrast — the bar to hit

| | fg/bg | border/bg | text/bg |
|---|---|---|---|
| Primary / Light | 1.11 | 2.33 | 13.37 |
| Primary / Dark | 1.48 | 2.45 | 14.85 |
| Subtle / Light | 1.34 | 1.93 | 11.08 |
| Subtle / Dark | 1.66 | 3.88 | 10.05 |
| Contrast / Light | 1.48 | 2.45 | 14.85 |
| Contrast / Dark | 1.11 | 2.33 | 13.37 |

Button text sits at 14.85 in all six.

`fg/bg` runs low by design — a card should be distinguishable from its page, not
in contrast with it. The ratios that must clear a threshold are text and button
text.

---

## 8. Output format

Flat key-value, path-keyed. Primitives resolve to hex; scheme roles resolve to a
primitive path.

```json
{
  "primitives": {
    "Key Colors/Flush Orange": "#FF8400",
    "Scale/Neutral/Lightest": "#F6F5F1",
    "Utility/Error": "#E7544B",
    "Transparency/Neutral Darkest 20": { "color": "#24201A", "alpha": 20 },
    "Opacity/40": 40
  },
  "schemes": {
    "Scheme 1 - Primary": {
      "Background": {
        "Light (Primary)": "Scale/Neutral/Lighter",
        "Dark": "Scale/Neutral/Darkest"
      }
    }
  },
  "validation": {
    "contrast": [
      { "check": "text/bg", "scheme": "Scheme 1 - Primary",
        "mode": "Light (Primary)", "ratio": 13.37, "passes": true }
    ],
    "warnings": []
  }
}
```

**The `validation` block is required, not optional.** The engine must report its
own contrast measurements and flag anything failing §4. A palette that looks
right and fails silently is worse than one that refuses to generate.
