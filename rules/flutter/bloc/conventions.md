## BLoC

### Dependency Rules

- **bloc/** depends on usecases/ only (no direct adapter or port calls)
- No business logic in bloc/ event handlers — delegate to usecases

### Naming

#### Files

| Element | File Suffix | Example |
|---------|-------------|---------|
| BLoC | `*_bloc.dart` | `product_bloc.dart` |
| Event | `*_event.dart` | `product_event.dart` |
| State | `*_state.dart` | `product_state.dart` |

#### Classes

| Element | Pattern | Example |
|---------|---------|---------|
| BLoC | `{Feature}Bloc` | `ProductBloc`, `LoginBloc` |
| Event | `{Feature}Event` | `ProductEvent`, `LoginEvent` |
| State | `{Feature}State` | `ProductState`, `LoginState` |

### Event Named Constructors

Use `{verb}Requested` or `{verb}Changed` pattern:

| Action | Pattern | Example |
|--------|---------|---------|
| Initial load | `.loadRequested()` | `ProductEvent.loadRequested()` |
| Pull-to-refresh | `.refreshRequested()` | `ProductEvent.refreshRequested()` |
| Delete | `.deleteRequested()` | `ProductEvent.deleteRequested(id: id)` |
| Form input | `.{field}Changed()` | `LoginEvent.emailChanged(value: email)` |
| Submit | `.submitRequested()` | `LoginEvent.submitRequested()` |

### Patterns

- Extend `Bloc<Event, State>` directly (no base class)
- Register event handlers in constructor: `on<EventType>(_handler)`
- Handler naming: `_on{EventName}`
- Parallel requests: use `Future.wait()`
- Pull-to-refresh: pass `Completer<void>?` in event for completion signaling
- Stream subscriptions: must cancel in `close()` override

```dart
class ProductBloc extends Bloc<ProductEvent, ProductState> {
  final GetProductsUseCase getProductsUseCase;

  ProductBloc({required this.getProductsUseCase})
      : super(const ProductInitial()) {
    on<ProductLoadRequested>(_onLoadRequested);
  }

  Future<void> _onLoadRequested(ProductLoadRequested event, Emitter<ProductState> emit) async {
    emit(const ProductLoading());
    try {
      final result = await getProductsUseCase(const GetProductsParams());
      emit(ProductLoaded(items: result.items));
    } on Exception catch (e) {
      emit(ProductError(message: e.toString()));
    }
  }
}
```

### Communication

| Scenario | Pattern |
|----------|---------|
| Parent -> Child BLoC | Pass data via constructor or event at creation time |
| Sibling BLoCs | Use `common/events/` event bus — one BLoC fires event, the other listens |
| Global state change (e.g., logout) | `Bloc.observer` handles via `addError()` pattern |

### DI Registration

| Scope | Registration | Target |
|-------|-------------|--------|
| BLoC | `registerFactory` | New instance per route |

```dart
sl.registerFactory(() => ProductBloc(getProductsUseCase: sl()));
```

### Routing with BLoC

Create BLoC via `BlocProvider` at each route and dispatch initial event:

```dart
GoRoute(
  path: '/products',
  pageBuilder: (context, state) => NoTransitionPage<void>(
    child: BlocProvider(
      create: (_) => sl<ProductBloc>()..add(const ProductLoadRequested()),
      child: const ProductScreen(),
    ),
  ),
),
```

### Error Handling

| Layer | Responsibility |
|-------|---------------|
| BLoC | Use `on Exception catch (e)` for errors -> emit error state. Never use bare `catch`. |

### Test Patterns

- Call `bloc.close()` in `tearDown`
- Call `registerFallbackValue()` in `setUpAll` for Freezed params
