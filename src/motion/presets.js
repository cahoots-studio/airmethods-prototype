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
      reveal: seconds(css('--sc-duration-reveal', '0.3s')),
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

/**
 * Split an element's text into one span per rendered line, so lines can move
 * independently. Words are measured where the browser actually wrapped them.
 * Returns the line spans and a restore() that puts the original markup back
 * (called once the animation has finished, so later resizes re-wrap normally).
 */
function splitLines(el) {
  const original = el.innerHTML;
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map((w) => `<span class="sc-word" style="display:inline-block">${w.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`).join(' ');
  const lines = [];
  let top = null;
  for (const w of el.querySelectorAll('.sc-word')) {
    if (top === null || Math.abs(w.offsetTop - top) > 2) { lines.push([]); top = w.offsetTop; }
    lines[lines.length - 1].push(w.textContent);
  }
  // joined with a space so the text still reads "word word" (screen readers, copy) while split
  el.innerHTML = lines.map((l) => `<span class="sc-line" style="display:block">${l.join(' ')}</span>`).join(' ');
  return { lines: [...el.querySelectorAll('.sc-line')], restore: () => { el.innerHTML = original; } };
}

export const presets = {
  /** Headlines: each rendered line slides and fades up; the next line starts halfway through. */
  'lines-up': (el, gsap, t) => ({
    run(trigger) {
      const { lines, restore } = splitLines(el);
      gsap.set(el, { autoAlpha: 1 });
      return gsap.fromTo(lines, { y: t.distance.reveal, autoAlpha: 0 }, {
        y: 0, autoAlpha: 1, duration: t.duration.reveal, ease: ease(t, 'entrance'),
        stagger: t.duration.reveal * 0.5, paused: true, onComplete: restore,
      });
    },
  }),
  /** Children enter one after another, each starting halfway through the one before. */
  'cascade-up': (el, gsap, t) => ({
    run() {
      return gsap.fromTo(el.children, { y: t.distance.reveal, autoAlpha: 0 }, {
        y: 0, autoAlpha: 1, duration: t.duration.reveal, ease: ease(t, 'entrance'),
        stagger: t.duration.reveal * 0.5, paused: true, clearProps: 'transform',
      });
    },
  }),
  /** Scroll parallax from rest: moves down by drift × depth as its section scrolls out. */
  'scroll-drift': (el, gsap, t, opts) => ({
    scrub: true,
    trigger: el.closest('section') ?? el,
    start: 'top top',
    from: { y: 0 },
    to: { y: `${parseFloat(t.distance.drift) * (opts.depth ?? 1)}rem`, ease: 'none' },
  }),
  /** Eases toward the cursor while it is over the element's section. Fine pointers only. */
  magnet: (el, gsap, t, opts) => ({
    run() {
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return null;
      const zone = el.closest('section') ?? document.body;
      const strength = opts.strength ?? 0.04;           // share of the cursor's offset from centre
      const max = parseFloat(t.distance.reveal) * 16;   // cap: one reveal distance, in px
      const qx = gsap.quickTo(el, 'x', { duration: t.duration.slow, ease: 'power3.out' });
      const qy = gsap.quickTo(el, 'y', { duration: t.duration.slow, ease: 'power3.out' });
      const clamp = (v) => Math.max(-max, Math.min(max, v));
      zone.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        qx(clamp((e.clientX - (r.left + r.width / 2)) * strength));
        qy(clamp((e.clientY - (r.top + r.height / 2)) * strength));
      });
      zone.addEventListener('pointerleave', () => { qx(0); qy(0); });
      return null;
    },
  }),
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
  const done = () => document.documentElement.classList.add('sc-motion-ready');
  if (!gsap) {
    console.warn('[supercomponent] initMotion called without gsap');
    return done();
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return done();
  if (ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  const t = tokens();
  const played = new Map();   // element → Promise that resolves when its entrance finishes

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
      strength: el.dataset.scMotionStrength ? parseFloat(el.dataset.scMotionStrength) : undefined,
      start: el.dataset.scMotionStart ?? 'top 85%',
      after: el.dataset.scMotionAfter,            // selector, resolved inside the same section
    };

    const spec = build(el, gsap, t, opts);

    /* Presets with their own run(): entrances return a paused tween that plays
       when the element scrolls into view — and, with data-sc-motion-after,
       only once the named element's entrance has finished. */
    if (spec.run) {
      const tween = spec.run();
      if (!tween) continue;
      let resolve;
      played.set(el, new Promise((r) => { resolve = r; }));
      tween.eventCallback('onComplete', ((prev) => function () { prev?.apply(this); resolve(); })(tween.eventCallback('onComplete')));
      const dep = opts.after ? (el.closest('section') ?? root).querySelector(opts.after) : null;
      const waitFor = dep && played.has(dep) ? played.get(dep) : Promise.resolve();
      const inView = new Promise((r) => {
        if (!ScrollTrigger) return r();
        ScrollTrigger.create({ trigger: el, start: opts.start, once: true, onEnter: r });
      });
      Promise.all([waitFor, inView]).then(() => tween.play());
      continue;
    }

    const targets = spec.targets ?? el;
    gsap.fromTo(targets, spec.from, {
      ...spec.to,
      scrollTrigger: ScrollTrigger
        ? { trigger: spec.trigger ?? el, start: spec.start ?? opts.start, end: spec.end, scrub: spec.scrub ? 1 : false, once: !spec.scrub }
        : undefined,
    });
  }
  done();
  if (ScrollTrigger) addEventListener('load', () => ScrollTrigger.refresh());
}

if (typeof window !== 'undefined') window.SupercomponentMotion = { initMotion, presets };
