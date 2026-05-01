// =============================================================================
// freezed_lint — 경로/annotation 헬퍼 (self-contained)
// -----------------------------------------------------------------------------
// architecture_lint와 독립적으로 동작하기 위해 패키지 내부에서 자체 path 분류.
// 룰 3개(FZ_E1/E2/E3)가 필요로 하는 최소 헬퍼만 포함.
//
// 전제 프로젝트 구조 (architecture_lint와 동일):
//   app/lib/features/<feature>/
//     ├── domain/entities/
//     ├── domain/usecases/
//     └── presentation/bloc/
// =============================================================================

import 'package:analyzer/dart/ast/ast.dart';

/// codegen 산출물 suffix — 검사에서 제외.
const _generatedFileSuffixes = <String>{
  '.g.dart',
  '.freezed.dart',
  '.gr.dart',
  '.config.dart',
  '.mocks.dart',
};

/// 입력 path를 root-relative `app/lib/...` 형태로 정규화.
String _normalizeInputPath(String filePath) {
  final raw = filePath.replaceAll('\\', '/');

  final pkgIdx = raw.indexOf('/packages/');
  if (pkgIdx >= 0) return raw.substring(pkgIdx + 1);
  if (raw.startsWith('packages/')) return raw;

  final libIdx = raw.indexOf('/lib/');
  if (libIdx >= 0) return 'app${raw.substring(libIdx)}';
  if (raw.startsWith('lib/')) return 'app/$raw';

  if (RegExp(r'^(features|common|di|router)/').hasMatch(raw)) {
    return 'app/lib/$raw';
  }

  return raw;
}

/// AST 노드에서 파일의 절대 경로를 얻는다 (CompilationUnit 루트에서 조회).
String? getFilePath(AstNode node) {
  final unit = node.root;
  if (unit is CompilationUnit) {
    // ignore: experimental_member_use
    return unit.declaredFragment?.source.fullName;
  }
  return null;
}

/// 파일이 codegen 산출물(`*.g.dart`, `*.freezed.dart` 등)인지.
bool isGeneratedFile(String filePath) {
  final n = filePath.replaceAll('\\', '/');
  for (final suffix in _generatedFileSuffixes) {
    if (n.endsWith(suffix)) return true;
  }
  return false;
}

/// 파일이 entities 레이어인지 — `.../features/<f>/domain/entities/...`
bool isEntitiesFile(String filePath) {
  final n = _normalizeInputPath(filePath);
  return RegExp(r'^app/lib/features/[^/]+/domain/entities/').hasMatch(n);
}

/// 파일이 bloc 레이어인지 — `.../features/<f>/presentation/bloc/...`
bool isBlocFile(String filePath) {
  final n = _normalizeInputPath(filePath);
  return RegExp(r'^app/lib/features/[^/]+/presentation/bloc/').hasMatch(n);
}

/// 파일이 usecases 레이어인지 — `.../features/<f>/domain/usecases/...`
bool isUsecaseFile(String filePath) {
  final n = _normalizeInputPath(filePath);
  return RegExp(r'^app/lib/features/[^/]+/domain/usecases/').hasMatch(n);
}

/// ClassDeclaration이 `@freezed` annotation을 가지고 있는지.
///
/// `@freezed`, `@Freezed(...)`, `@freezed.unionKeys(...)` 등 prefix 매칭으로
/// `freezed` 식별자를 포함한 모든 형태 인식.
bool hasFreezedAnnotation(ClassDeclaration node) {
  for (final ann in node.metadata) {
    final name = ann.name.name;
    // `@freezed` (variable) or `@Freezed(...)` (class constructor)
    if (name == 'freezed' || name == 'Freezed') return true;
  }
  return false;
}
