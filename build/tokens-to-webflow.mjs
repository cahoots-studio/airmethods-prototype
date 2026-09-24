#!/usr/bin/env node
/**
 * tokens -> dist/webflow-variables.json
 *
 * Consumed by the Webflow MCP `data_variable_tool`. Run the build, then in
 * Claude Code: "read dist/webflow-variables.json and create these variables in
 * the <site> Webflow site." Variable NAMES match the --sc-* CSS custom property
 * names exactly, so a component's CSS is portable without rewriting.
 *
 * Webflow variable types: Color, Size, FontFamily, Number, Percentage.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadTokens, loadRawMerged, resolveMap, listModes, cssVarName, listThemes } from './lib/tokens.mjs';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const t = loadTokens(process.argv[2] ?? listThemes()[0]);

const WF_TYPE = { color: 'Color', dimension: 'Size', fontFamily: 'FontFamily', number: 'Number' };

const groups = { Color: [], Size: [], FontFamily: [], Number: [] };
const skipped = [];

for (const [path, { type, value }] of Object.entries(t)) {
  // Motion tokens have no Webflow equivalent — they ship as a custom code embed.
  if (path.startsWith('duration.') || path.startsWith('ease.') || path.startsWith('stagger.')) {
    skipped.push(path);
    continue;
  }
  const wfType = WF_TYPE[type];
  if (!wfType) { skipped.push(path); continue; }
  groups[wfType].push({ name: cssVarName(path).replace(/^--/, ''), value: String(value), token: path });
}

// Webflow supports breakpoint-bound variable modes, so the mobile overrides
// port natively instead of becoming custom CSS.
// Webflow breakpoint ids. 'large' (1280) is deliberately unused — it sits close
// enough to the base to be noise, and a larger breakpoint cannot be removed
// from a Webflow site once added.
const WF_BREAKPOINT = {
  portrait: 'tiny',      // max-width 479
  landscape: 'small',    // max-width 767
  tablet: 'medium',      // max-width 991
  wide: 'xl',            // min-width 1440
  xwide: 'xxl',          // min-width 1920
};
const raw = loadRawMerged(process.argv[2] ?? listThemes()[0]);
const modeBlocks = listModes(raw)
  .filter((m) => m !== 'default')
  .map((mode) => {
    const rt = resolveMap(raw, mode);
    const overrides = Object.entries(rt)
      .filter(([p, v]) => v.overridden && WF_TYPE[v.type])
      .map(([p, v]) => ({ name: cssVarName(p).replace(/^--/, ''), value: String(v.value), token: p }));
    return { mode, breakpoint_id: WF_BREAKPOINT[mode] ?? 'small', count: overrides.length, overrides };
  })
  .filter((b) => b.count);

const payload = {
  $note: 'Generated. Feed to Webflow MCP data_variable_tool. Names match --sc-* custom properties.',
  collections: Object.entries(groups)
    .filter(([, v]) => v.length)
    .map(([type, variables]) => ({ type, count: variables.length, variables })),
  modes: modeBlocks.length ? modeBlocks : undefined,
  $modesNote: modeBlocks.length
    ? 'Create these via create_variable_mode with the given breakpoint_id, then set the override values.'
    : undefined,
  motionEmbed: {
    $note: 'Motion tokens cannot be Webflow variables. Paste this into Site Settings > Custom Code > Head.',
    css: `<style>:root{${['duration', 'ease', 'distance', 'stagger']
      .flatMap((p) => Object.entries(t).filter(([k]) => k.startsWith(p + '.')))
      .map(([k, v]) => `${cssVarName(k)}:${v.value};`)
      .join('')}}</style>`,
  },
};

mkdirSync(DIST, { recursive: true });
writeFileSync(DIST + 'webflow-variables.json', JSON.stringify(payload, null, 2) + '\n');
console.log('✓ dist/webflow-variables.json');
for (const c of payload.collections) console.log(`  ${c.type}: ${c.count}`);
for (const m of modeBlocks) console.log(`  mode ${m.mode} -> breakpoint '${m.breakpoint_id}': ${m.count} override(s)`);
console.log(`  ${skipped.length} motion/unsupported token(s) routed to custom code embed`);
