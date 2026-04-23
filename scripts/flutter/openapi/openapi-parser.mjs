// =============================================================================
// OpenAPI 3.x spec parser.
//
// Parses an OpenAPI spec file (YAML / JSON) or URL into a structured
// ParsedSpec object ready for Dart code generation. Direct port of
// openapi_parser.py; preserves public API surface and field names.
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import YAML from 'yaml';

import {
  sanitizeFieldName,
  schemaToDartClass,
  schemaToEnumClass,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
} from './dart-name-utils.mjs';

// ──────────────────────────────────────────────
// Python-style helpers
// ──────────────────────────────────────────────

// Mimic Python's str(v): None → 'None', True/False → 'True'/'False',
// numbers → same as JS default, strings → unchanged.
// Matters for enum-value coercion from arbitrary YAML/JSON types.
function pyStr(v) {
  if (v === null || v === undefined) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  return String(v);
}

// Preserve insertion order while deduplicating (mirrors dict.fromkeys).
function dedupe(arr) {
  return [...new Set(arr)];
}

// ──────────────────────────────────────────────
// Spec loading
// ──────────────────────────────────────────────

function isUrl(specPath) {
  return specPath.startsWith('http://') || specPath.startsWith('https://');
}

function isHtml(content) {
  const stripped = content.trim().slice(0, 500).toLowerCase();
  return (
    stripped.startsWith('<!doctype html') ||
    stripped.startsWith('<html') ||
    stripped.includes('<!doctype html')
  );
}

async function fetchUrl(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json, application/yaml, text/yaml' },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return await res.text();
}

function extractBalancedJson(text, start) {
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === '\\') {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

async function extractSpecFromSwaggerUi(html, baseUrl) {
  // Strategy 1: {baseUrl}-json (NestJS default)
  const jsonUrl = baseUrl.replace(/\/+$/, '') + '-json';
  try {
    const content = await fetchUrl(jsonUrl);
    if (!isHtml(content)) {
      const parsed = JSON.parse(content);
      if ('openapi' in parsed || 'swagger' in parsed) {
        process.stdout.write(`  Resolved Swagger UI → ${jsonUrl}\n`);
        return content;
      }
    }
  } catch {
    // fall through
  }

  // Strategy 2: inline swaggerDoc in swagger-ui-init.js
  const initJsMatch = html.match(/src=["']([^"']*swagger-ui-init\.js)["']/);
  if (initJsMatch) {
    const initJsPath = initJsMatch[1];
    const initJsUrl = new URL(initJsPath, baseUrl + '/').href;
    try {
      const jsContent = await fetchUrl(initJsUrl);
      const docMatch = jsContent.match(/"swaggerDoc"\s*:\s*(\{)/);
      if (docMatch) {
        const start = docMatch.index + docMatch[0].indexOf('{');
        const specJson = extractBalancedJson(jsContent, start);
        if (specJson) {
          process.stdout.write(
            `  Resolved Swagger UI → inline swaggerDoc from ${initJsUrl}\n`,
          );
          return specJson;
        }
      }
    } catch {
      // fall through
    }
  }

  return null;
}

function detectContentFormat(content) {
  try {
    JSON.parse(content);
    return 'json';
  } catch {
    return 'yaml';
  }
}

async function downloadSpec(url, savePath) {
  fs.mkdirSync(path.dirname(savePath), { recursive: true });

  let content = await fetchUrl(url);

  if (isHtml(content)) {
    process.stdout.write(`  Detected Swagger UI HTML page at ${url}\n`);
    const specContent = await extractSpecFromSwaggerUi(content, url);
    if (specContent === null) {
      process.stderr.write(
        `Error: URL returned Swagger UI HTML but could not extract the OpenAPI spec.\n` +
          `  Tried: ${url}-json\n` +
          `  Tried: swagger-ui-init.js inline swaggerDoc\n` +
          `\n` +
          `Hint: Use the direct JSON/YAML spec URL instead. Common patterns:\n` +
          `  - ${url}-json\n` +
          `  - ${url.replace(/\/+$/, '')}/swagger.json\n` +
          `  - ${url.replace(/\/+$/, '')}/openapi.json\n`,
      );
      process.exit(1);
    }
    content = specContent;
  }

  const fmt = detectContentFormat(content);
  const { dir, name } = path.parse(savePath);
  const finalPath = path.join(dir, `${name}.${fmt}`);

  fs.writeFileSync(finalPath, content, 'utf8');
  process.stdout.write(`  Downloaded spec to ${finalPath}\n`);
  return finalPath;
}

async function loadSpec(specPath, apiName, specsDir) {
  let localPath;
  if (isUrl(specPath)) {
    localPath = await downloadSpec(specPath, path.join(specsDir, apiName));
  } else {
    localPath = specPath;
  }

  if (!fs.existsSync(localPath)) {
    process.stderr.write(`Error: Spec file not found: ${localPath}\n`);
    process.exit(1);
  }

  const content = fs.readFileSync(localPath, 'utf8');

  try {
    return JSON.parse(content);
  } catch {
    return YAML.parse(content);
  }
}

// ──────────────────────────────────────────────
// $ref resolution
// ──────────────────────────────────────────────

function resolveRef(spec, ref) {
  if (!ref.startsWith('#/')) return {};

  const parts = ref.slice(2).split('/');
  let current = spec;
  for (const part of parts) {
    current = (current && current[part]) || {};
  }
  return current;
}

function resolveSchema(spec, schema) {
  if (schema && '$ref' in schema) {
    return resolveRef(spec, schema.$ref);
  }
  if (schema && 'allOf' in schema) {
    return mergeAllOf(spec, schema.allOf);
  }
  return schema || {};
}

function mergeAllOf(spec, allOfList) {
  const merged = {
    type: 'object',
    properties: {},
    required: [],
  };

  for (const item of allOfList) {
    const resolved = resolveSchema(spec, item);

    if (resolved.properties) {
      Object.assign(merged.properties, resolved.properties);
    }
    if (resolved.required) {
      merged.required.push(...resolved.required);
    }
    if (resolved.description && !('description' in merged)) {
      merged.description = resolved.description;
    }
  }

  merged.required = dedupe(merged.required);
  return merged;
}

// ──────────────────────────────────────────────
// Type mapping
// ──────────────────────────────────────────────

const OPENAPI_TO_DART = {
  string: 'String',
  integer: 'int',
  number: 'double',
  boolean: 'bool',
};

function resolveDartType(spec, schema, visited = new Set()) {
  if (schema && '$ref' in schema) {
    const refName = schema.$ref.split('/').pop();

    if (visited.has(refName)) {
      return [schemaToDartClass(refName), false];
    }

    const resolved = resolveRef(spec, schema.$ref);
    const newVisited = new Set([...visited, refName]);

    if ('enum' in resolved) {
      return [schemaToEnumClass(refName), true];
    }
    if ('allOf' in resolved) {
      return [schemaToDartClass(refName), false];
    }
    if (resolved.type === 'object' || 'properties' in resolved) {
      return [schemaToDartClass(refName), false];
    }

    return resolveDartType(spec, resolved, newVisited);
  }

  if (schema && 'allOf' in schema) {
    const refs = schema.allOf.filter((item) => item && '$ref' in item);
    if (refs.length === 1) {
      return resolveDartType(spec, refs[0], visited);
    }
    return ['Object', false];
  }

  const schemaType = (schema && schema.type) || '';
  const schemaFormat = (schema && schema.format) || '';

  if (schemaType === 'array') {
    const items = (schema && schema.items) || {};
    const [itemType, isItemEnum] = resolveDartType(spec, items, visited);
    return [`BuiltList<${itemType}>`, isItemEnum];
  }

  if (schemaType === 'string') {
    if ('enum' in (schema || {})) return ['String', true];
    if (schemaFormat === 'date-time') return ['String', false];
    if (schemaFormat === 'date') return ['String', false];
    if (schemaFormat === 'binary') return ['String', false];
    return ['String', false];
  }

  if (schemaType === 'integer') {
    return ['int', false];
  }

  if (schemaType === 'number') {
    return ['double', false];
  }

  if (schemaType in OPENAPI_TO_DART) {
    return [OPENAPI_TO_DART[schemaType], false];
  }

  if (schemaType === 'object') {
    return ['Object', false];
  }

  return ['Object', false];
}

// ──────────────────────────────────────────────
// Inline enum collection
// ──────────────────────────────────────────────

function collectInlineEnums(spec) {
  const schemasDict = (spec.components && spec.components.schemas) || {};

  const existingNames = new Set();
  for (const schemaName of Object.keys(schemasDict)) {
    existingNames.add(toPascalCase(schemaName));
  }

  // Map composite key `${propName}|${JSON.stringify(values)}` → usages
  const enumGroups = new Map();

  for (const [schemaName, schema] of Object.entries(schemasDict)) {
    const resolved = resolveSchema(spec, schema);
    const properties = resolved.properties || {};

    for (const [propName, propSchema] of Object.entries(properties)) {
      if (propSchema && propSchema.type === 'string' && 'enum' in propSchema) {
        const values = propSchema.enum.map(pyStr);
        const key = `${propName}|${JSON.stringify(values)}`;
        if (!enumGroups.has(key)) {
          enumGroups.set(key, { propName, values, usages: [] });
        }
        enumGroups.get(key).usages.push([schemaName, propName]);
      } else if (propSchema && propSchema.type === 'array') {
        const items = propSchema.items || {};
        if (items.type === 'string' && 'enum' in items) {
          const values = items.enum.map(pyStr);
          const key = `${propName}|${JSON.stringify(values)}`;
          if (!enumGroups.has(key)) {
            enumGroups.set(key, { propName, values, usages: [] });
          }
          enumGroups.get(key).usages.push([schemaName, propName]);
        }
      }
    }
  }

  const enumSchemas = [];
  const fieldEnumMap = new Map(); // "schemaName\0propName" → enumName
  const usedNames = new Set();

  for (const { propName, values, usages } of enumGroups.values()) {
    let enumName = toPascalCase(propName);

    if (existingNames.has(enumName) || usedNames.has(enumName)) {
      const firstSchema = usages[0][0];
      enumName = `${toPascalCase(firstSchema)}${toPascalCase(propName)}`;
    }

    usedNames.add(enumName);

    enumSchemas.push({
      name: enumName,
      dart_class_name: schemaToEnumClass(enumName),
      fields: [],
      is_enum: true,
      enum_values: values,
      description: null,
    });

    for (const [schemaName, pname] of usages) {
      fieldEnumMap.set(`${schemaName}\0${pname}`, enumName);
    }
  }

  return [enumSchemas, fieldEnumMap];
}

// ──────────────────────────────────────────────
// Schema parsing
// ──────────────────────────────────────────────

function parseSchema(spec, name, schema, inlineEnumMap = null) {
  if ('enum' in schema) {
    return {
      name,
      dart_class_name: schemaToEnumClass(name),
      fields: [],
      is_enum: true,
      enum_values: schema.enum.map(pyStr),
      description: schema.description ?? null,
    };
  }

  const resolved = resolveSchema(spec, schema);

  const properties = resolved.properties || {};
  const requiredFields = new Set(resolved.required || []);

  const fields = [];
  for (const [propName, propSchema] of Object.entries(properties)) {
    let [dartType, isEnum] = resolveDartType(spec, propSchema);

    if (isEnum && inlineEnumMap) {
      const enumName = inlineEnumMap.get(`${name}\0${propName}`);
      if (enumName) {
        const enumClass = schemaToEnumClass(enumName);
        if (dartType === 'String') {
          dartType = enumClass;
        } else if (dartType === 'BuiltList<String>') {
          dartType = `BuiltList<${enumClass}>`;
        }
      }
    }

    const isNullable =
      !requiredFields.has(propName) || propSchema.nullable === true;
    const fixme = dartType.includes('Object')
      ? `Object type detected for '${propName}'. Replace with a specific type.`
      : null;

    fields.push({
      name: propName,
      dart_name: sanitizeFieldName(toCamelCase(propName)),
      dart_type: dartType,
      is_nullable: isNullable,
      is_enum: isEnum,
      description: propSchema.description ?? null,
      fixme,
    });
  }

  return {
    name,
    dart_class_name: schemaToDartClass(name),
    fields,
    is_enum: false,
    enum_values: null,
    description: resolved.description ?? null,
  };
}

function parseSchemas(spec, inlineEnumMap = null) {
  const components = spec.components || {};
  const schemasDict = components.schemas || {};

  const schemas = [];
  for (const [name, schema] of Object.entries(schemasDict)) {
    schemas.push(parseSchema(spec, name, schema, inlineEnumMap));
  }
  return schemas;
}

// ──────────────────────────────────────────────
// Parameter parsing
// ──────────────────────────────────────────────

function parseParameter(spec, param) {
  const paramSchema = param.schema || {};
  const [dartType, isEnum] = resolveDartType(spec, paramSchema);
  const fixme = dartType.includes('Object')
    ? `Object type detected for '${param.name}'. Replace with a specific type.`
    : null;

  return {
    name: param.name,
    dart_name: toCamelCase(param.name),
    dart_type: dartType,
    is_nullable: !param.required,
    is_enum: isEnum,
    description: param.description ?? null,
    fixme,
  };
}

// ──────────────────────────────────────────────
// Endpoint parsing
// ──────────────────────────────────────────────

function extractResponseSchema(spec, responses, statusRange) {
  for (const code of Object.keys(responses)) {
    const codeStr = String(code);
    if (statusRange === '2xx' && codeStr.startsWith('2')) {
      let response = responses[code];
      if (response && '$ref' in response) {
        response = resolveRef(spec, response.$ref);
      }
      const content = (response && response.content) || {};
      const jsonContent = content['application/json'] || {};
      const schema = jsonContent.schema || {};

      if ('$ref' in schema) {
        return schema.$ref.split('/').pop();
      }
      if ('allOf' in schema) {
        for (const item of schema.allOf) {
          if (item && '$ref' in item) {
            return item.$ref.split('/').pop();
          }
        }
      }
      if (schema.type === 'array') {
        const items = schema.items || {};
        if ('$ref' in items) {
          return items.$ref.split('/').pop();
        }
      }
      const props = schema.properties || {};
      const dataProp = props.data || {};
      if ('$ref' in dataProp) {
        const title = schema.title;
        if (title) return title;
        return dataProp.$ref.split('/').pop();
      }
      return null;
    }
  }
  return null;
}

function extractErrorSchemas(spec, responses) {
  const errorSchemas = [];

  for (const [code, rawResponse] of Object.entries(responses)) {
    const codeStr = String(code);
    if (!(codeStr.startsWith('4') || codeStr.startsWith('5'))) continue;

    let response = rawResponse;
    if (response && '$ref' in response) {
      response = resolveRef(spec, response.$ref);
    }

    const content = (response && response.content) || {};
    const jsonContent = content['application/json'] || {};
    const schema = jsonContent.schema || {};

    if ('$ref' in schema) {
      const schemaName = schema.$ref.split('/').pop();
      errorSchemas.push({
        status_code: parseInt(codeStr, 10),
        schema_name: schemaName,
      });
    }
  }

  return errorSchemas;
}

function extractRequestBodySchema(spec, operation) {
  let requestBody = operation.requestBody || {};
  if ('$ref' in requestBody) {
    requestBody = resolveRef(spec, requestBody.$ref);
  }

  const content = requestBody.content || {};
  const jsonContent = content['application/json'] || {};
  const schema = jsonContent.schema || {};

  if ('$ref' in schema) {
    return schema.$ref.split('/').pop();
  }
  return null;
}

function extractMultipartFields(spec, operation) {
  let requestBody = operation.requestBody || {};
  if ('$ref' in requestBody) {
    requestBody = resolveRef(spec, requestBody.$ref);
  }

  const content = requestBody.content || {};
  const multipartContent = content['multipart/form-data'];
  if (!multipartContent) return [false, []];

  let schema = multipartContent.schema || {};
  schema = resolveSchema(spec, schema);

  const properties = schema.properties || {};
  const requiredFields = new Set(schema.required || []);

  if (Object.keys(properties).length === 0) return [true, []];

  const fields = [];
  for (const [propName, propSchema] of Object.entries(properties)) {
    const propType = propSchema.type || '';
    const propFormat = propSchema.format || '';
    let isFile = propType === 'string' && propFormat === 'binary';
    const isArray = propType === 'array';

    if (isArray) {
      const items = propSchema.items || {};
      if (items.type === 'string' && items.format === 'binary') {
        isFile = true;
      }
    }

    let dartType;
    if (isFile && isArray) dartType = 'List<LeafMultipartFile>';
    else if (isFile) dartType = 'LeafMultipartFile';
    else if (isArray) dartType = 'List<String>';
    else dartType = 'String';

    fields.push({
      name: propName,
      dart_name: toCamelCase(propName),
      dart_type: dartType,
      is_required: requiredFields.has(propName),
      is_file: isFile,
      is_array: isArray,
      description: propSchema.description ?? null,
    });
  }

  return [true, fields];
}

function collectInlineResponseSchemas(spec) {
  const schemas = new Map();

  for (const pathItem of Object.values(spec.paths || {})) {
    for (const method of ['get', 'post', 'put', 'delete', 'patch']) {
      const operation = pathItem[method];
      if (!operation) continue;

      const responses = operation.responses || {};
      for (const [code, rawResponse] of Object.entries(responses)) {
        if (!String(code).startsWith('2')) continue;

        let response = rawResponse;
        if (response && '$ref' in response) {
          response = resolveRef(spec, response.$ref);
        }

        const content = (response && response.content) || {};
        const jsonContent = content['application/json'] || {};
        const schema = jsonContent.schema || {};

        const title = schema.title;
        if (!title) continue;

        const props = schema.properties || {};
        const dataProp = props.data || {};
        if (!('$ref' in dataProp)) continue;

        if (schemas.has(title)) continue;

        schemas.set(title, parseSchema(spec, title, schema));
      }
    }
  }

  return [...schemas.values()];
}

function parseEndpoints(spec) {
  const paths = spec.paths || {};
  const endpoints = [];

  for (const [pth, pathItem] of Object.entries(paths)) {
    const pathLevelParams = pathItem.parameters || [];

    for (const method of ['get', 'post', 'put', 'delete', 'patch']) {
      const operation = pathItem[method];
      if (operation == null) continue;

      const tags = operation.tags || ['default'];
      const tag = tags.length > 0 ? tags[0] : 'default';

      const allParams = [...pathLevelParams, ...(operation.parameters || [])];
      const resolvedParams = allParams.map((p) =>
        '$ref' in p ? resolveRef(spec, p.$ref) : p,
      );

      const pathParams = resolvedParams
        .filter((p) => p.in === 'path')
        .map((p) => parseParameter(spec, p));
      const queryParams = resolvedParams
        .filter((p) => p.in === 'query')
        .map((p) => parseParameter(spec, p));

      const responses = operation.responses || {};
      const responseSchema = extractResponseSchema(spec, responses, '2xx');
      const errorSchemas = extractErrorSchemas(spec, responses);
      const requestBodySchema = extractRequestBodySchema(spec, operation);
      const [isMultipart, multipartFields] = extractMultipartFields(spec, operation);

      endpoints.push({
        path: pth,
        method: method.toUpperCase(),
        operation_id: operation.operationId ?? null,
        tag,
        summary: operation.summary ?? null,
        request_body_schema: requestBodySchema,
        response_schema: responseSchema,
        error_schemas: errorSchemas,
        path_params: pathParams,
        query_params: queryParams,
        is_multipart: isMultipart,
        multipart_fields: multipartFields,
      });
    }
  }

  return endpoints;
}

// ──────────────────────────────────────────────
// Server parsing
// ──────────────────────────────────────────────

function parseServers(spec, sourceUrl = null) {
  const servers = spec.servers || [];

  let origin = null;
  if (sourceUrl) {
    try {
      const parsed = new URL(sourceUrl);
      if (parsed.protocol && parsed.host) {
        origin = `${parsed.protocol}//${parsed.host}`;
      }
    } catch {
      // invalid URL → leave origin null
    }
  }

  if (servers.length === 0) {
    const url = origin ?? '/';
    return [{ url, description: 'Default' }];
  }

  const result = [];
  for (const s of servers) {
    let url = s.url ?? '/';
    if (origin && !(url.startsWith('http://') || url.startsWith('https://'))) {
      url = origin + (url.startsWith('/') ? url : `/${url}`);
    }
    result.push({ url, description: s.description ?? null });
  }

  return result;
}

// ──────────────────────────────────────────────
// Tag extraction
// ──────────────────────────────────────────────

function extractTags(spec, endpoints) {
  const specTags = (spec.tags || []).map((t) => t.name);
  const endpointTags = dedupe(endpoints.map((ep) => ep.tag));

  const seen = new Set(specTags);
  const result = [...specTags];
  for (const tag of endpointTags) {
    if (!seen.has(tag)) {
      result.push(tag);
      seen.add(tag);
    }
  }
  return result;
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

export async function parseOpenapi(specPath, apiName, specsDir = null) {
  const resolvedSpecsDir = specsDir ?? 'specs';

  const spec = await loadSpec(specPath, apiName, resolvedSpecsDir);

  const sourceUrl = isUrl(specPath) ? specPath : null;
  const servers = parseServers(spec, sourceUrl);

  const [inlineEnumSchemas, inlineEnumMap] = collectInlineEnums(spec);

  const schemas = parseSchemas(spec, inlineEnumMap);
  const inlineSchemas = collectInlineResponseSchemas(spec);
  const allSchemas = [...schemas, ...inlineSchemas, ...inlineEnumSchemas];
  const endpoints = parseEndpoints(spec);
  const tags = extractTags(spec, endpoints);

  return {
    servers,
    schemas: allSchemas,
    endpoints,
    tags,
  };
}

// Named exports for future generate-api.mjs consumers.
export {
  downloadSpec,
  loadSpec,
  resolveRef,
  resolveSchema,
  resolveDartType,
  parseSchema,
  parseSchemas,
  parseParameter,
  parseEndpoints,
  parseServers,
  extractTags,
  collectInlineEnums,
  collectInlineResponseSchemas,
  extractResponseSchema,
  extractErrorSchemas,
  extractRequestBodySchema,
  extractMultipartFields,
};
