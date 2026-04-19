#!/usr/bin/env python3
"""OpenAPI 3.x 스펙 파서.

YAML/JSON 파일 또는 URL에서 OpenAPI 스펙을 파싱하여
코드 생성에 필요한 구조화된 데이터를 반환합니다.
"""

import json
import re
import sys
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urljoin, urlparse

import yaml

from dart_name_utils import (
    sanitize_field_name,
    schema_to_dart_class,
    schema_to_enum_class,
    to_camel_case,
    to_pascal_case,
    to_snake_case,
)

# ──────────────────────────────────────────────
# Data classes
# ──────────────────────────────────────────────


@dataclass(frozen=True)
class FieldInfo:
    """스키마의 개별 필드 정보."""

    name: str  # JSON wire name (e.g., "first_name")
    dart_name: str  # Dart field name (e.g., "firstName")
    dart_type: str  # Dart type (e.g., "String", "int", "BuiltList<UserModel>")
    is_nullable: bool
    is_enum: bool
    description: str | None = None
    fixme: str | None = None  # FIXME 주석 (Object 폴백 시 설정)


@dataclass(frozen=True)
class MultipartFieldInfo:
    """multipart/form-data 필드 정보."""

    name: str  # wire name (e.g., "image")
    dart_name: str  # Dart 파라미터명 (e.g., "image")
    dart_type: str  # "LeafMultipartFile" | "String" | "List<String>"
    is_required: bool
    is_file: bool  # format == "binary"
    is_array: bool  # type == "array"
    description: str | None = None


@dataclass(frozen=True)
class SchemaInfo:
    """OpenAPI 스키마 정보."""

    name: str  # Schema name from spec (e.g., "User")
    dart_class_name: str  # Dart class name (e.g., "UserModel")
    fields: tuple[FieldInfo, ...]
    is_enum: bool
    enum_values: tuple[str, ...] | None = None
    description: str | None = None


@dataclass(frozen=True)
class ErrorSchemaInfo:
    """에러 응답 스키마 정보."""

    status_code: int  # HTTP status code (400, 401, 500, ...)
    schema_name: str  # Schema name (e.g., "ValidationError")


@dataclass(frozen=True)
class EndpointInfo:
    """API 엔드포인트 정보."""

    path: str  # e.g., "/users/{id}"
    method: str  # GET, POST, PUT, DELETE, PATCH
    operation_id: str | None
    tag: str  # Swagger tag name
    summary: str | None
    request_body_schema: str | None
    response_schema: str | None
    error_schemas: tuple[ErrorSchemaInfo, ...]
    path_params: tuple[FieldInfo, ...]
    query_params: tuple[FieldInfo, ...]
    is_multipart: bool = False
    multipart_fields: tuple[MultipartFieldInfo, ...] = ()


@dataclass(frozen=True)
class ServerInfo:
    """API 서버 정보."""

    url: str
    description: str | None = None


@dataclass(frozen=True)
class ParsedSpec:
    """파싱된 OpenAPI 스펙 전체."""

    servers: tuple[ServerInfo, ...]
    schemas: tuple[SchemaInfo, ...]
    endpoints: tuple[EndpointInfo, ...]
    tags: tuple[str, ...]


# ──────────────────────────────────────────────
# Spec loading
# ──────────────────────────────────────────────


def _is_url(spec_path: str) -> bool:
    """경로가 URL인지 판별합니다."""
    return spec_path.startswith("http://") or spec_path.startswith("https://")


def _is_html(content: str) -> bool:
    """콘텐츠가 HTML인지 판별합니다."""
    stripped = content.strip()[:500].lower()
    return (
        stripped.startswith("<!doctype html")
        or stripped.startswith("<html")
        or "<!doctype html" in stripped
    )


def _fetch_url(url: str) -> str:
    """URL에서 콘텐츠를 다운로드합니다."""
    req = urllib.request.Request(
        url,
        headers={"Accept": "application/json, application/yaml, text/yaml"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


def _extract_spec_from_swagger_ui(html: str, base_url: str) -> str | None:
    """Swagger UI HTML 페이지에서 OpenAPI spec JSON을 추출합니다.

    두 가지 방법을 순서대로 시도합니다:
    1. {base_url}-json 패턴 (NestJS swagger 기본 패턴)
    2. swagger-ui-init.js에서 인라인 swaggerDoc 추출

    Args:
        html: Swagger UI HTML 콘텐츠.
        base_url: 원본 Swagger UI URL.

    Returns:
        스펙 JSON 문자열 또는 None.
    """
    # 방법 1: {url}-json 패턴 시도 (NestJS 등)
    json_url = base_url.rstrip("/") + "-json"
    try:
        content = _fetch_url(json_url)
        if not _is_html(content):
            parsed = json.loads(content)
            if "openapi" in parsed or "swagger" in parsed:
                print(f"  Resolved Swagger UI → {json_url}")
                return content
    except (urllib.error.URLError, json.JSONDecodeError, ValueError):
        pass

    # 방법 2: swagger-ui-init.js에서 인라인 swaggerDoc 추출
    init_js_match = re.search(
        r'src=["\']([^"\']*swagger-ui-init\.js)["\']',
        html,
    )
    if init_js_match:
        init_js_path = init_js_match.group(1)
        init_js_url = urljoin(base_url + "/", init_js_path)
        try:
            js_content = _fetch_url(init_js_url)
            # "swaggerDoc": { ... } 패턴에서 JSON 추출
            doc_match = re.search(r'"swaggerDoc"\s*:\s*(\{)', js_content)
            if doc_match:
                start = doc_match.start(1)
                spec_json = _extract_balanced_json(js_content, start)
                if spec_json:
                    print(
                        f"  Resolved Swagger UI → inline swaggerDoc from {init_js_url}"
                    )
                    return spec_json
        except (urllib.error.URLError, ValueError):
            pass

    return None


def _extract_balanced_json(text: str, start: int) -> str | None:
    """중괄호 균형을 맞춰 JSON 객체를 추출합니다.

    Args:
        text: 전체 텍스트.
        start: '{' 시작 위치.

    Returns:
        추출된 JSON 문자열 또는 None.
    """
    depth = 0
    in_string = False
    escape_next = False

    for i in range(start, len(text)):
        ch = text[i]

        if escape_next:
            escape_next = False
            continue

        if ch == "\\":
            escape_next = True
            continue

        if ch == '"':
            in_string = not in_string
            continue

        if in_string:
            continue

        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]

    return None


def _detect_content_format(content: str) -> str:
    """콘텐츠가 JSON인지 YAML인지 감지합니다.

    Returns:
        ``"json"`` 또는 ``"yaml"``.
    """
    try:
        json.loads(content)
        return "json"
    except (json.JSONDecodeError, ValueError):
        return "yaml"


def download_spec(url: str, save_path: Path) -> Path:
    """URL에서 스펙을 다운로드하여 로컬에 저장합니다.

    Swagger UI HTML 페이지가 반환되면 자동으로 실제 spec을 탐색합니다.
    콘텐츠 포맷(JSON/YAML)을 감지하여 적절한 확장자로 저장합니다.

    Args:
        url: OpenAPI 스펙 URL.
        save_path: 저장할 로컬 파일 경로 (확장자는 콘텐츠에 따라 자동 결정).

    Returns:
        저장된 파일 경로.
    """
    save_path.parent.mkdir(parents=True, exist_ok=True)

    content = _fetch_url(url)

    # HTML (Swagger UI) 감지 시 실제 spec 탐색
    if _is_html(content):
        print(f"  Detected Swagger UI HTML page at {url}")
        spec_content = _extract_spec_from_swagger_ui(content, url)
        if spec_content is None:
            print(
                f"Error: URL returned Swagger UI HTML but could not extract "
                f"the OpenAPI spec.\n"
                f"  Tried: {url}-json\n"
                f"  Tried: swagger-ui-init.js inline swaggerDoc\n"
                f"\n"
                f"Hint: Use the direct JSON/YAML spec URL instead. Common patterns:\n"
                f"  - {url}-json\n"
                f"  - {url.rstrip('/')}/swagger.json\n"
                f"  - {url.rstrip('/')}/openapi.json",
                file=sys.stderr,
            )
            sys.exit(1)
        content = spec_content

    # 콘텐츠 포맷에 맞는 확장자로 저장
    fmt = _detect_content_format(content)
    save_path = save_path.with_suffix(f".{fmt}")

    save_path.write_text(content, encoding="utf-8")
    print(f"  Downloaded spec to {save_path}")
    return save_path


def load_spec(spec_path: str, api_name: str, specs_dir: Path) -> dict:
    """스펙 파일을 로드합니다.

    URL이면 다운로드 후 로드하고, 로컬 파일이면 직접 로드합니다.

    Args:
        spec_path: 스펙 파일 경로 또는 URL.
        api_name: API 이름 (URL 다운로드 시 파일명에 사용).
        specs_dir: 스펙 파일 저장 디렉토리.

    Returns:
        파싱된 스펙 dict.
    """
    if _is_url(spec_path):
        local_path = download_spec(spec_path, specs_dir / api_name)
    else:
        local_path = Path(spec_path)

    if not local_path.exists():
        print(f"Error: Spec file not found: {local_path}", file=sys.stderr)
        sys.exit(1)

    content = local_path.read_text(encoding="utf-8")

    # JSON 또는 YAML 파싱
    try:
        return json.loads(content)
    except (json.JSONDecodeError, ValueError):
        return yaml.safe_load(content)


# ──────────────────────────────────────────────
# $ref resolution
# ──────────────────────────────────────────────


def _resolve_ref(spec: dict, ref: str) -> dict:
    """$ref 경로를 해석하여 해당 스키마 dict를 반환합니다.

    Args:
        spec: 전체 스펙 dict.
        ref: $ref 경로 (e.g., "#/components/schemas/User").

    Returns:
        해석된 스키마 dict.
    """
    if not ref.startswith("#/"):
        return {}

    parts = ref[2:].split("/")
    current = spec
    for part in parts:
        current = current.get(part, {})
    return current


def _resolve_schema(spec: dict, schema: dict) -> dict:
    """스키마에서 $ref를 재귀적으로 해석합니다.

    allOf도 병합 처리합니다.
    """
    if "$ref" in schema:
        return _resolve_ref(spec, schema["$ref"])

    if "allOf" in schema:
        return _merge_all_of(spec, schema["allOf"])

    return schema


def _merge_all_of(spec: dict, all_of_list: list[dict]) -> dict:
    """allOf 목록을 단일 스키마로 병합합니다."""
    merged: dict = {
        "type": "object",
        "properties": {},
        "required": [],
    }

    for item in all_of_list:
        resolved = _resolve_schema(spec, item)

        # properties 병합
        if "properties" in resolved:
            merged["properties"].update(resolved["properties"])

        # required 병합
        if "required" in resolved:
            merged["required"].extend(resolved["required"])

        # description은 첫 번째 것 사용
        if "description" in resolved and "description" not in merged:
            merged["description"] = resolved["description"]

    # required 중복 제거
    merged["required"] = list(dict.fromkeys(merged["required"]))

    return merged


# ──────────────────────────────────────────────
# Type mapping
# ──────────────────────────────────────────────

_OPENAPI_TO_DART: dict[str, str] = {
    "string": "String",
    "integer": "int",
    "number": "double",
    "boolean": "bool",
}


def _resolve_dart_type(
    spec: dict,
    schema: dict,
    visited: frozenset[str] = frozenset(),
) -> tuple[str, bool]:
    """OpenAPI 스키마를 Dart 타입 문자열로 변환합니다.

    Args:
        spec: 전체 스펙 dict.
        schema: 개별 필드/파라미터 스키마.
        visited: 순환 참조 방지용 방문 추적.

    Returns:
        (dart_type, is_enum) 튜플.
    """
    if "$ref" in schema:
        ref_name = schema["$ref"].split("/")[-1]

        # 순환 참조 감지: 타입명만 참조
        if ref_name in visited:
            return schema_to_dart_class(ref_name), False

        resolved = _resolve_ref(spec, schema["$ref"])
        new_visited = visited | {ref_name}

        # enum 체크
        if "enum" in resolved:
            return schema_to_enum_class(ref_name), True

        # allOf 체크
        if "allOf" in resolved:
            return schema_to_dart_class(ref_name), False

        # 일반 object
        if resolved.get("type") == "object" or "properties" in resolved:
            return schema_to_dart_class(ref_name), False

        # primitive $ref (드물지만 가능)
        return _resolve_dart_type(spec, resolved, new_visited)

    if "allOf" in schema:
        # allOf에 단일 $ref가 있으면 해당 타입으로 해석
        # (NestJS가 $ref에 description 추가 시 allOf 래핑 사용)
        refs = [item for item in schema["allOf"] if "$ref" in item]
        if len(refs) == 1:
            return _resolve_dart_type(spec, refs[0], visited)
        # 다중 allOf는 병합된 객체로 처리 (이름이 없으므로 Object로 폴백)
        return "Object", False

    schema_type = schema.get("type", "")
    schema_format = schema.get("format", "")

    # array
    if schema_type == "array":
        items = schema.get("items", {})
        item_type, is_item_enum = _resolve_dart_type(spec, items, visited)
        return f"BuiltList<{item_type}>", is_item_enum

    # string + format
    if schema_type == "string":
        if "enum" in schema:
            return "String", True  # inline enum - 이름 없으면 String으로 폴백
        if schema_format == "date-time":
            return "String", False
        if schema_format == "date":
            return "String", False
        if schema_format == "binary":
            return "String", False
        return "String", False

    # integer + format
    if schema_type == "integer":
        if schema_format == "int64":
            return "int", False
        return "int", False

    # number + format
    if schema_type == "number":
        if schema_format == "float":
            return "double", False
        return "double", False

    # primitive 매핑
    if schema_type in _OPENAPI_TO_DART:
        return _OPENAPI_TO_DART[schema_type], False

    # object without properties (dynamic map)
    if schema_type == "object":
        return "Object", False

    # fallback
    return "Object", False


# ──────────────────────────────────────────────
# Inline enum collection
# ──────────────────────────────────────────────


def _collect_inline_enums(
    spec: dict,
) -> tuple[list["SchemaInfo"], dict[tuple[str, str], str]]:
    """인라인 enum을 수집하고 필드-enum 매핑을 반환합니다.

    components/schemas의 프로퍼티에 직접 정의된 string enum을 감지하여
    별도의 SchemaInfo로 추출합니다. 동일한 (prop_name, values) 조합은
    하나의 enum으로 공유됩니다.

    Returns:
        (enum_schemas, field_enum_map) 튜플.
        - enum_schemas: 고유한 inline enum의 SchemaInfo 리스트.
        - field_enum_map: (schema_name, prop_name) → enum_name 매핑.
    """
    schemas_dict = spec.get("components", {}).get("schemas", {})

    # 기존 스키마 이름 수집 (이름 충돌 방지)
    existing_names: set[str] = set()
    for schema_name, schema in schemas_dict.items():
        existing_names.add(to_pascal_case(schema_name))

    # (prop_name, values) → [(schema_name, prop_name), ...] 그룹화
    enum_groups: dict[tuple[str, tuple[str, ...]], list[tuple[str, str]]] = {}

    for schema_name, schema in schemas_dict.items():
        # allOf 병합 처리
        resolved = _resolve_schema(spec, schema)
        properties = resolved.get("properties", {})

        for prop_name, prop_schema in properties.items():
            if prop_schema.get("type") == "string" and "enum" in prop_schema:
                key = (prop_name, tuple(str(v) for v in prop_schema["enum"]))
                if key not in enum_groups:
                    enum_groups[key] = []
                enum_groups[key].append((schema_name, prop_name))
            # array의 items에 인라인 enum이 있는 경우
            elif prop_schema.get("type") == "array":
                items = prop_schema.get("items", {})
                if items.get("type") == "string" and "enum" in items:
                    key = (prop_name, tuple(str(v) for v in items["enum"]))
                    if key not in enum_groups:
                        enum_groups[key] = []
                    enum_groups[key].append((schema_name, prop_name))

    # enum 스키마 생성 + 매핑 구축
    enum_schemas: list[SchemaInfo] = []
    field_enum_map: dict[tuple[str, str], str] = {}
    used_names: set[str] = set()

    for (prop_name, values), usages in enum_groups.items():
        # 기본 이름: PascalCase(prop_name) (e.g., device_type → DeviceType)
        enum_name = to_pascal_case(prop_name)

        # 기존 스키마 이름 또는 이미 사용된 enum 이름과 충돌 시 disambiguate
        if enum_name in existing_names or enum_name in used_names:
            first_schema = usages[0][0]
            enum_name = f"{to_pascal_case(first_schema)}{to_pascal_case(prop_name)}"

        used_names.add(enum_name)

        enum_schemas.append(
            SchemaInfo(
                name=enum_name,
                dart_class_name=schema_to_enum_class(enum_name),
                fields=(),
                is_enum=True,
                enum_values=values,
                description=None,
            )
        )

        for schema_name, pname in usages:
            field_enum_map[(schema_name, pname)] = enum_name

    return enum_schemas, field_enum_map


# ──────────────────────────────────────────────
# Schema parsing
# ──────────────────────────────────────────────


def _parse_schema(
    spec: dict,
    name: str,
    schema: dict,
    inline_enum_map: dict[tuple[str, str], str] | None = None,
) -> SchemaInfo:
    """단일 스키마를 SchemaInfo로 파싱합니다."""
    # enum 스키마
    if "enum" in schema:
        return SchemaInfo(
            name=name,
            dart_class_name=schema_to_enum_class(name),
            fields=(),
            is_enum=True,
            enum_values=tuple(str(v) for v in schema["enum"]),
            description=schema.get("description"),
        )

    # allOf 병합
    resolved = _resolve_schema(spec, schema)

    # properties 파싱
    properties = resolved.get("properties", {})
    required_fields = set(resolved.get("required", []))

    fields: list[FieldInfo] = []
    for prop_name, prop_schema in properties.items():
        dart_type, is_enum = _resolve_dart_type(spec, prop_schema)

        # inline enum → 실제 enum 클래스 이름으로 교체
        if is_enum and inline_enum_map:
            enum_name = inline_enum_map.get((name, prop_name))
            if enum_name:
                enum_class = schema_to_enum_class(enum_name)
                if dart_type == "String":
                    dart_type = enum_class
                elif dart_type == "BuiltList<String>":
                    dart_type = f"BuiltList<{enum_class}>"

        is_nullable = prop_name not in required_fields or prop_schema.get(
            "nullable", False
        )
        fixme = (
            f"Object type detected for '{prop_name}'. " "Replace with a specific type."
            if "Object" in dart_type
            else None
        )

        fields.append(
            FieldInfo(
                name=prop_name,
                dart_name=sanitize_field_name(to_camel_case(prop_name)),
                dart_type=dart_type,
                is_nullable=is_nullable,
                is_enum=is_enum,
                description=prop_schema.get("description"),
                fixme=fixme,
            )
        )

    return SchemaInfo(
        name=name,
        dart_class_name=schema_to_dart_class(name),
        fields=tuple(fields),
        is_enum=False,
        description=resolved.get("description"),
    )


def _parse_schemas(
    spec: dict,
    inline_enum_map: dict[tuple[str, str], str] | None = None,
) -> list[SchemaInfo]:
    """모든 스키마를 파싱합니다."""
    components = spec.get("components", {})
    schemas_dict = components.get("schemas", {})

    schemas: list[SchemaInfo] = []
    for name, schema in schemas_dict.items():
        schemas.append(_parse_schema(spec, name, schema, inline_enum_map))

    return schemas


# ──────────────────────────────────────────────
# Parameter parsing
# ──────────────────────────────────────────────


def _parse_parameter(spec: dict, param: dict) -> FieldInfo:
    """개별 파라미터를 FieldInfo로 파싱합니다."""
    param_schema = param.get("schema", {})
    dart_type, is_enum = _resolve_dart_type(spec, param_schema)
    fixme = (
        f"Object type detected for '{param['name']}'. " "Replace with a specific type."
        if "Object" in dart_type
        else None
    )

    return FieldInfo(
        name=param["name"],
        dart_name=to_camel_case(param["name"]),
        dart_type=dart_type,
        is_nullable=not param.get("required", False),
        is_enum=is_enum,
        description=param.get("description"),
        fixme=fixme,
    )


# ──────────────────────────────────────────────
# Endpoint parsing
# ──────────────────────────────────────────────


def _extract_response_schema(
    spec: dict, responses: dict, status_range: str
) -> str | None:
    """응답에서 스키마 이름을 추출합니다.

    Args:
        spec: 전체 스펙.
        responses: 엔드포인트 responses dict.
        status_range: "2xx" 또는 특정 코드.

    Returns:
        스키마 이름 또는 None.
    """
    # 정확한 코드 매칭 (200, 201 등)
    for code in responses:
        code_str = str(code)
        if status_range == "2xx" and code_str.startswith("2"):
            response = responses[code]
            if "$ref" in response:
                response = _resolve_ref(spec, response["$ref"])
            content = response.get("content", {})
            json_content = content.get("application/json", {})
            schema = json_content.get("schema", {})
            if "$ref" in schema:
                return schema["$ref"].split("/")[-1]
            if "allOf" in schema:
                # allOf는 첫 번째 $ref의 이름을 사용
                for item in schema["allOf"]:
                    if "$ref" in item:
                        return item["$ref"].split("/")[-1]
            # array response
            if schema.get("type") == "array":
                items = schema.get("items", {})
                if "$ref" in items:
                    return items["$ref"].split("/")[-1]
            # inline object with { success, data } wrapper pattern
            # e.g. { "type": "object", "properties": { "success": ..., "data": { "$ref": "..." } } }
            props = schema.get("properties", {})
            data_prop = props.get("data", {})
            if "$ref" in data_prop:
                title = schema.get("title")
                if title:
                    return title  # 래퍼 title 반환 (e.g., "SuccessVocabExtractionResponseDto")
                return data_prop["$ref"].split("/")[-1]  # title 없으면 내부 타입 폴백
            return None
    return None


def _extract_error_schemas(spec: dict, responses: dict) -> list[ErrorSchemaInfo]:
    """에러 응답에서 스키마 정보를 추출합니다."""
    error_schemas: list[ErrorSchemaInfo] = []

    for code, response in responses.items():
        code_str = str(code)
        if not (code_str.startswith("4") or code_str.startswith("5")):
            continue

        if "$ref" in response:
            response = _resolve_ref(spec, response["$ref"])

        content = response.get("content", {})
        json_content = content.get("application/json", {})
        schema = json_content.get("schema", {})

        if "$ref" in schema:
            schema_name = schema["$ref"].split("/")[-1]
            error_schemas.append(
                ErrorSchemaInfo(
                    status_code=int(code_str),
                    schema_name=schema_name,
                )
            )

    return error_schemas


def _extract_request_body_schema(spec: dict, operation: dict) -> str | None:
    """요청 바디에서 스키마 이름을 추출합니다."""
    request_body = operation.get("requestBody", {})
    if "$ref" in request_body:
        request_body = _resolve_ref(spec, request_body["$ref"])

    content = request_body.get("content", {})
    json_content = content.get("application/json", {})
    schema = json_content.get("schema", {})

    if "$ref" in schema:
        return schema["$ref"].split("/")[-1]

    return None


def _extract_multipart_fields(
    spec: dict,
    operation: dict,
) -> tuple[bool, tuple[MultipartFieldInfo, ...]]:
    """requestBody에서 multipart/form-data 필드를 추출합니다.

    Returns:
        (is_multipart, multipart_fields) 튜플.
    """
    request_body = operation.get("requestBody", {})
    if "$ref" in request_body:
        request_body = _resolve_ref(spec, request_body["$ref"])

    content = request_body.get("content", {})
    multipart_content = content.get("multipart/form-data", {})
    if not multipart_content:
        return False, ()

    schema = multipart_content.get("schema", {})
    schema = _resolve_schema(spec, schema)

    properties = schema.get("properties", {})
    required_fields = set(schema.get("required", []))

    if not properties:
        return True, ()

    fields: list[MultipartFieldInfo] = []
    for prop_name, prop_schema in properties.items():
        prop_type = prop_schema.get("type", "")
        prop_format = prop_schema.get("format", "")
        is_file = prop_type == "string" and prop_format == "binary"
        is_array = prop_type == "array"

        # 배열 내부 아이템이 binary 파일인지 확인
        if is_array:
            items = prop_schema.get("items", {})
            if items.get("type") == "string" and items.get("format") == "binary":
                is_file = True

        if is_file and is_array:
            dart_type = "List<LeafMultipartFile>"
        elif is_file:
            dart_type = "LeafMultipartFile"
        elif is_array:
            dart_type = "List<String>"
        else:
            dart_type = "String"

        fields.append(
            MultipartFieldInfo(
                name=prop_name,
                dart_name=to_camel_case(prop_name),
                dart_type=dart_type,
                is_required=prop_name in required_fields,
                is_file=is_file,
                is_array=is_array,
                description=prop_schema.get("description"),
            )
        )

    return True, tuple(fields)


def _collect_inline_response_schemas(spec: dict) -> list[SchemaInfo]:
    """인라인 응답 래퍼 스키마를 SchemaInfo로 수집합니다.

    엔드포인트 2xx 응답에서 { success, data } 패턴의 인라인 래퍼를 찾아
    BuiltValue 모델 생성에 필요한 SchemaInfo 리스트를 반환합니다.
    동일한 title의 래퍼는 중복 제거됩니다.
    """
    schemas: dict[str, SchemaInfo] = {}  # title → SchemaInfo (중복 제거)

    for _path, path_item in spec.get("paths", {}).items():
        for method in ("get", "post", "put", "delete", "patch"):
            operation = path_item.get(method)
            if not operation:
                continue

            responses = operation.get("responses", {})
            for code, response in responses.items():
                if not str(code).startswith("2"):
                    continue

                if "$ref" in response:
                    response = _resolve_ref(spec, response["$ref"])

                content = response.get("content", {})
                json_content = content.get("application/json", {})
                schema = json_content.get("schema", {})

                title = schema.get("title")
                if not title:
                    continue

                # { success, data } 패턴 확인: data에 $ref가 있어야 함
                props = schema.get("properties", {})
                data_prop = props.get("data", {})
                if "$ref" not in data_prop:
                    continue

                # 이미 수집된 title이면 스킵
                if title in schemas:
                    continue

                # SchemaInfo 생성
                schemas[title] = _parse_schema(spec, title, schema)

    return list(schemas.values())


def _parse_endpoints(spec: dict) -> list[EndpointInfo]:
    """모든 엔드포인트를 파싱합니다."""
    paths = spec.get("paths", {})
    endpoints: list[EndpointInfo] = []

    for path, path_item in paths.items():
        # path-level parameters
        path_level_params = path_item.get("parameters", [])

        for method in ("get", "post", "put", "delete", "patch"):
            operation = path_item.get(method)
            if operation is None:
                continue

            # tag 결정 (첫 번째 tag 또는 "default")
            tags = operation.get("tags", ["default"])
            tag = tags[0] if tags else "default"

            # parameters (path-level + operation-level 병합)
            all_params = path_level_params + operation.get("parameters", [])
            # $ref 해석
            resolved_params = []
            for p in all_params:
                if "$ref" in p:
                    resolved_params.append(_resolve_ref(spec, p["$ref"]))
                else:
                    resolved_params.append(p)

            path_params = tuple(
                _parse_parameter(spec, p)
                for p in resolved_params
                if p.get("in") == "path"
            )
            query_params = tuple(
                _parse_parameter(spec, p)
                for p in resolved_params
                if p.get("in") == "query"
            )

            # response schema
            responses = operation.get("responses", {})
            response_schema = _extract_response_schema(spec, responses, "2xx")

            # error schemas
            error_schemas = _extract_error_schemas(spec, responses)

            # request body schema
            request_body_schema = _extract_request_body_schema(spec, operation)

            # multipart/form-data fields
            is_multipart, multipart_fields = _extract_multipart_fields(
                spec,
                operation,
            )

            endpoints.append(
                EndpointInfo(
                    path=path,
                    method=method.upper(),
                    operation_id=operation.get("operationId"),
                    tag=tag,
                    summary=operation.get("summary"),
                    request_body_schema=request_body_schema,
                    response_schema=response_schema,
                    error_schemas=tuple(error_schemas),
                    path_params=path_params,
                    query_params=query_params,
                    is_multipart=is_multipart,
                    multipart_fields=multipart_fields,
                )
            )

    return endpoints


# ──────────────────────────────────────────────
# Server parsing
# ──────────────────────────────────────────────


def _parse_servers(spec: dict, source_url: str | None = None) -> list[ServerInfo]:
    """서버 목록을 파싱합니다.

    서버 URL이 상대 경로(예: ``/``)이고 ``source_url``이 제공되면,
    원본 URL의 origin(scheme + host + port)과 결합하여 절대 URL로 변환합니다.

    Args:
        spec: OpenAPI 스펙 dict.
        source_url: 스펙을 가져온 원본 URL (Swagger UI URL 등).
    """
    servers = spec.get("servers", [])

    # source_url에서 origin 추출 (예: http://localhost:3001)
    origin = None
    if source_url:
        parsed = urlparse(source_url)
        if parsed.scheme and parsed.netloc:
            origin = f"{parsed.scheme}://{parsed.netloc}"

    if not servers:
        url = origin if origin else "/"
        return [ServerInfo(url=url, description="Default")]

    result: list[ServerInfo] = []
    for s in servers:
        url = s.get("url", "/")
        # 상대 경로이고 origin이 있으면 절대 URL로 변환
        if origin and not url.startswith(("http://", "https://")):
            url = origin + (url if url.startswith("/") else f"/{url}")
        result.append(ServerInfo(url=url, description=s.get("description")))

    return result


# ──────────────────────────────────────────────
# Tag extraction
# ──────────────────────────────────────────────


def _extract_tags(spec: dict, endpoints: list[EndpointInfo]) -> list[str]:
    """사용된 태그 목록을 추출합니다.

    스펙의 tags 정의 순서를 우선하고, 엔드포인트에서만 사용된 태그를 추가합니다.
    """
    # 스펙에 정의된 태그 순서
    spec_tags = [t["name"] for t in spec.get("tags", [])]

    # 엔드포인트에서 사용된 태그
    endpoint_tags = list(dict.fromkeys(ep.tag for ep in endpoints))

    # 합치기 (스펙 순서 우선, 누락된 것 추가)
    seen = set(spec_tags)
    result = list(spec_tags)
    for tag in endpoint_tags:
        if tag not in seen:
            result.append(tag)
            seen.add(tag)

    return result


# ──────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────


def parse_openapi(
    spec_path: str,
    api_name: str,
    specs_dir: Path | None = None,
) -> ParsedSpec:
    """OpenAPI 스펙을 파싱하여 ParsedSpec을 반환합니다.

    Args:
        spec_path: 스펙 파일 경로 또는 URL.
        api_name: API 이름.
        specs_dir: 스펙 파일 저장 디렉토리 (URL 다운로드 시).

    Returns:
        ParsedSpec 객체.
    """
    if specs_dir is None:
        specs_dir = Path("specs")

    spec = load_spec(spec_path, api_name, specs_dir)

    source_url = spec_path if _is_url(spec_path) else None
    servers = _parse_servers(spec, source_url)

    # inline enum 수집 (스키마 파싱보다 먼저 실행)
    inline_enum_schemas, inline_enum_map = _collect_inline_enums(spec)

    schemas = _parse_schemas(spec, inline_enum_map)
    inline_schemas = _collect_inline_response_schemas(spec)
    all_schemas = schemas + inline_schemas + inline_enum_schemas
    endpoints = _parse_endpoints(spec)
    tags = _extract_tags(spec, endpoints)

    return ParsedSpec(
        servers=tuple(servers),
        schemas=tuple(all_schemas),
        endpoints=tuple(endpoints),
        tags=tuple(tags),
    )
