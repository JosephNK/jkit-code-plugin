// =============================================================================
// Dart naming utilities.
//
// Converts OpenAPI schema names to Dart-compatible snake_case, camelCase,
// and PascalCase identifiers. Preserves the exact behavior of the original
// Python module (dart_name_utils.py), including edge-case handling for
// reserved words, built-in types, and BuiltValue reserved field names.
// =============================================================================

// Dart reserved words (cannot be used as identifiers directly).
export const DART_RESERVED_WORDS = new Set([
  'abstract',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'covariant',
  'default',
  'deferred',
  'do',
  'dynamic',
  'else',
  'enum',
  'export',
  'extends',
  'extension',
  'external',
  'factory',
  'false',
  'final',
  'finally',
  'for',
  'function',
  'get',
  'hide',
  'if',
  'implements',
  'import',
  'in',
  'interface',
  'is',
  'late',
  'library',
  'mixin',
  'new',
  'null',
  'on',
  'operator',
  'part',
  'required',
  'rethrow',
  'return',
  'set',
  'show',
  'static',
  'super',
  'switch',
  'sync',
  'this',
  'throw',
  'true',
  'try',
  'typedef',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

// Dart built-in type names (avoid class-name collisions).
export const DART_BUILTIN_TYPES = new Set([
  'int',
  'double',
  'String',
  'bool',
  'List',
  'Map',
  'Set',
  'Object',
  'Null',
  'Future',
  'Stream',
  'Iterable',
  'num',
  'dynamic',
  'void',
  'Function',
  'Never',
  'Type',
  'Symbol',
  'Record',
]);

// BuiltValue reserved field names that collide with Builder/Built members.
export const BUILT_VALUE_RESERVED_FIELDS = new Set([
  'update',
  'replace',
  'build',
  'rebuild',
  'toBuilder',
  'serializer',
  'hashCode',
  'toString',
]);

// Mirrors Python's str.capitalize(): first char upper, remainder lowered.
function capitalize(word) {
  if (!word) return '';
  return word[0].toUpperCase() + word.slice(1).toLowerCase();
}

function splitWords(name) {
  let normalized = name.replace(/[^a-zA-Z0-9]/g, ' ');
  normalized = normalized.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  normalized = normalized.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return normalized.split(/\s+/).filter(Boolean);
}

export function toSnakeCase(name) {
  return splitWords(name)
    .map((w) => w.toLowerCase())
    .join('_');
}

export function toCamelCase(name) {
  const words = splitWords(name);
  if (words.length === 0) return '';
  return words[0].toLowerCase() + words.slice(1).map(capitalize).join('');
}

export function toPascalCase(name) {
  return splitWords(name).map(capitalize).join('');
}

export function sanitizeIdentifier(name) {
  let sanitized = name.replace(/[^a-zA-Z0-9_]/g, '_');
  if (!sanitized) return 'unnamed';
  if (/^\d/.test(sanitized)) {
    sanitized = `n${sanitized}`;
  }
  if (DART_RESERVED_WORDS.has(sanitized.toLowerCase())) {
    sanitized = `${sanitized}_`;
  }
  return sanitized;
}

export function sanitizeFieldName(name) {
  if (BUILT_VALUE_RESERVED_FIELDS.has(name)) {
    return `${name}Field`;
  }
  return name;
}

export function sanitizeEnumValue(value) {
  return sanitizeIdentifier(toCamelCase(value));
}

export function schemaToDartClass(schemaName) {
  let pascal = toPascalCase(schemaName);
  if (DART_BUILTIN_TYPES.has(pascal)) {
    pascal = `${pascal}Dto`;
  }
  return pascal;
}

export function schemaToDartFilename(schemaName) {
  const className = schemaToDartClass(schemaName);
  return `${toSnakeCase(className)}.dart`;
}

export function schemaToEnumClass(schemaName) {
  let pascal = toPascalCase(schemaName);
  if (DART_BUILTIN_TYPES.has(pascal)) {
    pascal = `${pascal}Dto`;
  }
  if (!pascal.endsWith('Enum')) {
    pascal = `${pascal}Enum`;
  }
  return pascal;
}

export function schemaToEnumFilename(schemaName) {
  return `${toSnakeCase(schemaName)}_enum.dart`;
}

export function tagToServiceClass(tag) {
  const pascal = toPascalCase(tag);
  if (pascal.endsWith('Service')) return pascal;
  return `${pascal}Service`;
}

export function tagToServiceFilename(tag) {
  const className = tagToServiceClass(tag);
  return `${toSnakeCase(className)}.dart`;
}

export function pathToEndpointName(path, method, operationId = null) {
  if (operationId) {
    return toCamelCase(operationId);
  }
  const cleanPath = path.replace(/\{([^}]+)\}/g, '$1');
  const words = splitWords(cleanPath);
  const methodLower = method.toLowerCase();
  return methodLower + words.map(capitalize).join('');
}

export function pathToEndpointConstant(path) {
  return path;
}

export function hasPathParams(path) {
  return /\{[^}]+\}/.test(path);
}

export function extractPathParams(path) {
  return [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
}

export function methodNameFromEndpoint(path, method, operationId = null) {
  if (operationId) {
    return toCamelCase(operationId);
  }
  const cleanPath = path.replace(/\{([^}]+)\}/g, '');
  const words = splitWords(cleanPath);
  const methodLower = method.toLowerCase();
  if (words.length === 0) return methodLower;
  return methodLower + words.map(capitalize).join('');
}
