#!/usr/bin/env node
// =============================================================================
// Next.js OpenAPI Code Generator
// -----------------------------------------------------------------------------
// Reads an OpenAPI 3.x spec and emits:
//   - <project-root>/src/http/_generated/types.ts        DTO interfaces (components/schemas)
//   - <project-root>/src/http/_generated/endpoints.ts    URL helpers (paths)
//   - <project-root>/src/http/_generated/services/*.ts   tag별 API 서비스 클래스
//
// Generated files are overwritten on every run. Stale service files for renamed
// tags are removed each run.
//
// Additionally, scaffolds <project-root>/src/http/client.ts if it does not exist
// (services depend on its KyInstance). Existing client.ts is preserved unless
// --force-client is passed. Per-feature mapper.ts / repository.ts / hook.ts
// (src/http/<feature>/) are user-authored and never touched by this script.
//
// Usage:
//   node scripts/nextjs/openapi/generate-api.mjs <spec> [--dry-run] [--force-client]
//
// <spec> is a file path or HTTP(S) URL. URL specs are saved to
// <project-root>/specs/openapi.{yaml,json} for VCS tracking.
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import YAML from "yaml";

// ─── CLI ────────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`Usage: generate-api.mjs <spec> [--dry-run] [--force-client]

Arguments:
  <spec>            OpenAPI 3.x spec file path or URL

Options:
  --dry-run         Preview only — no files written
  --force-client    Overwrite existing src/http/client.ts scaffold
  -h, --help        Show this help
`);
}

function fail(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { spec: null, dryRun: false, forceClient: false };
  for (const a of argv.slice(2)) {
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--force-client") args.forceClient = true;
    else if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    } else if (a.startsWith("-")) {
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
  return s.startsWith("http://") || s.startsWith("https://");
}

async function fetchText(url) {
  let res;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json, application/yaml, text/yaml" },
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    return { error: `fetch failed: ${e.message}` };
  }
  if (!res.ok) {
    return { error: `HTTP ${res.status} ${res.statusText}` };
  }
  const text = await res.text();
  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  return { text, contentType };
}

function looksLikeHtml(text, contentType) {
  if (contentType.includes("text/html")) return true;
  const t = text.trimStart().toLowerCase();
  return (
    t.startsWith("<!doctype") || t.startsWith("<html") || t.startsWith("<")
  );
}

function tryParseSpec(text) {
  const trimmed = text.trim();
  const isJson = trimmed.startsWith("{") || trimmed.startsWith("[");
  try {
    const obj = isJson ? JSON.parse(text) : YAML.parse(text);
    if (obj && typeof obj === "object" && typeof obj.openapi === "string") {
      return { spec: obj, isJson };
    }
  } catch {
    // not parseable
  }
  return null;
}

/**
 * Derive common OpenAPI spec endpoint candidates from a Swagger UI URL.
 * 입력이 NestJS `/api-docs`처럼 HTML을 반환할 때 자동 fallback 대상으로 사용.
 */
function deriveSpecCandidates(originalUrl) {
  let parsed;
  try {
    parsed = new URL(originalUrl);
  } catch {
    return [];
  }
  const base = `${parsed.protocol}//${parsed.host}`;
  const orig = parsed.pathname.replace(/\/$/, "");
  const candidates = new Set();
  // Sibling-of-input first (e.g. /api-docs → /api-docs-json, /api-docs.json)
  if (orig) {
    candidates.add(`${base}${orig}-json`);
    candidates.add(`${base}${orig}.json`);
    candidates.add(`${base}${orig}-yaml`);
    candidates.add(`${base}${orig}.yaml`);
  }
  // Host-level common patterns (NestJS, SpringDoc, FastAPI 등)
  for (const p of [
    "/api-docs-json",
    "/api-json",
    "/api-docs.json",
    "/swagger-json",
    "/swagger.json",
    "/openapi.json",
    "/openapi.yaml",
    "/v3/api-docs",
    "/v3/api-docs.yaml",
  ]) {
    candidates.add(`${base}${p}`);
  }
  candidates.delete(originalUrl);
  return [...candidates];
}

async function loadSpec(specArg, projectRoot) {
  let text;
  let source;
  let isJson;
  let spec;

  if (isUrl(specArg)) {
    let res = await fetchText(specArg);
    let parsed =
      !res.error && !looksLikeHtml(res.text, res.contentType)
        ? tryParseSpec(res.text)
        : null;

    // 초기 URL이 (a) HTTP 에러 (b) HTML 응답 (c) OpenAPI가 아닌 텍스트 중 하나면
    // sibling/host-level 엔드포인트(/api-docs-json, /v3/api-docs 등)를 순차 탐지.
    if (!parsed) {
      const candidates = deriveSpecCandidates(specArg);
      const reason = res.error
        ? `Spec URL failed (${res.error})`
        : `Spec URL did not return OpenAPI JSON/YAML`;
      if (candidates.length) {
        console.log(`${reason}. Probing common endpoints...`);
        for (const url of candidates) {
          const r = await fetchText(url);
          if (r.error) continue;
          if (looksLikeHtml(r.text, r.contentType)) continue;
          const p = tryParseSpec(r.text);
          if (p) {
            res = r;
            parsed = p;
            console.log(`Found spec at: ${url}`);
            break;
          }
        }
      }
      if (!parsed) {
        fail(
          `${reason}` +
            (candidates.length
              ? ` (also tried: ${candidates.join(", ")})`
              : ""),
        );
      }
    }

    text = res.text;
    spec = parsed.spec;
    isJson = parsed.isJson;
    const ext = isJson ? "json" : "yaml";
    const specsDir = path.join(projectRoot, "specs");
    fs.mkdirSync(specsDir, { recursive: true });
    source = path.join(specsDir, `openapi.${ext}`);
    fs.writeFileSync(source, text);
    console.log(`Saved spec: ${path.relative(projectRoot, source)}`);
  } else {
    source = path.resolve(specArg);
    if (!fs.existsSync(source)) fail(`spec not found: ${specArg}`);
    text = fs.readFileSync(source, "utf8");
    try {
      spec = source.endsWith(".json") ? JSON.parse(text) : YAML.parse(text);
    } catch (e) {
      fail(`failed to parse spec: ${e.message}`);
    }
    if (!spec || typeof spec !== "object") fail("spec is empty or invalid");
  }

  return { spec, source };
}

function validateOpenApi(spec) {
  if (
    !spec.openapi ||
    typeof spec.openapi !== "string" ||
    !spec.openapi.startsWith("3.")
  ) {
    fail(`only OpenAPI 3.x is supported (found: ${spec.openapi ?? "none"})`);
  }
}

// ─── Naming utils ───────────────────────────────────────────────────────────

function toPascalCase(s) {
  return String(s)
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^[^a-zA-Z0-9]+/, "")
    .replace(/^(.)/, (_, c) => c.toUpperCase());
}

function toCamelCase(s) {
  const p = toPascalCase(s);
  return p ? p[0].toLowerCase() + p.slice(1) : "";
}

function dtoName(schemaName) {
  const pascal = toPascalCase(schemaName);
  return pascal.endsWith("Dto") ? pascal : `${pascal}Dto`;
}

function refName(ref) {
  if (typeof ref !== "string") return null;
  const m = ref.match(/^#\/components\/schemas\/(.+)$/);
  return m ? dtoName(m[1]) : null;
}

function isSafeIdent(s) {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(s);
}

function escapeSingle(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// ─── Schema → TS type ───────────────────────────────────────────────────────

function renderType(schema) {
  if (!schema || typeof schema !== "object") return "unknown";

  if (schema.$ref) {
    return refName(schema.$ref) || "unknown";
  }

  // OpenAPI 3.1: `type` can be an array including 'null'
  let baseType = schema.type;
  let nullableFromTypeArray = false;
  if (Array.isArray(baseType)) {
    const filtered = baseType.filter((t) => t !== "null");
    nullableFromTypeArray = filtered.length !== baseType.length;
    baseType =
      filtered.length === 1
        ? filtered[0]
        : filtered.length === 0
          ? undefined
          : filtered;
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
    const intersection =
      parts.length === 0
        ? "unknown"
        : parts.length === 1
          ? parts[0]
          : parts.join(" & ");
    return wrapNullable(intersection, nullable);
  }

  // enum
  if (Array.isArray(schema.enum)) {
    const lits = schema.enum.map((v) =>
      typeof v === "string" ? `'${escapeSingle(v)}'` : JSON.stringify(v),
    );
    return wrapNullable(unionOf(lits) || "never", nullable);
  }

  let ts;
  switch (baseType) {
    case "string":
      ts = "string";
      break;
    case "integer":
    case "number":
      ts = "number";
      break;
    case "boolean":
      ts = "boolean";
      break;
    case "array": {
      const item = renderType(schema.items || {});
      ts = needsParensForArray(item) ? `(${item})[]` : `${item}[]`;
      break;
    }
    case "object": {
      if (schema.properties) {
        ts = renderInlineObject(schema);
      } else if (
        schema.additionalProperties !== undefined &&
        schema.additionalProperties !== false
      ) {
        const v =
          schema.additionalProperties === true
            ? "unknown"
            : renderType(schema.additionalProperties);
        ts = `Record<string, ${v}>`;
      } else {
        ts = "Record<string, unknown>";
      }
      break;
    }
    default:
      ts = "unknown";
  }
  return wrapNullable(ts, nullable);
}

function unionOf(parts) {
  const uniq = [...new Set(parts.filter(Boolean))];
  if (uniq.length === 0) return "unknown";
  return uniq.length === 1 ? uniq[0] : uniq.join(" | ");
}

function wrapNullable(ts, nullable) {
  if (!nullable) return ts;
  if (ts === "unknown" || ts === "null" || ts === "never") return ts;
  return `${ts} | null`;
}

function needsParensForArray(t) {
  return t.includes("|") || t.includes("&");
}

function renderInlineObject(schema) {
  const props = schema.properties || {};
  const required = new Set(schema.required || []);
  const entries = Object.entries(props);
  if (entries.length === 0) return "Record<string, unknown>";
  const lines = ["{"];
  for (const [name, prop] of entries) {
    const optional = required.has(name) ? "" : "?";
    const ty = renderType(prop);
    const safe = isSafeIdent(name) ? name : `'${escapeSingle(name)}'`;
    lines.push(`  ${safe}${optional}: ${ty};`);
  }
  lines.push("}");
  return lines.join("\n");
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
    (schema.type === "object" || (!schema.type && schema.properties)) &&
    schema.properties &&
    !schema.oneOf &&
    !schema.anyOf &&
    !schema.allOf
  ) {
    const required = new Set(schema.required || []);
    const lines = [`export interface ${tn} {`];
    for (const [pname, prop] of Object.entries(schema.properties)) {
      const optional = required.has(pname) ? "" : "?";
      const ty = indentNested(renderType(prop), 2);
      const safe = isSafeIdent(pname) ? pname : `'${escapeSingle(pname)}'`;
      lines.push(`  ${safe}${optional}: ${ty};`);
    }
    lines.push("}");
    return { code: lines.join("\n") };
  }

  // Everything else (oneOf/anyOf/allOf/scalar/array at top level) → `export type`
  return {
    code: `export type ${tn} = ${indentNested(renderType(schema), 0)};`,
  };
}

function indentNested(ts, spaces) {
  if (!ts.includes("\n")) return ts;
  const pad = " ".repeat(spaces);
  return ts
    .split("\n")
    .map((line, i) => (i === 0 ? line : pad + line))
    .join("\n");
}

// ─── Endpoints rendering ────────────────────────────────────────────────────

const HTTP_METHODS = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
  "trace",
];

function collectOperations(paths) {
  const ops = [];
  for (const [pathStr, pathItem] of Object.entries(paths || {})) {
    if (!pathItem || typeof pathItem !== "object") continue;
    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (!op || typeof op !== "object") continue;
      ops.push({ path: pathStr, method, op, pathItem });
    }
  }
  return ops;
}

function deriveOpName(op, method, pathStr, used) {
  let name;
  if (op.operationId && typeof op.operationId === "string") {
    name = toCamelCase(op.operationId);
  } else {
    const pathPascal = pathStr
      .split("/")
      .filter(Boolean)
      .map((seg) => toPascalCase(seg.replace(/[{}]/g, "")))
      .join("");
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
    const def = paramDefs.find((p) => p && p.in === "path" && p.name === n);
    let ty = "string";
    if (def && def.schema) {
      const rendered = renderType(def.schema);
      if (
        rendered === "number" ||
        rendered === "string" ||
        rendered === "boolean"
      ) {
        ty = rendered;
      }
    }
    return {
      name: isSafeIdent(n) ? n : `_${n.replace(/[^a-zA-Z0-9]/g, "_")}`,
      type: ty,
    };
  });
}

function renderEndpoint({
  path: pathStr,
  method: _method,
  op,
  pathItem,
  opName,
}) {
  const params = extractPathParams(pathStr, op, pathItem);
  const args = params.map((p) => `${p.name}: ${p.type}`).join(", ");
  const template = pathStr.replace(/\{([^}]+)\}/g, (_, n) => {
    const safe = isSafeIdent(n) ? n : `_${n.replace(/[^a-zA-Z0-9]/g, "_")}`;
    return "${" + safe + "}";
  });
  return `  ${opName}: (${args}) => \`${template}\`,`;
}

// Assign a unique camelCase method name to each operation, shared between
// endpoints.ts entries and service class methods (so service method calls
// `endpoints.X(...)` resolve to the matching helper).
function assignOpNames(operations) {
  const used = new Set();
  return operations.map((opData) => ({
    ...opData,
    opName: deriveOpName(opData.op, opData.method, opData.path, used),
  }));
}

// ─── Services rendering ─────────────────────────────────────────────────────

function extractRequestBodyType(op) {
  const json = op.requestBody?.content?.["application/json"];
  if (!json || !json.schema) return null;
  return renderType(json.schema);
}

function extractSuccessResponseType(op) {
  const r = op.responses || {};
  for (const code of ["200", "201", "202", "2XX"]) {
    const resp = r[code];
    if (!resp) continue;
    const json = resp.content?.["application/json"];
    if (!json || !json.schema) return "void";
    return renderType(json.schema);
  }
  return "void";
}

function extractQueryParams(op, pathItem) {
  const all = [...(pathItem.parameters || []), ...(op.parameters || [])];
  return all
    .filter((p) => p && p.in === "query" && p.name)
    .map((p) => ({
      name: p.name,
      required: Boolean(p.required),
      type: renderType(p.schema || { type: "string" }),
    }));
}

function renderQueryParamType(params) {
  const parts = params.map((p) => {
    const safe = isSafeIdent(p.name) ? p.name : `'${escapeSingle(p.name)}'`;
    const optional = p.required ? "" : "?";
    return `${safe}${optional}: ${p.type}`;
  });
  return compactInlineObject(
    `{\n${parts.map((p) => `    ${p};`).join("\n")}\n  }`,
  );
}

// Collapse short multi-line object literals to single line for service signatures.
// `renderInlineObject` emits multi-line by default (good for top-level interfaces in
// types.ts), but service method signatures benefit from compact inline forms.
function compactInlineObject(typeStr) {
  if (!typeStr) return typeStr;
  if (!typeStr.startsWith("{") || !typeStr.endsWith("}")) return typeStr;
  if (!typeStr.includes("\n")) return typeStr;
  const inner = typeStr
    .slice(1, -1)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
  const candidate = `{ ${inner} }`;
  return candidate.length <= 80 ? candidate : typeStr;
}

function renderServiceMethod({ path: pathStr, method, op, pathItem, opName }) {
  const pathParams = extractPathParams(pathStr, op, pathItem);
  const queryParams = extractQueryParams(op, pathItem);
  const bodyType = compactInlineObject(extractRequestBodyType(op));
  const respType = compactInlineObject(extractSuccessResponseType(op));

  const args = [];
  for (const p of pathParams) args.push(`${p.name}: ${p.type}`);
  if (bodyType) args.push(`body: ${indentNested(bodyType, 4)}`);
  if (queryParams.length > 0) {
    const queryRequired = queryParams.some((p) => p.required);
    const optional = queryRequired ? "" : "?";
    args.push(`query${optional}: ${renderQueryParamType(queryParams)}`);
  }
  const argStr = args.join(", ");

  const endpointArgs = pathParams.map((p) => p.name).join(", ");
  const urlExpr = `endpoints.${opName}(${endpointArgs})`;

  const optsParts = [];
  if (bodyType) optsParts.push("json: body");
  if (queryParams.length > 0)
    optsParts.push("searchParams: this.toSearchParams(query)");
  const optsExpr = optsParts.length > 0 ? `, { ${optsParts.join(", ")} }` : "";

  const httpMethod = method.toLowerCase();
  const body =
    respType === "void"
      ? `    await this.api.${httpMethod}(${urlExpr}${optsExpr});`
      : `    return this.api.${httpMethod}(${urlExpr}${optsExpr}).json<${respType}>();`;

  return `  async ${opName}(${argStr}): Promise<${respType}> {\n${body}\n  }`;
}

function collectMethodDtos(opData) {
  const dtos = new Set();
  const bodyType = extractRequestBodyType(opData.op);
  const respType = extractSuccessResponseType(opData.op);
  const queryParams = extractQueryParams(opData.op, opData.pathItem);
  const allTypes = [bodyType, respType, ...queryParams.map((q) => q.type)];
  for (const t of allTypes) {
    if (!t) continue;
    for (const m of t.matchAll(/\b([A-Z][a-zA-Z0-9]*Dto)\b/g)) {
      dtos.add(m[1]);
    }
  }
  return dtos;
}

function kebabCase(s) {
  return String(s)
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function groupOperationsByTag(namedOperations) {
  const groups = new Map();
  for (const opData of namedOperations) {
    const tag = opData.op.tags?.[0] || "Default";
    if (!groups.has(tag)) groups.set(tag, []);
    groups.get(tag).push(opData);
  }
  return groups;
}

function renderServiceFile(tag, ops) {
  const className = `${toPascalCase(tag)}Service`;

  const dtoSet = new Set();
  for (const op of ops) {
    for (const name of collectMethodDtos(op)) dtoSet.add(name);
  }
  const dtoNames = [...dtoSet].sort();
  const dtoImport =
    dtoNames.length > 0
      ? `\nimport type {\n${dtoNames.map((n) => `  ${n},`).join("\n")}\n} from "../types";\n`
      : "";

  const hasQueryParams = ops.some(
    (op) => extractQueryParams(op.op, op.pathItem).length > 0,
  );
  const searchParamsHelper = hasQueryParams
    ? `\n  private toSearchParams(q: Record<string, unknown> | undefined): URLSearchParams {
    const p = new URLSearchParams();
    if (!q) return p;
    for (const [k, v] of Object.entries(q)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) for (const item of v) p.append(k, String(item));
      else p.set(k, String(v));
    }
    return p;
  }
`
    : "";

  const methods = ops.map(renderServiceMethod).join("\n\n");

  return [
    GEN_HEADER,
    "",
    `import type { KyInstance } from "ky";`,
    "",
    `import { endpoints } from "../endpoints";`,
    dtoImport,
    `export class ${className} {`,
    `  constructor(private readonly api: KyInstance) {}`,
    searchParamsHelper,
    methods,
    `}`,
    "",
  ].join("\n");
}

// ─── File renderers ─────────────────────────────────────────────────────────

const GEN_HEADER =
  "// GENERATED CODE - DO NOT MODIFY BY HAND\n// Source: jkit nextjs-openapi-gen";

function renderTypesFile(schemas) {
  const entries = Object.entries(schemas);
  if (entries.length === 0) {
    return `${GEN_HEADER}\n\nexport {};\n`;
  }
  const ordered = entries.sort(([a], [b]) => a.localeCompare(b));
  const blocks = ordered.map(
    ([name, schema]) => renderTopLevelSchema(name, schema).code,
  );
  return `${GEN_HEADER}\n\n${blocks.join("\n\n")}\n`;
}

function renderEndpointsFile(namedOperations) {
  if (namedOperations.length === 0) {
    return `${GEN_HEADER}\n\nexport const endpoints = {} as const;\n`;
  }
  const lines = namedOperations.map(renderEndpoint);
  return `${GEN_HEADER}\n\nexport const endpoints = {\n${lines.join("\n")}\n} as const;\n`;
}

// ─── client.ts scaffold ─────────────────────────────────────────────────────
//
// services는 `KyInstance` 주입을 요구하므로 client.ts가 없으면 컴파일 불가.
// 처음 init 시점에만 최소 스캐폴드를 깔아주고, 이후 사용자가 직접 401 refresh ·
// 인증 헤더 · 인터셉터 등 비즈니스 로직을 채워넣는다. 기존 파일은 보존
// (--force-client 명시 시에만 덮어쓰기).

function renderClientScaffold() {
  return `import ky, { type KyInstance } from "ky";

const API_PROXY_PATH = "/api/proxy";

function getPrefix(): string {
  if (typeof window !== "undefined") {
    return \`\${window.location.origin}\${API_PROXY_PATH}\`;
  }

  const apiUrl = process.env.NEST_API_URL;
  if (!apiUrl) {
    throw new Error("NEST_API_URL is required for server-side API calls");
  }
  return apiUrl;
}

function createApiInstance(): KyInstance {
  return ky.create({
    prefix: getPrefix(),
    retry: {
      limit: 2,
      methods: ["get"],
      statusCodes: [408, 429, 500, 502, 503, 504],
    },
    timeout: 30_000,
    headers: {
      Accept: "application/json",
    },
  });
}

let api: KyInstance | null = null;

export function getApi(): KyInstance {
  if (api === null) {
    api = createApiInstance();
  }
  return api;
}

export function resetApiInstance(): void {
  api = null;
}
`;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  const projectRoot = process.cwd();
  const { spec, source } = await loadSpec(args.spec, projectRoot);
  validateOpenApi(spec);

  const schemas = spec.components?.schemas ?? {};
  const operations = collectOperations(spec.paths ?? {});
  const namedOperations = assignOpNames(operations);

  const typesContent = renderTypesFile(schemas);
  const endpointsContent = renderEndpointsFile(namedOperations);
  const serviceGroups = groupOperationsByTag(namedOperations);

  const httpDir = path.join(projectRoot, "src", "http");
  const clientPath = path.join(httpDir, "client.ts");
  const genDir = path.join(httpDir, "_generated");
  const typesPath = path.join(genDir, "types.ts");
  const endpointsPath = path.join(genDir, "endpoints.ts");
  const servicesDir = path.join(genDir, "services");
  const schemaCount = Object.keys(schemas).length;

  const serviceFiles = [...serviceGroups.entries()].map(([tag, ops]) => ({
    tag,
    count: ops.length,
    path: path.join(servicesDir, `${kebabCase(tag)}.ts`),
    content: renderServiceFile(tag, ops),
  }));

  const clientExists = fs.existsSync(clientPath);
  const clientAction = clientExists
    ? args.forceClient
      ? "overwrite"
      : "skip"
    : "create";

  if (args.dryRun) {
    if (clientAction === "create") {
      console.log(
        `[dry-run] would create: ${path.relative(projectRoot, clientPath)} (scaffold)`,
      );
    } else if (clientAction === "overwrite") {
      console.log(
        `[dry-run] would overwrite: ${path.relative(projectRoot, clientPath)} (--force-client)`,
      );
    } else {
      console.log(
        `[dry-run] keep existing: ${path.relative(projectRoot, clientPath)} (pass --force-client to overwrite)`,
      );
    }
    console.log(
      `[dry-run] would write: ${path.relative(projectRoot, typesPath)} (${schemaCount} schemas)`,
    );
    console.log(
      `[dry-run] would write: ${path.relative(projectRoot, endpointsPath)} (${operations.length} operations)`,
    );
    for (const f of serviceFiles) {
      console.log(
        `[dry-run] would write: ${path.relative(projectRoot, f.path)} (${f.count} methods, tag: ${f.tag})`,
      );
    }
    console.log(`Spec: ${path.relative(projectRoot, source)}`);
    return;
  }

  fs.mkdirSync(httpDir, { recursive: true });
  if (clientAction === "create" || clientAction === "overwrite") {
    fs.writeFileSync(clientPath, renderClientScaffold());
  }

  fs.mkdirSync(genDir, { recursive: true });
  fs.writeFileSync(typesPath, typesContent);
  fs.writeFileSync(endpointsPath, endpointsContent);

  // Clear stale service files (tag renames between runs would otherwise leave orphans)
  fs.mkdirSync(servicesDir, { recursive: true });
  for (const entry of fs.readdirSync(servicesDir)) {
    if (entry.endsWith(".ts")) {
      fs.unlinkSync(path.join(servicesDir, entry));
    }
  }
  for (const f of serviceFiles) {
    fs.writeFileSync(f.path, f.content);
  }

  if (clientAction === "create") {
    console.log(
      `Generated: ${path.relative(projectRoot, clientPath)} (scaffold)`,
    );
  } else if (clientAction === "overwrite") {
    console.log(
      `Overwrote: ${path.relative(projectRoot, clientPath)} (--force-client)`,
    );
  } else {
    console.log(
      `Skipped:   ${path.relative(projectRoot, clientPath)} (already exists — pass --force-client to overwrite)`,
    );
  }
  console.log(
    `Generated: ${path.relative(projectRoot, typesPath)} (${schemaCount} schemas)`,
  );
  console.log(
    `Generated: ${path.relative(projectRoot, endpointsPath)} (${operations.length} operations)`,
  );
  for (const f of serviceFiles) {
    console.log(
      `Generated: ${path.relative(projectRoot, f.path)} (${f.count} methods)`,
    );
  }
  console.log(`Spec: ${path.relative(projectRoot, source)}`);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
