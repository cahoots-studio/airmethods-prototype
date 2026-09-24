#!/usr/bin/env node
/**
 * npm run sync [-- --theme=cahoots] [--yes] [--no-deploy]
 *
 *   1. normalise tokens/.figma-raw.json into a candidate token set (temp)
 *   2. diff against the committed set, with blast radius
 *   3. block on breaking removals — nothing is written
 *   4. on confirm: write, rebuild all targets, deploy a preview
 *
 * Nothing is overwritten before you have seen what changes. That is the whole
 * point of this script; the rest is plumbing.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, copyFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import { TOKENS_DIR, loadRawMerged, resolveMap, listThemes } from './lib/tokens.mjs';
import { normalizeFigmaDump } from './lib/figma.mjs';
import { diffTokens, formatDiff } from './lib/diff.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const RAW = join(TOKENS_DIR, '.figma-raw.json');
const TMP = join(ROOT, '.sync-tmp');

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => (args.find((a) => a.startsWith(`--${n}=`)) ?? `=${d}`).split('=')[1];

const theme = opt('theme', listThemes()[0] ?? 'cahoots');
const autoYes = flag('yes') || flag('y');
const skipDeploy = flag('no-deploy');

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;

function fail(msg, hint) {
  console.error('\n' + red('✗ ') + msg);
  if (hint) console.error(dim('  ' + hint));
  console.error('');
  process.exit(1);
}

// ---- 1. normalise into a candidate set ------------------------------------

if (!existsSync(RAW)) {
  fail(
    'tokens/.figma-raw.json not found.',
    'In Claude Code: call the Figma MCP get_variable_defs tool on the Supercomponent\n' +
      '  library file and save the raw result to tokens/.figma-raw.json, then re-run.'
  );
}

let dump;
try {
  // Pass the current token set so units and float precision are restored from
  // what is already committed rather than guessed.
  const current = loadRawMerged(theme, TOKENS_DIR);
  dump = normalizeFigmaDump(JSON.parse(readFileSync(RAW, 'utf8')), current);
} catch (err) {
  fail(`Could not read the Figma dump — ${err.message}`);
}

// Two different Figma names collapsing to one token path would silently drop a
// variable. Refuse rather than write a half-set.
if (dump.collisions?.length) {
  console.error('\n' + red(`✗ ${dump.collisions.length} naming collision(s) — two Figma variables normalise to the same token:`));
  for (const c of dump.collisions) {
    console.error(`    ${c.names[0]}`);
    console.error(`    ${c.names[1]}`);
    console.error(dim(`      both -> ${c.path}`));
  }
  fail('Rename one of each pair in Figma, then re-run.', 'Nothing was written.');
}

if (dump.skipped.length) {
  const collections = [...new Set(dump.skipped.map((s) => s.split('/')[0]))];
  console.log(
    '\n' + dim(`  ⚠ ${dump.skipped.length} variable(s) skipped — collections: ${collections.join(', ')}`)
  );
  console.log(dim('    Rename them to Primitive / Brand / UI + Spacing in Figma to include them.'));
}

rmSync(TMP, { recursive: true, force: true });
mkdirSync(join(TMP, 'themes'), { recursive: true });

const keep = (file, tree, extra = {}) => {
  const current = existsSync(join(TOKENS_DIR, file))
    ? JSON.parse(readFileSync(join(TOKENS_DIR, file), 'utf8'))
    : {};
  const merged = Object.keys(tree).length
    ? { $description: current.$description, ...extra, ...tree }
    : current;
  writeFileSync(join(TMP, file), JSON.stringify(merged, null, 2) + '\n');
};

keep('primitive.json', dump.primitive);
keep(`themes/${theme}.json`, dump.brand, { $theme: theme });
keep('semantic.json', dump.semantic);
// Repo-native tokens never come from Figma.
for (const f of ['motion.json', 'repo-native.json', 'textstyles.json']) {
  if (existsSync(join(TOKENS_DIR, f))) copyFileSync(join(TOKENS_DIR, f), join(TMP, f));
}
// Build schemes.json from Figma Color Schemes collection, or copy through.
if (dump.schemes) {
  const existingSchemes = existsSync(join(TOKENS_DIR, 'schemes.json'))
    ? JSON.parse(readFileSync(join(TOKENS_DIR, 'schemes.json'), 'utf8'))
    : {};
  const newSchemes = {
    $description: existingSchemes.$description ?? 'Colour schemes.',
    $default: existingSchemes.$default ?? 'scheme-1',
    $defaultMode: existingSchemes.$defaultMode ?? 'light',
    $modes: dump.schemes.modes,
    $roles: dump.schemes.roles,
    $global: existingSchemes.$global ?? {},
    schemes: {},
  };
  for (const [name, modeData] of Object.entries(dump.schemes.schemes)) {
    const existing = existingSchemes.schemes?.[name] ?? {};
    newSchemes.schemes[name] = {
      ...(existing.$label ? { $label: existing.$label } : {}),
      ...(existing.$note ? { $note: existing.$note } : {}),
      ...modeData,
    };
  }
  writeFileSync(join(TMP, 'schemes.json'), JSON.stringify(newSchemes, null, 2) + '\n');
} else if (existsSync(join(TOKENS_DIR, 'schemes.json'))) {
  copyFileSync(join(TOKENS_DIR, 'schemes.json'), join(TMP, 'schemes.json'));
}

// ---- 2. diff ---------------------------------------------------------------

let before, after, resolvedBefore, resolvedAfter;
try {
  before = loadRawMerged(theme, TOKENS_DIR);
  resolvedBefore = resolveMap(before);
} catch (err) {
  fail(`The committed token set does not resolve — ${err.message}`, 'Fix tokens/ before syncing.');
}
try {
  after = loadRawMerged(theme, TMP + '/');
} catch (err) {
  fail(`The pulled token set could not be read — ${err.message}`);
}
try {
  resolvedAfter = resolveMap(after);
} catch (err) {
  // Dangling aliases are reported by the diff below in a far more useful form.
  resolvedAfter = {};
}

const d = diffTokens(before, after, resolvedBefore, resolvedAfter);
console.log(formatDiff(d, { theme }));

if (d.breaking.length) {
  rmSync(TMP, { recursive: true, force: true });
  process.exit(1);
}

if (d.clean) {
  rmSync(TMP, { recursive: true, force: true });
  console.log(dim('  Rebuilding anyway to be sure dist/ is current…\n'));
  run('npm run tokens:build');
  process.exit(0);
}

// ---- 3. confirm ------------------------------------------------------------

if (!autoYes && !stdin.isTTY) {
  rmSync(TMP, { recursive: true, force: true });
  console.log(dim('  Non-interactive shell — nothing written. Re-run with --yes to apply.\n'));
  process.exit(0);
}

if (!autoYes) {
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = (await rl.question(`  Apply to tokens/ and rebuild? ${dim('[y/N]')} `)).trim().toLowerCase();
  rl.close();
  if (answer !== 'y' && answer !== 'yes') {
    rmSync(TMP, { recursive: true, force: true });
    console.log(dim('\n  Cancelled. Nothing written.\n'));
    process.exit(0);
  }
}

// ---- 4. apply, rebuild, deploy --------------------------------------------

function run(cmd, opts = {}) {
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts });
    return true;
  } catch {
    return false;
  }
}

writeFileSync(join(TOKENS_DIR, 'primitive.json'), readFileSync(join(TMP, 'primitive.json')));
writeFileSync(join(TOKENS_DIR, `themes/${theme}.json`), readFileSync(join(TMP, `themes/${theme}.json`)));
writeFileSync(join(TOKENS_DIR, 'semantic.json'), readFileSync(join(TMP, 'semantic.json')));
if (existsSync(join(TMP, 'schemes.json'))) {
  writeFileSync(join(TOKENS_DIR, 'schemes.json'), readFileSync(join(TMP, 'schemes.json')));
}
rmSync(TMP, { recursive: true, force: true });
console.log('\n' + green('✓') + ' tokens/ updated');

if (!run('npm run tokens:build')) fail('Build failed after applying tokens.', 'tokens/ was written — `git diff` to inspect, `git checkout tokens/` to revert.');

if (skipDeploy) {
  console.log(dim('\n  Skipping deploy (--no-deploy).\n'));
  process.exit(0);
}

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
if (!pkg.scripts?.deploy) {
  console.log('\n' + dim('  No `deploy` script configured — build is current but nothing was published.'));
  console.log(dim('  Add one to package.json, e.g.:'));
  console.log(dim('    "deploy": "npx wrangler pages deploy docs --project-name=supercomponent"'));
  console.log('');
  process.exit(0);
}

console.log(dim('\n  Deploying preview…\n'));
if (!run('npm run deploy')) fail('Deploy failed.', 'Tokens and build are current; only publishing failed.');
console.log('\n' + green('✓') + ' synced\n');
