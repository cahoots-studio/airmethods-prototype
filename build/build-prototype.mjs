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

cpSync(join(ROOT, 'site/index.html'), join(SITE, 'index.html'));
cpSync(join(ROOT, 'site/site.css'), join(SITE, 'assets/site.css'));
cpSync(join(ROOT, 'site/img'), join(SITE, 'img'), { recursive: true });
console.log('✓ _site/index.html (Air Methods homepage) · _site/styleguide/ (token inspector)');
