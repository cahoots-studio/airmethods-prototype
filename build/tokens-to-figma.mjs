#!/usr/bin/env node
/**
 * tokens -> dist/figma-variables.json  (seed payload for use_figma)
 *
 * Creates three collections matching the repo exactly, so tokens:pull round
 * trips without renaming anything.
 *
 * Critically: semantic tokens are emitted as ALIASES, not resolved values.
 * Flattening them would put a hex in Figma where an indirection belongs, and
 * the one-file client retheme — the whole point of the semantic layer — would
 * stop working on the Figma side.
 *
 * Direction: runs ONCE to seed. After that Figma is the authoring surface and
 * tokens flow back via tokens:pull. Re-running is a reset, not a sync.
 *
 * Figma types: COLOR, FLOAT, STRING, BOOLEAN. No unit concept, so rem is
 * emitted as px FLOAT at 16/rem with remValue carried for the return trip.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadRawMerged, resolveMap, listModes, toFigmaName, loadSchemes, expandSchemes, listThemes } from './lib/tokens.mjs';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const theme = process.argv[2] ?? listThemes()[0];
const raw = loadRawMerged(theme);
const modes = listModes(raw);
const resolvedByMode = Object.fromEntries(modes.map((m) => [m, resolveMap(raw, m)]));

const ROOT = 16;
// Mode names match Webflow's canvas bar so the two panels read the same.
const MODE_LABEL = {
  default: 'Desktop',
  wide: '1440',
  xwide: '1920',
  tablet: 'Tablet',
  landscape: 'Mobile Landscape',
  portrait: 'Mobile Portrait',
};
const MODE_ORDER = ['xwide', 'wide', 'default', 'tablet', 'landscape', 'portrait'];

// Order matters: checked most-specific first. 'space.' would otherwise swallow
// 'space.section-md' into Primitive before Semantic ever sees it.
const COLLECTIONS = {
  // Semantic first: the five role names would otherwise be swallowed by the
  // broad 'color.' prefix that catches brand primitives.
  'UI + Spacing': ['color.background', 'color.foreground', 'color.text', 'color.accent', 'color.border',
             'space.section-', 'space.gutter', 'space.stack-', 'max-width.', 'font.'],
  Brand: ['color.', 'family.', 'font-size.', 'weight.'],
  Primitive: ['space.', 'size.', 'radius.', 'breakpoint.', 'opacity.'],
};
const CREATE_ORDER = ['Primitive', 'Brand', 'UI + Spacing'];
const EXCLUDE = ['duration.', 'ease.', 'distance.', 'stagger.'];

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return {
    r: +(parseInt(f.slice(0, 2), 16) / 255).toFixed(4),
    g: +(parseInt(f.slice(2, 4), 16) / 255).toFixed(4),
    b: +(parseInt(f.slice(4, 6), 16) / 255).toFixed(4),
    a: 1,
  };
}

function encode(type, value) {
  if (type === 'color' && typeof value === 'string' && value.startsWith('#')) {
    return { resolvedType: 'COLOR', value: hexToRgb(value), hex: value };
  }
  if (type === 'dimension') {
    const n = parseFloat(value);
    if (String(value).endsWith('rem')) return { resolvedType: 'FLOAT', value: n * ROOT, remValue: `${n}rem` };
    if (String(value).endsWith('px')) return { resolvedType: 'FLOAT', value: n };
    return { resolvedType: 'STRING', value: String(value) };
  }
  if (type === 'number') return { resolvedType: 'FLOAT', value: Number(value) };
  return { resolvedType: 'STRING', value: String(value) };
}

const ALIAS = /^\{([^}]+)\}$/;
const buckets = {};
const unassigned = [];

for (const [path, token] of Object.entries(raw)) {
  if (EXCLUDE.some((p) => path.startsWith(p))) continue;
  const hit = Object.entries(COLLECTIONS).find(([, ps]) => ps.some((p) => path.startsWith(p)));
  if (!hit) { unassigned.push(path); continue; }

  const name = token.figmaName
    ? token.figmaName.split('/').slice(1).join('/')
    : toFigmaName(path);

  const entry = { name, token: path };
  const aliasMatch = ALIAS.exec(String(token.value));

  if (aliasMatch) {
    // Preserve the indirection. The seeding script resolves `aliasOf` against
    // the path->variable map it builds as it goes.
    entry.aliasOf = aliasMatch[1];
    entry.resolvedType = encode(token.type, resolvedByMode.default[path].value).resolvedType;
  } else {
    Object.assign(entry, encode(token.type, resolvedByMode.default[path].value));
  }

  // Per-mode overrides, if this token declares any.
  if (token.modes) {
    entry.valuesByMode = { [MODE_LABEL.default]: entry.aliasOf ?? entry.value };
    for (const mode of MODE_ORDER) {
      if (!(mode in token.modes)) continue;
      const v = token.modes[mode];
      const am = ALIAS.exec(String(v));
      entry.valuesByMode[MODE_LABEL[mode] ?? mode] = am
        ? { aliasOf: am[1] }
        : encode(token.type, resolvedByMode[mode][path].value).value;
    }
  }

  (buckets[hit[0]] ??= []).push(entry);
}

// --- Color Schemes -------------------------------------------------------
// A separate collection, matching Relume. Figma allows one mode axis per
// collection and Semantic spends its modes on Desktop/Mobile, so schemes
// cannot also live there. Groups per scheme, Light/Dark as the modes.
const schemeDef = loadSchemes();
let schemeCollection = null;
if (schemeDef) {
  const roles = schemeDef.$roles ?? [];
  const variables = [];
  const expanded = expandSchemes(schemeDef);
  for (const [name, byMode] of Object.entries(expanded)) {
    const label = (schemeDef.schemes[name].$label ?? name).split('—')[0].trim();
    for (const role of roles) {
      const entry = {
        name: `${label}/${toFigmaName(role)}`,
        token: `scheme.${name}.${role}`,
        resolvedType: 'COLOR',
        valuesByMode: {},
      };
      for (const mode of schemeDef.$modes ?? ['light']) {
        const v = byMode[mode]?.[role];
        if (!v) continue;
        const am = ALIAS.exec(String(v));
        const label2 = mode === 'light' ? 'Light (Primary)' : toFigmaName(mode);
        entry.valuesByMode[label2] = am
          ? { aliasOf: am[1] }
          : encode('color', v).value;
      }
      variables.push(entry);
    }
  }
  schemeCollection = {
    name: 'Color Schemes',
    modes: (schemeDef.$modes ?? ['light']).map((m) => (m === 'light' ? 'Light (Primary)' : toFigmaName(m))),
    count: variables.length,
    aliased: variables.filter((v) => Object.values(v.valuesByMode).some((x) => x && x.aliasOf)).length,
    variables,
  };
}

const collectionsOut = CREATE_ORDER.filter((n) => buckets[n]).map((name) => {
  const variables = buckets[name];
  const responsive = variables.some((v) => v.valuesByMode);
  const used = MODE_ORDER.filter((m) =>
    m === 'default' || variables.some((v) => v.valuesByMode && MODE_LABEL[m] in v.valuesByMode)
  ).map((m) => MODE_LABEL[m]);
  return {
    name,
    modes: responsive ? used : ['Default'],
    count: variables.length,
    aliased: variables.filter((v) => v.aliasOf).length,
    variables,
  };
});

if (schemeCollection) collectionsOut.push(schemeCollection);

const payload = {
  $note: 'Seed payload for use_figma. Create collections in listed order — Semantic and Color Schemes alias against earlier collections.',
  $theme: theme,
  $remBase: ROOT,
  collections: collectionsOut,
};

mkdirSync(DIST, { recursive: true });
writeFileSync(DIST + 'figma-variables.json', JSON.stringify(payload, null, 2) + '\n');
console.log('✓ dist/figma-variables.json');
for (const c of collectionsOut) {
  console.log(`  ${c.name}: ${c.count} (${c.aliased} aliased) · modes: ${c.modes.join(', ')}`);
}
if (unassigned.length) console.log(`  ⚠ unassigned: ${unassigned.join(', ')}`);
