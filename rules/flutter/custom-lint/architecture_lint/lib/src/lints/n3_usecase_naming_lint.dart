import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import '../classification.dart';
import '../dart_lint.dart';

/// N3: usecases/ 레이어의 클래스는 이름이 `UseCase` 또는 `Params`로 끝나야 한다.
///
/// ## 이유
/// - `*UseCase` : 비즈니스 동작 하나를 표현하는 Command/Query 객체
///   예: `GetUserUseCase`, `CreateOrderUseCase`
/// - `*Params` : UseCase 입력 파라미터를 캡슐화한 객체 (DTO 역할)
///   예: `GetUserParams`, `CreateOrderParams`
///
/// 이 두 접미사로 제한하여 UseCase 폴더 안에 헬퍼/서비스/유틸 클래스가 섞이는 것을
/// 방지한다 — UseCase 폴더는 "하나의 유스케이스 또는 그 입력" 만 담는다.
///
/// ## 심각도
/// WARNING
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
