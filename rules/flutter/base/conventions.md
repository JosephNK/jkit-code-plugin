# Conventions

> 레이어 경로 매핑: `@jkit/code-plugin/flutter/base/lint-rules-structure-reference.md`
> 레이어 의존성 규칙 (E/N/S 룰 표) · 패키지 화이트/블랙리스트: `@jkit/code-plugin/flutter/base/lint-rules-reference.md`
> 파일/클래스 네이밍 (Contains): `@jkit/code-plugin/flutter/base/lint-rules-reference.md` ("레이어 글로서리")

## common/ vs features/ Scope Rules

### common/services/ vs features/

| Location | When to use | Example |
|----------|-------------|---------|
| `common/services/` | Service used by **multiple features** or global infrastructure | Token storage, TTS, database, image compression |
| `features/<feature>/domain/ports/` | Port specific to **one feature's domain** | Product CRUD, order processing |

Both follow the same Port & Adapter pattern. The only difference is scope.

### common/widgets/ vs features/widgets/

| Location | When to use |
|----------|-------------|
| `features/<feature>/presentation/widgets/` | Widget used by **one feature only** |
| `common/widgets/` | Widget used by **2+ features** — promote from feature to common |

## Feature Types

| Type | Layers | Location | Description |
|------|--------|----------|-------------|
| Full-stack feature | domain/ + infrastructure/ + presentation/ | `features/<feature>/` | Has its own port, adapter, usecase, and UI |
| Presentation-only feature | presentation/ only | `features/<feature>/presentation/` | Reuses another feature's domain layer via DI (e.g., login screen uses auth usecases) |
| Shared domain module | entities/ + exceptions/ | `features/shared/domain/` | Shared domain objects with no full stack |

## Adapter Private Methods

| Purpose | Pattern | Example |
|---------|---------|---------|
| Raw data → Entity conversion | `_toEntity()` or `_to{EntityName}()` | `_toProduct()`, `_toOrder()` |
| Complex parsing | `_parse{Name}()` | `_parseProductPage()` |

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

## Port & Adapter Patterns

- **Port**: `abstract class` with domain types only
- **Adapter**: implements Port, handles raw data → Entity conversion via `_to{Entity}()` methods
- Multiple data sources (remote + local): combine in a single Adapter, fallback to cache on network failure

```dart
// Port — data source agnostic
abstract class ProductPort {
  Future<ProductPage> getProducts({required int page, required int limit});
  Future<Product> getProductById({required String id});
}

// Adapter (Remote API)
class ProductApiAdapter implements ProductPort {
  @override
  Future<ProductPage> getProducts({required int page, required int limit}) async {
    final response = await apiClient.getProducts(page: page, limit: limit);

    if (response.isSuccessful && response.data != null) {
      return ProductPage(
        items: response.data!.items.map(_toProduct).toList(),
        total: response.data!.total,
      );
    }
    throw ServerException(response.error?.message ?? 'Failed');
  }

  Product _toProduct(ProductDto dto) => Product(
    id: dto.id, name: dto.name, price: dto.price, createdAt: dto.createdAt,
  );
}

// Adapter (Local DB)
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

