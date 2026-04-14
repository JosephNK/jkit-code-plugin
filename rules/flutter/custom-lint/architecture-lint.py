#!/usr/bin/env python3
"""Flutter hexagonal architecture linter.

Scans Dart source files and validates import rules based on
Hexagonal Architecture layer boundaries.

Sources:
    - rules/flutter/base/architecture.md
    - rules/flutter/base/conventions.md
    - rules/flutter/custom-lint/architecture/arch_rules_test.dart

Rules:
    E1  entities/ must only import codegen annotations (freezed_annotation, etc.)
    E2  usecases/ must not import adapters/, bloc/, or presentation/
    E3  bloc/ must not import adapters/ or ports/ directly
    E4  No external SDK (dio, http, etc.) in domain layers (entities, ports, usecases, exceptions)
    E5  ports/ must not import framework packages (dio, flutter, etc.)
    E6  No cross-feature imports of internal layers (ports, adapters, usecases, bloc)
        - Exception: entities/ imports are always allowed across features
        - Exception: presentation/bloc may import other feature's domain/ (Presentation-only feature pattern)
    E7  No bare catch — must use 'on ExceptionType catch (e)'
    N1  Abstract classes in ports/ must end with 'Port'
    N2  Concrete classes in adapters/ must end with 'Adapter'
    N3  Classes in usecases/ must end with 'UseCase' or 'Params'
    S1  Files must not exceed 800 lines

Usage:
    python3 check_architecture.py [entry_dir]
    python3 check_architecture.py app
    python3 check_architecture.py client
"""

from __future__ import annotations

import argparse
import dataclasses
import os
import re
import sys
from pathlib import Path

# ─── Constants ───

GENERATED_SUFFIXES = (".g.dart", ".freezed.dart", ".gen.dart", ".chopper.dart")

IMPORT_RE = re.compile(r'^\s*import\s+[\'"](.+?)[\'"]')
BARE_CATCH_RE = re.compile(r"\bcatch\s*\(")
TYPED_CATCH_RE = re.compile(r"\bon\s+\w+.*\bcatch\s*\(")
LINE_COMMENT_RE = re.compile(r"//")
CLASS_DECL_RE = re.compile(
    r"^\s*(?:abstract\s+)?class\s+(\w+)"
)

MAX_FILE_LINES = 800

# Codegen-only packages allowed in domain layers
CODEGEN_PACKAGES = frozenset(
    {
        "freezed_annotation",
        "json_annotation",
        "meta",
        "collection",
    }
)

# Packages allowed in bloc layer (state management + codegen)
BLOC_ALLOWED_PACKAGES = CODEGEN_PACKAGES | frozenset(
    {
        "flutter_bloc",
        "bloc",
        "equatable",
    }
)

# Infrastructure packages forbidden in domain layers
INFRA_PACKAGES = frozenset(
    {
        # Remote API
        "dio",
        "http",
        "retrofit",
        "chopper",
        # Local DB
        "drift",
        "sqflite",
        "isar",
        "hive",
        "hive_flutter",
        "floor",
        "objectbox",
        # Storage
        "flutter_secure_storage",
        "shared_preferences",
        # Firebase
        "firebase_core",
        "firebase_auth",
        "firebase_messaging",
        "cloud_firestore",
    }
)

# Framework packages forbidden in ports
FRAMEWORK_PACKAGES = INFRA_PACKAGES | frozenset(
    {
        "flutter",
    }
)

# Layers that are part of the domain (no external SDK allowed)
DOMAIN_LAYERS = frozenset({"entities", "ports", "usecases", "exceptions"})

# Internal layers forbidden for cross-feature imports
CROSS_FEATURE_FORBIDDEN = frozenset({"ports", "adapters", "usecases", "bloc"})

# Layer directory markers
LAYER_MARKERS = {
    "/entities/": "entities",
    "/ports/": "ports",
    "/usecases/": "usecases",
    "/adapters/": "adapters",
    "/bloc/": "bloc",
    "/exceptions/": "exceptions",
    "/pages/": "presentation",
    "/views/": "presentation",
    "/widgets/": "presentation",
}


# ─── Data ───


@dataclasses.dataclass
class Violation:
    file: str
    line: int
    rule: str
    message: str

    def __str__(self) -> str:
        return f"{self.file}:{self.line}: [{self.rule}] {self.message}"


# ─── Classification ───


def classify_layer(rel_path: str) -> str:
    """Classify a file's architectural layer from its path relative to lib/."""
    for marker, layer in LAYER_MARKERS.items():
        if marker in f"/{rel_path}/":
            return layer
    if "/common/services/" in f"/{rel_path}/":
        return "common_services"
    return "other"


def extract_feature(rel_path: str) -> str | None:
    """Extract feature name from path like features/<name>/..."""
    parts = Path(rel_path).parts
    for i, part in enumerate(parts):
        if part == "features" and i + 1 < len(parts):
            return parts[i + 1]
    return None


def get_package_name(entry_dir: Path) -> str | None:
    """Read package name from pubspec.yaml."""
    pubspec = entry_dir / "pubspec.yaml"
    if not pubspec.is_file():
        return None
    for line in pubspec.read_text().splitlines():
        line = line.strip()
        if line.startswith("name:"):
            return line.split(":", 1)[1].strip()
    return None


# ─── Import Parsing ───


def parse_imports(file_path: Path) -> list[tuple[int, str]]:
    """Extract (line_number, import_path) from a Dart file."""
    results = []
    try:
        text = file_path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return results

    for i, line in enumerate(text.splitlines(), start=1):
        m = IMPORT_RE.match(line)
        if m:
            results.append((i, m.group(1)))
    return results


def find_bare_catches(file_path: Path) -> list[tuple[int, str]]:
    """Find bare catch statements without on ExceptionType."""
    results = []
    try:
        text = file_path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return results

    in_block_comment = False
    for i, line in enumerate(text.splitlines(), start=1):
        stripped = line.strip()

        # Track block comments
        if "/*" in stripped:
            in_block_comment = True
        if "*/" in stripped:
            in_block_comment = False
            continue
        if in_block_comment:
            continue

        # Skip line comments
        comment_pos = LINE_COMMENT_RE.search(line)
        code_part = line[:comment_pos.start()] if comment_pos else line

        if BARE_CATCH_RE.search(code_part) and not TYPED_CATCH_RE.search(code_part):
            results.append((i, stripped))

    return results


# ─── Import Helpers ───


def extract_package(import_path: str) -> str | None:
    """Extract package name from 'package:name/...'."""
    if import_path.startswith("package:"):
        parts = import_path[len("package:") :].split("/", 1)
        return parts[0] if parts else None
    return None


def resolve_import_layer(import_path: str, file_path: str) -> str | None:
    """Resolve relative import to a layer classification."""
    if import_path.startswith("package:"):
        return None
    # Relative import
    file_dir = str(Path(file_path).parent)
    resolved = os.path.normpath(os.path.join(file_dir, import_path))
    return classify_layer(resolved)


def resolve_import_feature(import_path: str, file_path: str) -> str | None:
    """Resolve relative import to extract target feature name."""
    if import_path.startswith("package:"):
        return None
    file_dir = str(Path(file_path).parent)
    resolved = os.path.normpath(os.path.join(file_dir, import_path))
    # If normpath escapes beyond the expected root, skip
    if resolved.startswith(".."):
        return None
    return extract_feature(resolved)


def get_import_layer_from_package(
    import_path: str, package_name: str | None
) -> str | None:
    """For package imports of the project itself, extract layer."""
    if not package_name:
        return None
    pkg = extract_package(import_path)
    if pkg != package_name:
        return None
    # e.g. package:my_app/features/auth/domain/ports/auth_port.dart
    inner = import_path[len(f"package:{package_name}/") :]
    return classify_layer(inner)


def get_import_feature_from_package(
    import_path: str, package_name: str | None
) -> str | None:
    """For package imports of the project itself, extract feature name."""
    if not package_name:
        return None
    pkg = extract_package(import_path)
    if pkg != package_name:
        return None
    inner = import_path[len(f"package:{package_name}/") :]
    return extract_feature(inner)


# ─── Rules ───


def check_e1_entities_import(
    layer: str, import_path: str, package_name: str | None
) -> str | None:
    """E1: entities/ must only import codegen annotations."""
    if layer != "entities":
        return None
    pkg = extract_package(import_path)
    if pkg is None:
        return None  # relative import OK
    if pkg == package_name:
        return None  # project internal import
    if pkg in CODEGEN_PACKAGES:
        return None
    if pkg == "dart" or import_path.startswith("dart:"):
        return None
    return f"entities/ must not import external package '{pkg}' -- only codegen annotations allowed"


def check_e2_usecases_dependency(
    layer: str,
    import_path: str,
    file_rel: str,
    package_name: str | None,
) -> str | None:
    """E2: usecases/ may only import entities/, ports/, exceptions/."""
    if layer != "usecases":
        return None

    target_layer = resolve_import_layer(import_path, file_rel)
    if target_layer is None:
        target_layer = get_import_layer_from_package(import_path, package_name)
    if target_layer is None:
        return None  # external package (checked by E4)

    forbidden = {"adapters", "bloc", "presentation", "common_services"}
    if target_layer in forbidden:
        return f"usecases/ must not import from {target_layer}/ -- only entities/ and ports/ allowed"
    return None


def check_e3_bloc_dependency(
    layer: str,
    import_path: str,
    file_rel: str,
    package_name: str | None,
) -> str | None:
    """E3: bloc/ may only import usecases/, entities/, exceptions/."""
    if layer != "bloc":
        return None

    pkg = extract_package(import_path)
    if pkg and pkg in BLOC_ALLOWED_PACKAGES:
        return None
    if pkg == "dart" or import_path.startswith("dart:"):
        return None
    if pkg == package_name or pkg is None:
        target_layer = resolve_import_layer(import_path, file_rel)
        if target_layer is None:
            target_layer = get_import_layer_from_package(import_path, package_name)
        if target_layer is None:
            return None
        forbidden = {"adapters", "ports", "common_services"}
        if target_layer in forbidden:
            return f"bloc/ must not import from {target_layer}/ -- only usecases/ allowed"
        return None
    # External package not in allowed list -- skip (not architecture rule)
    return None


def check_e4_domain_no_sdk(
    layer: str, import_path: str, package_name: str | None
) -> str | None:
    """E4: No external SDK in domain layers."""
    if layer not in DOMAIN_LAYERS:
        return None
    pkg = extract_package(import_path)
    if pkg is None:
        return None
    if pkg == package_name:
        return None
    if pkg in INFRA_PACKAGES:
        return f"'{pkg}' must not be imported in {layer}/ -- no external SDK in domain layers"
    return None


def check_e5_ports_no_framework(
    layer: str, import_path: str, package_name: str | None
) -> str | None:
    """E5: ports/ must not import framework packages."""
    if layer != "ports":
        return None
    pkg = extract_package(import_path)
    if pkg is None:
        return None
    if pkg == package_name:
        return None
    if pkg in FRAMEWORK_PACKAGES:
        return f"ports/ must not import framework package '{pkg}' -- use domain types only"
    return None


def check_e6_cross_feature(
    layer: str,
    feature: str | None,
    import_path: str,
    file_rel: str,
    package_name: str | None,
) -> str | None:
    """E6: No cross-feature imports of internal layers.

    Exception: entities/ imports are always allowed across features.
    """
    if feature is None:
        return None

    target_feature = resolve_import_feature(import_path, file_rel)
    if target_feature is None:
        target_feature = get_import_feature_from_package(import_path, package_name)
    if target_feature is None or target_feature == feature:
        return None

    # Check target layer
    target_layer = resolve_import_layer(import_path, file_rel)
    if target_layer is None:
        target_layer = get_import_layer_from_package(import_path, package_name)

    # entities/ imports are always allowed across features
    if target_layer == "entities":
        return None

    # presentation layer may import other feature's domain/
    # (Presentation-only feature pattern — usecases injected via DI)
    if layer in ("presentation", "bloc"):
        target_is_domain = resolve_import_layer(import_path, file_rel) or ""
        # Also check via package import
        if target_is_domain == "":
            target_is_domain = get_import_layer_from_package(import_path, package_name) or ""
        # Allow if the import path contains /domain/ (usecases, entities, exceptions, ports)
        resolved_path = ""
        if not import_path.startswith("package:"):
            file_dir = str(Path(file_rel).parent)
            resolved_path = os.path.normpath(os.path.join(file_dir, import_path))
        else:
            pkg = extract_package(import_path)
            if pkg == package_name:
                resolved_path = import_path[len(f"package:{package_name}/"):]
        if "/domain/" in f"/{resolved_path}/":
            return None

    if target_layer in CROSS_FEATURE_FORBIDDEN:
        return (
            f"Cross-feature import: '{feature}' must not import "
            f"'{target_feature}'s {target_layer}/ -- use DI or event bus"
        )
    return None


# ─── Naming & Size Rules ───


def find_class_declarations(file_path: Path) -> list[tuple[int, str, bool]]:
    """Find class declarations. Returns (line_no, class_name, is_abstract)."""
    results = []
    try:
        text = file_path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return results

    for i, line in enumerate(text.splitlines(), start=1):
        m = CLASS_DECL_RE.match(line)
        if m:
            is_abstract = "abstract" in line[: m.start(1)]
            results.append((i, m.group(1), is_abstract))
    return results


def count_lines(file_path: Path) -> int:
    """Count lines in a file."""
    try:
        return len(file_path.read_text(encoding="utf-8").splitlines())
    except (UnicodeDecodeError, OSError):
        return 0


def check_n1_port_naming(
    layer: str, line_no: int, class_name: str, is_abstract: bool
) -> str | None:
    """N1: ports/ classes must end with Port."""
    if layer != "ports":
        return None
    if not class_name.endswith("Port"):
        return f"Port class '{class_name}' must end with 'Port'"
    return None


def check_n2_adapter_naming(
    layer: str, line_no: int, class_name: str, is_abstract: bool
) -> str | None:
    """N2: adapters/ classes must end with Adapter."""
    if layer != "adapters":
        return None
    if not class_name.endswith("Adapter"):
        return f"Adapter class '{class_name}' must end with 'Adapter'"
    return None


def check_n3_usecase_naming(
    layer: str, line_no: int, class_name: str, is_abstract: bool
) -> str | None:
    """N3: usecases/ classes must end with UseCase or Params."""
    if layer != "usecases":
        return None
    if not (class_name.endswith("UseCase") or class_name.endswith("Params")):
        return f"UseCase class '{class_name}' must end with 'UseCase' or 'Params'"
    return None


# ─── Scanner ───


def scan(lib_root: Path, entry_dir: Path) -> list[Violation]:
    """Scan lib/ directory and return architecture violations."""
    violations: list[Violation] = []
    package_name = get_package_name(entry_dir)

    for dart_file in sorted(lib_root.rglob("*.dart")):
        # Skip generated files
        if any(dart_file.name.endswith(s) for s in GENERATED_SUFFIXES):
            continue

        rel_path = str(dart_file.relative_to(lib_root))
        layer = classify_layer(rel_path)
        feature = extract_feature(rel_path)

        if layer == "other":
            continue

        # Check imports
        for line_no, import_path in parse_imports(dart_file):
            file_str = str(dart_file)

            for rule_id, check_fn, args in [
                ("E1", check_e1_entities_import, (layer, import_path, package_name)),
                (
                    "E2",
                    check_e2_usecases_dependency,
                    (layer, import_path, rel_path, package_name),
                ),
                (
                    "E3",
                    check_e3_bloc_dependency,
                    (layer, import_path, rel_path, package_name),
                ),
                ("E4", check_e4_domain_no_sdk, (layer, import_path, package_name)),
                ("E5", check_e5_ports_no_framework, (layer, import_path, package_name)),
                (
                    "E6",
                    check_e6_cross_feature,
                    (layer, feature, import_path, rel_path, package_name),
                ),
            ]:
                msg = check_fn(*args)
                if msg:
                    violations.append(Violation(file_str, line_no, rule_id, msg))

        # Check bare catches (E7)
        for line_no, _ in find_bare_catches(dart_file):
            violations.append(
                Violation(
                    str(dart_file),
                    line_no,
                    "E7",
                    "Bare catch is not allowed -- use 'on ExceptionType catch (e)'",
                )
            )

        # Check naming conventions (N1, N2, N3)
        for line_no, class_name, is_abstract in find_class_declarations(dart_file):
            file_str = str(dart_file)
            for rule_id, check_fn in [
                ("N1", check_n1_port_naming),
                ("N2", check_n2_adapter_naming),
                ("N3", check_n3_usecase_naming),
            ]:
                msg = check_fn(layer, line_no, class_name, is_abstract)
                if msg:
                    violations.append(Violation(file_str, line_no, rule_id, msg))

        # Check file size (S1)
        line_count = count_lines(dart_file)
        if line_count > MAX_FILE_LINES:
            violations.append(
                Violation(
                    str(dart_file),
                    1,
                    "S1",
                    f"File has {line_count} lines (max {MAX_FILE_LINES})",
                )
            )

    return violations


# ─── Reporter ───


def report(violations: list[Violation]) -> None:
    """Print violations and summary."""
    violations.sort(key=lambda v: (v.file, v.line))
    for v in violations:
        print(v)
    print()
    if violations:
        print(f"Found {len(violations)} architecture violation(s).")
    else:
        print("No architecture violations found.")


# ─── Main ───


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Flutter hexagonal architecture linter"
    )
    parser.add_argument(
        "entry", nargs="?", default="app", help="Entry directory (default: app)"
    )
    args = parser.parse_args()

    entry_dir = Path(args.entry)
    lib_root = entry_dir / "lib"

    if not lib_root.is_dir():
        print(f"Error: {lib_root} is not a directory", file=sys.stderr)
        sys.exit(2)

    violations = scan(lib_root, entry_dir)
    report(violations)
    sys.exit(1 if violations else 0)


if __name__ == "__main__":
    main()
