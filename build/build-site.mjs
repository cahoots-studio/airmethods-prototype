#!/usr/bin/env node
/**
 * docs/ -> _site/   (the deployable style guide)
 *
 * docs/index.html links its stylesheets with ../dist and ../src, which resolve
 * fine on disk and 404 the moment docs/ becomes a site root. This assembles a
 * self-contained folder and rewrites those links to the single bundle.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SITE = join(ROOT, '_site');

rmSync(SITE, { recursive: true, force: true });
mkdirSync(join(SITE, 'assets'), { recursive: true });

const bundle = join(ROOT, 'dist/supercomponent.css');
if (!existsSync(bundle)) {
  console.error('✗ dist/supercomponent.css missing — run npm run build first.');
  process.exit(1);
}
cpSync(bundle, join(SITE, 'assets/supercomponent.css'));

let html = readFileSync(join(ROOT, 'docs/index.html'), 'utf8');

// Replace every local stylesheet link with the single bundle.
// The bundle MUST load before any inline <style> that references its layers,
// because CSS layer ordering is first-encounter-wins. Inserting before </head>
// would put the bundle after the inline @layer sc-components block, giving
// sc-components the lowest priority instead of the one the declaration sets.
const localLinks = /\n?[ \t]*<link rel="stylesheet" href="\.\.\/[^"]+">/g;
const found = html.match(localLinks) ?? [];
html = html.replace(localLinks, '');
const insertBefore = html.indexOf('<style');
if (insertBefore !== -1) {
  html = html.slice(0, insertBefore)
    + '<link rel="stylesheet" href="assets/supercomponent.css">\n'
    + html.slice(insertBefore);
} else {
  html = html.replace('</head>', '<link rel="stylesheet" href="assets/supercomponent.css">\n</head>');
}

writeFileSync(join(SITE, 'index.html'), html);

console.log('✓ _site/');
console.log(`  index.html · assets/supercomponent.css`);
console.log(`  ${found.length} local link(s) collapsed into the bundle`);
