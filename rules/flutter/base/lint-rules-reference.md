<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/flutter/gen-architecture-lint-reference.mjs -->
<!-- Source: rules/flutter/base/custom-lint/architecture_lint/lib/src/ (lints/*.dart, constants.dart, classification.dart, layer_semantics.dart) -->

# Lint Rules Reference (flutter/base)

## 레이어 글로서리 (Layer Glossary)

각 레이어의 책임·포함 파일·제약·대표 코드 형태. `boundary_element.dart`의 `projectBoundaryElements`로 분류된 파일별 룰 적용 범위를 `layer_semantics.dart`(Role/Contains/Example) + `lints/*.dart`(Constraints)로 채운다.

### `entities`

**Role** — 도메인 Entity · Value Object · 공용 타입. 프레임워크 비의존 순수 Dart로 비즈니스 규칙의 단일 진실 공급원이자 가장 안정적인 레이어.

**Contains**

- Entity — `*.dart`
- Value Object — `*.dart`
- 도메인 상수·공용 타입 — `*.dart`

**Constraints**

- `E1` (error) — codegen annotation 패키지만 외부 import 허용 — 도메인 순수성 유지.

```dart
// entities/order.dart
class Order {
  const Order({
    required this.id,
    required this.items,
    required this.status,
  });

  final String id;
  final List<OrderItem> items;
  final OrderStatus status;
}
```

### `ports`

**Role** — 도메인과 인프라 사이의 abstract interface. 도메인 타입만 시그니처에 노출하여 구현 교체·테스트 용이성을 보장.

**Contains**

- Port — `*_port.dart` (`abstract class {Name}Port`)

**Constraints**

- `E5` (error) — framework 패키지(flutter/dio 등) import 금지 — 시그니처에 framework 타입 노출 차단.
- `N1` (warning) — 클래스명에 `Port` suffix 필수 (예: `AuthPort`, `UserRepositoryPort`).

```dart
// ports/product_port.dart
abstract class ProductPort {
  Future<ProductPage> getProducts({required int page, required int limit});
  Future<Product> getProductById({required String id});
}
```

### `usecases`

**Role** — 비즈니스 로직 단위. Port를 주입받아 도메인 동작을 조합하며, UI/인프라 없이 단독 단위 테스트 가능.

**Contains**

- UseCase — `*_usecase.dart` (`class {Verb}{Noun}UseCase`)
- UseCase Params — inline 또는 `*_params.dart` (`class {Verb}{Noun}Params`)

**Constraints**

- `E2` (error) — `entities/`/`ports/`/`exceptions/`만 import 허용 — adapters/bloc/presentation 금지.
- `N3` (warning) — 클래스명에 `UseCase` 또는 `Params` suffix 필수 (예: `GetUserUseCase`, `GetUserParams`).

```dart
// usecases/get_products_usecase.dart
class GetProductsUseCase {
  const GetProductsUseCase({required this.productPort});
  final ProductPort productPort;

  Future<ProductPage> call(GetProductsParams params) =>
      productPort.getProducts(page: params.page, limit: params.limit);
}
```

### `adapters`

**Role** — Port 구현체. Remote API · Local DB · Platform SDK 등 외부 데이터 소스와 통신하고 raw 데이터 → Entity 변환을 책임진다.

**Contains**

- Adapter — `*_adapter.dart` (`class {Name}Adapter implements {Name}Port`)
- 변환 메서드 — `_to{Entity}()`, `_parse{Name}()`

**Constraints**

- `N2` (warning) — 클래스명에 `Adapter` suffix 필수 (예: `AuthAdapter`, `ApiUserAdapter`).

```dart
// adapters/product_api_adapter.dart
class ProductApiAdapter implements ProductPort {
  @override
  Future<ProductPage> getProducts({required int page, required int limit}) async {
    final res = await apiClient.getProducts(page: page, limit: limit);
    if (res.isSuccessful && res.data != null) {
      return ProductPage(items: res.data!.items.map(_toProduct).toList(), total: res.data!.total);
    }
    throw ServerException(res.error?.message ?? 'Failed');
  }

  Product _toProduct(ProductDto dto) => Product(id: dto.id, name: dto.name);
}
```

### `bloc`

**Role** — UI 상태 관리 (flutter_bloc). UseCase를 호출하여 데이터를 받고 Event → State 전환만 담당하는 얇은 계층.

**Contains**

- Bloc/Cubit — `*_bloc.dart` / `*_cubit.dart`
- Event — `*_event.dart`
- State — `*_state.dart`

**Constraints**

- `E3` (error) — bloc/은 `usecases`/`entities`/`exceptions`만 import — 외부는 `blocAllowedPackages`만 허용.

```dart
// bloc/product_bloc.dart
class ProductBloc extends Bloc<ProductEvent, ProductState> {
  ProductBloc({required this.getProducts}) : super(const ProductInitial()) {
    on<ProductLoadRequested>((event, emit) async {
      emit(const ProductLoading());
      final page = await getProducts(GetProductsParams(page: event.page));
      emit(ProductLoaded(page));
    });
  }

  final GetProductsUseCase getProducts;
}
```

### `exceptions`

**Role** — 도메인 특화 예외. UseCase 경계에서 throw하고 presentation에서 사용자 메시지로 매핑.

**Contains**

- Exception — `*_exception.dart` (`class {Name}Exception implements Exception`)

```dart
// exceptions/server_exception.dart
class ServerException implements Exception {
  const ServerException(this.message);
  final String message;
  @override
  String toString() => message;
}
```

### `presentation`

**Role** — UI 레이어. Screen(라우트 진입점) · View(논리적 섹션) · Widget(재사용 컴포넌트)으로 분할. Bloc을 통해 상태를 구독하고 사용자 입력을 이벤트로 전달.

**Contains**

- Screen (라우트 진입점) — `*_screen.dart` (`pages/`)
- View (StatelessWidget 섹션) — `*_view.dart` (`views/`)
- Widget (재사용 컴포넌트) — `*_{purpose}.dart` (`widgets/`)

```dart
// pages/product_screen.dart
class ProductScreen extends StatelessWidget {
  const ProductScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<ProductBloc>()..add(const ProductLoadRequested(page: 1)),
      child: const ProductBodyView(),
    );
  }
}
```

## 규칙 (Rules)

architecture_lint 패키지가 활성화하는 12개 룰. 시각화된 의존 다이어그램은 `lint-rules-diagram.md` 참조.

| ID | Severity | Layer | 설명 | 참조 |
| --- | --- | --- | --- | --- |
| E1 | error | `entities` | codegen annotation 패키지만 외부 import 허용 — 도메인 순수성 유지. | `codegenPackages` |
| E2 | error | `usecases` | `entities/`/`ports/`/`exceptions/`만 import 허용 — adapters/bloc/presentation 금지. | — |
| E3 | error | `bloc` | bloc/은 `usecases`/`entities`/`exceptions`만 import — 외부는 `blocAllowedPackages`만 허용. | `blocAllowedPackages` |
| E4 | error | `domainLayers` | 도메인 레이어(entities/ports/usecases/exceptions)는 인프라 SDK import 금지. | `infraPackages`, `domainLayers` |
| E5 | error | `ports` | framework 패키지(flutter/dio 등) import 금지 — 시그니처에 framework 타입 노출 차단. | `frameworkPackages`, `infraPackages` |
| E6 | error | (all features) | feature 간 cross-import는 `entities/`와 다른 feature `domain/`만 허용. | `crossFeatureForbidden` |
| E7 | error | (all) | bare `catch` 금지 — `on ExceptionType catch (e)` 형태 강제. | — |
| N1 | warning | `ports` | 클래스명에 `Port` suffix 필수 (예: `AuthPort`, `UserRepositoryPort`). | — |
| N2 | warning | `adapters` | 클래스명에 `Adapter` suffix 필수 (예: `AuthAdapter`, `ApiUserAdapter`). | — |
| N3 | warning | `usecases` | 클래스명에 `UseCase` 또는 `Params` suffix 필수 (예: `GetUserUseCase`, `GetUserParams`). | — |
| S1 | warning | (all) | 파일당 800줄 초과 금지 (codegen 산출물 `*.g.dart` 등 제외) — 단일 책임 위반 신호. | `maxFileLines`, `generatedFileSuffixes` |
| S2 | error | (all) | `app/lib/` 안에서 boundary 외 경로 금지 — 구조 일관성 강제. | — |

## 패키지 화이트/블랙리스트

### `codegenPackages`

entities/ 레이어에서 **유일하게 허용되는** 외부 패키지들.

entities는 순수 Dart 도메인 모델이어야 하지만, 코드 생성(freezed/json) 기반
불변 모델 정의는 현실적으로 필요. 따라서 코드 생성 어노테이션 패키지만 예외 허용.
런타임 로직을 포함한 패키지(dio, flutter 등)는 여기 들어오면 안 됨.

- `freezed_annotation`
- `json_annotation`
- `meta`
- `collection`

### `blocAllowedPackages`

bloc/ 레이어에서 허용되는 외부 import 화이트리스트.

상태 관리 의존은 `flutter_leaf_kit_state.dart` 단일 진입점을 통하도록 강제 —
`flutter_bloc`/`bloc`/`equatable` 직접 import 및 leaf_kit 다른 entry
(component/route 등 presentation 누출) 모두 차단. 화이트리스트 외 모든
외부 패키지는 위반(E3 error).
entry에 `/`가 있으면 풀 import URI 매칭(특정 entry-point만 허용),
없으면 패키지명 단위 매칭(패키지 전체 허용).

- `freezed_annotation`
- `flutter_leaf_kit/flutter_leaf_kit_state.dart`

### `infraPackages`

도메인 레이어에서 금지되는 "인프라" 패키지 목록.

이 패키지들은 외부 세계(네트워크/DB/저장소/Firebase 등)와 직접 통신하므로
도메인(entities/ports/usecases/exceptions)에 섞이면 테스트 용이성과 이식성이 깨진다.
adapters/ 레이어에서 Port 구현체로만 사용해야 한다.

- `dio`
- `http`
- `retrofit`
- `chopper`
- `drift`
- `sqflite`
- `isar`
- `hive`
- `hive_flutter`
- `floor`
- `objectbox`
- `flutter_secure_storage`
- `shared_preferences`
- `firebase_core`
- `firebase_auth`
- `firebase_messaging`
- `cloud_firestore`

### `frameworkPackages`

ports/ 레이어에서 금지되는 "프레임워크" 패키지 목록.

Port는 도메인 인터페이스이므로 인프라 SDK는 물론 flutter(위젯/BuildContext 등)
도 시그니처에 노출되면 안 된다. (flutter 자체도 "프레임워크"로 분류하여 차단)

- `flutter`
- `dio`
- `http`
- `retrofit`
- `chopper`
- `drift`
- `sqflite`
- `isar`
- `hive`
- `hive_flutter`
- `floor`
- `objectbox`
- `flutter_secure_storage`
- `shared_preferences`
- `firebase_core`
- `firebase_auth`
- `firebase_messaging`
- `cloud_firestore`

## 레이어 집합 상수

### `domainLayers`

"도메인 레이어"로 간주되는 디렉토리 이름 집합.
E4 룰(도메인 순수성 검사)이 이 집합에 속한 파일에만 적용된다.

- `entities`
- `ports`
- `usecases`
- `exceptions`

### `crossFeatureForbidden`

다른 feature에서 cross-import 하면 안 되는 내부 레이어.

feature 간 결합을 entities(공용 도메인 타입) 수준으로만 제한하여
기능 모듈을 독립적으로 변경/삭제할 수 있도록 한다.
ports/adapters/usecases/bloc은 feature 전용 내부 계약이므로 cross-import 금지.

- `ports`
- `adapters`
- `usecases`
- `bloc`

## 자동 생성 파일 제외 패턴

### `generatedFileSuffixes`

S1 룰에서 라인 수 검사를 건너뛰는 자동 생성 파일 suffix.

build_runner / freezed / auto_route / injectable / mockito가 만들어내는
파일은 사람이 분할할 수 없고 800줄을 쉽게 넘기므로 검사 제외.

- `.g.dart`
- `.freezed.dart`
- `.gr.dart`
- `.config.dart`
- `.mocks.dart`

