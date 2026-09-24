#!/usr/bin/env node
/**
 * tokens -> dist/theme.json  (WordPress block theme)
 *
 * Gutenberg emits its own custom properties from theme.json in the form
 * --wp--preset--color--{slug}. We ALSO ship supercomponent.tokens.css, so
 * --sc-* names stay identical across every target. The presets below exist so
 * the client sees correct swatches and sizes in the editor UI.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadTokens, listThemes } from './lib/tokens.mjs';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const t = loadTokens(process.argv[2] ?? listThemes()[0]);

const label = (s) => s.replace(/[-.]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const palette = Object.entries(t)
  .filter(([p, v]) => p.startsWith('color.') && v.type === 'color')
  .map(([p, v]) => ({ slug: p.replace('color.', '').replace(/\./g, '-'), name: label(p.replace('color.', '')), color: v.value }));

const GAP_STEPS = ['none', 'tiny', 'small', 'medium', 'large', 'huge'];
const spacingSizes = GAP_STEPS
  .filter((k) => t[`padding.gap.${k}`] ?? t[`gap.${k}`])
  .map((k, i) => ({
    slug: String((i + 1) * 10),
    name: label(k),
    size: (t[`padding.gap.${k}`] ?? t[`gap.${k}`]).value,
  }));

const fontSizes = Object.entries(t)
  .filter(([p]) => p.startsWith('font-size.'))
  .map(([p, v]) => ({ slug: p.replace('font-size.', '').replace(/\./g, '-'), name: label(p.replace('font-size.', '')), size: v.value }));

const FONT_ROLES = { headline: 'display', text: 'body', decorative: 'mono' };
const fontFamilies = Object.entries(FONT_ROLES)
  .filter(([tok]) => t[`typeface.family.${tok}`] ?? t[`font-family.${tok}`])
  .map(([tok, slug]) => ({
    slug,
    name: label(slug),
    fontFamily: (t[`typeface.family.${tok}`] ?? t[`font-family.${tok}`]).value,
  }));

const themeJson = {
  $schema: 'https://schemas.wp.org/trunk/theme.json',
  version: 3,
  settings: {
    appearanceTools: true,
    useRootPaddingAwareAlignments: true,
    layout: {
      contentSize: (t['width.container.medium'] ?? t['container.medium']).value,
      wideSize: (t['width.container.large'] ?? t['container.large']).value,
    },
    color: { palette, custom: false, defaultPalette: false, defaultGradients: false },
    spacing: { units: ['rem', 'px', '%', 'vw'], spacingSizes, defaultSpacingSizes: false },
    typography: { fluid: true, fontSizes, fontFamilies, defaultFontSizes: false },
  },
  styles: {
    color: { background: t['color.background'].value, text: t['color.text'].value },
    typography: { fontFamily: (t['typeface.family.text'] ?? t['font-family.text']).value, fontSize: t['font-size.text.small'].value, lineHeight: '1.55' },
    spacing: { padding: { left: (t['padding.section.global'] ?? t['page-padding.global']).value, right: (t['padding.section.global'] ?? t['page-padding.global']).value } },
    elements: {
      heading: { typography: { fontFamily: (t['typeface.family.headline'] ?? t['font-family.headline']).value, lineHeight: '1.2', letterSpacing: '-0.01em' } },
      link: { color: { text: t['color.accent'].value } },
    },
  },
};

mkdirSync(DIST, { recursive: true });
writeFileSync(DIST + 'theme.json', JSON.stringify(themeJson, null, 2) + '\n');
console.log(`✓ dist/theme.json`);
console.log(`  ${palette.length} colors · ${spacingSizes.length} spacing · ${fontSizes.length} sizes`);
