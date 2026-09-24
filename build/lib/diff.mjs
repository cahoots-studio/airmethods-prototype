/**
 * Token diff with blast radius.
 *
 * A raw diff ("color.brand.500 changed") is not the useful question. The useful
 * question is "what does that change actually move?" — because a primitive edit
 * silently propagates through every semantic role that aliases it. This module
 * answers that, and refuses the pull outright if it would leave a semantic role
 * pointing at a token that no longer exists.
 */

const ALIAS = /\{([^}]+)\}/g;

/** direct alias refs a token makes */
function refsOf(token) {
  if (typeof token?.value !== 'string') return [];
  return [...token.value.matchAll(ALIAS)].map((m) => m[1]);
}

/** reverse index: token path -> [paths that reference it, transitively] */
export function buildDependents(rawMap) {
  const direct = {};
  for (const [path, token] of Object.entries(rawMap)) {
    for (const ref of refsOf(token)) (direct[ref] ??= new Set()).add(path);
  }
  const cache = {};
  function walk(path, seen = new Set()) {
    if (cache[path]) return cache[path];
    const out = new Set();
    for (const dep of direct[path] ?? []) {
      if (seen.has(dep)) continue;
      out.add(dep);
      for (const d of walk(dep, new Set([...seen, dep]))) out.add(d);
    }
    return (cache[path] = out);
  }
  const dependents = {};
  for (const path of Object.keys(rawMap)) dependents[path] = [...walk(path)].sort();
  return dependents;
}

/**
 * Mode overrides are invisible to a plain value comparison — the base value is
 * unchanged, so a stripped or edited mode reads as no change at all. That made
 * the diff report clean while destroying the entire responsive layer.
 */
function diffModes(before = {}, after = {}) {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const out = [];
  for (const k of [...keys].sort()) {
    const b = before?.[k];
    const a = after?.[k];
    if (b === undefined && a !== undefined) out.push({ mode: k, kind: 'added', to: a });
    else if (b !== undefined && a === undefined) out.push({ mode: k, kind: 'removed', from: b });
    else if (String(b) !== String(a)) out.push({ mode: k, kind: 'changed', from: b, to: a });
  }
  return out;
}

const SEMANTIC = (p) =>
  /^(color\.(surface|text-|border-|action|focus-)|space\.(section-|gutter|stack-)|font\.)/.test(p);

/**
 * @param before merged UNRESOLVED map (current committed state)
 * @param after  merged UNRESOLVED map (what the pull would produce)
 */
export function diffTokens(before, after, resolvedBefore = {}, resolvedAfter = {}) {
  const dependents = buildDependents(before);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  const added = [];
  const removed = [];
  const changed = [];

  for (const path of [...keys].sort()) {
    const b = before[path];
    const a = after[path];
    if (!b && a) {
      added.push({ path, value: a.value, type: a.type });
    } else if (b && !a) {
      removed.push({ path, value: b.value, dependents: dependents[path] ?? [] });
    } else {
      const valueChanged = String(b.value) !== String(a.value);
      const modeDelta = diffModes(b.modes, a.modes);
      if (!valueChanged && !modeDelta.length) continue;
      const affected = (dependents[path] ?? []).filter(SEMANTIC);
      changed.push({
        path,
        from: b.value,
        to: a.value,
        valueChanged,
        modes: modeDelta,
        fromResolved: resolvedBefore[path]?.value,
        toResolved: resolvedAfter[path]?.value,
        affects: affected,
      });
    }
  }

  // A removal is breaking if anything in the AFTER map still references it.
  // Uses the after-side dependency graph, not the before-side one — otherwise
  // a renamed alias (neutral-darkest -> neutral.darkest) reads as breaking
  // because the old dependent path still exists, even though it now points at
  // the new name.
  const afterDependents = buildDependents(after);
  const breaking = removed
    .map((r) => ({ ...r, stillReferenced: [...(afterDependents[r.path] ?? [])].filter((d) => d in after) }))
    .filter((r) => r.stillReferenced.length);

  return { added, removed, changed, breaking, clean: !added.length && !removed.length && !changed.length };
}

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

export function formatDiff(d, { theme } = {}) {
  const out = [];
  out.push('');
  out.push(c.bold(`Supercomponent sync`) + c.dim(` · ${theme ?? 'cahoots'}`));

  if (d.clean) {
    out.push('');
    out.push('  ' + c.dim('No token changes. Figma matches the repo.'));
    out.push('');
    return out.join('\n');
  }

  if (d.changed.length) {
    out.push('');
    out.push('  ' + c.yellow(`CHANGED  ${d.changed.length}`));
    for (const t of d.changed) {
      if (t.valueChanged !== false) {
        out.push(`    ${t.path.padEnd(26)} ${c.dim(t.from)} → ${c.cyan(String(t.to))}`);
      } else {
        out.push(`    ${t.path.padEnd(26)} ${c.dim('(base unchanged)')}`);
      }
      for (const m of t.modes ?? []) {
        const desc =
          m.kind === 'removed'
            ? `${c.red('mode removed')} ${m.mode} ${c.dim(`was ${m.from}`)}`
            : m.kind === 'added'
              ? `${c.green('mode added')} ${m.mode} ${c.cyan(String(m.to))}`
              : `${c.yellow('mode')} ${m.mode} ${c.dim(m.from)} → ${c.cyan(String(m.to))}`;
        out.push(`      ${desc}`);
      }
      if (t.affects.length) {
        const shown = t.affects.slice(0, 4).join(', ');
        const more = t.affects.length > 4 ? c.dim(` +${t.affects.length - 4} more`) : '';
        out.push(`      ${c.dim('↳ affects')} ${shown}${more}`);
      }
    }
  }

  if (d.added.length) {
    out.push('');
    out.push('  ' + c.green(`ADDED  ${d.added.length}`));
    for (const t of d.added) out.push(`    ${t.path.padEnd(26)} ${c.cyan(String(t.value))}`);
  }

  if (d.removed.length) {
    out.push('');
    out.push('  ' + c.red(`REMOVED  ${d.removed.length}`));
    for (const t of d.removed) out.push(`    ${t.path.padEnd(26)} ${c.dim(String(t.value))}`);
  }

  if (d.breaking.length) {
    out.push('');
    out.push('  ' + c.red(c.bold(`✗ BLOCKED — ${d.breaking.length} removed token(s) still referenced`)));
    for (const b of d.breaking) {
      out.push(`    ${c.red(b.path)} ${c.dim('is gone but referenced by')} ${b.stillReferenced.join(', ')}`);
    }
    out.push('');
    out.push('  ' + c.dim('Restore it in Figma, or update tokens/semantic.json, then re-run.'));
    out.push('  ' + c.dim('Nothing was written.'));
  }

  out.push('');
  return out.join('\n');
}
