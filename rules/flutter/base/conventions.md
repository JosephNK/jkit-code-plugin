# Conventions

## common/ vs features/ Scope Rules

### common/services/ vs features/

| Location | When to use | Example |
|----------|-------------|---------|
| `common/services/` | Service used by **multiple features** or global infrastructure | Token storage, TTS, database, image compression, auth, gatekeeper |
| `features/<feature>/domain/ports/` | Port specific to **one feature's domain** | Product CRUD, order processing |

Both follow the same Port & Adapter pattern. The only difference is scope.

### common/services/ — FLAT vs nested layout

`common/services/<svc>/` 자체가 두 패턴을 지원한다. 서비스의 도메인 풍부도에 따라 선택:

| Pattern | When to use | Layout |
|---------|-------------|--------|
| **FLAT** (thin service) | 외부 시스템 1:1 wrapper, 자체 도메인 거의 없음 (token storage, TTS, image compression 등) | `<svc>/<svc>_port.dart` + `<svc>/<svc>_adapter.dart` (+ optional `support/`) |
| **nested** (domain-rich subsystem) | 다수 feature가 의존하는 cross-cutting subsystem, 자체 entities/usecases/exceptions 보유 (auth, gatekeeper 등) | `<svc>/{entities,ports,adapters,usecases,exceptions}/` (+ optional `support/`) |

**Lint 적용 (양 모드 동일)**:

- AL_N1/N2/N3 — `Port`/`Adapter`/`UseCase` suffix 강제
- AL_E1 — `entities/`는 codegen annotation만 외부 import 허용
- AL_E4 — 도메인 4 레이어(entities/ports/usecases/exceptions)는 인프라 SDK 차단
- AL_E5 — `ports/`는 framework 패키지 차단
- AL_E6 — `common/services/`는 feature가 아니므로 cross-feature 위반 fire 안 함 → 모든 feature가 자유롭게 의존 가능
- LK_E3 — `bloc/` → `common/services/<svc>/usecases/`는 통과, `ports/`/`adapters/` 직접 import는 차단 (DI 경유 강제)

**선택 기준**:

- Adapter 1개 + 자체 도메인 타입 거의 없음 → **FLAT**
- 다수 feature가 의존 + 서비스가 자체 entities/usecases/exceptions 보유 → **nested**
- 의심되면 FLAT으로 시작하고, 자체 도메인이 늘어나면 nested로 promote

### common/widgets/ vs features/widgets/

| Location | When to use |
|----------|-------------|
| `features/<feature>/presentation/widgets/` | Widget used by **one feature only** |
| `common/widgets/` | Widget used by **2+ features** — promote from feature to common |

## Feature Types

| Type | Layers | Location | Description |
|------|--------|----------|-------------|
| Full-stack feature | domain/ + infrastructure/ + presentation/ | `features/<feature>/` | Has its own port, adapter, usecase, and UI |
| Presentation-only feature | presentation/ only | `features/<feature>/presentation/` | Reuses another feature's domain layer via its own bloc — bloc is required. |
| Shared domain module | entities/ + exceptions/ | `features/shared/domain/` | Shared domain objects with no full stack |

## UseCase Patterns

- Single responsibility: one business action per UseCase
- Execute via `call()` method (callable like a function)
- Omit parameters when none are needed
- Declare constructors as `const`

```dart
class CreateOrderUseCase {
  final OrderPort orderPort;
  const CreateOrderUseCase({required this.orderPort});

  Future<Order> call(CreateOrderParams params) async {
    return orderPort.createOrder(items: params.items);
  }
}
```

## Multi-Source Adapter

다수 데이터 소스(remote + local)는 단일 Adapter에서 결합 — 네트워크 실패 시 캐시 fallback.

```dart
// Local DB Adapter (동일 ProductPort 구현)
class ProductLocalAdapter implements ProductPort {
  final AppDatabase _db;
  const ProductLocalAdapter({required AppDatabase db}) : _db = db;

  @override
  Future<ProductPage> getProducts({required int page, required int limit}) async {
    final rows = await _db.productDao.getProducts(page: page, limit: limit);
    final total = await _db.productDao.count();
    return ProductPage(
      items: rows.map(_toProduct).toList(),
      total: total,
    );
  }

  Product _toProduct(ProductRow row) => Product(
    id: row.id, name: row.name, price: row.price, createdAt: row.createdAt,
  );
}
```

## DI Registration

| Scope | Registration | Target |
|-------|-------------|--------|
| Cross-app services | `registerLazySingleton` | Stateful services shared across features |
| Feature Adapter | `registerFactory` | Port implementations |
| UseCase | `registerFactory` | Business logic units |

```dart
final sl = GetIt.instance;

void setupDependencies() {
  sl.registerLazySingleton<TokenStoragePort>(() => TokenStorageAdapter());
  sl.registerFactory<ProductPort>(() => ProductAdapter());
  sl.registerFactory(() => GetProductsUseCase(productPort: sl()));
}
```

## Error Handling

| Layer | Responsibility |
|-------|---------------|
| Adapter (API) | Check response success. Throw `ServerException` for failures (403, 404, 429, 5xx). |
| Adapter (Local DB) | Catch DB exceptions. Throw `DatabaseException` for failures (not found, constraint violation, etc.). |
| UseCase | Let exceptions propagate. Add domain-specific validation errors if needed. |

```dart
class ServerException implements Exception {
  final String message;
  const ServerException(this.message);
  @override
  String toString() => message;
}

class DatabaseException implements Exception {
  final String message;
  const DatabaseException(this.message);
  @override
  String toString() => message;
}
```

## Test Strategy

- Mocking: `mocktail` (`Mock`, `when`, `verify`)
- Test file structure mirrors `lib/`

```dart
class MockProductPort extends Mock implements ProductPort {}

void main() {
  late MockProductPort mockPort;
  late GetProductsUseCase useCase;

  setUp(() {
    mockPort = MockProductPort();
    useCase = GetProductsUseCase(productPort: mockPort);
  });

  test('delegates to port with correct params', () async {
    when(() => mockPort.getProducts(page: 1, limit: 20))
        .thenAnswer((_) async => mockPage);
    final result = await useCase(const GetProductsParams());
    expect(result, mockPage);
    verify(() => mockPort.getProducts(page: 1, limit: 20)).called(1);
  });
}
```

