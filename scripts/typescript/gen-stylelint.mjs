#!/usr/bin/env node
// =============================================================================
// Copies rules/<framework>/base/stylelint.template.mjs to
// <output-dir>/stylelint.config.mjs and patches <output-dir>/package.json:
//   - devDependencies: stylelint, stylelint-config-standard,
//     stylelint-declaration-strict-value, @jkit/code-plugin
//   - scripts.lint:css
//   - lint-staged glob for CSS files
//
// Usage:
//   gen-stylelint.mjs <framework> -p <output-dir>
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { setDep } from '../common.mjs';

const HELP = `Usage: gen-stylelint.mjs <framework> -p <output-dir>

Copies the framework's stylelint template to <output-dir>/stylelint.config.mjs
and patches <output-dir>/package.json with:
  - devDependencies: stylelint, stylelint-config-standard, @jkit/code-plugin
  - scripts.lint:css
  - lint-staged glob for CSS files

Arguments:
  <framework>    Framework name (e.g. nextjs)

Options:
  -p <dir>       Output directory (required)
  -h, --help     Show this help

Examples:
  ./scripts/typescript/gen-stylelint.mjs nextjs -p ./my-project
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { framework: '', outputDir: '' };
  const rest = argv.slice(2);

  if (rest.length >= 1 && !rest[0].startsWith('-')) {
    args.framework = rest.shift();
  }

  while (rest.length > 0) {
    const a = rest.shift();
    switch (a) {
      case '-p':
        if (!rest.length) {
          process.stderr.write('-p requires a directory\n');
          usage();
        }
        args.outputDir = rest.shift();
        break;
      case '-h':
      case '--help':
        usage(0);
        break;
      default:
        process.stderr.write(`Unknown option: ${a}\n`);
        usage();
    }
  }

  if (!args.framework) {
    process.stderr.write('Error: framework is required\n');
    usage();
  }
  if (!args.outputDir) {
    process.stderr.write('Error: -p <output-dir> is required\n');
    usage();
  }

  return args;
}

// Repr a JS string the way Python's `repr()` of a str does:
//   'x' -> "'x'",  with embedded ' escaped as \'.
function pyReprStr(s) {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function patchLintStaged(lintStaged, lintGlob, lintCmd) {
  const existing = lintStaged[lintGlob];
  if (existing === undefined) {
    lintStaged[lintGlob] = lintCmd;
    return `  Added:     lint-staged[${pyReprStr(lintGlob)}]`;
  }
  if (typeof existing === 'string') {
    if (existing.includes('stylelint')) {
      return `  Unchanged: lint-staged[${pyReprStr(lintGlob)}] (stylelint already wired)`;
    }
    lintStaged[lintGlob] = [existing, lintCmd];
    return `  Merged:    lint-staged[${pyReprStr(lintGlob)}] with existing command`;
  }
  if (Array.isArray(existing)) {
    if (existing.some((cmd) => typeof cmd === 'string' && cmd.includes('stylelint'))) {
      return `  Unchanged: lint-staged[${pyReprStr(lintGlob)}] (stylelint already wired)`;
    }
    lintStaged[lintGlob] = [...existing, lintCmd];
    return `  Appended:  lint-staged[${pyReprStr(lintGlob)}]`;
  }
  return `  Skipped:   lint-staged[${pyReprStr(lintGlob)}] (unexpected type: ${typeof existing})`;
}

function main() {
  const args = parseArgs(process.argv);

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const pluginRoot = path.resolve(scriptDir, '..', '..');
  const rulesDir = path.join(pluginRoot, 'rules', args.framework);
  const template = path.join(rulesDir, 'base', 'stylelint.template.mjs');

  if (!fs.existsSync(template)) {
    process.stderr.write(`Error: Stylelint template not found: ${template}\n`);
    process.exit(1);
  }

  // Copy template to stylelint.config.mjs.
  fs.mkdirSync(args.outputDir, { recursive: true });
  const outputFile = path.join(args.outputDir, 'stylelint.config.mjs');
  fs.copyFileSync(template, outputFile);
  process.stdout.write(`Generated: ${outputFile}\n`);

  // Resolve plugin version.
  const pluginJson = path.join(pluginRoot, '.claude-plugin', 'plugin.json');
  if (!fs.existsSync(pluginJson)) {
    process.stderr.write(`Error: plugin.json not found at ${pluginJson}\n`);
    process.exit(1);
  }
  const pluginMeta = JSON.parse(fs.readFileSync(pluginJson, 'utf8'));
  if (!pluginMeta.version) {
    process.stderr.write(`Error: version missing in ${pluginJson}\n`);
    process.exit(1);
  }
  const gitDep = `github:JosephNK/jkit-code-plugin#v${pluginMeta.version}`;

  const userPkgPath = path.join(args.outputDir, 'package.json');
  if (!fs.existsSync(userPkgPath)) {
    process.stderr.write(`Error: package.json not found at ${userPkgPath}\n`);
    process.stderr.write(
      'Hint: run gen-eslint.mjs first (which ensures package.json exists).\n',
    );
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(userPkgPath, 'utf8'));

  // ── devDependencies ─────────────────────────────────────────────────────
  const dev = pkg.devDependencies || {};
  const devChanges = [];
  // stylelint 16.x (Node 18+) — stylelint-config-standard 36.x is 16-compatible.
  devChanges.push(setDep(dev, 'stylelint', '^16.0.0'));
  devChanges.push(setDep(dev, 'stylelint-config-standard', '^36.0.0'));
  // Enforces token usage (stylelint.rules.mjs uses scale-unlimited/declaration-strict-value).
  devChanges.push(setDep(dev, 'stylelint-declaration-strict-value', '^1.10.0'));
  // gen-eslint.mjs already pins @jkit/code-plugin; re-sync here for idempotency.
  devChanges.push(setDep(dev, '@jkit/code-plugin', gitDep));

  const sortedDev = {};
  for (const k of Object.keys(dev).sort()) sortedDev[k] = dev[k];
  pkg.devDependencies = sortedDev;

  // ── scripts.lint:css ────────────────────────────────────────────────────
  const scripts = pkg.scripts || {};
  const cssGlob = '**/*.{css,scss}';
  const cssCmd = `stylelint "${cssGlob}" --fix`;
  let scriptNote;
  if (!('lint:css' in scripts)) {
    scripts['lint:css'] = cssCmd;
    scriptNote = `  Added:     scripts.lint:css`;
  } else {
    scriptNote = `  Unchanged: scripts.lint:css (already defined)`;
  }
  pkg.scripts = scripts;

  // ── lint-staged ─────────────────────────────────────────────────────────
  const lintStaged = pkg['lint-staged'] || {};
  const lintGlob = '*.{css,scss}';
  const lintCmd = 'stylelint --fix';
  const lsNote = patchLintStaged(lintStaged, lintGlob, lintCmd);
  pkg['lint-staged'] = lintStaged;

  fs.writeFileSync(userPkgPath, JSON.stringify(pkg, null, 2) + '\n');

  for (const line of devChanges) process.stdout.write(line + '\n');
  process.stdout.write(scriptNote + '\n');
  process.stdout.write(lsNote + '\n');

  process.stdout.write('\n');
  process.stdout.write(`Next step: run your package manager install in ${args.outputDir}\n`);
}

main();
