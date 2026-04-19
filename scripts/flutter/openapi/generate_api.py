#!/usr/bin/env python3
"""OpenAPI 코드 생성기 메인 오케스트레이션.

OpenAPI 스펙에서 BuiltValue 모델, 서비스, 엔드포인트, 클라이언트 코드를
Jinja2 템플릿으로 렌더링하여 생성합니다.

Usage:
    cd ${CLAUDE_PLUGIN_ROOT} && poetry run python scripts/flutter/openapi/generate_api.py <spec> <api_name> --output-dir <path> [--dry-run]
"""

import argparse
import re
import shutil
import sys
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from dart_name_utils import (
    extract_path_params,
    has_path_params,
    method_name_from_endpoint,
    path_to_endpoint_name,
    sanitize_enum_value,
    schema_to_dart_class,
    schema_to_dart_filename,
    schema_to_enum_class,
    schema_to_enum_filename,
    tag_to_service_class,
    tag_to_service_filename,
    to_camel_case,
    to_pascal_case,
)
from openapi_parser import (
    EndpointInfo,
    ErrorSchemaInfo,
    FieldInfo,
    MultipartFieldInfo,
    ParsedSpec,
    SchemaInfo,
    parse_openapi,
)

# ──────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────


def parse_args() -> argparse.Namespace:
    """CLI 인자를 파싱합니다."""
    parser = argparse.ArgumentParser(
        description="OpenAPI 스펙에서 Dart 코드를 생성합니다.",
    )
    parser.add_argument(
        "spec",
        help="OpenAPI 스펙 파일 경로 또는 URL",
    )
    parser.add_argument(
        "api_name",
        help="API 이름 (snake_case, 예: main, auth)",
    )
    parser.add_argument(
        "--output-dir",
        required=True,
        help="코드 생성 경로 (예: packages/myapp_network/lib/)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="미리보기 (파일 미생성)",
    )
    return parser.parse_args()


# ──────────────────────────────────────────────
# Template Engine
# ──────────────────────────────────────────────


def _create_jinja_env() -> Environment:
    """Jinja2 환경을 생성합니다."""
    templates_dir = Path(__file__).resolve().parent / "templates"
    return Environment(
        loader=FileSystemLoader(str(templates_dir)),
        keep_trailing_newline=True,
        trim_blocks=True,
        lstrip_blocks=True,
    )


# ──────────────────────────────────────────────
# File writing helpers
# ──────────────────────────────────────────────


def _write_file(path: Path, content: str, dry_run: bool) -> None:
    """파일을 생성합니다."""
    if dry_run:
        print(f"  [dry-run] {path}")
        return

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    print(f"  Created {path}")


# ──────────────────────────────────────────────
# Model generation
# ──────────────────────────────────────────────


def _has_built_list(fields: tuple[FieldInfo, ...]) -> bool:
    """필드 중 BuiltList를 사용하는 것이 있는지 확인합니다."""
    return any("BuiltList" in f.dart_type for f in fields)


def _collect_model_imports(
    schema: SchemaInfo,
    all_schemas: tuple[SchemaInfo, ...],
) -> list[str]:
    """모델 파일에 필요한 import 문을 수집합니다."""
    imports: set[str] = set()
    schema_names = {s.name for s in all_schemas}

    for field in schema.fields:
        # BuiltList<XxxModel> 또는 XxxModel 참조 추출
        type_str = field.dart_type
        # BuiltList 내부 타입 추출
        match = re.search(r"BuiltList<(\w+)>", type_str)
        ref_type = match.group(1) if match else type_str

        # 다른 모델 참조인지 확인
        for other in all_schemas:
            if other.dart_class_name == ref_type and other.name != schema.name:
                if other.is_enum:
                    imports.add(f"import '{schema_to_enum_filename(other.name)}';")
                else:
                    imports.add(f"import '{schema_to_dart_filename(other.name)}';")

    return sorted(imports)


def _serializer_name(class_name: str) -> str:
    """BuiltValue serializer 이름을 생성합니다 (lowerCamelCase)."""
    return class_name[0].lower() + class_name[1:]


def generate_model(
    env: Environment,
    schema: SchemaInfo,
    all_schemas: tuple[SchemaInfo, ...],
    api_name: str,
    output_dir: Path,
    dry_run: bool,
) -> Path | None:
    """BuiltValue 모델 파일을 생성합니다."""
    if schema.is_enum:
        return generate_enum(env, schema, api_name, output_dir, dry_run)

    filename = schema_to_dart_filename(schema.name)
    filepath = output_dir / "src" / "api" / api_name / "models" / "src" / filename

    extra_imports = _collect_model_imports(schema, all_schemas)

    template = env.get_template("model.dart.j2")
    content = template.render(
        class_name=schema.dart_class_name,
        serializer_name=_serializer_name(schema.dart_class_name),
        filename_without_ext=filename.replace(".dart", ""),
        fields=schema.fields,
        has_built_list=_has_built_list(schema.fields),
        extra_imports=extra_imports,
        description=schema.description,
    )

    _write_file(filepath, content, dry_run)
    return filepath


def generate_enum(
    env: Environment,
    schema: SchemaInfo,
    api_name: str,
    output_dir: Path,
    dry_run: bool,
) -> Path | None:
    """Enum 파일을 생성합니다."""
    filename = schema_to_enum_filename(schema.name)
    filepath = output_dir / "src" / "api" / api_name / "models" / "src" / filename

    enum_values = []
    for val in schema.enum_values or ():
        enum_values.append(
            {
                "wire_name": val,
                "dart_name": sanitize_enum_value(val),
            }
        )

    class_name = schema.dart_class_name
    # EnumClass용 serializer name (lowerCamelCase)
    serializer_name = _serializer_name(class_name)

    # values getter name (lowerCamelCase + Values)
    values_name = _serializer_name(class_name)

    # valueOf name (lowerCamelCase + ValueOf → lowerCamelCase)
    value_of_name = _serializer_name(class_name)

    template = env.get_template("enum.dart.j2")
    content = template.render(
        class_name=class_name,
        serializer_name=serializer_name,
        values_name=values_name,
        value_of_name=value_of_name,
        filename_without_ext=filename.replace(".dart", ""),
        enum_values=enum_values,
        description=schema.description,
    )

    _write_file(filepath, content, dry_run)
    return filepath


# ──────────────────────────────────────────────
# Serializers generation
# ──────────────────────────────────────────────


def _collect_serializer_imports(
    schemas: tuple[SchemaInfo, ...],
) -> list[str]:
    """serializers.dart에 필요한 import 문을 수집합니다.

    serializers.dart가 models/serializers/ 하위에 있으므로
    모델 파일 경로에 '../' prefix를 추가합니다.
    """
    imports: list[str] = []
    for schema in schemas:
        if schema.is_enum:
            imports.append(f"import '../{schema_to_enum_filename(schema.name)}';")
        else:
            imports.append(f"import '../{schema_to_dart_filename(schema.name)}';")
    return sorted(imports)


def generate_serializers(
    env: Environment,
    schemas: tuple[SchemaInfo, ...],
    api_name: str,
    output_dir: Path,
    dry_run: bool,
) -> Path:
    """serializers.dart 파일을 생성합니다.

    기존 파일이 있으면 모델 목록을 병합합니다.
    기존 클래스 중 모델 파일이 존재하지 않는 것은 제거합니다.
    """
    filepath = (
        output_dir
        / "src"
        / "api"
        / api_name
        / "models"
        / "src"
        / "serializers"
        / "serializers.dart"
    )

    sorted_classes = sorted(s.dart_class_name for s in schemas)
    model_imports = _collect_serializer_imports(schemas)

    template = env.get_template("serializers.dart.j2")
    content = template.render(
        model_imports=model_imports,
        model_classes=sorted_classes,
    )

    _write_file(filepath, content, dry_run)
    return filepath


# ──────────────────────────────────────────────
# Endpoints generation
# ──────────────────────────────────────────────


def _build_dart_path_template(path: str) -> str:
    """Dart 문자열 보간 형식의 경로를 생성합니다.

    예: "/users/{userId}" → "/users/$userId"
    """
    return re.sub(r"\{(\w+)\}", lambda m: f"${to_camel_case(m.group(1))}", path)


def _build_endpoint_data(
    endpoints: tuple[EndpointInfo, ...],
    api_name: str,
) -> list[dict]:
    """엔드포인트 데이터를 템플릿용으로 변환합니다."""
    result: list[dict] = []
    seen_names: set[str] = set()

    for ep in endpoints:
        constant_name = path_to_endpoint_name(ep.path, ep.method, ep.operation_id)

        # 중복 이름 방지
        if constant_name in seen_names:
            constant_name = f"{constant_name}{ep.method.capitalize()}"
        seen_names.add(constant_name)

        is_dynamic = has_path_params(ep.path)

        path_params = []
        if is_dynamic:
            for param_name in extract_path_params(ep.path):
                # endpoint의 path_params에서 타입 찾기
                dart_type = "String"
                dart_name = to_camel_case(param_name)
                for pp in ep.path_params:
                    if pp.name == param_name:
                        dart_type = pp.dart_type
                        dart_name = pp.dart_name
                        break
                path_params.append(
                    {
                        "dart_type": dart_type,
                        "dart_name": dart_name,
                    }
                )

        result.append(
            {
                "path": ep.path,
                "method": ep.method,
                "summary": ep.summary,
                "constant_name": constant_name,
                "is_dynamic": is_dynamic,
                "path_params": path_params,
                "dart_path_template": _build_dart_path_template(ep.path),
            }
        )

    return result


def generate_endpoints(
    env: Environment,
    parsed: ParsedSpec,
    api_name: str,
    output_dir: Path,
    dry_run: bool,
) -> Path:
    """endpoints.dart 파일을 생성합니다."""
    api_dir = output_dir / "src" / "api" / api_name
    filepath = api_dir / "endpoints.dart"

    base_url = parsed.servers[0].url if parsed.servers else "/"

    endpoint_data = _build_endpoint_data(parsed.endpoints, api_name)

    template = env.get_template("endpoints.dart.j2")
    content = template.render(
        api_name_pascal=to_pascal_case(api_name),
        base_url=base_url,
        endpoints=endpoint_data,
    )

    _write_file(filepath, content, dry_run)
    return filepath


# ──────────────────────────────────────────────
# Service generation
# ──────────────────────────────────────────────


def _determine_error_strategy(
    error_schemas: tuple[ErrorSchemaInfo, ...],
) -> tuple[str, str | None, bool]:
    """에러 처리 전략을 결정합니다.

    Returns:
        (error_type, uniform_error_schema_name, use_error_parser)
        - error_type: Dart 제네릭 E 타입 ("Null" 또는 "ErrorBodyModel" 등)
        - uniform_error_schema_name: 동일 에러 스키마 이름 (있으면)
        - use_error_parser: errorParser 사용 여부
    """
    if not error_schemas:
        return "Null", None, False

    schema_names = {es.schema_name for es in error_schemas}

    if len(schema_names) == 1:
        # 모든 에러가 같은 스키마
        name = next(iter(schema_names))
        return schema_to_dart_class(name), name, False

    # 에러 스키마가 다름 → errorParser 사용
    return "Null", None, True


def _build_service_methods(
    endpoints: tuple[EndpointInfo, ...],
    tag: str,
    api_name: str,
    all_schemas: tuple[SchemaInfo, ...],
) -> list[dict]:
    """서비스 메서드 데이터를 빌드합니다."""
    api_name_pascal = to_pascal_case(api_name)
    methods: list[dict] = []
    schema_map = {s.name: s for s in all_schemas}

    tag_endpoints = [ep for ep in endpoints if ep.tag == tag]

    for ep in tag_endpoints:
        method_name = method_name_from_endpoint(ep.path, ep.method, ep.operation_id)

        # Response type
        if ep.response_schema:
            response_type = schema_to_dart_class(ep.response_schema)
        else:
            response_type = "Null"

        # Error strategy
        error_type, _, use_error_parser = _determine_error_strategy(ep.error_schemas)

        # Endpoint call
        constant_name = path_to_endpoint_name(ep.path, ep.method, ep.operation_id)
        if has_path_params(ep.path):
            param_args = ", ".join(
                to_camel_case(p) for p in extract_path_params(ep.path)
            )
            endpoint_call = (
                f"{api_name_pascal}ApiEndpoints.{constant_name}({param_args})"
            )
        else:
            endpoint_call = f"{api_name_pascal}ApiEndpoints.{constant_name}"

        # Request body
        request_body = ep.request_body_schema is not None
        request_body_type = ""
        request_body_name = ""
        request_body_serializer = ""
        if request_body and ep.request_body_schema:
            request_body_type = schema_to_dart_class(ep.request_body_schema)
            request_body_name = to_camel_case(ep.request_body_schema)
            request_body_serializer = f"{request_body_type}.serializer"

        # Error parser schemas
        error_parser_schemas = []
        if use_error_parser:
            for es in ep.error_schemas:
                error_parser_schemas.append(
                    {
                        "status_code": es.status_code,
                        "serializer": f"{schema_to_dart_class(es.schema_name)}.serializer",
                    }
                )

        methods.append(
            {
                "name": method_name,
                "http_method": ep.method.lower(),
                "summary": ep.summary,
                "response_type": response_type,
                "error_type": error_type,
                "endpoint_call": endpoint_call,
                "path_params": list(ep.path_params),
                "query_params": list(ep.query_params),
                "request_body": request_body,
                "request_body_type": request_body_type,
                "request_body_name": request_body_name,
                "request_body_serializer": request_body_serializer,
                "error_parser_code": use_error_parser,
                "error_schemas": error_parser_schemas,
                "is_multipart": ep.is_multipart,
                "multipart_fields": [
                    {
                        "name": mf.name,
                        "dart_name": mf.dart_name,
                        "dart_type": mf.dart_type,
                        "is_required": mf.is_required,
                        "is_file": mf.is_file,
                        "is_array": mf.is_array,
                        "description": mf.description,
                    }
                    for mf in ep.multipart_fields
                ],
            }
        )

    return methods


def _collect_service_imports(
    methods: list[dict],
    all_schemas: tuple[SchemaInfo, ...],
) -> list[str]:
    """서비스 파일에 필요한 모델 import 문을 수집합니다."""
    imports: set[str] = set()
    schema_map = {s.dart_class_name: s for s in all_schemas}

    for method in methods:
        # response type
        if method["response_type"] != "Null":
            schema = schema_map.get(method["response_type"])
            if schema:
                if schema.is_enum:
                    imports.add(
                        f"import '../../models/src/{schema_to_enum_filename(schema.name)}';"
                    )
                else:
                    imports.add(
                        f"import '../../models/src/{schema_to_dart_filename(schema.name)}';"
                    )

        # request body type
        if method["request_body"] and method["request_body_type"]:
            schema = schema_map.get(method["request_body_type"])
            if schema:
                imports.add(
                    f"import '../../models/src/{schema_to_dart_filename(schema.name)}';"
                )

        # error schemas
        for es in method.get("error_schemas", []):
            serializer_str = es["serializer"]
            # "XxxModel.serializer" → "XxxModel"
            class_name = serializer_str.replace(".serializer", "")
            schema = schema_map.get(class_name)
            if schema:
                imports.add(
                    f"import '../../models/src/{schema_to_dart_filename(schema.name)}';"
                )

        # error type (uniform E type)
        if method["error_type"] != "Null":
            schema = schema_map.get(method["error_type"])
            if schema:
                imports.add(
                    f"import '../../models/src/{schema_to_dart_filename(schema.name)}';"
                )

    return sorted(imports)


def generate_services(
    env: Environment,
    parsed: ParsedSpec,
    api_name: str,
    output_dir: Path,
    dry_run: bool,
) -> list[Path]:
    """태그별 서비스 파일을 생성합니다."""
    api_dir = output_dir / "src" / "api" / api_name / "services" / "src"
    generated: list[Path] = []

    for tag in parsed.tags:
        class_name = tag_to_service_class(tag)
        filename = tag_to_service_filename(tag)
        filepath = api_dir / filename

        methods = _build_service_methods(
            parsed.endpoints,
            tag,
            api_name,
            parsed.schemas,
        )

        if not methods:
            continue

        extra_imports = _collect_service_imports(methods, parsed.schemas)

        # BuiltList 사용 여부 확인
        has_built_list_flag = any(
            "BuiltList" in m["response_type"]
            or any("BuiltList" in p.dart_type for p in m["query_params"])
            for m in methods
        )

        # serializers import 필요 여부 (request body 또는 error parser 사용 시)
        # multipart는 serializers 불필요하므로 제외
        has_serializers_flag = any(
            (m["request_body"] and not m.get("is_multipart"))
            or m.get("error_parser_code")
            for m in methods
        )

        template = env.get_template("service.dart.j2")
        content = template.render(
            class_name=class_name,
            tag=tag,
            methods=methods,
            has_built_list=has_built_list_flag,
            has_serializers=has_serializers_flag,
            extra_imports=extra_imports,
            description=None,
        )

        _write_file(filepath, content, dry_run)
        generated.append(filepath)

    return generated


# ──────────────────────────────────────────────
# API Client generation
# ──────────────────────────────────────────────


def generate_api_client(
    env: Environment,
    parsed: ParsedSpec,
    api_name: str,
    output_dir: Path,
    dry_run: bool,
) -> Path:
    """API 클라이언트 파일을 생성합니다."""
    api_dir = output_dir / "src" / "api" / api_name
    filepath = api_dir / f"{api_name}_api.dart"

    service_classes = []
    service_imports = []
    for tag in parsed.tags:
        cls = tag_to_service_class(tag)
        fname = tag_to_service_filename(tag)
        # 해당 태그에 실제 엔드포인트가 있는지 확인
        tag_endpoints = [ep for ep in parsed.endpoints if ep.tag == tag]
        if not tag_endpoints:
            continue
        service_classes.append(cls)
        service_imports.append(f"import 'services/src/{fname}';")

    template = env.get_template("api_client.dart.j2")
    content = template.render(
        api_name_pascal=to_pascal_case(api_name),
        service_classes=service_classes,
        service_imports=sorted(service_imports),
    )

    _write_file(filepath, content, dry_run)
    return filepath


# ──────────────────────────────────────────────
# Network & Barrel generation
# ──────────────────────────────────────────────


def _discover_existing_apis(output_dir: Path) -> list[str]:
    """기존에 생성된 API 디렉토리를 탐색합니다."""
    api_base = output_dir / "src" / "api"
    if not api_base.exists():
        return []

    return sorted(
        d.name
        for d in api_base.iterdir()
        if d.is_dir() and (d / "endpoints.dart").exists()
    )


def generate_network(
    env: Environment,
    api_names: list[str],
    output_dir: Path,
    dry_run: bool,
) -> Path:
    """network.dart 진입점 파일을 생성합니다."""
    filepath = output_dir / "src" / "network.dart"

    apis = []
    api_imports = []
    for name in api_names:
        pascal = to_pascal_case(name)
        client_class = f"{pascal}Api"
        apis.append(
            {
                "name_pascal": pascal,
                "client_class": client_class,
            }
        )
        api_imports.append(f"import 'api/{name}/{name}_api.dart';")

    template = env.get_template("network.dart.j2")
    content = template.render(
        api_imports=sorted(api_imports),
        apis=apis,
    )

    _write_file(filepath, content, dry_run)
    return filepath


def generate_models_index(
    env: Environment,
    parsed: ParsedSpec,
    api_name: str,
    output_dir: Path,
    dry_run: bool,
) -> Path:
    """api/{name}/models/index.dart를 생성합니다."""
    filepath = output_dir / "src" / "api" / api_name / "models" / "index.dart"

    exports: list[str] = []
    for schema in sorted(parsed.schemas, key=lambda s: s.name):
        if schema.is_enum:
            exports.append(f"export 'src/{schema_to_enum_filename(schema.name)}';")
        else:
            exports.append(f"export 'src/{schema_to_dart_filename(schema.name)}';")
    exports.append("export 'src/serializers/serializers.dart';")

    template = env.get_template("index.dart.j2")
    content = template.render(exports=sorted(set(exports)))

    _write_file(filepath, content, dry_run)
    return filepath


def generate_services_index(
    env: Environment,
    parsed: ParsedSpec,
    api_name: str,
    output_dir: Path,
    dry_run: bool,
) -> Path:
    """api/{name}/services/index.dart를 생성합니다."""
    services_base = output_dir / "src" / "api" / api_name / "services"
    services_src_dir = services_base / "src"
    filepath = services_base / "index.dart"

    exports: list[str] = []
    if services_src_dir.exists():
        for sfile in sorted(services_src_dir.iterdir()):
            if sfile.suffix == ".dart":
                exports.append(f"export 'src/{sfile.name}';")
    else:
        for tag in parsed.tags:
            tag_endpoints = [ep for ep in parsed.endpoints if ep.tag == tag]
            if tag_endpoints:
                exports.append(f"export 'src/{tag_to_service_filename(tag)}';")

    template = env.get_template("index.dart.j2")
    content = template.render(exports=sorted(set(exports)))

    _write_file(filepath, content, dry_run)
    return filepath


def generate_barrel(
    env: Environment,
    parsed: ParsedSpec,
    api_names: list[str],
    package_name: str,
    output_dir: Path,
    dry_run: bool,
) -> Path:
    """barrel exports 파일을 생성합니다."""
    filepath = output_dir / f"{package_name}.dart"

    model_exports: list[str] = []
    for name in api_names:
        model_exports.append(f"export 'src/api/{name}/models/index.dart';")

    api_exports: list[str] = []
    for name in api_names:
        api_exports.append(f"export 'src/api/{name}/{name}_api.dart';")
        api_exports.append(f"export 'src/api/{name}/endpoints.dart';")
        api_exports.append(f"export 'src/api/{name}/services/index.dart';")
    api_exports.append("export 'src/network.dart';")

    template = env.get_template("barrel.dart.j2")
    content = template.render(
        package_name=package_name,
        model_exports=sorted(set(model_exports)),
        api_exports=sorted(set(api_exports)),
    )

    _write_file(filepath, content, dry_run)
    return filepath


# ──────────────────────────────────────────────
# Main orchestration
# ──────────────────────────────────────────────


def generate(
    spec_path: str,
    api_name: str,
    output_dir_str: str,
    dry_run: bool = False,
) -> dict:
    """전체 코드 생성을 수행합니다.

    Args:
        spec_path: 스펙 파일 경로 또는 URL.
        api_name: API 이름.
        output_dir_str: 출력 디렉토리 경로.
        dry_run: True이면 미리보기만.

    Returns:
        생성된 파일 정보 dict.
    """
    output_dir = Path(output_dir_str)

    # 패키지 이름 추론 (output_dir의 상위 디렉토리 이름)
    # 예: packages/myapp_network/lib/ → myapp_network
    package_name = output_dir.parent.name

    # 스펙 파서에서 사용할 specs 디렉토리
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent.parent.parent.parent
    specs_dir = project_root / "specs"

    print(f"\nOpenAPI Code Generator")
    print(f"  Spec: {spec_path}")
    print(f"  API: {api_name}")
    print(f"  Output: {output_dir}")
    if dry_run:
        print(f"  Mode: dry-run\n")
    else:
        print()

    # 1. Parse spec
    print("Step 1: Parsing OpenAPI spec...")
    parsed = parse_openapi(spec_path, api_name, specs_dir)
    print(
        f"  Found {len(parsed.schemas)} schemas, {len(parsed.endpoints)} endpoints, {len(parsed.tags)} tags"
    )

    # 2. Clean existing generated directory
    api_dir = output_dir / "src" / "api" / api_name
    if api_dir.exists() and not dry_run:
        shutil.rmtree(api_dir)
        print(f"\n  Cleaned {api_dir}")

    # 3. Initialize Jinja2
    env = _create_jinja_env()

    # 4. Generate models
    print("\nStep 3: Generating models...")
    model_files: list[Path] = []
    for schema in parsed.schemas:
        path = generate_model(
            env, schema, parsed.schemas, api_name, output_dir, dry_run
        )
        if path:
            model_files.append(path)

    # 5. Generate serializers
    print("\nStep 4: Generating serializers...")
    serializers_file = generate_serializers(
        env, parsed.schemas, api_name, output_dir, dry_run
    )

    # 6. Generate endpoints
    print("\nStep 5: Generating endpoints...")
    endpoints_file = generate_endpoints(env, parsed, api_name, output_dir, dry_run)

    # 7. Generate services
    print("\nStep 6: Generating services...")
    service_files = generate_services(env, parsed, api_name, output_dir, dry_run)

    # 8. Generate API client
    print("\nStep 7: Generating API client...")
    api_client_file = generate_api_client(env, parsed, api_name, output_dir, dry_run)

    # 9. Generate index files
    print("\nStep 8: Generating index files...")
    models_index_file = generate_models_index(
        env, parsed, api_name, output_dir, dry_run
    )
    services_index_file = generate_services_index(
        env, parsed, api_name, output_dir, dry_run
    )

    # 10. Generate network + barrel
    print("\nStep 9: Generating network & barrel...")
    all_api_names = _discover_existing_apis(output_dir)
    if api_name not in all_api_names:
        all_api_names.append(api_name)
    all_api_names.sort()

    network_file = generate_network(env, all_api_names, output_dir, dry_run)
    barrel_file = generate_barrel(
        env, parsed, all_api_names, package_name, output_dir, dry_run
    )

    # Summary
    total = (
        len(model_files) + 1 + 1 + len(service_files) + 1 + 2 + 1 + 1
    )  # models + serializers + endpoints + services + api_client + indexes + network + barrel
    action = "would generate" if dry_run else "generated"
    print(f"\nDone! {total} files {action}.")

    return {
        "models": [str(p) for p in model_files],
        "serializers": str(serializers_file),
        "endpoints": str(endpoints_file),
        "services": [str(p) for p in service_files],
        "api_client": str(api_client_file),
        "network": str(network_file),
        "barrel": str(barrel_file),
    }


def main() -> int:
    """CLI 진입점."""
    args = parse_args()
    generate(
        spec_path=args.spec,
        api_name=args.api_name,
        output_dir_str=args.output_dir,
        dry_run=args.dry_run,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
