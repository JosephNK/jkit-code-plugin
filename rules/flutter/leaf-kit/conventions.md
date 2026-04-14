## flutter_leaf_kit

### Usage Rules

| Package | Key Rules |
|---------|-----------|
| **leaf_component** | `LeafText` instead of `Text`. Colors via `context.leafColors`. Typography via `context.leafTypography`. Follow Atomic Design hierarchy. |
| **leaf_network** | (API 사용 시) HTTP client via `LeafDioSharedClient.shared`. Service calls via `.getService<T>()`. Response checks: `.isSuccessful`, `.isHttpUnauthorisedException`. File uploads: `LeafMultipartFile.fromBytes()`. |
| **leaf_state** | Screens extend `LeafScreenStatefulWidget` / `LeafScreenState`. BLoC consumption via `BlocScreenConsumer<BlocType, StateType>`. |
| **leaf_common** | Shared utilities (Cancelable, Converter, DateTime Extension, Logger, Model). |
| **leaf_platform** | Platform features (Config, System, Device, File, Permission, WebView). |

### Network (API 사용 시)

> 이 섹션은 Remote API를 데이터 소스로 사용하는 경우에 해당합니다. 로컬 DB만 사용하는 프로젝트에서는 적용하지 않습니다.

#### Initialization

Network initialization in `app.dart` via `LeafDioSharedClient` with automatic token refresh via interceptor.

#### Adapter Pattern

```dart
class ProductApiAdapter implements ProductPort {
  @override
  Future<ProductPage> getProducts({required int page, required int limit}) async {
    final service = LeafDioSharedClient.shared.getService<ProductService>();
    final response = await service.getProducts(page: page, limit: limit);

    if (response.isSuccessful && response.data?.data != null) {
      return ProductPage(
        items: response.data!.data!.items.map(_toProduct).toList(),
        total: response.data!.data!.total,
      );
    }
    if (response.isHttpUnauthorisedException) throw response.httpException!;
    throw ServerException(response.error?.error?.message ?? 'Failed');
  }
}
```

### Error Handling — 401 (API 사용 시)

> 이 섹션은 Remote API를 데이터 소스로 사용하는 경우에 해당합니다.

```
HTTP Response
    |-- 401 Unauthorized --> throw LeafUnauthorisedException (from response.httpException!)
    |-- Other failure    --> throw ServerException (or domain-specific exception)
    +-- Success          --> DTO -> Entity conversion, return domain object
```

401 is handled globally: BLoC catches `LeafUnauthorisedException` -> `addError(e, st)` -> `Bloc.observer` triggers logout.

```dart
// BLoC 401 handling pattern
Future<void> _onLoadRequested(ProductLoadRequested event, Emitter<ProductState> emit) async {
  emit(const ProductLoading());
  try {
    final result = await getProductsUseCase(const GetProductsParams());
    emit(ProductLoaded(items: result.items));
  } on LeafUnauthorisedException catch (e, st) {
    addError(e, st);
  } on Exception catch (e) {
    emit(ProductError(message: e.toString()));
  }
}
```

### Presentation

- **Screen** (pages/): extends `LeafScreenStatefulWidget`, uses `BlocScreenConsumer`
