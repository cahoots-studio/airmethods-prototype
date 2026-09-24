#!/usr/bin/env node
/**
 * Everything -> dist/supercomponent.css
 *
 * One stylesheet, in cascade order. This is the distributable: paste it into
 * Webflow's custom code, enqueue it in a WordPress theme, or import it in
 * Astro. Same file, same behaviour, all three targets.
 *
 * Layer order is declared once at the top of the generated token file, so file
 * concatenation order does not actually decide precedence — @layer does. The
 * order below is for readability.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DIST = join(ROOT, 'dist');
const SRC = join(ROOT, 'src');

function collect(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((name) => join(dir, name))
    .filter((p) => existsSync(p))
    .flatMap((p) => {
      try {
        return readdirSync(p).filter((f) => f.endsWith('.css')).map((f) => join(p, f));
      } catch {
        return [];
      }
    })
    .sort();
}

const parts = [
  { label: 'tokens', files: [join(DIST, 'supercomponent.tokens.css')] },
  { label: 'base', files: [join(SRC, 'styles/base.css')] },
  { label: 'blocks', files: collect(join(SRC, 'blocks')) },
  { label: 'patterns', files: collect(join(SRC, 'patterns')) },
];

const out = ['/* Supercomponent — generated bundle. Do not edit; edit the sources. */'];
let count = 0;

for (const part of parts) {
  for (const file of part.files) {
    if (!existsSync(file)) continue;
    out.push(`\n/* ── ${part.label}: ${file.replace(ROOT, '')} ─────────────────────── */`);
    out.push(readFileSync(file, 'utf8').trim());
    count++;
  }
}

mkdirSync(DIST, { recursive: true });
const css = out.join('\n') + '\n';
writeFileSync(join(DIST, 'supercomponent.css'), css);

const kb = (css.length / 1024).toFixed(1);
console.log(`✓ dist/supercomponent.css`);
console.log(`  ${count} source file(s) · ${kb} kB`);
