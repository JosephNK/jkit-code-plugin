#!/usr/bin/env node
// =============================================================================
// Scaffold/regenerate `analysis_options.yaml` from jkit templates.
//
// Templates (in this plugin's checkout):
//   rules/flutter/base/templates/analysis-options.workspace-root.yaml
//   rules/flutter/base/templates/analysis-options.workspace-member.yaml
//   rules/flutter/base/templates/analysis-options.standalone.yaml
//
// Workspace mode (root pubspec.yaml has `workspace:` listing the entry):
//   - <projectDir>/analysis_options.yaml      ← workspace-root template
//   - <entry>/analysis_options.yaml           ← workspace-member template
//                                               ({{INCLUDE_PATH}} → relpath
//                                                to root analysis_options.yaml)
//
// Standalone mode:
//   - <entry>/analysis_options.yaml           ← standalone template
//
// Behavior: ALWAYS overwrite. Each scaffolded file starts with the banner
//   `# GENERATED FILE - DO NOT MODIFY BY HAND`
// for visual signaling only — there is no banner-based skip. /jkit:flutter-init
// and /jkit:flutter-sync both regenerate these files unconditionally so that
// template updates (e.g. new lint rules added in a jkit release) propagate.
// If a file did not previously contain the banner (e.g. created by
// `flutter create` or hand-edited), the script logs an INFO line noting the
// content was replaced.
//
// The plugins: section is NOT in any template — it is managed by
// gen-custom-lint.mjs which runs AFTER this script, adding plugins: into the
// scaffolded file via YAML round-trip (preserving template content).
//
// To opt out for a specific project: remove the gen-analysis-options.mjs call
// from your /flutter-init / /flutter-sync command (fork the command file).
//
// Usage:
//   gen-analysis-options.mjs flutter -p <project-dir> [-entry <dir>]
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import YAML from 'yaml';

import { ensureFlutterRoot, normalizePath } from '../common.mjs';

const BANNER_LINE = '# GENERATED FILE - DO NOT MODIFY BY HAND';

const TEMPLATE_REL = {
  workspaceRoot:
    'rules/flutter/base/templates/analysis-options.workspace-root.yaml',
  workspaceMember:
    'rules/flutter/base/templates/analysis-options.workspace-member.yaml',
  standalone: 'rules/flutter/base/templates/analysis-options.standalone.yaml',
};

const HELP = `Usage: gen-analysis-options.mjs flutter -p <project-dir> [-entry <dir>]

Scaffold or regenerate analysis_options.yaml from jkit templates. In a Dart
pub workspace, scaffolds both the workspace root and the entry member. In a
standalone (non-workspace) project, scaffolds only the entry's options.

Existing files are ALWAYS overwritten (the banner is for visual signaling,
not opt-out). The script logs whether the previous content was a jkit-managed
file (banner present) or a user-edited / flutter-create file (banner absent).

The plugins: section is added separately by gen-custom-lint.mjs after this
script runs.

Arguments:
  flutter         Framework name (currently flutter only)

Options:
  -p <dir>        Project root directory (required)
  -entry <dir>    Flutter entry directory (default: app)
  -h, --help      Show this help

Examples:
  ./scripts/flutter/gen-analysis-options.mjs flutter -p .
  ./scripts/flutter/gen-analysis-options.mjs flutter -p . -entry app
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { framework: '', projectDir: '', entry: 'app' };
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
        args.projectDir = rest.shift();
        break;
      case '-entry':
        if (!rest.length) {
          process.stderr.write('-entry requires a directory\n');
          usage();
        }
        args.entry = rest.shift();
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
  if (!args.projectDir) {
    process.stderr.write('Error: -p <project-dir> is required\n');
    usage();
  }

  return args;
}

// Detect whether projectDir is a Dart pub workspace root that includes the
// given entry as a member. (Mirrors gen-custom-lint.mjs's logic.)
function isWorkspaceMember(projectDir, entry) {
  const rootPubspec = path.join(projectDir, 'pubspec.yaml');
  if (!fs.existsSync(rootPubspec) || !fs.statSync(rootPubspec).isFile()) {
    return false;
  }
  let doc;
  try {
    doc = YAML.parseDocument(fs.readFileSync(rootPubspec, 'utf-8'));
  } catch {
    return false;
  }
  const ws = doc.get('workspace');
  if (!YAML.isSeq(ws)) return false;
  const entries = ws.toJSON().map((s) => String(s).replace(/\/+$/, ''));
  return entries.includes(entry.replace(/\/+$/, ''));
}

function hasBanner(content) {
  return content.trimStart().startsWith(BANNER_LINE);
}

function loadTemplate(templateAbsPath, vars = {}) {
  let content = fs.readFileSync(templateAbsPath, 'utf-8');
  for (const [key, value] of Object.entries(vars)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }
  return content;
}

// Returns true on success (write or up-to-date) — false on hard error.
// Always overwrites: the banner is for user signaling, not opt-out.
function scaffoldFile(targetAbsPath, templateContent, label) {
  const exists =
    fs.existsSync(targetAbsPath) && fs.statSync(targetAbsPath).isFile();

  let priorWasNonBanner = false;
  if (exists) {
    const current = fs.readFileSync(targetAbsPath, 'utf-8');
    if (current === templateContent) {
      process.stdout.write(`  ${label} already up-to-date (${targetAbsPath})\n`);
      return true;
    }
    priorWasNonBanner = !hasBanner(current);
  }

  const targetDir = path.dirname(targetAbsPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  fs.writeFileSync(targetAbsPath, templateContent);

  if (priorWasNonBanner) {
    process.stdout.write(
      `  Replaced ${label} (${targetAbsPath}) — prior content lacked the ` +
        `GENERATED banner (recover via git history if needed)\n`,
    );
  } else {
    process.stdout.write(
      `  ${exists ? 'Regenerated' : 'Created'} ${label} (${targetAbsPath})\n`,
    );
  }
  return true;
}

function main() {
  const args = parseArgs(process.argv);

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const pluginRoot = path.resolve(scriptDir, '..', '..');

  try {
    ensureFlutterRoot(args.projectDir, args.entry);
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }

  let projectDir;
  try {
    projectDir = normalizePath(args.projectDir);
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }

  const inWorkspace = isWorkspaceMember(projectDir, args.entry);
  process.stdout.write(
    `Scaffolding analysis_options.yaml from jkit templates ` +
      `(${inWorkspace ? 'workspace' : 'standalone'} mode)...\n`,
  );

  let ok = true;

  if (inWorkspace) {
    const rootTplPath = path.join(pluginRoot, TEMPLATE_REL.workspaceRoot);
    const rootTplContent = loadTemplate(rootTplPath);
    ok =
      scaffoldFile(
        path.join(projectDir, 'analysis_options.yaml'),
        rootTplContent,
        'workspace root',
      ) && ok;

    const memberPath = path.join(projectDir, args.entry, 'analysis_options.yaml');
    const includePathOs = path.relative(
      path.dirname(memberPath),
      path.join(projectDir, 'analysis_options.yaml'),
    );
    const includePath = includePathOs.split(path.sep).join('/');
    const memberTplPath = path.join(pluginRoot, TEMPLATE_REL.workspaceMember);
    const memberTplContent = loadTemplate(memberTplPath, {
      INCLUDE_PATH: includePath,
    });
    ok =
      scaffoldFile(
        memberPath,
        memberTplContent,
        `workspace member (entry=${args.entry})`,
      ) && ok;
  } else {
    const standaloneTplPath = path.join(pluginRoot, TEMPLATE_REL.standalone);
    const standaloneTplContent = loadTemplate(standaloneTplPath);
    ok =
      scaffoldFile(
        path.join(projectDir, args.entry, 'analysis_options.yaml'),
        standaloneTplContent,
        `standalone (entry=${args.entry})`,
      ) && ok;
  }

  if (ok) {
    process.stdout.write(
      'Done. Run gen-custom-lint.mjs next to add the plugins: section.\n',
    );
  } else {
    process.stderr.write('Completed with errors.\n');
  }

  process.exit(ok ? 0 : 1);
}

main();
