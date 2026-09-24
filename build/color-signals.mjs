#!/usr/bin/env node
/**
 * npm run color:signals -- [--key="#hex"] [--theme=<name>] [--dry]
 *
 * Derives error / warning / success / info from a brand key.
 *
 * Canonical hues, so red still reads as an error. Everything else — saturation,
 * lightness — borrowed from the brand, so a muted brand gets muted signals
 * rather than three stock colours that look pasted in from another system.
 *
 * All four land on a common lightness so they read as a set and each keeps
 * enough contrast to sit on both a light and a dark surface.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TOKENS_DIR, listThemes } from './lib/tokens.mjs';
import { signalsFromBrand, hexToOklab } from './lib/color.mjs';

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('--'));
const opt = (n, d) => {
  const f = flags.find((x) => x.startsWith(`--${n}=`));
  return f ? f.slice(n.length + 3).replace(/^["']|["']$/g, '') : d;
};

const theme = opt('theme', listThemes()[0]);
const dry = flags.includes('--dry');
const file = join(TOKENS_DIR, 'themes', `${theme}.json`);
const doc = JSON.parse(readFileSync(file, 'utf8'));

// Default to the colour the schemes actually use as Accent.
const key = opt('key', doc.color?.['flush-orange']?.$value ?? doc.color?.accent?.$value);
if (!key) {
  console.error(`\n✗ no brand key found in ${theme}. Pass one: --key="#FF8400"\n`);
  process.exit(1);
}

const targetL = Number(opt('lightness', 0.6));
const signals = signalsFromBrand(key, { targetL });

const b = hexToOklab(key);
console.log(`\n${theme}   from ${key}   L ${b.L.toFixed(3)}  C ${Math.hypot(b.a, b.b).toFixed(3)}\n`);
for (const [name, s] of Object.entries(signals)) {
  const existing = doc.color?.[name]?.$value;
  const was = existing ? `   was ${existing}` : '';
  console.log(`  ${name.padEnd(10)} ${s.hex}   L ${s.L}  C ${String(s.C).padEnd(7)} hue ${s.hue}°${was}`);
}

if (dry) {
  console.log('\n(--dry: nothing written)\n');
  process.exit(0);
}

for (const [name, s] of Object.entries(signals)) {
  doc.color[name] = { $type: 'color', $value: s.hex };
}
writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
console.log(`\n✓ ${Object.keys(signals).length} signals written to tokens/themes/${theme}.json`);
console.log('  Ramp any of them if you need tints: npm run color:add -- "Error" "<hex>"\n');
