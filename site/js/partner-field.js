/* Partner Logo Field — ported from the "Partner Logo Field" artifact
   (claude.ai/artifact/56GMw54cWSzbAL6nUmQ9Js) into the "Our partners make it
   possible" beat of Section 2. The tuning panel (lil-gui) was removed; colours
   come from the Supercomponent scheme tokens in coverage.css.
   Partners below are PLACEHOLDERS — invented names and marks. Swap LOGOS for
   the client's real logo files (SVG preferred). */

const M = {
  cross: '<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.5v9M7.5 12h9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  ridge: '<path d="M2 19 8 9.5l4 5 3-4 7 8.5z" fill="currentColor"/>',
  wing: '<path d="M1.5 15 12 6l10.5 9h-3.6L12 9.8 5.1 15z" fill="currentColor"/><path d="M8 19 12 15.6 16 19z" fill="currentColor"/>',
  leaf: '<path d="M4.5 19.5C4.5 10 10.5 4.5 19.5 4.5c0 9-5.5 15-15 15z" fill="currentColor"/><path d="M5 19 13 11" stroke="var(--tile)" stroke-width="1.6"/>',
  heart: '<path d="M12 20.5S3 15 3 8.8A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 9 1.8C21 15 12 20.5 12 20.5z" fill="currentColor"/>',
  hex: '<path d="M12 2.5 20.5 7.3v9.4L12 21.5 3.5 16.7V7.3z" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/>',
  sun: '<circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  wave: '<path d="M2 9c3.3-3 6.7 3 10 0s6.7 3 10 0M2 15c3.3-3 6.7 3 10 0s6.7 3 10 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  star: '<path d="M12 1.5 14.3 9.7 22.5 12l-8.2 2.3L12 22.5l-2.3-8.2L1.5 12l8.2-2.3z" fill="currentColor"/>',
  bars: '<path d="M4 20V9M9.3 20V4M14.7 20v-8M20 20V6.5" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  ring: '<path d="M12 3a9 9 0 0 1 0 18" fill="none" stroke="currentColor" stroke-width="3"/><path d="M12 7a5 5 0 0 0 0 10" fill="none" stroke="currentColor" stroke-width="3"/>',
  diamond: '<path d="M12 2 22 12 12 22 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7 17 12 12 17 7 12z" fill="currentColor"/>',
  arch: '<path d="M4 21V12a8 8 0 0 1 16 0v9" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M9 21v-7a3 3 0 0 1 6 0v7" fill="none" stroke="currentColor" stroke-width="2.4"/>',
  drop: '<path d="M12 2.5C8 8 5.5 11.3 5.5 14.6a6.5 6.5 0 0 0 13 0C18.5 11.3 16 8 12 2.5z" fill="currentColor"/>',
  pine: '<path d="M12 2 18 10h-3l4 6h-4l3 5H6l3-5H5l4-6H6z" fill="currentColor"/>',
  compass: '<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 8.5 13.2 13.2 8.5 15.5l2.3-4.7z" fill="currentColor"/>',
  pulse: '<path d="M2 12h5l2.2-5 3.6 10 2.2-5H22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  shield: '<path d="M12 2.5 20 5.5v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 7v9M8 11.5h8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
};
const LOGOS = [
  ["Halvorsen Medical", "cross"], ["Ridgeline Trauma", "ridge"], ["Kestrel Children’s", "wing"], ["Juniper Valley", "leaf"],
  ["Tallis Heart", "heart"], ["Northmark Health", "hex"], ["Ostara Care", "sun"], ["Saltbrook Medical", "wave"],
  ["Verra Health", "star"], ["Bramwell Regional", "bars"], ["Corvid Clinical", "ring"], ["Pellam Health", "diamond"],
  ["Ashgrove Medical", "arch"], ["Clearwater General", "drop"], ["Timberline Health", "pine"], ["Wayfarer Care", "compass"],
  ["Ardent Cardiac", "pulse"], ["Harrow Regional", "shield"],
];

const params = {
  count: 18, shape: "circle",
  magnify: 0.38, push: 0.55, reach: 1.7, shrink: 0.1, spring: 0.16,
  autoRoam: !matchMedia("(hover: hover)").matches,
};
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const field = document.getElementById("partnerField");
const section = field.closest(".coverage_partners") || field.parentElement;

let items = [], D = 120, W_ITEM = 120, H_ITEM = 120, R = 200;

function build() {
  field.innerHTML = "";
  items = LOGOS.slice(0, params.count).map(([name, mark]) => {
    const el = document.createElement("div");
    el.className = "partner-logo is-" + params.shape; el.tabIndex = 0; el.setAttribute("role", "listitem"); el.setAttribute("aria-label", name);
    el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${M[mark]}</svg><span class="partner-logo_name">${name}</span>`;
    field.appendChild(el);
    const it = { el, hx: 0, hy: 0, x: 0, y: 0, s: 1 };
    el.addEventListener("focus", () => { keyboardFocus(it); });
    return it;
  });
  layout();
}

/* Honeycomb layout: staggered rows, centred in the field */
function layout() {
  const W = field.clientWidth, narrow = W < 560, pill = params.shape === "pill";
  const n = items.length;
  const cols = pill ? (narrow ? 2 : n > 12 ? 5 : n > 8 ? 4 : 3) : (narrow ? 3 : n > 10 ? 6 : n > 8 ? 5 : 4);
  const rows = Math.ceil(n / cols);
  const pitchX = Math.min(W / (cols + 0.5), pill ? 290 : 176);
  if (pill) { W_ITEM = pitchX * 0.8; H_ITEM = W_ITEM * 0.36; }
  else { W_ITEM = H_ITEM = pitchX * 0.68; }
  D = Math.max(W_ITEM, H_ITEM);
  const pitchY = pill ? H_ITEM * 1.45 : pitchX * 0.87;
  R = pitchX * params.reach;
  const pad = H_ITEM * 0.55;
  const H = (rows - 1) * pitchY + H_ITEM + pad * 2;
  field.style.height = H + "px";
  section.style.setProperty("--partner-name-size", Math.max(10, Math.min(15, (pill ? H_ITEM * 0.26 : W_ITEM * 0.095))) + "px");
  let i = 0;
  for (let r = 0; r < rows; r++) {
    const inRow = Math.min(cols, n - i);
    const stagger = (r % 2 === 0 ? -0.25 : 0.25) * pitchX;
    for (let c = 0; c < inRow; c++, i++) {
      const it = items[i];
      it.hx = W / 2 + (c - (inRow - 1) / 2) * pitchX + stagger;
      it.hy = pad + H_ITEM / 2 + r * pitchY;
      it.el.style.width = W_ITEM + "px"; it.el.style.height = H_ITEM + "px";
      if (!it.init) { it.x = it.hx; it.y = it.hy; it.init = true; }
    }
  }
  wake();
}

/* ---------- pointer / focus state ---------- */
const focus = { x: 0, y: 0, tx: 0, ty: 0, a: 0, ta: 0 };
let mode = "none", t0 = performance.now();
addEventListener("pointermove", (e) => {
  if (e.pointerType === "touch") return;
  const r = field.getBoundingClientRect();
  focus.tx = e.clientX - r.left; focus.ty = e.clientY - r.top;
  // proximity: full strength inside the field, fading out over one reach-radius beyond it
  const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right), dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
  const d = Math.hypot(dx, dy); const k = Math.min(1, d / (R * 0.9));
  focus.ta = 1 - k * k * (3 - 2 * k);
  if (mode !== "pointer") { if (focus.a < 0.02) { focus.x = focus.tx; focus.y = focus.ty; } mode = "pointer"; }
  wake();
}, { passive: true });
document.documentElement.addEventListener("pointerleave", () => { focus.ta = 0; wake(); });
field.addEventListener("pointerdown", (e) => { if (e.pointerType !== "touch") return; mode = "touch"; setTouch(e); });
field.addEventListener("pointermove", (e) => { if (e.pointerType === "touch" && mode === "touch") setTouch(e); });
addEventListener("pointerup", (e) => { if (e.pointerType === "touch") { mode = "roam"; t0 = performance.now(); } });
function setTouch(e) { const r = field.getBoundingClientRect(); focus.tx = e.clientX - r.left; focus.ty = e.clientY - r.top; focus.ta = 1; wake(); }
function keyboardFocus(it) { mode = "keyboard"; focus.tx = it.hx; focus.ty = it.hy; focus.ta = 1; wake(); }
field.addEventListener("focusout", (e) => { if (!field.contains(e.relatedTarget)) { focus.ta = 0; wake(); } });

/* ---------- animation ---------- */
let running = false, inView = true;
new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView) wake(); }).observe(field);
function wake() { if (!running && inView) { running = true; requestAnimationFrame(tick); } }

function tick(now) {
  const W = field.clientWidth, H = field.clientHeight;
  if (params.autoRoam && !reduceMotion && (mode === "none" || mode === "roam")) {
    const t = (now - t0) / 1000;               // slow wandering focus for touch screens
    focus.tx = W / 2 + Math.sin(t * 0.33) * W * 0.36; focus.ty = H / 2 + Math.sin(t * 0.51 + 1) * H * 0.28; focus.ta = 0.85;
  }
  const k = params.spring;
  focus.x += (focus.tx - focus.x) * (k * 1.2); focus.y += (focus.ty - focus.y) * (k * 1.2);
  focus.a += (focus.ta - focus.a) * (k * 0.7);
  const act = reduceMotion ? 0 : focus.a;
  let moving = Math.abs(focus.ta - focus.a) > 0.002 || Math.hypot(focus.tx - focus.x, focus.ty - focus.y) > 0.3 || (params.autoRoam && !reduceMotion);
  let nearest = null, nearestG = 0.55;
  for (const it of items) {
    const vx = it.hx - focus.x, vy = it.hy - focus.y, d = Math.hypot(vx, vy) || 0.0001;
    const g = Math.exp(-((d / R) ** 2));
    // zoom the tiles under the cursor; push neighbours radially outward; ease far tiles down a touch
    const C = params.push * D * 1.6 * act, x = d / R;
    const push = C * x * g;
    // where neighbours get squeezed together (outer ring of the push), shrink them in proportion
    const squeeze = Math.min(1, Math.max(0.7, 1 + (C / R) * (1 - 2 * x * x) * g));
    const s = (1 + params.magnify * g * act) * (1 - params.shrink * act * (1 - g)) * squeeze;
    const tx = it.hx + (vx / d) * push, ty = it.hy + (vy / d) * push;
    it.x += (tx - it.x) * k; it.y += (ty - it.y) * k; it.s += (s - it.s) * k;
    if (Math.abs(tx - it.x) > 0.1 || Math.abs(s - it.s) > 0.0005) moving = true;
    it.el.style.transform = `translate3d(${(it.x - W_ITEM / 2).toFixed(2)}px, ${(it.y - H_ITEM / 2).toFixed(2)}px, 0) scale(${it.s.toFixed(4)})`;
    it.el.style.zIndex = Math.round(it.s * 100);
    if (g * act > nearestG) { nearestG = g * act; nearest = it; }
  }
  for (const it of items) it.el.classList.toggle("is-near", it === nearest);
  if (moving && inView) requestAnimationFrame(tick); else running = false;
}

addEventListener("resize", layout);
build();

/* Hand the stage's bottom corners to the grid: fade the globe HUD while this beat is in view. */
const stage = document.getElementById("stage");
/* UNUSED since 28 Sep 2026: the HUD moved into the intro beat and scrolls away, so no CSS reads
   .is-partners any more. Kept (harmless) in case a pinned element needs to react to this beat again. */
if (stage) new IntersectionObserver(([e]) => stage.classList.toggle("is-partners", e.isIntersecting), { threshold: 0.35 }).observe(section);
