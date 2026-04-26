import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import '../classification.dart';
import '../dart_lint.dart';

/// N3: `usecases/` 레이어 클래스는 `UseCase` 또는 `Params` suffix 강제 (warning).
///
/// `*UseCase` = Command/Query 객체, `*Params` = UseCase 입력 캡슐.
/// suffix 제한으로 폴더에 헬퍼·유틸이 섞이는 것을 방지.
class N3UseCaseNamingLint extends DartLint {
  @override
  String get code => 'n3_usecase_naming';

  @override
  String get message => "UseCase classes must end with 'UseCase' or 'Params'.";

  @override
  AnalysisErrorSeverity get severity => AnalysisErrorSeverity.WARNING;

  @override
  String? get correction =>
      "Rename the class to end with 'UseCase' "
      "(e.g., GetUserUseCase) or 'Params' (e.g., GetUserParams).";

  @override
  SyntacticEntity? matchLint(AstNode node) {
    if (node is! ClassDeclaration) return null;

    final filePath = getFilePath(node);
    if (filePath == null) return null;

    final layer = classifyLayer(filePath);
    if (layer != 'usecases') return null;

    final name = node.namePart.typeName;
    if (!name.lexeme.endsWith('UseCase') && !name.lexeme.endsWith('Params')) {
      return name;
    }

    return null;
  }
}
