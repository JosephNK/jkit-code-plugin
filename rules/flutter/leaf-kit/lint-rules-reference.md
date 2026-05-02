<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/flutter/gen-custom-lint-reference.mjs -->
<!-- Source: rules/flutter/leaf-kit/custom-lint/leaf_kit_lint/lib/src/ (lints/*.dart, constants.dart) -->

# Lint Rules Reference (flutter/leaf-kit)

## 개요

`leaf-kit` 컨벤션을 선택한 프로젝트의 추가 룰. base의 `architecture_lint`와 함께 `analysis_options.yaml`의 `plugins:` 섹션에 등록 — Dart analysis server가 두 패키지를 독립 isolate로 로드한다. leaf_kit_lint은 base의 boundary 정의 위에 bloc + leaf_kit 전용 의존성 제약만 추가한다.

## 규칙 (Rules)

leaf-kit 룰 5개. base 룰과 함께 모두 적용된다 (base 12개 + leaf-kit 5개).

| ID | Severity | Layer | 설명 |
| --- | --- | --- | --- |
| LK_E2 | error | `usecases` | usecases/는 bloc/ import 금지. |
| LK_E3 | error | `bloc` | bloc/은 `blocAllowedPackages` + `leafKitBlocAllowed` entrypoint만 허용 — `adapters/`/`ports/` 직접 import 차단. freezed 스택 활성 시 `freezedStackBlocAllowed`(=`freezed_annotation`)가 화이트리스트에 자동 합쳐짐. |
| LK_E6 | error | (all) | feature 간 bloc/ cross-import 금지. |
| LK_E8 | error | `presentation` | presentation/{pages,views,widgets}에서 usecases/ 직접 import 금지. |
| LK_E9 | error | `presentation` | presentation/{pages,views,widgets}에서 금지 위젯 직접 생성 금지 — leaf-kit 권장 위젯 사용 (`CustomScrollView`/`SingleChildScrollView` → `LeafScrollView`, `ListView`/`ListView.builder` → `LeafListView`, `GridView`/`GridView.builder` → `LeafGridView`, `Text`/`Text.rich` → `LeafText`/`LeafText.rich`, `Switch`/`CupertinoSwitch` → `LeafSwitch`). |

## bloc 화이트리스트 (LK_E3 참조)

LK_E3 룰이 bloc/ 레이어에서 허용하는 외부 의존성. 리스트 외 패키지는 bloc/에서 import 시 ERROR. `freezedStackBlocAllowed`는 freezed 스택 활성 시(=프로젝트 pubspec.yaml에 `freezed_annotation` 의존성) 자동 합쳐진다.

### `blocAllowedPackages`

bloc/ 레이어에서 허용되는 외부 패키지.

bloc은 상태 관리 + 이벤트 처리만 담당하므로 의존은 좁게 유지.
`flutter_leaf_kit_state.dart`/`flutter_leaf_kit_core.dart`는 별도로
`leafKitBlocAllowed`로 명시 허용.

- `flutter`
- `flutter_bloc`
- `bloc`
- `equatable`
- `meta`
- `collection`

### `leafKitBlocAllowed`

bloc/에서 허용되는 leaf_kit entrypoint (full-path entry).

flutter_leaf_kit의 메인 entrypoint(`flutter_leaf_kit.dart`) 대신 영역별
좁은 entrypoint만 허용. presentation/bloc은 상태/이벤트만 다루므로
component/network/route entrypoint는 차단.

- `flutter_leaf_kit/flutter_leaf_kit_state.dart`
- `flutter_leaf_kit/flutter_leaf_kit_core.dart`

### `freezedStackBlocAllowed`

freezed 스택 활성 시 `blocAllowedPackages`에 자동 합쳐지는 패키지.

프로젝트 pubspec.yaml에 `freezed_annotation` 의존성이 있으면(=freezed 스택
활성 신호) LK_E3가 bloc/에서 해당 import를 자동 허용. freezed_lint의 FZ_E2
가 bloc/ Event/State에 `@freezed` 적용을 강제하므로 두 스택을 같이 쓰는
프로젝트의 정상 사용 케이스. 감지는 `helpers.dart`의
`projectHasFreezedStack()`이 담당.

- `freezed_annotation`

