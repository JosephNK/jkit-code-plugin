import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import '../classification.dart';
import '../constants.dart';
import '../dart_lint.dart';

/// E1: entities/ 레이어는 코드 생성 어노테이션 패키지만 import 가능.
///
/// ## 이유
/// entities는 순수 도메인 모델이어야 한다. dio/http/flutter 등 외부 런타임 의존성이
/// 섞이면 모델이 특정 구현에 결합되어, 테스트/리팩토링/패키지 교체가 어려워진다.
/// 불변 모델 정의에 필요한 code-gen 어노테이션(freezed_annotation, json_annotation 등)
/// 만 예외로 허용 — 이는 런타임 코드가 아니라 빌드타임 메타데이터이므로 안전.
///
/// ## 허용
/// - `dart:` imports (언어 기본)
/// - 같은 프로젝트 내 imports (`package:my_app/...`, 상대 경로)
/// - codegenPackages: freezed_annotation, json_annotation, meta, collection
///
/// ## 금지
/// - 그 외 모든 외부 package import (dio, http, flutter, ...)
class E1EntitiesImportLint extends DartLint {
  @override
  String get code => 'e1_entities_import';

  @override
  String get message =>
      'entities/ must only import codegen annotations '
      '(freezed_annotation, json_annotation, meta, collection).';

  @override
  AnalysisErrorSeverity get severity => AnalysisErrorSeverity.ERROR;

  @override
  String? get correction =>
      'Remove the import or move this code to the adapters/ layer.';

  @override
  SyntacticEntity? matchLint(AstNode node) {
    if (node is! ImportDirective) return null;

    final filePath = getFilePath(node);
    if (filePath == null) return null;

    final layer = classifyLayer(filePath);
    if (layer != 'entities') return null;

    final importUri = node.uri.stringValue;
    if (importUri == null) return null;

    // dart: imports are always allowed
    if (isDartImport(importUri)) return null;

    // Relative imports (project-internal) are OK
    if (!importUri.startsWith('package:')) return null;

    final packageName = extractImportPackageName(importUri);
    if (packageName == null) return null;

    // Same project imports are allowed
    final projectPackage = getProjectPackageName(node);
    if (packageName == projectPackage) return null;

    // Only codegen packages allowed
    if (codegenPackages.contains(packageName)) return null;

    return node.uri;
  }
}
