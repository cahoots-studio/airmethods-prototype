import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOKENS_DIR = fileURLToPath(new URL('../../tokens/', import.meta.url));

/** Flatten nested token objects into { "color.brand.500": { type, value } } */
export function flatten(obj, prefix = '', out = {}) {
  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('$')) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === 'object' && '$value' in val) {
      out[path] = { type: val.$type ?? 'string', value: val.$value, modes: val.$modes, figmaName: val.$figmaName };
    } else if (val && typeof val === 'object') {
      flatten(val, path, out);
    }
  }
  return out;
}

const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));

export function listThemes(dir = TOKENS_DIR) {
  return readdirSync(join(dir, 'themes'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));
}

/**
 * The merged but UNRESOLVED token map — aliases still in {curly.brace} form.
 * The dependency graph is built from this.
 * Layer order (later wins): primitive -> theme -> motion -> semantic
 */
export function loadRawMerged(theme = listThemes()[0], dir = TOKENS_DIR) {
  const layers = [
    flatten(readJSON(join(dir, 'primitive.json'))),
    flatten(readJSON(join(dir, 'themes', `${theme}.json`))),
    existsSync(join(dir, 'repo-native.json')) ? flatten(readJSON(join(dir, 'repo-native.json'))) : {},
    existsSync(join(dir, 'motion.json')) ? flatten(readJSON(join(dir, 'motion.json'))) : {},
    flatten(readJSON(join(dir, 'semantic.json'))),
  ];
  const merged = Object.assign({}, ...layers);

  // Colour roles come from the default scheme in its default mode. They used to
  // be declared in semantic.json as well, which meant one change needed two
  // edits — and a guard to catch the times it did not. One source instead.
  const schemesPath = join(dir, 'schemes.json');
  if (existsSync(schemesPath)) {
    const def = readJSON(schemesPath);
    const expanded = expandSchemes(def);
    const set = expanded[def.$default]?.[def.$defaultMode] ?? {};
    for (const [role, value] of Object.entries(set)) {
      merged[`color.${role}`] = { type: 'color', value };
    }
  }
  return merged;
}

/** Every mode any token declares, in emit order. 'default' is always first. */
export function listModes(merged) {
  const modes = new Set();
  for (const t of Object.values(merged)) for (const m of Object.keys(t.modes ?? {})) modes.add(m);
  return ['default', ...[...modes].sort()];
}

/**
 * Resolve a merged map for one mode. Aliases resolve within the same mode when
 * the target declares it, and fall back to default otherwise — so overriding
 * space.section-lg on mobile does not require overriding the whole space scale.
 */
export function resolveMap(merged, mode = 'default') {
  const resolved = {};
  function resolve(path, trail = []) {
    if (path in resolved) return resolved[path];
    if (trail.includes(path)) throw new Error(`Circular token alias: ${[...trail, path].join(' -> ')}`);
    const token = merged[path];
    if (!token) {
      const from = trail.length ? ` (referenced from ${trail[trail.length - 1]})` : '';
      throw new Error(`Unresolved token alias {${path}}${from}`);
    }
    let value = mode !== 'default' && token.modes && mode in token.modes ? token.modes[mode] : token.value;
    if (typeof value === 'string') {
      value = value.replace(/\{([^}]+)\}/g, (_, ref) => resolve(ref, [...trail, path]).value);
    }
    resolved[path] = { type: token.type, value, figmaName: token.figmaName, overridden: mode !== 'default' && !!(token.modes && mode in token.modes) };
    return resolved[path];
  }
  for (const path of Object.keys(merged)) resolve(path);
  return resolved;
}

/** Load schemes.json (optional). */
export function loadSchemes(dir = TOKENS_DIR) {
  const f = join(dir, 'schemes.json');
  if (!existsSync(f)) return null;
  return readJSON(f);
}

/**
 * Resolve one scheme in one mode, returning ONLY the roles it overrides.
 * Overrides are injected into the merged map before resolution, so an alias
 * like {color.neutral.900} resolves through the active theme exactly as a
 * semantic role would.
 */
export function resolveScheme(merged, overrides, mode = 'default') {
  const patched = { ...merged };
  for (const [path, value] of Object.entries(overrides)) {
    patched[path] = { ...(merged[path] ?? { type: 'color' }), value, modes: undefined };
  }
  const resolved = resolveMap(patched, mode);
  const out = {};
  for (const path of Object.keys(overrides)) out[path] = resolved[path];
  return out;
}

export function loadTokens(theme = listThemes()[0], dir = TOKENS_DIR, mode = 'default') {
  return resolveMap(loadRawMerged(theme, dir), mode);
}

/** "color.text-primary" -> "--sc-color-text-primary" */
export function cssVarName(path) {
  return `--sc-${path.replace(/\./g, '-')}`;
}

/**
 * "color.neutral-darkest" -> "Color/Neutral Darkest" (seed fallback only).
 * Once a name exists in Figma, $figmaName wins and this is never consulted —
 * so renaming in Figma sticks permanently rather than being re-derived.
 */
const SCALE_ABBR = /^(\d*)(xs|sm|md|lg|xl)$/i;
const DISPLAY_WORDS = { cta: 'CTA', ui: 'UI' };

function titleWord(w) {
  const key = w.toLowerCase();
  if (DISPLAY_WORDS[key]) return DISPLAY_WORDS[key];
  const abbr = key.match(SCALE_ABBR);
  if (abbr) return abbr[1] + abbr[2].toUpperCase();
  if (/^\d/.test(w)) return w;
  return w.charAt(0).toUpperCase() + w.slice(1);
}

const FIGMA_SEGMENT = { 'font-size': 'Size' };

export function toFigmaName(path) {
  return path
    .split('.')
    .map((seg) => FIGMA_SEGMENT[seg] ?? seg.split('-').map(titleWord).join(' '))
    .join('/');
}

/**
 * Expand scheme definitions into complete role sets keyed by mode.
 * Each scheme declares its roles per mode directly — no derivation.
 */
export function expandSchemes(def) {
  const modes = def.$modes ?? ['light'];
  const out = {};
  for (const [name, s] of Object.entries(def.schemes ?? {})) {
    const result = {};
    for (const mode of modes) result[mode] = { ...(s[mode] ?? {}) };
    out[name] = result;
  }
  return out;
}
