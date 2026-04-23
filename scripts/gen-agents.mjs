#!/usr/bin/env node
// =============================================================================
// Generates AGENTS.md from rules/<framework>/base/agents.template.md and
// creates a CLAUDE.md symlink pointing at it.
//
// Usage:
//   gen-agents.mjs <framework> -p <output-dir> [-n <project-name>] [--docs-dir <dir>]
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { ensureGitRepo, normalizePath } from './common.mjs';

const HELP = `Usage: gen-agents.mjs <framework> -p <output-dir> [-n <project-name>] [--docs-dir <dir>]

Generates AGENTS.md and creates CLAUDE.md symlink.

Arguments:
  <framework>    Framework name (e.g. nextjs, nestjs, flutter)

Options:
  -p <dir>           Output directory (required)
  -n <name>          Project name (default: directory name)
  --docs-dir <dir>   Docs directory prefix for reference paths (default: root)
  -h, --help         Show this help

Examples:
  ./scripts/gen-agents.mjs nextjs -p . -n "My Project"
  ./scripts/gen-agents.mjs nextjs -p . -n "My Project" --docs-dir docs
  ./scripts/gen-agents.mjs nestjs -p .
  ./scripts/gen-agents.mjs flutter -p .
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const args = {
    framework: '',
    outputDir: '',
    projectName: '',
    docsDir: '',
  };
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
      case '-n':
        if (!rest.length) {
          process.stderr.write('-n requires a project name\n');
          usage();
        }
        args.projectName = rest.shift();
        break;
      case '--docs-dir':
        if (!rest.length) {
          process.stderr.write('--docs-dir requires a directory\n');
          usage();
        }
        args.docsDir = rest.shift();
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

function renderTemplate(template, { projectName, docsDir }) {
  return template
    .replaceAll('{{PROJECT_NAME}}', projectName)
    .replaceAll('{{DOCS_DIR}}', docsDir);
}

function writeSymlink(target, linkPath) {
  if (fs.existsSync(linkPath) || fs.lstatSync(linkPath, { throwIfNoEntry: false })) {
    fs.rmSync(linkPath, { force: true });
  }
  fs.symlinkSync(target, linkPath);
}

function main() {
  const args = parseArgs(process.argv);

  // -p must point at a git repo root. AGENTS.md/CLAUDE.md live at the project
  // root — refuse to write them into a subdirectory.
  try {
    ensureGitRepo(args.outputDir);
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }

  let outputDir;
  try {
    outputDir = normalizePath(args.outputDir);
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }

  const docsDir = args.docsDir ? `${args.docsDir.replace(/\/+$/, '')}/` : '';
  const projectName = args.projectName || path.basename(outputDir);

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const pluginRoot = path.resolve(scriptDir, '..');
  const templatePath = path.join(
    pluginRoot,
    'rules',
    args.framework,
    'base',
    'agents.template.md',
  );

  if (!fs.existsSync(templatePath)) {
    process.stderr.write(`Error: Template not found: ${templatePath}\n`);
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const outputFile = path.join(outputDir, 'AGENTS.md');
  const template = fs.readFileSync(templatePath, 'utf8');
  const rendered = renderTemplate(template, { projectName, docsDir });
  fs.writeFileSync(outputFile, rendered);

  const symlink = path.join(outputDir, 'CLAUDE.md');
  writeSymlink('AGENTS.md', symlink);

  process.stdout.write(`Generated: ${outputFile}\n`);
  process.stdout.write(`Symlink: ${symlink} -> AGENTS.md\n`);
}

main();
