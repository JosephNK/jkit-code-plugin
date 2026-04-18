import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import '../classification.dart';
import '../constants.dart';
import '../dart_lint.dart';

/// E3: bloc/ 레이어의 의존 범위 제한.
///
/// ## 이유
/// Bloc은 UI 상태를 관리하는 얇은 계층이며, 데이터 접근은 UseCase에게 위임해야 한다.
/// - adapters/ : 구체 구현 직접 호출 금지 (UseCase 경유)
/// - ports/ : 인터페이스 직접 호출 금지 (UseCase 경유 — bloc이 비즈니스 로직을
///           포함하게 되는 "anemic UseCase" 문제 방지)
/// - common_services/ : 전역 서비스 직접 접근 금지 (UseCase로 감싸서 사용)
///
/// ## 허용 내부 레이어
/// usecases/, entities/, exceptions/
///
/// ## 허용 외부 패키지
/// blocAllowedPackages: flutter_bloc, bloc, equatable + codegen 어노테이션
/// (그 외 외부 패키지는 이 룰에서 검사 안 함 — 일반 import 자유)
class E3BlocDependencyLint extends DartLint {
  static const _forbidden = <String>{'adapters', 'ports', 'common_services'};

  @override
  String get code => 'e3_bloc_dependency';

  @override
  String get message =>
      'bloc/ must not import adapters/ or ports/ directly. '
      'Only usecases/, entities/, and exceptions/ are allowed.';

  @override
  AnalysisErrorSeverity get severity => AnalysisErrorSeverity.ERROR;

  @override
  String? get correction =>
      'Access data through usecases/ instead of directly importing '
      'adapters/ or ports/.';

  @override
  SyntacticEntity? matchLint(AstNode node) {
    if (node is! ImportDirective) return null;

    final filePath = getFilePath(node);
    if (filePath == null) return null;

    final layer = classifyLayer(filePath);
    if (layer != 'bloc') return null;

    final importUri = node.uri.stringValue;
    if (importUri == null) return null;

    if (isDartImport(importUri)) return null;

    // Check external packages
    final importPkg = extractImportPackageName(importUri);
    final projectPkg = getProjectPackageName(node);

    if (importPkg != null && importPkg != projectPkg) {
      // External package — allow bloc-related and codegen only
      if (blocAllowedPackages.contains(importPkg)) return null;
      // Other external packages — not an architecture rule, skip
      return null;
    }

    // Internal import — check layer
    final targetLayer = getImportTargetLayer(importUri, filePath, projectPkg);
    if (targetLayer == null) return null;

    if (_forbidden.contains(targetLayer)) {
      return node.uri;
    }

    return null;
  }
}
