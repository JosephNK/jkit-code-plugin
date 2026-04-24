// =============================================================================
// Shared helpers for jkit gen-*.mjs scripts.
//
// Import from any gen-*.mjs:
//
//   import { normalizePath, ensureGitRepo } from './common.mjs';
//
// Provides:
//   normalizePath(p)              → returns absolute path (path must exist)
//   ensureGitRepo(p)              → throws if <p> is not a git repo root
//   ensureFlutterRoot(root, entry)→ throws unless <root>/<entry>/pubspec.yaml exists
//   setDep(dev, name, version)    → upsert a devDep and return a log line
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';

export function normalizePath(p) {
  if (!p) throw new Error('normalizePath requires a path');
  if (!fs.existsSync(p)) {
    throw new Error(`path does not exist: ${p}`);
  }
  // Mirror bash `(cd "$p" && pwd)`: use the shell's logical cwd (PWD) so that
  // symlinked roots like macOS /tmp stay as /tmp instead of /private/tmp.
  const base = process.env.PWD || process.cwd();
  return path.isAbsolute(p) ? path.normalize(p) : path.resolve(base, p);
}

// Fail unless <p> is the top level of a git repository, i.e. <p>/.git exists
// (directory or file, the latter for worktrees/submodules).
// We deliberately do not treat "inside a git work tree" as sufficient — the
// guardrail's purpose is to reject cases like running from `app/` when the
// script should run at the repo root.
export function ensureGitRepo(p = '.') {
  if (!fs.existsSync(p)) {
    throw new Error(`path does not exist: ${p}`);
  }
  if (!fs.existsSync(path.join(p, '.git'))) {
    const msg = [
      `${p} is not a git repository root (missing ${p}/.git)`,
      'Hint: pass -p <project-root> or cd into the project root first.',
    ].join('\n');
    throw new Error(msg);
  }
}

// Upsert `name` → `version` in a devDependencies-like object.
// Returns a one-line log string describing what changed:
//   "  Added:     X -> 1.0.0"
//   "  Updated:   X 1.0.0 -> 2.0.0"
//   "  Unchanged: X (1.0.0)"
// The caller is responsible for sorting keys and writing the JSON back.
export function setDep(dev, name, version) {
  const old = dev[name];
  dev[name] = version;
  if (old === version) {
    return `  Unchanged: ${name} (${version})`;
  }
  if (old) {
    return `  Updated:   ${name} ${old} -> ${version}`;
  }
  return `  Added:     ${name} -> ${version}`;
}

export function ensureFlutterRoot(root, entry) {
  if (!root) throw new Error('ensureFlutterRoot requires a project root');
  if (!entry) throw new Error('ensureFlutterRoot requires an entry dir');
  const pubspec = path.join(root, entry, 'pubspec.yaml');
  if (!fs.existsSync(pubspec)) {
    const msg = [
      `${root} is not a Flutter project root (missing ${entry}/pubspec.yaml)`,
      "Hint: pass -p <project-root> (and -entry <dir> if different from 'app').",
    ].join('\n');
    throw new Error(msg);
  }
}
