#!/usr/bin/env node
/**
 * After build-site.mjs: the Air Methods homepage becomes the site root and the
 * Supercomponent style guide moves to /styleguide/. Both use the same bundle,
 * so the style guide doubles as a token inspector for this theme.
 */
import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SITE = join(ROOT, '_site');

const guide = readFileSync(join(SITE, 'index.html'), 'utf8').replaceAll('href="assets/', 'href="../assets/').replaceAll('src="assets/', 'src="../assets/');
mkdirSync(join(SITE, 'styleguide'), { recursive: true });
writeFileSync(join(SITE, 'styleguide/index.html'), guide);

// Cache-bust: /assets/* is served immutable, so every CSS/JS reference carries a content hash.
{
  const { createHash } = await import('node:crypto');
  const hash = (f) => createHash('sha1').update(readFileSync(f)).digest('hex').slice(0, 10);
  let html = readFileSync(join(ROOT, 'site/index.html'), 'utf8');
  html = html
    .replace('href="assets/supercomponent.css"', `href="assets/supercomponent.css?v=${hash(join(SITE, 'assets/supercomponent.css'))}"`)
    .replace('href="assets/site.css"', `href="assets/site.css?v=${hash(join(ROOT, 'site/site.css'))}"`)
    .replace(/src="js\/([\w-]+\.js)"/g, (m, f) => `src="js/${f}?v=${hash(join(ROOT, 'site/js', f))}"`);
  writeFileSync(join(SITE, 'index.html'), html);
}
cpSync(join(ROOT, 'site/site.css'), join(SITE, 'assets/site.css'));
cpSync(join(ROOT, 'site/img'), join(SITE, 'img'), { recursive: true });
cpSync(join(ROOT, 'site/js'), join(SITE, 'js'), { recursive: true });
// Motion presets live in src/ (the portable source); ship them beside the page scripts.
cpSync(join(ROOT, 'src/motion/presets.js'), join(SITE, 'js/presets.js'));
console.log('✓ _site/index.html (Air Methods homepage) · _site/styleguide/ (token inspector)');
