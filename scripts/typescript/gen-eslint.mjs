#!/usr/bin/env node
// =============================================================================
// Generates <output-dir>/eslint.config.mjs from rules/<framework>/base/eslint.template.mjs
// by replacing `// {{MARKER}}` placeholders with concatenated snippets from
// each `--with` stack's eslint.manifest.
//
// Also pins the `@jkit/eslint-rules` git dependency in the user's package.json
// to `v<plugin-version>` (read from .claude-plugin/plugin.json).
//
// Manifest format (plaintext):
//   --- <section> ---
//   <content lines...>
//   --- <next section> ---
//   ...
//
// Section -> marker mapping:
//   import     -> {{STACK_IMPORTS}}
//   restricted -> {{RESTRICTED_PATTERNS}}
//   domain     -> {{DOMAIN_BANNED}}
//   syntax     -> {{RESTRICTED_SYNTAX}}
//   elements   -> {{BOUNDARY_ELEMENTS}}
//   rules      -> {{BOUNDARY_RULES}}
//   patches    -> {{BOUNDARY_PATCHES}}
//   ignores    -> {{BOUNDARY_IGNORES}}
//   framework  -> {{FRAMEWORK_PACKAGES}}
//   infra      -> {{INFRA_PACKAGES}}
//   custom     -> {{CUSTOM_CONFIG}}
//
// Usage:
//   gen-eslint.mjs <framework> -p <output-dir> [--with stack1,stack2,...]
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const HELP = `Usage: gen-eslint.mjs <framework> -p <output-dir> [--with stack1,stack2,...]

Arguments:
  <framework>    Framework name (e.g. nextjs, nestjs)

Options:
  -p <dir>       Output directory (required)
  --with <list>  Comma-separated stacks (e.g. mantine,nextauth,tanstack-query)
  -h, --help     Show this help

Examples:
  ./scripts/typescript/gen-eslint.mjs nextjs -p ./my-project --with mantine,nextauth,tanstack-query
  ./scripts/typescript/gen-eslint.mjs nextjs -p ./my-project
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { framework: '', outputDir: '', stacks: '' };
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
      case '--with':
        if (!rest.length) {
          process.stderr.write('--with requires a stack list\n');
          usage();
        }
        args.stacks = rest.shift();
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

function splitStacks(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Parse a manifest into a map of { section → content }.
// Content is all lines between `--- <section> ---` headers.
function parseManifest(manifestPath) {
  const text = fs.readFileSync(manifestPath, 'utf8');
  const lines = text.split('\n');
  const sections = {};
  let current = null;
  const headerRe = /^--- (.+) ---$/;

  for (const line of lines) {
    const m = line.match(headerRe);
    if (m) {
      current = m[1];
      if (!(current in sections)) sections[current] = [];
      continue;
    }
    if (current !== null) {
      sections[current].push(line);
    }
  }

  return sections;
}

// Marker order matches the bash script's replace_marker invocation order.
const MARKERS = [
  { section: 'import', marker: '// {{STACK_IMPORTS}}' },
  { section: 'restricted', marker: '// {{RESTRICTED_PATTERNS}}' },
  { section: 'domain', marker: '// {{DOMAIN_BANNED}}' },
  { section: 'syntax', marker: '// {{RESTRICTED_SYNTAX}}' },
  { section: 'elements', marker: '// {{BOUNDARY_ELEMENTS}}' },
  { section: 'rules', marker: '// {{BOUNDARY_RULES}}' },
  { section: 'patches', marker: '// {{BOUNDARY_PATCHES}}' },
  { section: 'ignores', marker: '// {{BOUNDARY_IGNORES}}' },
  { section: 'framework', marker: '// {{FRAMEWORK_PACKAGES}}' },
  { section: 'infra', marker: '// {{INFRA_PACKAGES}}' },
  { section: 'custom', marker: '// {{CUSTOM_CONFIG}}' },
];

// Reproduce the bash-side behavior:
// Each invocation reads a `value` (possibly multi-line), drops empty lines
// via `sed '/^$/d'`, then for each line in the current template content:
//   - if the line contains the marker, replace the entire line with the value
//     (trailing newline appended by the loop)
//   - else keep the line
// If the value is empty, the marker line is removed entirely.
//
// The bash loop uses `while read` + `"${content%$'\n'}"`-style trimming and
// appends `$'\n'` after every line, which effectively adds a trailing newline
// to the final output (matched to `echo "$content"` in the writer).
function replaceMarker(content, marker, rawValue) {
  // sed '/^$/d' — strip empty lines from the value.
  const cleaned = rawValue
    .split('\n')
    .filter((line) => line !== '')
    .join('\n');

  const lines = content.split('\n');
  const out = [];

  if (cleaned.length > 0) {
    for (const line of lines) {
      if (line.includes(marker)) {
        out.push(cleaned);
      } else {
        out.push(line);
      }
    }
  } else {
    for (const line of lines) {
      if (!line.includes(marker)) out.push(line);
    }
  }

  return out.join('\n');
}

function main() {
  const args = parseArgs(process.argv);

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const pluginRoot = path.resolve(scriptDir, '..', '..');
  const rulesDir = path.join(pluginRoot, 'rules', args.framework);
  const template = path.join(rulesDir, 'base', 'eslint.template.mjs');

  if (!fs.existsSync(template)) {
    process.stderr.write(`Error: Template not found: ${template}\n`);
    process.exit(1);
  }

  // Collect snippets, sorted stack order (matches bash `sort`).
  const stacks = splitStacks(args.stacks).sort();
  const buckets = Object.fromEntries(MARKERS.map((m) => [m.section, '']));

  for (const stack of stacks) {
    const manifest = path.join(rulesDir, stack, 'eslint.manifest');
    if (!fs.existsSync(manifest)) {
      process.stderr.write(
        `Warning: Manifest not found for stack '${stack}': ${manifest}\n`,
      );
      continue;
    }
    const sections = parseManifest(manifest);
    for (const { section } of MARKERS) {
      const raw = sections[section];
      if (!raw) continue;
      // Bash appended `$'\n'` only when the captured content was non-empty,
      // where "content" is the result of awk across all lines after the header
      // until the next one. Any non-empty line survives — match that.
      const nonEmpty = raw.filter((line) => line !== '');
      if (nonEmpty.length === 0) continue;
      // bash path: `section_content=$(parse_section ...)` then
      // `BUCKET="${BUCKET}${section_content}"$'\n'`.
      // `$( ... )` strips trailing newlines; joining non-empty lines with \n
      // reproduces that, then we append a single newline.
      buckets[section] += nonEmpty.join('\n') + '\n';
    }
  }

  // Render template.
  let content = fs.readFileSync(template, 'utf8');
  for (const { section, marker } of MARKERS) {
    content = replaceMarker(content, marker, buckets[section]);
  }

  // Bash script's trailing-blank-line trim + `echo` writer semantics:
  //   while [[ "$content" == *$'\n'$'\n' ]]; do content="${content%$'\n'}"; done
  //   echo "$content" > file      # echo appends exactly one extra \n
  // After the trim, content ends with at most one \n; echo tacks on another.
  while (content.endsWith('\n\n')) {
    content = content.slice(0, -1);
  }
  content += '\n';

  fs.mkdirSync(args.outputDir, { recursive: true });
  const outputFile = path.join(args.outputDir, 'eslint.config.mjs');
  fs.writeFileSync(outputFile, content);
  process.stdout.write(`Generated: ${outputFile}\n`);

  // ── Patch user's package.json with git dependency ───────────────────────
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
      "Hint: run 'npm init -y' in the project root first.\n",
    );
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(userPkgPath, 'utf8'));
  const dev = pkg.devDependencies || {};
  const old = dev['@jkit/eslint-rules'];
  dev['@jkit/eslint-rules'] = gitDep;

  // Sort devDependencies alphabetically to keep diffs minimal.
  const sortedDev = {};
  for (const k of Object.keys(dev).sort()) sortedDev[k] = dev[k];
  pkg.devDependencies = sortedDev;

  fs.writeFileSync(userPkgPath, JSON.stringify(pkg, null, 2) + '\n');

  if (old === gitDep) {
    process.stdout.write(`  Unchanged: @jkit/eslint-rules (${gitDep})\n`);
  } else if (old) {
    process.stdout.write(`  Updated:   @jkit/eslint-rules ${old} → ${gitDep}\n`);
  } else {
    process.stdout.write(`  Added:     @jkit/eslint-rules → ${gitDep}\n`);
  }

  process.stdout.write('\n');
  process.stdout.write(`Next step: run 'npm install' in ${args.outputDir}\n`);
  if (args.stacks) {
    process.stdout.write(`Stacks: ${args.stacks}\n`);
  }
}

main();
