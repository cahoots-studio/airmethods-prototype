#!/usr/bin/env node
/**
 * Generate a seven-stop ramp from one key colour.
 *
 *   npm run color:add -- "Sky Blue" "#2E9BFF"
 *   npm run color:add -- "Sky Blue" "#2E9BFF" --theme=acme --dry
 *
 * THE RULE: tints mix toward the theme's own White and shades toward its own
 * Black — never pure #FFF / #000. A warm brand mixed toward pure white goes
 * chalky and cold at the light end; mixed toward its own warm white it stays
 * in the family. This is why the ramp has to be generated per theme rather
 * than computed once and reused.
 *
 * Stops are written into the theme file, so any of them can be hand-tuned
 * afterwards. Generation is a starting point, not a constraint — the neutral
 * ramp in the Cahoots theme is hand-tuned for exactly this reason.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TOKENS_DIR, listThemes } from './lib/tokens.mjs';
import { rampFromKey, scaleBetween, lightnessOf } from './lib/color.mjs';

// ---- CLI -------------------------------------------------------------------

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('--'));
const positional = args.filter((a) => !a.startsWith('--'));
const opt = (n, d) => (flags.find((f) => f.startsWith(`--${n}=`)) ?? `=${d}`).split('=')[1];

if (positional.length < 1 || (!flags.includes('--scale') && positional.length < 2)) {
  console.error('\nAccent ramp — radiates from a key colour:');
  console.error('  npm run color:add -- "Sky Blue" "#2E9BFF"\n');
  console.error('Neutral scale — interpolates between the theme light and dark ends:');
  console.error('  npm run color:add -- "Neutral" --scale\n');
  console.error('Flags: --theme=<name>  --dry  --force\n');
  process.exit(1);
}

const [name, key] = positional;
// --scale interpolates between the theme's light and dark ends instead of
// radiating from a key. Correct for neutrals, where the mid is an output.
const mode = flags.includes('--scale') ? 'scale' : 'key';
const theme = opt('theme', listThemes()[0]);
const dry = flags.includes('--dry');
const file = join(TOKENS_DIR, 'themes', `${theme}.json`);
const doc = JSON.parse(readFileSync(file, 'utf8'));

const white = doc.color?.white?.$value;
const black = doc.color?.black?.$value;
if (!white || !black) {
  console.error(`\n✗ ${theme} has no color.white / color.black to mix toward.\n`);
  process.exit(1);
}

const ramp = mode === 'scale'
  ? scaleBetween(name, white, black)
  : rampFromKey(name, key, { light: white, dark: black });

// A ramp is a BOOTSTRAP, not a sync. Once the stops exist they may have been
// hand-tuned — here or pulled back from Figma — and regenerating would silently
// discard that. Refuse unless explicitly forced.
const existing = Object.keys(ramp).filter((k) => doc.color?.[k]);
if (existing.length && !flags.includes('--force') && !flags.includes('--dry')) {
  console.error(`\n✗ ${existing.length} of these stops already exist in ${theme}:`);
  for (const k of existing) console.error(`    ${k.padEnd(30)} ${doc.color[k].$value}`);
  console.error('\n  They may have been hand-tuned, or pulled back from Figma.');
  console.error('  Regenerating would discard that. To edit a stop, edit the theme file.');
  console.error('  To rebuild the whole ramp from the key colour anyway: --force\n');
  process.exit(1);
}

const how = mode === 'scale' ? `interpolating ${white} → ${black}` : `radiating from ${key} toward ${white} / ${black}`;
console.log(`\n${name}  ${theme}  ${how}\n`);
for (const [k, v] of Object.entries(ramp)) {
  const mark = mode === 'key' && v.toUpperCase() === String(key).toUpperCase() ? '  ← key' : '';
  console.log(`  ${k.padEnd(30)} ${v}   L ${String(lightnessOf(v)).padEnd(6)}${mark}`);
}

if (dry) {
  console.log('\n(--dry: nothing written)\n');
  process.exit(0);
}

// Insert after the last existing colour so ordering stays readable.
const merged = { ...doc.color };
for (const [k, v] of Object.entries(ramp)) merged[k] = { $type: 'color', $value: v };
doc.color = merged;
writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');

console.log(`\n✓ ${Object.keys(ramp).length} stops added to tokens/themes/${theme}.json`);
console.log('  Hand-tune any of them, then: npm run tokens:build\n');
