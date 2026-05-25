#!/usr/bin/env node
// =============================================================================
// Copies rules/<framework>/base/prettier.template.mjs to
// <output-dir>/prettier.config.mjs and patches <output-dir>/package.json:
//   - devDependencies: prettier (+ prettier-plugin-tailwindcss for nextjs)
//   - scripts.format
//   - lint-staged glob for code (TS/JS) — merged after `eslint --fix`
//   - lint-staged glob for data (JSON/MD/YAML)
//
// Note: CSS/SCSS는 stylelint가 담당하므로 prettier glob에서 제외.
//
// Usage:
//   gen-prettier.mjs <framework> -p <output-dir>
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { patchLintStaged, setDep } from "../common.mjs";

const HELP = `Usage: gen-prettier.mjs <framework> -p <output-dir>

Copies the framework's prettier template to <output-dir>/prettier.config.mjs
and patches <output-dir>/package.json with:
  - devDependencies: prettier (+ prettier-plugin-tailwindcss for nextjs)
  - scripts.format
  - lint-staged TS/JS glob (merged after eslint --fix)
  - lint-staged JSON/MD/YAML glob

Arguments:
  <framework>    Framework name (e.g. nextjs, nestjs)

Options:
  -p <dir>       Output directory (required)
  -h, --help     Show this help

Examples:
  ./scripts/typescript/gen-prettier.mjs nextjs -p ./my-project
  ./scripts/typescript/gen-prettier.mjs nestjs -p ./my-project
`;

// Pinned versions — bump together when needed.
const PRETTIER_VERSION = "^3.6.2";
const PRETTIER_PLUGIN_TAILWINDCSS_VERSION = "^0.6.14";

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { framework: "", outputDir: "" };
  const rest = argv.slice(2);

  if (rest.length >= 1 && !rest[0].startsWith("-")) {
    args.framework = rest.shift();
  }

  while (rest.length > 0) {
    const a = rest.shift();
    switch (a) {
      case "-p":
        if (!rest.length) {
          process.stderr.write("-p requires a directory\n");
          usage();
        }
        args.outputDir = rest.shift();
        break;
      case "-h":
      case "--help":
        usage(0);
        break;
      default:
        process.stderr.write(`Unknown option: ${a}\n`);
        usage();
    }
  }

  if (!args.framework) {
    process.stderr.write("Error: framework is required\n");
    usage();
  }
  if (!args.outputDir) {
    process.stderr.write("Error: -p <output-dir> is required\n");
    usage();
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv);

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const pluginRoot = path.resolve(scriptDir, "..", "..");
  const rulesDir = path.join(pluginRoot, "rules", args.framework);
  const template = path.join(rulesDir, "base", "prettier.template.mjs");

  if (!fs.existsSync(template)) {
    process.stderr.write(`Error: Prettier template not found: ${template}\n`);
    process.exit(1);
  }

  fs.mkdirSync(args.outputDir, { recursive: true });
  const outputFile = path.join(args.outputDir, "prettier.config.mjs");
  fs.copyFileSync(template, outputFile);
  process.stdout.write(`Generated: ${outputFile}\n`);

  const userPkgPath = path.join(args.outputDir, "package.json");
  if (!fs.existsSync(userPkgPath)) {
    process.stderr.write(`Error: package.json not found at ${userPkgPath}\n`);
    process.stderr.write(
      "Hint: run gen-eslint.mjs first (which ensures package.json exists).\n",
    );
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(userPkgPath, "utf8"));

  // ── devDependencies ─────────────────────────────────────────────────────
  const dev = pkg.devDependencies || {};
  const devChanges = [];
  devChanges.push(setDep(dev, "prettier", PRETTIER_VERSION));
  if (args.framework === "nextjs") {
    devChanges.push(
      setDep(
        dev,
        "prettier-plugin-tailwindcss",
        PRETTIER_PLUGIN_TAILWINDCSS_VERSION,
      ),
    );
  }

  const sortedDev = {};
  for (const k of Object.keys(dev).sort()) sortedDev[k] = dev[k];
  pkg.devDependencies = sortedDev;

  // ── scripts.format ──────────────────────────────────────────────────────
  const scripts = pkg.scripts || {};
  const formatCmd =
    'prettier --write "**/*.{ts,tsx,js,jsx,mjs,json,md,yml,yaml}"';
  let scriptNote;
  if (!("format" in scripts)) {
    scripts["format"] = formatCmd;
    scriptNote = `  Added:     scripts.format`;
  } else {
    scriptNote = `  Unchanged: scripts.format (already defined)`;
  }
  pkg.scripts = scripts;

  // ── lint-staged ─────────────────────────────────────────────────────────
  // Code files: append after eslint --fix (eslint first, then prettier formats final).
  // Data files: prettier --write only.
  const lintStaged = pkg["lint-staged"] || {};
  const codeNote = patchLintStaged(
    lintStaged,
    "*.{ts,tsx,js,jsx,mjs}",
    "prettier --write",
    "prettier",
  );
  const dataNote = patchLintStaged(
    lintStaged,
    "*.{json,md,yml,yaml}",
    "prettier --write",
    "prettier",
  );
  pkg["lint-staged"] = lintStaged;

  fs.writeFileSync(userPkgPath, JSON.stringify(pkg, null, 2) + "\n");

  for (const line of devChanges) process.stdout.write(line + "\n");
  process.stdout.write(scriptNote + "\n");
  process.stdout.write(codeNote + "\n");
  process.stdout.write(dataNote + "\n");

  process.stdout.write("\n");
  process.stdout.write(
    `Next step: run your package manager install in ${args.outputDir}\n`,
  );
}

main();
