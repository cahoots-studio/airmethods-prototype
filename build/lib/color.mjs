/**
 * Colour maths for ramp generation.
 *
 * Everything interpolates in OKLab, not sRGB. sRGB is gamma-encoded, so a 50%
 * channel mix lands visually darker than halfway — which is why naively mixed
 * ramps bunch up at the light end and go muddy in the middle. OKLab is
 * perceptually uniform, so an even step in the numbers is an even step to the
 * eye.
 *
 * Two strategies, because brands arrive in two shapes:
 *
 *   rampFromKey    — accents. A key colour radiates outward toward the theme's
 *                    own White and Black. The key is an input.
 *   scaleBetween   — neutrals. A light end and a dark end, usually the brand's
 *                    actual background and text colours, with steps
 *                    interpolated between them. The mid is an output.
 */

// ---- sRGB <-> OKLab --------------------------------------------------------

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

export function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) / 255);
}

export function rgbToHex(rgb) {
  return (
    '#' +
    rgb
      .map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0').toUpperCase())
      .join('')
  );
}

export function hexToOklab(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export function oklabToHex({ L, a, b }) {
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ].map(linearToSrgb);
  return rgbToHex(rgb);
}

const lerp = (a, b, t) => a + (b - a) * t;

// ---- Strategy 1: accents radiate from a key -------------------------------

/** How far each stop travels toward White or Black, in OKLab. */
export const KEY_STOPS = [
  { suffix: 'lightest', toward: 'light', t: 0.82 },
  { suffix: 'lighter', toward: 'light', t: 0.58 },
  { suffix: 'light', toward: 'light', t: 0.3 },
  { suffix: null, toward: null, t: 0 },
  { suffix: 'dark', toward: 'dark', t: 0.26 },
  { suffix: 'darker', toward: 'dark', t: 0.52 },
  { suffix: 'darkest', toward: 'dark', t: 0.76 },
];

/**
 * Mixes toward the theme's OWN light and dark, never pure #FFF/#000 — a warm
 * brand mixed toward pure white goes chalky and cold at the light end.
 *
 * Chroma is preserved rather than interpolated away: a straight OKLab lerp
 * toward white drops chroma linearly, which makes pale tints look washed out.
 * Holding a fraction of the key's chroma keeps a tint recognisably the brand.
 */
export function rampFromKey(name, key, { light, dark, chromaHold = 0.55 } = {}) {
  const slug = name.trim().toLowerCase().replace(/\s+/g, '-');
  const K = hexToOklab(key);
  const L1 = hexToOklab(light);
  const D1 = hexToOklab(dark);

  const out = {};
  for (const { suffix, toward, t } of KEY_STOPS) {
    const k = suffix ? `${slug}-${suffix}` : slug;
    if (!suffix) {
      out[k] = String(key).toUpperCase();
      continue;
    }
    const end = toward === 'light' ? L1 : D1;
    const hold = 1 - t * (1 - chromaHold);
    out[k] = oklabToHex({
      L: lerp(K.L, end.L, t),
      a: K.a * hold + end.a * t * (1 - chromaHold),
      b: K.b * hold + end.b * t * (1 - chromaHold),
    });
  }
  return out;
}

// ---- Strategy 2: neutrals interpolate between two ends --------------------

/**
 * Positions between the light end (0) and dark end (1).
 *
 * Front-loaded deliberately. Light surfaces need more steps close together —
 * the difference between a page background and a card sitting on it is small
 * but has to be visible. Dark steps can be further apart because they are
 * doing less work.
 */
export const SCALE_POSITIONS = [
  { suffix: 'lightest', t: 0.03 },
  { suffix: 'lighter', t: 0.07 },
  { suffix: 'light', t: 0.14 },
  { suffix: null, t: 0.36 },
  { suffix: 'dark', t: 0.6 },
  { suffix: 'darker', t: 0.74 },
  { suffix: 'darkest', t: 0.87 },
];

/**
 * Neutrals: lightness interpolated between the two ends, chroma shaped by an
 * envelope rather than carried along.
 *
 * Linear a/b interpolation is wrong here. If the brand's dark end is chromatic —
 * and warm blacks usually are — chroma rises monotonically toward the dark end
 * and the deep greys come out brown. A neutral ramp wants the opposite shape:
 * near-neutral at both ends, a little warmth through the middle where large
 * surfaces live.
 *
 * Hue comes from whichever endpoint carries more chroma, so the ramp stays in
 * the brand's family. Chroma follows a curve peaking mid-ramp.
 *
 * @param peakChroma  Mid-ramp chroma. ~0.02–0.03 is a subtle warmth; 0 gives a
 *                    dead-neutral grey scale.
 */
export function scaleBetween(name, lightEnd, darkEnd, { peakChroma = 0.025 } = {}) {
  const slug = name.trim().toLowerCase().replace(/\s+/g, '-');
  const A = hexToOklab(lightEnd);
  const B = hexToOklab(darkEnd);

  // Family hue: the more chromatic end decides, since the other is near-grey
  // and its hue angle is mostly rounding noise.
  const cA = Math.hypot(A.a, A.b);
  const cB = Math.hypot(B.a, B.b);
  const dom = cB >= cA ? B : A;
  const hue = Math.atan2(dom.b, dom.a);

  const out = {};
  for (const { suffix, t } of SCALE_POSITIONS) {
    const k = suffix ? `${slug}-${suffix}` : slug;
    // Peaks mid-ramp, falls to near zero at both ends. The exponent widens the
    // plateau so the mid-tones share the warmth rather than one stop spiking.
    const C = peakChroma * Math.sin(Math.PI * t) ** 0.7;
    out[k] = oklabToHex({
      L: lerp(A.L, B.L, t),
      a: Math.cos(hue) * C,
      b: Math.sin(hue) * C,
    });
  }
  return out;
}

/** Reported so a generated ramp can be checked for even perceptual spacing. */
export function lightnessOf(hex) {
  return +hexToOklab(hex).L.toFixed(4);
}


// ---- Strategy 3: signals borrow the brand's character ----------------------

/** True if an OKLab colour survives conversion to sRGB without clipping. */
function inGamut({ L, a, b }) {
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ].every((c) => c >= -0.001 && c <= 1.001);
}

/**
 * Chroma is not equally achievable at every hue and lightness — yellow reaches
 * far higher chroma than blue does. Asking for the brand's chroma at a green hue
 * can fall outside sRGB entirely, which silently clips to a flat, wrong colour.
 * Binary-search down to the highest chroma that actually survives.
 */
function clampChroma(L, hueDeg, wanted) {
  const h = (hueDeg * Math.PI) / 180;
  let lo = 0;
  let hi = wanted;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut({ L, a: Math.cos(h) * mid, b: Math.sin(h) * mid })) lo = mid;
    else hi = mid;
  }
  return { a: Math.cos(h) * lo, b: Math.sin(h) * lo, C: lo };
}

/**
 * Canonical hues, so red still reads as an error and green as success. Everything
 * else — how saturated, how light — is borrowed from the brand key, which is why
 * a muted brand gets muted signals and a vivid one gets vivid signals instead of
 * three stock colours that look pasted in from another system.
 *
 * Lightness is pulled toward a common target rather than copied outright, so the
 * three signals read as a set and each keeps enough contrast to sit on both a
 * light and a dark surface.
 */
export const SIGNAL_HUES = { error: 27, warning: 82, success: 148, info: 245 };

export function signalsFromBrand(keyHex, { targetL = 0.6, pull = 0.7, hues = SIGNAL_HUES } = {}) {
  const brand = hexToOklab(keyHex);
  const brandC = Math.hypot(brand.a, brand.b);
  const L = brand.L + (targetL - brand.L) * pull;

  const out = {};
  for (const [name, hue] of Object.entries(hues)) {
    const { a, b, C } = clampChroma(L, hue, brandC);
    out[name] = { hex: oklabToHex({ L, a, b }), L: +L.toFixed(4), C: +C.toFixed(4), hue };
  }
  return out;
}
