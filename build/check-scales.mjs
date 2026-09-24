#!/usr/bin/env node
/**
 * npm run check:scales
 *
 * A scale has one invariant: its ordering holds in EVERY mode. Tiny < Small <
 * Medium < Large < Huge, at 1920 and at 375. Breaking it does not throw an
 * error anywhere — the CSS is valid, the build passes, and you find out when a
 * "Huge" section on tablet has the same padding as a "Small" one.
 *
 * Two failure modes, both seen in practice:
 *   INVERTED — a step is smaller than the one below it, usually an old value
 *              left behind in the narrow modes after the base was fixed
 *   COLLAPSED — several steps share a value, so the scale stops distinguishing
 *              anything in that mode
 */
import { loadRawMerged, resolveMap, listModes, listThemes } from './lib/tokens.mjs';

/**
 * Ladder words, smallest to largest. Position in this list is the expected order.
 *
 * Includes the narrow/wide family so symmetric ladders like the max-width group
 * are checked too. 'round' is deliberately absent — 9999 is a sentinel meaning
 * "fully rounded", not a scale step, and including it would report a false
 * inversion on every radius scale.
 */
const LADDER = [
  'none',
  'narrowest', 'narrower', 'narrow',
  '3xs', 'xxxs', 'tiny', '2xs', 'xxs', 'xs', 'xsmall',
  'small', 'sm', 'medium', 'md', 'large', 'lg',
  'wide', 'wider', 'widest',
  'huge', 'xl', 'xlarge', '2xl', 'xxl', 'xxlarge', '3xl', '4xl', '5xl', '6xl',
];

const rank = (leaf) => LADDER.indexOf(leaf.toLowerCase());
const px = (v) => {
  const n = parseFloat(v);
  if (Number.isNaN(n)) return null;
  return String(v).endsWith('rem') ? n * 16 : n;
};

const theme = process.argv[2] ?? listThemes()[0];
const raw = loadRawMerged(theme);
const modes = listModes(raw);

// Group tokens by their parent path, keeping declaration order.
const groups = {};
for (const path of Object.keys(raw)) {
  const i = path.lastIndexOf('.');
  if (i < 0) continue;
  const group = path.slice(0, i);
  const leaf = path.slice(i + 1);
  if (rank(leaf) < 0) continue; // not a ladder member
  (groups[group] ??= []).push({ path, leaf, rank: rank(leaf) });
}

// A group is a scale only if it has 3+ ladder members and they all resolve to numbers.
const scales = Object.entries(groups).filter(([, members]) => members.length >= 3);

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

const problems = [];
let checked = 0;

for (const [group, members] of scales) {
  members.sort((a, b) => a.rank - b.rank);

  for (const mode of modes) {
    const resolved = resolveMap(raw, mode);
    const steps = members
      .map((m) => ({ ...m, value: resolved[m.path]?.value, n: px(resolved[m.path]?.value) }))
      .filter((m) => m.n !== null);
    if (steps.length < 3) continue;
    checked++;

    for (let i = 1; i < steps.length; i++) {
      const prev = steps[i - 1];
      const cur = steps[i];
      if (cur.n < prev.n) {
        problems.push({
          kind: 'INVERTED', group, mode,
          detail: `${cur.leaf} (${cur.value}) is smaller than ${prev.leaf} (${prev.value})`,
        });
      } else if (cur.n === prev.n && cur.n !== 0) {
        problems.push({
          kind: 'COLLAPSED', group, mode,
          detail: `${prev.leaf} and ${cur.leaf} are both ${cur.value}`,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Second check: cross-mode monotonicity.
//
// A spacing or sizing token must never GROW as the viewport gets smaller.
// The CSS cascade means at 479px all three max-width queries match and the
// most specific one wins, so the effective value at each breakpoint is the
// first override found walking the cascade chain.
// ---------------------------------------------------------------------------

const VIEWPORT_ORDER = ['xwide', 'wide', 'default', 'tablet', 'landscape', 'portrait'];
const CASCADE = {
  xwide:    ['xwide', 'wide', 'default'],
  wide:     ['wide', 'default'],
  default:  ['default'],
  tablet:   ['tablet', 'default'],
  landscape:['landscape', 'tablet', 'default'],
  portrait: ['portrait', 'landscape', 'tablet', 'default'],
};

function effectiveRawValue(token, chain) {
  for (const m of chain) {
    if (m === 'default') return token.value;
    if (token.modes?.[m] !== undefined) return token.modes[m];
  }
  return token.value;
}

const resolvedByBp = {};
for (const bp of VIEWPORT_ORDER) {
  const patched = {};
  for (const [path, token] of Object.entries(raw)) {
    patched[path] = { ...token, value: effectiveRawValue(token, CASCADE[bp]), modes: undefined };
  }
  resolvedByBp[bp] = resolveMap(patched, 'default');
}

const grows = [];
for (const [path, token] of Object.entries(raw)) {
  if (!token.modes || !Object.keys(token.modes).length) continue;
  for (let i = 1; i < VIEWPORT_ORDER.length; i++) {
    const wider = VIEWPORT_ORDER[i - 1];
    const narrower = VIEWPORT_ORDER[i];
    const widerN = px(resolvedByBp[wider][path]?.value);
    const narrowerN = px(resolvedByBp[narrower][path]?.value);
    if (widerN === null || narrowerN === null) continue;
    if (narrowerN > widerN) {
      grows.push({
        path, mode: narrower, value: resolvedByBp[narrower][path].value,
        prevMode: wider, prevValue: resolvedByBp[wider][path].value,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log('');
if (!problems.length && !grows.length) {
  console.log(green('✓') + ` ${scales.length} scale(s) × ${modes.length} mode(s) — ordering holds everywhere`);
  console.log(green('✓') + ` cross-mode monotonicity — no value grows as viewport narrows`);
  console.log('');
  process.exit(0);
}

if (problems.length) {
  const byKey = {};
  for (const p of problems) (byKey[`${p.group}|${p.mode}|${p.kind}`] ??= []).push(p);

  console.log(red(`✗ ${Object.keys(byKey).length} scale problem(s)`));
  for (const [key, list] of Object.entries(byKey)) {
    const [group, mode, kind] = key.split('|');
    const colour = kind === 'INVERTED' ? red : yellow;
    console.log(`\n  ${colour(kind)}  ${group}  ${dim('in mode')} ${mode}`);
    for (const p of list) console.log(`    ${p.detail}`);
  }
  console.log('');
  console.log(dim('  A scale must keep its ordering in every mode. An inverted step is usually'));
  console.log(dim('  an old value left behind in the narrow modes after the base was corrected.'));
}

if (grows.length) {
  console.log('');
  console.log(red(`✗ ${grows.length} cross-mode problem(s)`));
  for (const g of grows) {
    console.log(`  ${red('GROWS')}  ${g.path}: ${g.mode}=${g.value} exceeds ${g.prevMode}=${g.prevValue}`);
  }
  console.log('');
  console.log(dim('  A value must not increase as the viewport gets narrower. The usual cause'));
  console.log(dim('  is a mode override that was set higher than its neighbour in the cascade.'));
}

console.log('');
process.exit(1);
