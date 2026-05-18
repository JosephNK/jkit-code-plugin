#!/usr/bin/env node
// =============================================================================
// Next.js OpenAPI Code Generator
// -----------------------------------------------------------------------------
// Reads an OpenAPI 3.x spec and emits:
//   - <project-root>/src/http/_generated/types.ts      DTO interfaces (components/schemas)
//   - <project-root>/src/http/_generated/endpoints.ts  URL helpers (paths)
//
// Both files are overwritten on every run. client.ts (src/http/) and per-feature
// mapper.ts / repository.ts / hook.ts (src/http/<feature>/) are user-authored
// and never touched by this script.
//
// Usage:
//   node scripts/nextjs/openapi/generate-api.mjs <spec> [--dry-run]
//
// <spec> is a file path or HTTP(S) URL. URL specs are saved to
// <project-root>/specs/openapi.{yaml,json} for VCS tracking.
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import YAML from 'yaml';

// ─── CLI ────────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`Usage: generate-api.mjs <spec> [--dry-run]

Arguments:
  <spec>        OpenAPI 3.x spec file path or URL

Options:
  --dry-run     Preview only — no files written
  -h, --help    Show this help
`);
}

function fail(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { spec: null, dryRun: false };
  for (const a of argv.slice(2)) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '-h' || a === '--help') {
      printHelp();
      process.exit(0);
    } else if (a.startsWith('-')) {
      fail(`unknown option: ${a}`);
    } else if (!args.spec) {
      args.spec = a;
    } else {
      fail(`unexpected argument: ${a}`);
    }
  }
  if (!args.spec) {
    printHelp();
    process.exit(1);
  }
  return args;
}

// ─── Spec loading ───────────────────────────────────────────────────────────

function isUrl(s) {
  return s.startsWith('http://') || s.startsWith('https://');
}

async function loadSpec(specArg, projectRoot) {
  let text;
  let source;
  if (isUrl(specArg)) {
    let res;
    try {
      res = await fetch(specArg, {
        headers: { Accept: 'application/json, application/yaml, text/yaml' },
        signal: AbortSignal.timeout(30000),
      });
    } catch (e) {
      fail(`fetch failed: ${e.message}`);
    }
    if (!res.ok) fail(`fetch failed: HTTP ${res.status} ${res.statusText}`);
    text = await res.text();
    const trimmed = text.trim();
    const isJson = trimmed.startsWith('{') || trimmed.startsWith('[');
    const ext = isJson ? 'json' : 'yaml';
    const specsDir = path.join(projectRoot, 'specs');
    fs.mkdirSync(specsDir, { recursive: true });
    source = path.join(specsDir, `openapi.${ext}`);
    fs.writeFileSync(source, text);
    console.log(`Saved spec: ${path.relative(projectRoot, source)}`);
  } else {
    source = path.resolve(specArg);
    if (!fs.existsSync(source)) fail(`spec not found: ${specArg}`);
    text = fs.readFileSync(source, 'utf8');
  }

  let spec;
  try {
    spec = source.endsWith('.json') ? JSON.parse(text) : YAML.parse(text);
  } catch (e) {
    fail(`failed to parse spec: ${e.message}`);
  }
  if (!spec || typeof spec !== 'object') fail('spec is empty or invalid');
  return { spec, source };
}

function validateOpenApi(spec) {
  if (
    !spec.openapi ||
    typeof spec.openapi !== 'string' ||
    !spec.openapi.startsWith('3.')
  ) {
    fail(`only OpenAPI 3.x is supported (found: ${spec.openapi ?? 'none'})`);
  }
}

// ─── Naming utils ───────────────────────────────────────────────────────────

function toPascalCase(s) {
  return String(s)
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^[^a-zA-Z0-9]+/, '')
    .replace(/^(.)/, (_, c) => c.toUpperCase());
}

function toCamelCase(s) {
  const p = toPascalCase(s);
  return p ? p[0].toLowerCase() + p.slice(1) : '';
}

function dtoName(schemaName) {
  const pascal = toPascalCase(schemaName);
  return pascal.endsWith('Dto') ? pascal : `${pascal}Dto`;
}

function refName(ref) {
  if (typeof ref !== 'string') return null;
  const m = ref.match(/^#\/components\/schemas\/(.+)$/);
  return m ? dtoName(m[1]) : null;
}

function isSafeIdent(s) {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(s);
}

function escapeSingle(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ─── Schema → TS type ───────────────────────────────────────────────────────

function renderType(schema) {
  if (!schema || typeof schema !== 'object') return 'unknown';

  if (schema.$ref) {
    return refName(schema.$ref) || 'unknown';
  }

  // OpenAPI 3.1: `type` can be an array including 'null'
  let baseType = schema.type;
  let nullableFromTypeArray = false;
  if (Array.isArray(baseType)) {
    const filtered = baseType.filter((t) => t !== 'null');
    nullableFromTypeArray = filtered.length !== baseType.length;
    baseType = filtered.length === 1 ? filtered[0] : filtered.length === 0 ? undefined : filtered;
  }
  const nullable = Boolean(schema.nullable) || nullableFromTypeArray;

  // oneOf / anyOf → union
  if (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf)) {
    const variants = (schema.oneOf || schema.anyOf).map((s) => renderType(s));
    return wrapNullable(unionOf(variants), nullable);
  }

  // allOf → intersection
  if (Array.isArray(schema.allOf)) {
    const parts = schema.allOf.map((s) => renderType(s)).filter(Boolean);
    const intersection = parts.length === 0 ? 'unknown' : parts.length === 1 ? parts[0] : parts.join(' & ');
    return wrapNullable(intersection, nullable);
  }

  // enum
  if (Array.isArray(schema.enum)) {
    const lits = schema.enum.map((v) =>
      typeof v === 'string' ? `'${escapeSingle(v)}'` : JSON.stringify(v),
    );
    return wrapNullable(unionOf(lits) || 'never', nullable);
  }

  let ts;
  switch (baseType) {
    case 'string':
      ts = 'string';
      break;
    case 'integer':
    case 'number':
      ts = 'number';
      break;
    case 'boolean':
      ts = 'boolean';
      break;
    case 'array': {
      const item = renderType(schema.items || {});
      ts = needsParensForArray(item) ? `(${item})[]` : `${item}[]`;
      break;
    }
    case 'object': {
      if (schema.properties) {
        ts = renderInlineObject(schema);
      } else if (schema.additionalProperties !== undefined && schema.additionalProperties !== false) {
        const v =
          schema.additionalProperties === true
            ? 'unknown'
            : renderType(schema.additionalProperties);
        ts = `Record<string, ${v}>`;
      } else {
        ts = 'Record<string, unknown>';
      }
      break;
    }
    default:
      ts = 'unknown';
  }
  return wrapNullable(ts, nullable);
}

function unionOf(parts) {
  const uniq = [...new Set(parts.filter(Boolean))];
  if (uniq.length === 0) return 'unknown';
  return uniq.length === 1 ? uniq[0] : uniq.join(' | ');
}

function wrapNullable(ts, nullable) {
  if (!nullable) return ts;
  if (ts === 'unknown' || ts === 'null' || ts === 'never') return ts;
  return `${ts} | null`;
}

function needsParensForArray(t) {
  return t.includes('|') || t.includes('&');
}

function renderInlineObject(schema) {
  const props = schema.properties || {};
  const required = new Set(schema.required || []);
  const entries = Object.entries(props);
  if (entries.length === 0) return 'Record<string, unknown>';
  const lines = ['{'];
  for (const [name, prop] of entries) {
    const optional = required.has(name) ? '' : '?';
    const ty = renderType(prop);
    const safe = isSafeIdent(name) ? name : `'${escapeSingle(name)}'`;
    lines.push(`  ${safe}${optional}: ${ty};`);
  }
  lines.push('}');
  return lines.join('\n');
}

// ─── Top-level schema rendering ─────────────────────────────────────────────

function renderTopLevelSchema(name, schema) {
  const tn = dtoName(name);

  // Pure enum → `export type`
  if (
    Array.isArray(schema.enum) &&
    !schema.properties &&
    !schema.oneOf &&
    !schema.anyOf &&
    !schema.allOf
  ) {
    return { code: `export type ${tn} = ${renderType(schema)};` };
  }

  // Object with properties → `export interface`
  if (
    (schema.type === 'object' || (!schema.type && schema.properties)) &&
    schema.properties &&
    !schema.oneOf &&
    !schema.anyOf &&
    !schema.allOf
  ) {
    const required = new Set(schema.required || []);
    const lines = [`export interface ${tn} {`];
    for (const [pname, prop] of Object.entries(schema.properties)) {
      const optional = required.has(pname) ? '' : '?';
      const ty = indentNested(renderType(prop), 2);
      const safe = isSafeIdent(pname) ? pname : `'${escapeSingle(pname)}'`;
      lines.push(`  ${safe}${optional}: ${ty};`);
    }
    lines.push('}');
    return { code: lines.join('\n') };
  }

  // Everything else (oneOf/anyOf/allOf/scalar/array at top level) → `export type`
  return { code: `export type ${tn} = ${indentNested(renderType(schema), 0)};` };
}

function indentNested(ts, spaces) {
  if (!ts.includes('\n')) return ts;
  const pad = ' '.repeat(spaces);
  return ts
    .split('\n')
    .map((line, i) => (i === 0 ? line : pad + line))
    .join('\n');
}

// ─── Endpoints rendering ────────────────────────────────────────────────────

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];

function collectOperations(paths) {
  const ops = [];
  for (const [pathStr, pathItem] of Object.entries(paths || {})) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (!op || typeof op !== 'object') continue;
      ops.push({ path: pathStr, method, op, pathItem });
    }
  }
  return ops;
}

function deriveOpName(op, method, pathStr, used) {
  let name;
  if (op.operationId && typeof op.operationId === 'string') {
    name = toCamelCase(op.operationId);
  } else {
    const pathPascal = pathStr
      .split('/')
      .filter(Boolean)
      .map((seg) => toPascalCase(seg.replace(/[{}]/g, '')))
      .join('');
    name = `${method.toLowerCase()}${pathPascal}` || method.toLowerCase();
  }
  if (!name) name = method.toLowerCase();
  let unique = name;
  let i = 2;
  while (used.has(unique)) unique = `${name}${i++}`;
  used.add(unique);
  return unique;
}

function extractPathParams(pathStr, op, pathItem) {
  const names = [...pathStr.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
  const paramDefs = [...(pathItem.parameters || []), ...(op.parameters || [])];
  return names.map((n) => {
    const def = paramDefs.find((p) => p && p.in === 'path' && p.name === n);
    let ty = 'string';
    if (def && def.schema) {
      const rendered = renderType(def.schema);
      if (rendered === 'number' || rendered === 'string' || rendered === 'boolean') {
        ty = rendered;
      }
    }
    return { name: isSafeIdent(n) ? n : `_${n.replace(/[^a-zA-Z0-9]/g, '_')}`, type: ty };
  });
}

function renderEndpoint({ path: pathStr, method, op, pathItem }, used) {
  const opName = deriveOpName(op, method, pathStr, used);
  const params = extractPathParams(pathStr, op, pathItem);
  const args = params.map((p) => `${p.name}: ${p.type}`).join(', ');
  const template = pathStr.replace(/\{([^}]+)\}/g, (_, n) => {
    const safe = isSafeIdent(n) ? n : `_${n.replace(/[^a-zA-Z0-9]/g, '_')}`;
    return '${' + safe + '}';
  });
  return `  ${opName}: (${args}) => \`${template}\`,`;
}

// ─── File renderers ─────────────────────────────────────────────────────────

const GEN_HEADER = '// GENERATED CODE - DO NOT MODIFY BY HAND\n// Source: jkit nextjs-openapi-gen';

function renderTypesFile(schemas) {
  const entries = Object.entries(schemas);
  if (entries.length === 0) {
    return `${GEN_HEADER}\n\nexport {};\n`;
  }
  const ordered = entries.sort(([a], [b]) => a.localeCompare(b));
  const blocks = ordered.map(([name, schema]) => renderTopLevelSchema(name, schema).code);
  return `${GEN_HEADER}\n\n${blocks.join('\n\n')}\n`;
}

function renderEndpointsFile(operations) {
  if (operations.length === 0) {
    return `${GEN_HEADER}\n\nexport const endpoints = {} as const;\n`;
  }
  const used = new Set();
  const lines = operations.map((o) => renderEndpoint(o, used));
  return `${GEN_HEADER}\n\nexport const endpoints = {\n${lines.join('\n')}\n} as const;\n`;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  const projectRoot = process.cwd();
  const { spec, source } = await loadSpec(args.spec, projectRoot);
  validateOpenApi(spec);

  const schemas = spec.components?.schemas ?? {};
  const operations = collectOperations(spec.paths ?? {});

  const typesContent = renderTypesFile(schemas);
  const endpointsContent = renderEndpointsFile(operations);

  const typesPath = path.join(projectRoot, 'src', 'http', '_generated', 'types.ts');
  const endpointsPath = path.join(projectRoot, 'src', 'http', '_generated', 'endpoints.ts');
  const schemaCount = Object.keys(schemas).length;

  if (args.dryRun) {
    console.log(`[dry-run] would write: ${path.relative(projectRoot, typesPath)} (${schemaCount} schemas)`);
    console.log(`[dry-run] would write: ${path.relative(projectRoot, endpointsPath)} (${operations.length} operations)`);
    console.log(`Spec: ${path.relative(projectRoot, source)}`);
    return;
  }

  fs.mkdirSync(path.dirname(typesPath), { recursive: true });
  fs.writeFileSync(typesPath, typesContent);
  fs.writeFileSync(endpointsPath, endpointsContent);

  console.log(`Generated: ${path.relative(projectRoot, typesPath)} (${schemaCount} schemas)`);
  console.log(`Generated: ${path.relative(projectRoot, endpointsPath)} (${operations.length} operations)`);
  console.log(`Spec: ${path.relative(projectRoot, source)}`);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
