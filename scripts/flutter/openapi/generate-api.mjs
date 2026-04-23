#!/usr/bin/env node
// =============================================================================
// OpenAPI → Dart code generator (main orchestration).
//
// Renders BuiltValue models, services, endpoints, and client code from an
// OpenAPI spec using nunjucks templates. Direct port of generate_api.py;
// preserves the CLI surface, console output, and rendered file contents
// byte-for-byte.
//
// Usage:
//   generate-api.mjs <spec> <api_name> --output-dir <path> [--dry-run]
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import nunjucks from 'nunjucks';

import {
  extractPathParams,
  hasPathParams,
  methodNameFromEndpoint,
  pathToEndpointName,
  sanitizeEnumValue,
  schemaToDartClass,
  schemaToDartFilename,
  schemaToEnumClass,
  schemaToEnumFilename,
  tagToServiceClass,
  tagToServiceFilename,
  toCamelCase,
  toPascalCase,
} from './dart-name-utils.mjs';

import { parseOpenapi } from './openapi-parser.mjs';

// ──────────────────────────────────────────────
// CLI
// ──────────────────────────────────────────────

const HELP = `Usage: generate-api.mjs <spec> <api_name> --output-dir <path> [--dry-run]

Generates Dart code from an OpenAPI spec.

Arguments:
  <spec>           OpenAPI spec file path or URL
  <api_name>      API name (snake_case, e.g., main, auth)

Options:
  --output-dir <path>   Output directory (required)
  --dry-run             Preview without writing files
  -h, --help            Show this help
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const rest = argv.slice(2);
  const args = { spec: '', apiName: '', outputDir: '', dryRun: false };

  for (const a of rest) {
    if (a === '-h' || a === '--help') usage(0);
  }

  const positional = [];
  while (rest.length > 0) {
    const a = rest.shift();
    if (a === '--dry-run') {
      args.dryRun = true;
    } else if (a === '--output-dir') {
      if (!rest.length) {
        process.stderr.write('--output-dir requires a value\n');
        usage();
      }
      args.outputDir = rest.shift();
    } else if (a.startsWith('--output-dir=')) {
      args.outputDir = a.slice('--output-dir='.length);
    } else if (a.startsWith('-')) {
      process.stderr.write(`Unknown option: ${a}\n`);
      usage();
    } else {
      positional.push(a);
    }
  }

  if (positional.length < 2) {
    process.stderr.write('Error: <spec> and <api_name> are required\n');
    usage();
  }
  args.spec = positional[0];
  args.apiName = positional[1];

  if (!args.outputDir) {
    process.stderr.write('Error: --output-dir is required\n');
    usage();
  }

  return args;
}

// ──────────────────────────────────────────────
// Template engine
// ──────────────────────────────────────────────

function createEnv() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const templatesDir = path.join(scriptDir, 'templates');
  return new nunjucks.Environment(
    new nunjucks.FileSystemLoader(templatesDir),
    { trimBlocks: true, lstripBlocks: true, autoescape: false },
  );
}

// ──────────────────────────────────────────────
// File writing
// ──────────────────────────────────────────────

function writeFile(filepath, content, dryRun) {
  if (dryRun) {
    process.stdout.write(`  [dry-run] ${filepath}\n`);
    return;
  }
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, content, 'utf8');
  process.stdout.write(`  Created ${filepath}\n`);
}

// ──────────────────────────────────────────────
// Model generation
// ──────────────────────────────────────────────

function hasBuiltList(fields) {
  return fields.some((f) => f.dart_type.includes('BuiltList'));
}

function collectModelImports(schema, allSchemas) {
  const imports = new Set();
  for (const field of schema.fields) {
    const typeStr = field.dart_type;
    const match = typeStr.match(/BuiltList<(\w+)>/);
    const refType = match ? match[1] : typeStr;

    for (const other of allSchemas) {
      if (other.dart_class_name === refType && other.name !== schema.name) {
        if (other.is_enum) {
          imports.add(`import '${schemaToEnumFilename(other.name)}';`);
        } else {
          imports.add(`import '${schemaToDartFilename(other.name)}';`);
        }
      }
    }
  }
  return [...imports].sort();
}

function serializerName(className) {
  return className[0].toLowerCase() + className.slice(1);
}

function generateModel(env, schema, allSchemas, apiName, outputDir, dryRun) {
  if (schema.is_enum) {
    return generateEnum(env, schema, apiName, outputDir, dryRun);
  }

  const filename = schemaToDartFilename(schema.name);
  const filepath = path.join(
    outputDir,
    'src',
    'api',
    apiName,
    'models',
    'src',
    filename,
  );

  const extraImports = collectModelImports(schema, allSchemas);

  const content = env.render('model.dart.j2', {
    class_name: schema.dart_class_name,
    serializer_name: serializerName(schema.dart_class_name),
    filename_without_ext: filename.replace('.dart', ''),
    fields: schema.fields,
    has_built_list: hasBuiltList(schema.fields),
    extra_imports: extraImports,
    description: schema.description,
  });

  writeFile(filepath, content, dryRun);
  return filepath;
}

function generateEnum(env, schema, apiName, outputDir, dryRun) {
  const filename = schemaToEnumFilename(schema.name);
  const filepath = path.join(
    outputDir,
    'src',
    'api',
    apiName,
    'models',
    'src',
    filename,
  );

  const enumValues = (schema.enum_values || []).map((val) => ({
    wire_name: val,
    dart_name: sanitizeEnumValue(val),
  }));

  const className = schema.dart_class_name;
  const serializer = serializerName(className);

  const content = env.render('enum.dart.j2', {
    class_name: className,
    serializer_name: serializer,
    values_name: serializer,
    value_of_name: serializer,
    filename_without_ext: filename.replace('.dart', ''),
    enum_values: enumValues,
    description: schema.description,
  });

  writeFile(filepath, content, dryRun);
  return filepath;
}

// ──────────────────────────────────────────────
// Serializers generation
// ──────────────────────────────────────────────

function collectSerializerImports(schemas) {
  const imports = [];
  for (const schema of schemas) {
    if (schema.is_enum) {
      imports.push(`import '../${schemaToEnumFilename(schema.name)}';`);
    } else {
      imports.push(`import '../${schemaToDartFilename(schema.name)}';`);
    }
  }
  return imports.sort();
}

function generateSerializers(env, schemas, apiName, outputDir, dryRun) {
  const filepath = path.join(
    outputDir,
    'src',
    'api',
    apiName,
    'models',
    'src',
    'serializers',
    'serializers.dart',
  );

  const sortedClasses = schemas.map((s) => s.dart_class_name).sort();
  const modelImports = collectSerializerImports(schemas);

  const content = env.render('serializers.dart.j2', {
    model_imports: modelImports,
    model_classes: sortedClasses,
  });

  writeFile(filepath, content, dryRun);
  return filepath;
}

// ──────────────────────────────────────────────
// Endpoints generation
// ──────────────────────────────────────────────

function buildDartPathTemplate(p) {
  return p.replace(/\{(\w+)\}/g, (_m, g1) => `$${toCamelCase(g1)}`);
}

function buildEndpointData(endpoints, apiName) {
  const result = [];
  const seenNames = new Set();

  for (const ep of endpoints) {
    let constantName = pathToEndpointName(ep.path, ep.method, ep.operation_id);

    if (seenNames.has(constantName)) {
      const methodCap = ep.method[0].toUpperCase() + ep.method.slice(1).toLowerCase();
      constantName = `${constantName}${methodCap}`;
    }
    seenNames.add(constantName);

    const isDynamic = hasPathParams(ep.path);

    const pathParamsData = [];
    if (isDynamic) {
      for (const paramName of extractPathParams(ep.path)) {
        let dartType = 'String';
        let dartName = toCamelCase(paramName);
        for (const pp of ep.path_params) {
          if (pp.name === paramName) {
            dartType = pp.dart_type;
            dartName = pp.dart_name;
            break;
          }
        }
        pathParamsData.push({ dart_type: dartType, dart_name: dartName });
      }
    }

    result.push({
      path: ep.path,
      method: ep.method,
      summary: ep.summary,
      constant_name: constantName,
      is_dynamic: isDynamic,
      path_params: pathParamsData,
      dart_path_template: buildDartPathTemplate(ep.path),
    });
  }

  return result;
}

function generateEndpoints(env, parsed, apiName, outputDir, dryRun) {
  const apiDir = path.join(outputDir, 'src', 'api', apiName);
  const filepath = path.join(apiDir, 'endpoints.dart');

  const baseUrl = parsed.servers.length > 0 ? parsed.servers[0].url : '/';

  const endpointData = buildEndpointData(parsed.endpoints, apiName);

  const content = env.render('endpoints.dart.j2', {
    api_name_pascal: toPascalCase(apiName),
    base_url: baseUrl,
    endpoints: endpointData,
  });

  writeFile(filepath, content, dryRun);
  return filepath;
}

// ──────────────────────────────────────────────
// Service generation
// ──────────────────────────────────────────────

function determineErrorStrategy(errorSchemas) {
  if (!errorSchemas || errorSchemas.length === 0) {
    return ['Null', null, false];
  }

  const schemaNames = new Set(errorSchemas.map((es) => es.schema_name));

  if (schemaNames.size === 1) {
    const name = [...schemaNames][0];
    return [schemaToDartClass(name), name, false];
  }

  return ['Null', null, true];
}

function buildServiceMethods(endpoints, tag, apiName, _allSchemas) {
  const apiNamePascal = toPascalCase(apiName);
  const methods = [];

  const tagEndpoints = endpoints.filter((ep) => ep.tag === tag);

  for (const ep of tagEndpoints) {
    const methodName = methodNameFromEndpoint(ep.path, ep.method, ep.operation_id);

    const responseType = ep.response_schema
      ? schemaToDartClass(ep.response_schema)
      : 'Null';

    const [errorType, , useErrorParser] = determineErrorStrategy(ep.error_schemas);

    const constantName = pathToEndpointName(ep.path, ep.method, ep.operation_id);
    let endpointCall;
    if (hasPathParams(ep.path)) {
      const paramArgs = extractPathParams(ep.path).map(toCamelCase).join(', ');
      endpointCall = `${apiNamePascal}ApiEndpoints.${constantName}(${paramArgs})`;
    } else {
      endpointCall = `${apiNamePascal}ApiEndpoints.${constantName}`;
    }

    const requestBody = ep.request_body_schema != null;
    let requestBodyType = '';
    let requestBodyName = '';
    let requestBodySerializer = '';
    if (requestBody && ep.request_body_schema) {
      requestBodyType = schemaToDartClass(ep.request_body_schema);
      requestBodyName = toCamelCase(ep.request_body_schema);
      requestBodySerializer = `${requestBodyType}.serializer`;
    }

    const errorParserSchemas = [];
    if (useErrorParser) {
      for (const es of ep.error_schemas) {
        errorParserSchemas.push({
          status_code: es.status_code,
          serializer: `${schemaToDartClass(es.schema_name)}.serializer`,
        });
      }
    }

    methods.push({
      name: methodName,
      http_method: ep.method.toLowerCase(),
      summary: ep.summary,
      response_type: responseType,
      error_type: errorType,
      endpoint_call: endpointCall,
      path_params: [...ep.path_params],
      query_params: [...ep.query_params],
      request_body: requestBody,
      request_body_type: requestBodyType,
      request_body_name: requestBodyName,
      request_body_serializer: requestBodySerializer,
      error_parser_code: useErrorParser,
      error_schemas: errorParserSchemas,
      is_multipart: ep.is_multipart,
      multipart_fields: ep.multipart_fields.map((mf) => ({
        name: mf.name,
        dart_name: mf.dart_name,
        dart_type: mf.dart_type,
        is_required: mf.is_required,
        is_file: mf.is_file,
        is_array: mf.is_array,
        description: mf.description,
      })),
    });
  }

  return methods;
}

function collectServiceImports(methods, allSchemas) {
  const imports = new Set();
  const schemaMap = new Map(allSchemas.map((s) => [s.dart_class_name, s]));

  for (const method of methods) {
    if (method.response_type !== 'Null') {
      const schema = schemaMap.get(method.response_type);
      if (schema) {
        if (schema.is_enum) {
          imports.add(`import '../../models/src/${schemaToEnumFilename(schema.name)}';`);
        } else {
          imports.add(`import '../../models/src/${schemaToDartFilename(schema.name)}';`);
        }
      }
    }

    if (method.request_body && method.request_body_type) {
      const schema = schemaMap.get(method.request_body_type);
      if (schema) {
        imports.add(`import '../../models/src/${schemaToDartFilename(schema.name)}';`);
      }
    }

    for (const es of method.error_schemas || []) {
      const className = es.serializer.replace('.serializer', '');
      const schema = schemaMap.get(className);
      if (schema) {
        imports.add(`import '../../models/src/${schemaToDartFilename(schema.name)}';`);
      }
    }

    if (method.error_type !== 'Null') {
      const schema = schemaMap.get(method.error_type);
      if (schema) {
        imports.add(`import '../../models/src/${schemaToDartFilename(schema.name)}';`);
      }
    }
  }

  return [...imports].sort();
}

function generateServices(env, parsed, apiName, outputDir, dryRun) {
  const apiDir = path.join(outputDir, 'src', 'api', apiName, 'services', 'src');
  const generated = [];

  for (const tag of parsed.tags) {
    const className = tagToServiceClass(tag);
    const filename = tagToServiceFilename(tag);
    const filepath = path.join(apiDir, filename);

    const methods = buildServiceMethods(parsed.endpoints, tag, apiName, parsed.schemas);
    if (methods.length === 0) continue;

    const extraImports = collectServiceImports(methods, parsed.schemas);

    const hasBuiltListFlag = methods.some(
      (m) =>
        m.response_type.includes('BuiltList') ||
        m.query_params.some((p) => p.dart_type.includes('BuiltList')),
    );

    const hasSerializersFlag = methods.some(
      (m) => (m.request_body && !m.is_multipart) || m.error_parser_code,
    );

    const content = env.render('service.dart.j2', {
      class_name: className,
      tag,
      methods,
      has_built_list: hasBuiltListFlag,
      has_serializers: hasSerializersFlag,
      extra_imports: extraImports,
      description: null,
    });

    writeFile(filepath, content, dryRun);
    generated.push(filepath);
  }

  return generated;
}

// ──────────────────────────────────────────────
// API Client generation
// ──────────────────────────────────────────────

function generateApiClient(env, parsed, apiName, outputDir, dryRun) {
  const apiDir = path.join(outputDir, 'src', 'api', apiName);
  const filepath = path.join(apiDir, `${apiName}_api.dart`);

  const serviceClasses = [];
  const serviceImports = [];
  for (const tag of parsed.tags) {
    const cls = tagToServiceClass(tag);
    const fname = tagToServiceFilename(tag);
    const tagEndpoints = parsed.endpoints.filter((ep) => ep.tag === tag);
    if (tagEndpoints.length === 0) continue;
    serviceClasses.push(cls);
    serviceImports.push(`import 'services/src/${fname}';`);
  }

  const content = env.render('api_client.dart.j2', {
    api_name_pascal: toPascalCase(apiName),
    service_classes: serviceClasses,
    service_imports: serviceImports.sort(),
  });

  writeFile(filepath, content, dryRun);
  return filepath;
}

// ──────────────────────────────────────────────
// Network & Barrel generation
// ──────────────────────────────────────────────

function discoverExistingApis(outputDir) {
  const apiBase = path.join(outputDir, 'src', 'api');
  if (!fs.existsSync(apiBase)) return [];

  return fs
    .readdirSync(apiBase, { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() &&
        fs.existsSync(path.join(apiBase, d.name, 'endpoints.dart')),
    )
    .map((d) => d.name)
    .sort();
}

function generateNetwork(env, apiNames, outputDir, dryRun) {
  const filepath = path.join(outputDir, 'src', 'network.dart');

  const apis = [];
  const apiImports = [];
  for (const name of apiNames) {
    const pascal = toPascalCase(name);
    const clientClass = `${pascal}Api`;
    apis.push({ name_pascal: pascal, client_class: clientClass });
    apiImports.push(`import 'api/${name}/${name}_api.dart';`);
  }

  const content = env.render('network.dart.j2', {
    api_imports: apiImports.sort(),
    apis,
  });

  writeFile(filepath, content, dryRun);
  return filepath;
}

function generateModelsIndex(env, parsed, apiName, outputDir, dryRun) {
  const filepath = path.join(outputDir, 'src', 'api', apiName, 'models', 'index.dart');

  const exports = [];
  const schemasSorted = [...parsed.schemas].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  for (const schema of schemasSorted) {
    if (schema.is_enum) {
      exports.push(`export 'src/${schemaToEnumFilename(schema.name)}';`);
    } else {
      exports.push(`export 'src/${schemaToDartFilename(schema.name)}';`);
    }
  }
  exports.push("export 'src/serializers/serializers.dart';");

  const content = env.render('index.dart.j2', {
    exports: [...new Set(exports)].sort(),
  });

  writeFile(filepath, content, dryRun);
  return filepath;
}

function generateServicesIndex(env, parsed, apiName, outputDir, dryRun) {
  const servicesBase = path.join(outputDir, 'src', 'api', apiName, 'services');
  const servicesSrcDir = path.join(servicesBase, 'src');
  const filepath = path.join(servicesBase, 'index.dart');

  const exports = [];
  if (fs.existsSync(servicesSrcDir)) {
    const files = fs.readdirSync(servicesSrcDir).sort();
    for (const name of files) {
      if (path.extname(name) === '.dart') {
        exports.push(`export 'src/${name}';`);
      }
    }
  } else {
    for (const tag of parsed.tags) {
      const tagEndpoints = parsed.endpoints.filter((ep) => ep.tag === tag);
      if (tagEndpoints.length > 0) {
        exports.push(`export 'src/${tagToServiceFilename(tag)}';`);
      }
    }
  }

  const content = env.render('index.dart.j2', {
    exports: [...new Set(exports)].sort(),
  });

  writeFile(filepath, content, dryRun);
  return filepath;
}

function generateBarrel(env, _parsed, apiNames, packageName, outputDir, dryRun) {
  const filepath = path.join(outputDir, `${packageName}.dart`);

  const modelExports = apiNames.map(
    (name) => `export 'src/api/${name}/models/index.dart';`,
  );

  const apiExports = [];
  for (const name of apiNames) {
    apiExports.push(`export 'src/api/${name}/${name}_api.dart';`);
    apiExports.push(`export 'src/api/${name}/endpoints.dart';`);
    apiExports.push(`export 'src/api/${name}/services/index.dart';`);
  }
  apiExports.push("export 'src/network.dart';");

  const content = env.render('barrel.dart.j2', {
    package_name: packageName,
    model_exports: [...new Set(modelExports)].sort(),
    api_exports: [...new Set(apiExports)].sort(),
  });

  writeFile(filepath, content, dryRun);
  return filepath;
}

// ──────────────────────────────────────────────
// Main orchestration
// ──────────────────────────────────────────────

async function generate(specPath, apiName, outputDirStr, dryRun = false) {
  const outputDir = outputDirStr;

  const packageName = path.basename(path.dirname(outputDir));

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(scriptDir, '..', '..', '..', '..');
  const specsDir = path.join(projectRoot, 'specs');

  process.stdout.write(`\nOpenAPI Code Generator\n`);
  process.stdout.write(`  Spec: ${specPath}\n`);
  process.stdout.write(`  API: ${apiName}\n`);
  process.stdout.write(`  Output: ${outputDir}\n`);
  if (dryRun) {
    process.stdout.write(`  Mode: dry-run\n\n`);
  } else {
    process.stdout.write(`\n`);
  }

  process.stdout.write(`Step 1: Parsing OpenAPI spec...\n`);
  const parsed = await parseOpenapi(specPath, apiName, specsDir);
  process.stdout.write(
    `  Found ${parsed.schemas.length} schemas, ${parsed.endpoints.length} endpoints, ${parsed.tags.length} tags\n`,
  );

  const apiDir = path.join(outputDir, 'src', 'api', apiName);
  if (fs.existsSync(apiDir) && !dryRun) {
    fs.rmSync(apiDir, { recursive: true, force: true });
    process.stdout.write(`\n  Cleaned ${apiDir}\n`);
  }

  const env = createEnv();

  process.stdout.write(`\nStep 3: Generating models...\n`);
  const modelFiles = [];
  for (const schema of parsed.schemas) {
    const p = generateModel(env, schema, parsed.schemas, apiName, outputDir, dryRun);
    if (p) modelFiles.push(p);
  }

  process.stdout.write(`\nStep 4: Generating serializers...\n`);
  const serializersFile = generateSerializers(env, parsed.schemas, apiName, outputDir, dryRun);

  process.stdout.write(`\nStep 5: Generating endpoints...\n`);
  const endpointsFile = generateEndpoints(env, parsed, apiName, outputDir, dryRun);

  process.stdout.write(`\nStep 6: Generating services...\n`);
  const serviceFiles = generateServices(env, parsed, apiName, outputDir, dryRun);

  process.stdout.write(`\nStep 7: Generating API client...\n`);
  const apiClientFile = generateApiClient(env, parsed, apiName, outputDir, dryRun);

  process.stdout.write(`\nStep 8: Generating index files...\n`);
  const modelsIndexFile = generateModelsIndex(env, parsed, apiName, outputDir, dryRun);
  const servicesIndexFile = generateServicesIndex(env, parsed, apiName, outputDir, dryRun);

  process.stdout.write(`\nStep 9: Generating network & barrel...\n`);
  const allApiNames = discoverExistingApis(outputDir);
  if (!allApiNames.includes(apiName)) {
    allApiNames.push(apiName);
  }
  allApiNames.sort();

  const networkFile = generateNetwork(env, allApiNames, outputDir, dryRun);
  const barrelFile = generateBarrel(env, parsed, allApiNames, packageName, outputDir, dryRun);

  const total =
    modelFiles.length + 1 + 1 + serviceFiles.length + 1 + 2 + 1 + 1;
  const action = dryRun ? 'would generate' : 'generated';
  process.stdout.write(`\nDone! ${total} files ${action}.\n`);

  return {
    models: modelFiles,
    serializers: serializersFile,
    endpoints: endpointsFile,
    services: serviceFiles,
    api_client: apiClientFile,
    network: networkFile,
    barrel: barrelFile,
    models_index: modelsIndexFile,
    services_index: servicesIndexFile,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  await generate(args.spec, args.apiName, args.outputDir, args.dryRun);
  return 0;
}

main().then((code) => process.exit(code));
