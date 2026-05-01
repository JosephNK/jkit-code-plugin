import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer/dart/ast/visitor.dart';

import 'dart_lint.dart';
import 'lints/e1_entities_import_lint.dart';
import 'lints/e2_usecases_dependency_lint.dart';
import 'lints/e4_domain_no_sdk_lint.dart';
import 'lints/e5_ports_no_framework_lint.dart';
import 'lints/e6_cross_feature_lint.dart';
import 'lints/e7_no_bare_catch_lint.dart';
import 'lints/e8_presentation_dependency_lint.dart';
import 'lints/n1_port_naming_lint.dart';
import 'lints/n2_adapter_naming_lint.dart';
import 'lints/n3_usecase_naming_lint.dart';
import 'lints/s1_file_size_lint.dart';
import 'lints/s2_unknown_path_lint.dart';

typedef LintMatchHandler = void Function(DartLint lint, SyntacticEntity entity);

/// `CompilationUnit`을 순회하며 지원 노드 타입에서 각 `DartLint`의
/// `matchLint`를 호출하고, 일치가 있을 때 [onMatch]에 lint와
/// `SyntacticEntity`를 전달한다.
///
/// 분석기 플러그인과 CLI 러너가 공통으로 사용한다.
class LintRunner extends RecursiveAstVisitor<void> {
  LintRunner({required this.lints, required this.onMatch});

  final List<DartLint> lints;
  final LintMatchHandler onMatch;

  void _run(AstNode node) {
    for (final lint in lints) {
      final entity = lint.matchLint(node);
      if (entity != null) onMatch(lint, entity);
    }
  }

  @override
  void visitCompilationUnit(CompilationUnit node) {
    _run(node);
    super.visitCompilationUnit(node);
  }

  @override
  void visitImportDirective(ImportDirective node) {
    _run(node);
    super.visitImportDirective(node);
  }

  @override
  void visitClassDeclaration(ClassDeclaration node) {
    _run(node);
    super.visitClassDeclaration(node);
  }

  @override
  void visitCatchClause(CatchClause node) {
    _run(node);
    super.visitCatchClause(node);
  }
}

/// base 아키텍처 lint 규칙 목록 (E1·E2·E4·E5·E6·E7·E8·N1·N2·N3·S1·S2).
///
/// stack-specific 룰(예: bloc/leaf-kit/go-router 등)은 별도 패키지가 자체
/// 진입점으로 제공한다. 이 함수는 base 룰만 합성한다.
List<DartLint> createArchitectureLints() => <DartLint>[
  E1EntitiesImportLint(),
  E2UsecasesDependencyLint(),
  E4DomainNoSdkLint(),
  E5PortsNoFrameworkLint(),
  E6CrossFeatureLint(),
  E7NoBareCatchLint(),
  E8PresentationDependencyLint(),
  N1PortNamingLint(),
  N2AdapterNamingLint(),
  N3UseCaseNamingLint(),
  S1FileSizeLint(),
  S2UnknownPathLint(),
];
