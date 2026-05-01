## Freezed

- **Entity**: `@freezed abstract class` + `const factory` + `= _ClassName`
- **Event / State**: `@freezed sealed class` + named constructors

```dart
// Entity
@freezed
abstract class User with _$User {
  const factory User({
    required int id,
    required String email,
    String? name,
    @Default(true) bool isActive,
  }) = _User;
}

// BLoC Event
@freezed
sealed class ProductEvent with _$ProductEvent {
  const factory ProductEvent.loadRequested() = ProductLoadRequested;
  const factory ProductEvent.deleteRequested({required String id}) = ProductDeleteRequested;
}

// BLoC State
@freezed
sealed class ProductState with _$ProductState {
  const factory ProductState.initial() = ProductInitial;
  const factory ProductState.loading() = ProductLoading;
  const factory ProductState.loaded({required List<Product> items}) = ProductLoaded;
  const factory ProductState.error({required String message}) = ProductError;
}
```
