#!/usr/bin/env node
/**
 * npm run lint
 *
 * A dangling --sc-* reference does not throw. The property resolves to nothing
 * and the layout quietly degrades — which is exactly the failure you find on a
 * client call rather than in the build. This catches it in a second.
 *
 * Checks:
 *   1. every var(--sc-*) in src/ resolves to a real token
 *   2. every data-sc-motion value is a registered preset
 *   3. every data-sc-scheme value is a defined scheme
 *   4. reports tokens no block references (informational — de-bloat signal)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTokens, cssVarName, loadSchemes, listThemes } from './lib/tokens.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const DOCS = join(ROOT, 'docs');

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

function walk(dir, exts, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, exts, out);
    else if (exts.some((x) => e.endsWith(x))) out.push(p);
  }
  return out;
}

// --- what's valid ---
const tokens = loadTokens(listThemes()[0]);
const validVars = new Set(Object.keys(tokens).map(cssVarName));

const schemes = loadSchemes();
const validSchemes = new Set(Object.keys(schemes?.schemes ?? {}));

let validMotion = new Set();
try {
  const src = readFileSync(join(SRC, 'motion/presets.js'), 'utf8');
  const block = src.slice(src.indexOf('export const presets'), src.indexOf('export function initMotion'));
  for (const m of block.matchAll(/^\s*['"]?([a-z][\w-]*)['"]?\s*:\s*\(/gm)) validMotion.add(m[1]);
} catch { /* presets file optional */ }

// Patterns are directories under src/patterns — a data-sc-pattern value with
// no matching folder is a typo or a rename that did not finish.
let validPatterns = new Set();
try { validPatterns = new Set(readdirSync(join(SRC, 'patterns'))); } catch {}

// --- scan ---
const files = [...walk(SRC, ['.css', '.html', '.jsx', '.astro']), ...walk(DIST, ['.css']), ...walk(DOCS, ['.html'])];
const problems = [];
const usedVars = new Set();

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');

  lines.forEach((line, i) => {
    const at = `${relative(ROOT, file)}:${i + 1}`;

    // Require a real terminator so template-built names like var(--sc-color-${r})
    // are skipped rather than reported as the truncated prefix.
    for (const m of line.matchAll(/var\(\s*(--sc-[\w-]+)\s*[,)]/g)) {
      usedVars.add(m[1]);
      if (!validVars.has(m[1])) problems.push({ at, kind: 'variable', name: m[1], line: line.trim() });
    }
    for (const m of line.matchAll(/data-sc-motion\s*=\s*["']([^"']+)["']/g)) {
      if (validMotion.size && !validMotion.has(m[1]))
        problems.push({ at, kind: 'motion preset', name: m[1], line: line.trim() });
    }
    for (const m of line.matchAll(/data-sc-pattern\s*=\s*["']([^"']+)["']/g)) {
      if (validPatterns.size && !validPatterns.has(m[1]))
        problems.push({ at, kind: 'pattern', name: m[1], line: line.trim() });
    }
    for (const m of line.matchAll(/data-sc-scheme\s*=\s*["']([^"']+)["']/g)) {
      if (validSchemes.size && !validSchemes.has(m[1]))
        problems.push({ at, kind: 'scheme', name: m[1], line: line.trim() });
    }
  });
}

// --- report ---
console.log('');
if (problems.length) {
  console.log(bold(red(`✗ ${problems.length} broken reference(s)`)));
  for (const p of problems) {
    console.log(`  ${red(p.name)} ${dim(`— unknown ${p.kind}`)}`);
    console.log(`    ${dim(p.at)}  ${p.line.slice(0, 72)}`);
  }
  console.log('');
  process.exit(1);
}

console.log(green('✓') + ` ${files.length} file(s) · ${usedVars.size} variable reference(s) · all resolve`);

const unused = [...validVars].filter((v) => !usedVars.has(v));
if (unused.length) {
  console.log(dim(`  ${unused.length} token(s) defined but unreferenced in src/ + dist/ — expected while the block library is small.`));
}
console.log('');
