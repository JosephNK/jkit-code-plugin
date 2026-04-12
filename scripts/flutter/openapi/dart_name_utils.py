#!/usr/bin/env python3
"""Dart 네이밍 변환 유틸리티.

OpenAPI 스키마 이름을 Dart 코드에서 사용할 수 있는
snake_case, camelCase, PascalCase로 변환합니다.
"""

import re

# Dart 예약어 (식별자로 직접 사용 불가)
DART_RESERVED_WORDS: frozenset[str] = frozenset({
    "abstract", "as", "assert", "async", "await", "break", "case", "catch",
    "class", "const", "continue", "covariant", "default", "deferred", "do",
    "dynamic", "else", "enum", "export", "extends", "extension", "external",
    "factory", "false", "final", "finally", "for", "function", "get", "hide",
    "if", "implements", "import", "in", "interface", "is", "late", "library",
    "mixin", "new", "null", "on", "operator", "part", "required", "rethrow",
    "return", "set", "show", "static", "super", "switch", "sync", "this",
    "throw", "true", "try", "typedef", "var", "void", "while", "with", "yield",
})

# Dart 내장 타입 이름 (클래스명 충돌 방지)
DART_BUILTIN_TYPES: frozenset[str] = frozenset({
    "int", "double", "String", "bool", "List", "Map", "Set", "Object",
    "Null", "Future", "Stream", "Iterable", "num", "dynamic", "void",
    "Function", "Never", "Type", "Symbol", "Record",
})

# BuiltValue 예약 필드명 (Builder/Built 클래스의 내장 멤버와 충돌)
BUILT_VALUE_RESERVED_FIELDS: frozenset[str] = frozenset({
    "update",       # Builder.update()
    "replace",      # Builder.replace()
    "build",        # Builder.build()
    "rebuild",      # Built.rebuild()
    "toBuilder",    # Built.toBuilder()
    "serializer",   # Built의 static serializer getter
    "hashCode",     # Object.hashCode
    "toString",     # Object.toString()
})


def _split_words(name: str) -> list[str]:
    """이름을 단어 단위로 분리합니다.

    camelCase, PascalCase, snake_case, kebab-case,
    그리고 연속 대문자(예: HTTPSConnection → HTTPS, Connection)를 처리합니다.
    """
    # 먼저 non-alphanumeric 문자를 구분자로 치환
    normalized = re.sub(r"[^a-zA-Z0-9]", " ", name)

    # 연속 대문자 + 소문자 시작 경계에 공백 삽입 (예: HTTPSConn → HTTPS Conn)
    normalized = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1 \2", normalized)

    # 소문자/숫자 → 대문자 경계에 공백 삽입 (예: userId → user Id)
    normalized = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", normalized)

    return [w for w in normalized.split() if w]


def to_snake_case(name: str) -> str:
    """이름을 snake_case로 변환합니다.

    >>> to_snake_case("UserProfile")
    'user_profile'
    >>> to_snake_case("HTTPSConnection")
    'https_connection'
    >>> to_snake_case("user-name")
    'user_name'
    """
    words = _split_words(name)
    return "_".join(w.lower() for w in words)


def to_camel_case(name: str) -> str:
    """이름을 camelCase로 변환합니다.

    >>> to_camel_case("user_name")
    'userName'
    >>> to_camel_case("UserProfile")
    'userProfile'
    """
    words = _split_words(name)
    if not words:
        return ""
    return words[0].lower() + "".join(w.capitalize() for w in words[1:])


def to_pascal_case(name: str) -> str:
    """이름을 PascalCase로 변환합니다.

    >>> to_pascal_case("user_name")
    'UserName'
    >>> to_pascal_case("HTTPSConnection")
    'HttpsConnection'
    """
    words = _split_words(name)
    return "".join(w.capitalize() for w in words)


def sanitize_identifier(name: str) -> str:
    """Dart 식별자로 안전하게 변환합니다.

    - 숫자로 시작하면 앞에 'n' 접두사 추가
    - 예약어이면 뒤에 '_' 접미사 추가
    - 비알파벳/숫자 문자를 언더스코어로 치환
    """
    # 비알파벳/숫자 문자 제거
    sanitized = re.sub(r"[^a-zA-Z0-9_]", "_", name)

    # 빈 문자열 방지
    if not sanitized:
        return "unnamed"

    # 숫자로 시작하면 접두사 추가
    if sanitized[0].isdigit():
        sanitized = f"n{sanitized}"

    # 예약어 충돌 방지
    if sanitized.lower() in DART_RESERVED_WORDS:
        sanitized = f"{sanitized}_"

    return sanitized


def sanitize_field_name(name: str) -> str:
    """BuiltValue 예약 필드명과 충돌하는 이름에 'Field' 접미사를 추가합니다.

    wireName은 변경하지 않고, Dart getter 이름만 변경하여
    Builder의 내장 메서드와의 이름 충돌을 방지합니다.

    >>> sanitize_field_name("update")
    'updateField'
    >>> sanitize_field_name("build")
    'buildField'
    >>> sanitize_field_name("userName")
    'userName'
    """
    if name in BUILT_VALUE_RESERVED_FIELDS:
        return f"{name}Field"
    return name


def sanitize_enum_value(value: str) -> str:
    """Enum 값을 유효한 Dart 식별자로 변환합니다.

    >>> sanitize_enum_value("ACTIVE")
    'active'
    >>> sanitize_enum_value("in-progress")
    'inProgress'
    >>> sanitize_enum_value("123_status")
    'n123Status'
    """
    camel = to_camel_case(value)
    return sanitize_identifier(camel)


def schema_to_dart_class(schema_name: str) -> str:
    """OpenAPI 스키마 이름을 Dart 클래스 이름으로 변환합니다.

    - PascalCase 적용
    - 내장 타입 충돌 방지

    >>> schema_to_dart_class("User")
    'User'
    >>> schema_to_dart_class("create_user_request")
    'CreateUserRequest'
    >>> schema_to_dart_class("VocabExtractionResponseDto")
    'VocabExtractionResponseDto'
    """
    pascal = to_pascal_case(schema_name)

    # 내장 타입과 충돌 방지
    if pascal in DART_BUILTIN_TYPES:
        pascal = f"{pascal}Dto"

    return pascal


def schema_to_dart_filename(schema_name: str) -> str:
    """OpenAPI 스키마 이름을 Dart 파일 이름으로 변환합니다.

    >>> schema_to_dart_filename("User")
    'user.dart'
    >>> schema_to_dart_filename("CreateUserRequest")
    'create_user_request.dart'
    """
    class_name = schema_to_dart_class(schema_name)
    return f"{to_snake_case(class_name)}.dart"


def schema_to_enum_class(schema_name: str) -> str:
    """OpenAPI enum 스키마 이름을 Dart enum 클래스 이름으로 변환합니다.

    PascalCase 적용 후 'Enum' 접미사를 추가합니다.
    이미 'Enum'으로 끝나면 중복 추가하지 않습니다.

    >>> schema_to_enum_class("platform")
    'PlatformEnum'
    >>> schema_to_enum_class("LevelEnum")
    'LevelEnum'
    >>> schema_to_enum_class("user_status")
    'UserStatusEnum'
    """
    pascal = to_pascal_case(schema_name)

    # 내장 타입과 충돌 방지
    if pascal in DART_BUILTIN_TYPES:
        pascal = f"{pascal}Dto"

    # Enum 접미사 추가 (중복 방지)
    if not pascal.endswith("Enum"):
        pascal = f"{pascal}Enum"

    return pascal


def schema_to_enum_filename(schema_name: str) -> str:
    """OpenAPI enum 스키마 이름을 Dart 파일 이름으로 변환합니다.

    >>> schema_to_enum_filename("Status")
    'status_enum.dart'
    """
    snake = to_snake_case(schema_name)
    return f"{snake}_enum.dart"


def tag_to_service_class(tag: str) -> str:
    """OpenAPI tag 이름을 서비스 클래스 이름으로 변환합니다.

    >>> tag_to_service_class("User Management")
    'UserManagementService'
    >>> tag_to_service_class("post")
    'PostService'
    """
    pascal = to_pascal_case(tag)
    if pascal.endswith("Service"):
        return pascal
    return f"{pascal}Service"


def tag_to_service_filename(tag: str) -> str:
    """OpenAPI tag 이름을 서비스 파일 이름으로 변환합니다.

    >>> tag_to_service_filename("User Management")
    'user_management_service.dart'
    """
    class_name = tag_to_service_class(tag)
    return f"{to_snake_case(class_name)}.dart"


def path_to_endpoint_name(path: str, method: str, operation_id: str | None = None) -> str:
    """API 경로를 엔드포인트 상수 이름으로 변환합니다.

    operation_id가 있으면 우선 사용하고, 없으면 경로 + 메서드로 생성합니다.

    >>> path_to_endpoint_name("/users/{id}", "GET", "getUser")
    'getUser'
    >>> path_to_endpoint_name("/users/{id}", "GET")
    'getUsersId'
    >>> path_to_endpoint_name("/users", "POST")
    'postUsers'
    """
    if operation_id:
        return to_camel_case(operation_id)

    # 경로에서 파라미터 표기를 제거하고 단어로 분리
    clean_path = re.sub(r"\{([^}]+)\}", r"\1", path)
    words = _split_words(clean_path)
    method_lower = method.lower()

    return method_lower + "".join(w.capitalize() for w in words)


def path_to_endpoint_constant(path: str) -> str:
    """API 경로를 Dart 문자열 상수 표현으로 변환합니다.

    동적 경로 파라미터가 있으면 static 메서드로 사용됩니다.

    >>> path_to_endpoint_constant("/users")
    '/users'
    >>> path_to_endpoint_constant("/users/{id}")
    '/users/{id}'
    """
    return path


def has_path_params(path: str) -> bool:
    """경로에 동적 파라미터가 있는지 확인합니다.

    >>> has_path_params("/users/{id}")
    True
    >>> has_path_params("/users")
    False
    """
    return bool(re.search(r"\{[^}]+\}", path))


def extract_path_params(path: str) -> list[str]:
    """경로에서 파라미터 이름을 추출합니다.

    >>> extract_path_params("/users/{userId}/posts/{postId}")
    ['userId', 'postId']
    """
    return re.findall(r"\{([^}]+)\}", path)


def method_name_from_endpoint(
    path: str,
    method: str,
    operation_id: str | None = None,
) -> str:
    """엔드포인트에서 서비스 메서드 이름을 생성합니다.

    >>> method_name_from_endpoint("/users/{id}", "GET", "getUser")
    'getUser'
    >>> method_name_from_endpoint("/users", "GET")
    'getUsers'
    >>> method_name_from_endpoint("/users", "POST")
    'postUsers'
    """
    if operation_id:
        return to_camel_case(operation_id)

    clean_path = re.sub(r"\{([^}]+)\}", "", path)
    words = _split_words(clean_path)
    method_lower = method.lower()

    if not words:
        return method_lower

    return method_lower + "".join(w.capitalize() for w in words)
