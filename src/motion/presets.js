/**
 * Supercomponent motion.
 *
 * Blocks never write GSAP. They declare intent:
 *     <h1 data-sc-motion="reveal-up">
 *     <ul data-sc-motion="stagger-in" data-sc-motion-stagger="loose">
 *
 * This file reads motion tokens off the CSS custom properties, so a change in
 * tokens/motion.json propagates to every animation on every site. Portable to
 * Webflow as a single embed — same attributes, same behaviour, no per-page code.
 */

const css = (name, fallback) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

const seconds = (v) => (String(v).endsWith('ms') ? parseFloat(v) / 1000 : parseFloat(v));

function tokens() {
  return {
    duration: {
      instant: seconds(css('--sc-duration-instant', '0.12s')),
      fast: seconds(css('--sc-duration-fast', '0.24s')),
      base: seconds(css('--sc-duration-base', '0.4s')),
      slow: seconds(css('--sc-duration-slow', '0.7s')),
      ambient: seconds(css('--sc-duration-ambient', '1.2s')),
    },
    ease: {
      standard: css('--sc-ease-standard', 'power2.out'),
      entrance: css('--sc-ease-entrance', 'power3.out'),
      exit: css('--sc-ease-exit', 'power2.in'),
      spring: css('--sc-ease-spring', 'back.out(1.7)'),
    },
    distance: {
      reveal: css('--sc-distance-reveal', '1.5rem'),
      drift: css('--sc-distance-drift', '4rem'),
    },
    stagger: {
      tight: parseFloat(css('--sc-stagger-tight', '0.06')),
      base: parseFloat(css('--sc-stagger-base', '0.1')),
      loose: parseFloat(css('--sc-stagger-loose', '0.18')),
    },
  };
}

/** GSAP accepts cubic-bezier() strings via CustomEase only; map to built-ins otherwise. */
const EASE_FALLBACK = {
  standard: 'power2.out',
  entrance: 'power3.out',
  exit: 'power2.in',
  spring: 'back.out(1.7)',
};
const ease = (t, key) => (window.CustomEase ? t.ease[key] : EASE_FALLBACK[key]);

export const presets = {
  'reveal-up': (el, gsap, t) => ({
    from: { y: t.distance.reveal, autoAlpha: 0 },
    to: { y: 0, autoAlpha: 1, duration: t.duration.slow, ease: ease(t, 'entrance') },
  }),
  'reveal-fade': (el, gsap, t) => ({
    from: { autoAlpha: 0 },
    to: { autoAlpha: 1, duration: t.duration.base, ease: ease(t, 'standard') },
  }),
  'stagger-in': (el, gsap, t, opts) => ({
    targets: el.children,
    from: { y: t.distance.reveal, autoAlpha: 0 },
    to: {
      y: 0,
      autoAlpha: 1,
      duration: t.duration.base,
      ease: ease(t, 'entrance'),
      stagger: t.stagger[opts.stagger ?? 'base'],
    },
  }),
  parallax: (el, gsap, t, opts) => ({
    scrub: true,
    from: { y: `-${parseFloat(t.distance.drift) * (opts.depth ?? 1)}rem` },
    to: { y: `${parseFloat(t.distance.drift) * (opts.depth ?? 1)}rem`, ease: 'none' },
  }),
};

export function initMotion({ gsap, ScrollTrigger, root = document } = {}) {
  if (!gsap) {
    console.warn('[supercomponent] initMotion called without gsap');
    return;
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  const t = tokens();

  for (const el of root.querySelectorAll('[data-sc-motion]')) {
    const name = el.dataset.scMotion;
    const build = presets[name];
    if (!build) {
      console.warn(`[supercomponent] unknown motion preset "${name}"`, el);
      continue;
    }

    const opts = {
      stagger: el.dataset.scMotionStagger,
      depth: el.dataset.scMotionDepth ? parseFloat(el.dataset.scMotionDepth) : undefined,
      start: el.dataset.scMotionStart ?? 'top 85%',
    };

    const spec = build(el, gsap, t, opts);
    const targets = spec.targets ?? el;

    gsap.fromTo(targets, spec.from, {
      ...spec.to,
      scrollTrigger: ScrollTrigger
        ? { trigger: el, start: opts.start, scrub: spec.scrub ? 1 : false, once: !spec.scrub }
        : undefined,
    });
  }
}

if (typeof window !== 'undefined') window.SupercomponentMotion = { initMotion, presets };
