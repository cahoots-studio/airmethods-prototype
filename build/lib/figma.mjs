/**
 * Pure normalizer: Figma MCP get_variable_defs output -> token trees.
 * No file I/O — callers decide where the result lands. That separation is what
 * lets sync.mjs normalize into a temp dir and diff before committing anything.
 */

/**
 * Figma mode label -> token mode key. Modes are how the responsive layer and
 * light/dark exist at all, so a pull that reads one mode per variable silently
 * discards half the system.
 */
export const MODE_KEY = {
  'desktop': 'default',
  'default': 'default',
  'mode 1': 'default',
  '1440': 'wide',
  '1920': 'xwide',
  'tablet': 'tablet',
  'mobile landscape': 'landscape',
  'mobile portrait': 'portrait',
  'light (primary)': 'light',
  'light': 'light',
  'dark': 'dark',
};

const modeKey = (label) => MODE_KEY[String(label).trim().toLowerCase()] ?? String(label).trim().toLowerCase();

/** Accept { "color/brand/500": "#FF8400" } or [{ name, value, resolvedType }] */
export function toPairs(input) {
  if (Array.isArray(input)) {
    return input.map((v) => [v.name ?? v.key, v.value ?? v.resolvedValue, v.resolvedType, v.valuesByMode]);
  }
  if (input && typeof input === 'object') {
    return Object.entries(input).map(([k, v]) => {
      if (v && typeof v === 'object' && 'value' in v) return [k, v.value, v.$type ?? v.resolvedType, v.valuesByMode];
      // A per-mode object: { Desktop: 128, "1440": 144, Tablet: 96 }
      if (v && typeof v === 'object' && !('r' in v)) {
        const byMode = {};
        for (const [label, val] of Object.entries(v)) byMode[modeKey(label)] = val;
        const base = 'default' in byMode ? byMode.default : Object.values(byMode)[0];
        return [k, base, undefined, byMode];
      }
      return [k, v, undefined, undefined];
    });
  }
  throw new Error('Unrecognised variable dump shape');
}

const TYPE_MAP = { COLOR: 'color', FLOAT: 'number', STRING: 'string', BOOLEAN: 'boolean' };

const REM_BASE = 16;
const PX_GROUPS = ['breakpoint.', 'container.', 'page-padding.', 'max-width.', 'gap.', 'padding.', 'section-padding.', 'width.', 'corners.'];
const REM_GROUPS = ['space.', 'size.', 'radius.', 'font-size.'];

/** Figma FLOATs are 32-bit: 1.05 comes back as 1.0499999523162842. */
const tidy = (n) => Math.round(n * 1e4) / 1e4;

/**
 * Figma has no unit concept — every dimension returns a bare number. Restore
 * the unit from the token already in the repo rather than guessing, which
 * handles mixed-unit groups correctly (radius.sm is rem, radius.full is px).
 * Falls back to group defaults only for variables that are genuinely new.
 */
export function restoreUnit(path, value, current) {
  if (typeof value !== 'number') return value;
  const existing = current?.[path]?.value;

  if (typeof existing === 'string') {
    if (existing.endsWith('rem')) return `${tidy(value / REM_BASE)}rem`;
    if (existing.endsWith('px')) return `${tidy(value)}px`;
    if (existing.endsWith('%')) return `${tidy(value)}%`;
  }
  if (typeof existing === 'number') return tidy(value);

  if (PX_GROUPS.some((g) => path.startsWith(g))) return `${tidy(value)}px`;
  if (REM_GROUPS.some((g) => path.startsWith(g))) {
    if (value >= 1000) return `${tidy(value)}px`;
    return `${tidy(value / REM_BASE)}rem`;
  }
  return tidy(value);
}

export function inferType(value, declared) {
  if (declared) return TYPE_MAP[declared] ?? String(declared).toLowerCase();
  if (typeof value === 'string' && /^#|^rgba?\(/.test(value)) return 'color';
  if (typeof value === 'string' && /(rem|px|em|%)$/.test(value)) return 'dimension';
  if (typeof value === 'number') return 'number';
  return 'string';
}

/** Figma aliases arrive as "{Collection/path}" or "Collection/path" -> {dot.path} */
export function normaliseValue(value, type) {
  if (typeof value !== 'string') return value;
  const alias = value.match(/^\{?([A-Za-z][\w\s/+-]*\/[\w\s/+-]+)\}?$/);
  if (alias && type !== 'color') {
    const withoutCollection = alias[1].split('/').slice(1).join('/');
    return `{${toTokenPath(withoutCollection)}}`;
  }
  return value;
}

const ORG_GROUPS = new Set(['key-colors', 'scale', 'utility']);
const SEGMENT_MAP = { size: 'font-size' };

/**
 * "Color/Neutral Darkest" -> "color.neutral-darkest"
 *
 * ORG_GROUPS (Scale, Key Colors, Utility) are organisational in Figma and
 * stripped from the token path.  Everything that sits below a stripped group is
 * joined with dashes rather than dots so that the nested Figma layout
 * "Scale/Neutral/Lightest" maps to the same flat token "neutral-lightest" that
 * the old "Neutral Lightest" produced — no structural collision with a
 * key-color leaf at the same depth.
 */
export function toTokenPath(figmaName) {
  const raw = String(figmaName)
    .split('/')
    .map((s) => s.trim().toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, ''));

  const result = [];
  let i = 0;
  while (i < raw.length) {
    const s = SEGMENT_MAP[raw[i]] ?? raw[i];
    if (ORG_GROUPS.has(s)) {
      i++;
      const sub = [];
      while (i < raw.length) {
        sub.push(SEGMENT_MAP[raw[i]] ?? raw[i]);
        i++;
      }
      if (sub.length) result.push(sub.join('-'));
    } else {
      result.push(s);
      i++;
    }
  }
  return result.join('.');
}

function nest(pairs, collectionPrefix, current) {
  const tree = {};
  const collisions = [];
  const seen = {};

  for (const [name, value, declared, byMode] of pairs) {
    const path = toTokenPath(name);
    const segs = path.split('.');
    const type = inferType(value, declared);

    if (seen[path] && seen[path] !== name) {
      collisions.push({ path, names: [seen[path], name] });
      continue;
    }
    seen[path] = name;

    let node = tree;
    for (const seg of segs.slice(0, -1)) node = node[seg] ??= {};
    const restored = restoreUnit(path, normaliseValue(value, type), current);

    // Mode overrides come from the dump when present, and are otherwise carried
    // forward from what is committed. Dropping them was silent: the diff compares
    // resolved default values, so a stripped $modes block looked like no change.
    let modes;
    if (byMode) {
      const out = {};
      for (const [key, val] of Object.entries(byMode)) {
        if (key === 'default') continue;
        const r = restoreUnit(path, normaliseValue(val, type), current);
        if (String(r) !== String(restored)) out[key] = r;
      }
      if (Object.keys(out).length) modes = out;
    } else if (current?.[path]?.modes) {
      modes = current[path].modes;
    }

    node[segs.at(-1)] = {
      $type: typeof restored === 'string' && /(rem|px|em|%)$/.test(restored) ? 'dimension' : type,
      $value: restored,
      ...(modes ? { $modes: modes } : {}),
      // The exact Figma label, preserved verbatim. Seeding writes this back
      // rather than re-deriving it, so casing survives a full round trip and
      // acronyms like CTA or iOS are never mangled into Cta / Ios.
      $figmaName: collectionPrefix ? `${collectionPrefix}/${name}` : String(name),
    };
  }
  return { tree, collisions };
}

/**
 * Parse Color Schemes collection into a schemes structure.
 *
 * Supports two layouts:
 *   Old: flat variable names (e.g. "Background") with mode labels "Scheme 1 Light".
 *   New: grouped variable paths (e.g. "Scheme 1 - Primary/Background") with
 *        mode labels "Light (Primary)" / "Dark".
 */
export function parseColorSchemes(pairs) {
  const roles = new Set();
  const modes = new Set();
  const schemes = {};

  for (const [name, , , byMode] of pairs) {
    if (!byMode) continue;

    const slashIdx = name.indexOf('/');
    const isGrouped = slashIdx !== -1 && /^scheme\s+\d+/i.test(name);

    if (isGrouped) {
      const schemeLabel = name.slice(0, slashIdx).trim();
      const role = name.slice(slashIdx + 1).trim().toLowerCase().replace(/\s+/g, '-');
      const schemeMatch = schemeLabel.match(/^scheme\s+(\d+)/i);
      if (!schemeMatch) continue;
      const schemeName = `scheme-${schemeMatch[1]}`;
      roles.add(role);

      for (const [modeLabel, rawValue] of Object.entries(byMode)) {
        const mode = modeLabel.toLowerCase().startsWith('light') ? 'light'
          : modeLabel.toLowerCase().startsWith('dark') ? 'dark' : null;
        if (!mode) continue;
        modes.add(mode);

        let value = rawValue;
        if (typeof value === 'string') {
          const alias = value.match(/^\{([^}]+)\}$/);
          if (alias) {
            const withoutCollection = alias[1].split('/').slice(1).join('/');
            value = `{${toTokenPath(withoutCollection)}}`;
          }
        }

        schemes[schemeName] ??= {};
        schemes[schemeName][mode] ??= {};
        schemes[schemeName][mode][role] = value;
      }
    } else {
      const role = name.trim().toLowerCase().replace(/\s+/g, '-');
      roles.add(role);

      for (const [modeLabel, rawValue] of Object.entries(byMode)) {
        const match = modeLabel.match(/^scheme\s+(\d+)\s+(light|dark)$/);
        if (!match) continue;
        const schemeName = `scheme-${match[1]}`;
        const mode = match[2];
        modes.add(mode);

        let value = rawValue;
        if (typeof value === 'string') {
          const alias = value.match(/^\{([^}]+)\}$/);
          if (alias) {
            const withoutCollection = alias[1].split('/').slice(1).join('/');
            value = `{${toTokenPath(withoutCollection)}}`;
          }
        }

        schemes[schemeName] ??= {};
        schemes[schemeName][mode] ??= {};
        schemes[schemeName][mode][role] = value;
      }
    }
  }

  return { roles: [...roles], modes: [...modes].sort(), schemes };
}

/**
 * @returns { primitive, brand, semantic, schemes, skipped }
 * Collections must be named Primitive / Brand / Semantic.
 */
export function normalizeFigmaDump(raw, current) {
  const buckets = { primitive: [], brand: [], semantic: [], schemes: [], skipped: [] };
  for (const p of toPairs(raw)) {
    const full = String(p[0]);
    const collection = full.split('/')[0].toLowerCase();
    const rest = [full.split('/').slice(1).join('/'), p[1], p[2], p[3]];
    if (collection.startsWith('color primitive') || collection.startsWith('primitive')) buckets.primitive.push(rest);
    else if (collection.startsWith('brand') || collection.startsWith('typograph')) buckets.brand.push(rest);
    else if (collection.startsWith('ui')) buckets.semantic.push(rest);
    else if (collection.startsWith('color scheme')) buckets.schemes.push(rest);
    else buckets.skipped.push(full);
  }
  const p = nest(buckets.primitive, 'Color Primitives', current);
  const b = nest(buckets.brand, 'Typography', current);
  const sm = nest(buckets.semantic, 'UI + Spacing', current);
  const schemes = buckets.schemes.length ? parseColorSchemes(buckets.schemes) : null;
  return {
    primitive: p.tree,
    brand: b.tree,
    semantic: sm.tree,
    schemes,
    skipped: buckets.skipped,
    collisions: [...p.collisions, ...b.collisions, ...sm.collisions],
  };
}
