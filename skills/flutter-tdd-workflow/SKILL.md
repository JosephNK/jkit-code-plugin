---
name: flutter-tdd-workflow
description: Use this skill when writing new features, fixing bugs, or refactoring code. Enforces test-driven development with 80%+ coverage including unit, widget, and integration tests.
---

# Test-Driven Development Workflow

This skill ensures all code development follows TDD principles with comprehensive test coverage.

## When to Activate

- Writing new features or functionality
- Fixing bugs or issues
- Refactoring existing code
- Adding API services or repositories
- Creating new widgets or screens

## Core Principles

### 1. Tests BEFORE Code
ALWAYS write tests first, then implement code to make tests pass.

### 2. Coverage Requirements
- Minimum 80% coverage (unit + widget + integration)
- All edge cases covered
- Error scenarios tested
- Boundary conditions verified

### 3. Test Types

#### Unit Tests
- Individual functions and utilities
- BLoC/Cubit state transitions
- Pure functions
- Helpers and extensions

#### Widget Tests
- Widget rendering and layout
- User interaction (tap, scroll, input)
- State changes and rebuilds
- Navigation behavior

#### Integration Tests
- Repository + data source
- BLoC/Cubit + repository
- Service layer interactions
- API client responses

#### E2E Tests (`integration_test/`)
- Critical user flows
- Complete workflows
- Full app integration

## TDD Workflow Steps

### Step 1: Write User Journeys
```
As a [role], I want to [action], so that [benefit]

Example:
As a user, I want to search items by keyword,
so that I can quickly find what I'm looking for.
```

### Step 2: Generate Test Cases
For each user journey, create comprehensive test cases:

```dart
group('ItemSearchBloc', () {
  test('emits results when query matches', () async {
    // Test implementation
  });

  test('emits empty state for no matches', () async {
    // Test edge case
  });

  test('emits error state on repository failure', () async {
    // Test fallback behavior
  });

  test('debounces rapid search input', () async {
    // Test debounce logic
  });
});
```

### Step 3: Run Tests (They Should Fail)
```bash
flutter test
# Tests should fail - we haven't implemented yet
```

### Step 4: Implement Code
Write minimal code to make tests pass:

```dart
// Implementation guided by tests
class ItemSearchBloc extends Bloc<ItemSearchEvent, ItemSearchState> {
  // Implementation here
}
```

### Step 5: Run Tests Again
```bash
flutter test
# Tests should now pass
```

### Step 6: Refactor
Improve code quality while keeping tests green:
- Remove duplication
- Improve naming
- Optimize performance
- Enhance readability

### Step 7: Verify Coverage
```bash
flutter test --coverage
lcov --summary coverage/lcov.info
# Verify 80%+ coverage achieved
```

## Testing Patterns

### Unit Test Pattern
```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockItemRepository extends Mock implements ItemRepository {}

void main() {
  late MockItemRepository mockRepo;
  late ItemService service;

  setUp(() {
    mockRepo = MockItemRepository();
    service = ItemService(repository: mockRepo);
  });

  group('ItemService', () {
    test('returns item list on success', () async {
      when(() => mockRepo.getAll())
          .thenAnswer((_) async => [testItem]);

      final result = await service.getAll();

      expect(result, hasLength(1));
      expect(result.first.name, equals('test'));
      verify(() => mockRepo.getAll()).called(1);
    });

    test('throws on repository failure', () async {
      when(() => mockRepo.getAll())
          .thenThrow(Exception('DB error'));

      expect(
        () => service.getAll(),
        throwsA(isA<Exception>()),
      );
    });
  });
}
```

### Widget Test Pattern
```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ItemCard', () {
    testWidgets('renders title and subtitle', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ItemCard(title: 'Sample', subtitle: 'Description'),
          ),
        ),
      );

      expect(find.text('Sample'), findsOneWidget);
      expect(find.text('Description'), findsOneWidget);
    });

    testWidgets('calls onTap when tapped', (tester) async {
      var tapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ItemCard(
              title: 'Sample',
              subtitle: 'Description',
              onTap: () => tapped = true,
            ),
          ),
        ),
      );

      await tester.tap(find.byType(ItemCard));
      expect(tapped, isTrue);
    });
  });
}
```

### BLoC Test Pattern
```dart
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockItemRepository extends Mock implements ItemRepository {}

void main() {
  late MockItemRepository mockRepo;

  setUp(() {
    mockRepo = MockItemRepository();
  });

  group('ItemListBloc', () {
    blocTest<ItemListBloc, ItemListState>(
      'emits [loading, loaded] when fetch succeeds',
      build: () {
        when(() => mockRepo.getAll())
            .thenAnswer((_) async => [testItem]);
        return ItemListBloc(repository: mockRepo);
      },
      act: (bloc) => bloc.add(const ItemListFetched()),
      expect: () => [
        const ItemListState(status: ItemListStatus.loading),
        ItemListState(
          status: ItemListStatus.loaded,
          items: [testItem],
        ),
      ],
    );

    blocTest<ItemListBloc, ItemListState>(
      'emits [loading, error] when fetch fails',
      build: () {
        when(() => mockRepo.getAll())
            .thenThrow(Exception('Network error'));
        return ItemListBloc(repository: mockRepo);
      },
      act: (bloc) => bloc.add(const ItemListFetched()),
      expect: () => [
        const ItemListState(status: ItemListStatus.loading),
        isA<ItemListState>()
            .having((s) => s.status, 'status', ItemListStatus.error),
      ],
    );
  });
}
```

### E2E Test Pattern (`integration_test/`)
```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:app/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('user can search and view item detail', (tester) async {
    app.main();
    await tester.pumpAndSettle();

    // Navigate to search
    await tester.tap(find.byIcon(Icons.search));
    await tester.pumpAndSettle();

    // Type search query
    await tester.enterText(find.byType(TextField), 'sample');
    await tester.pumpAndSettle();

    // Verify search results
    expect(find.text('sample'), findsWidgets);

    // Tap on result
    await tester.tap(find.text('sample').first);
    await tester.pumpAndSettle();

    // Verify detail screen
    expect(find.text('Description'), findsOneWidget);
  });
}
```

## Test File Organization

```
# test/ mirrors lib/ structure
lib/
├── models/
│   └── user.dart
├── services/
│   └── auth_service.dart
├── widgets/
│   └── user_card.dart
└── screens/
    └── home_screen.dart

test/                                    # Unit + Widget tests
├── models/
│   └── user_test.dart
├── services/
│   └── auth_service_test.dart
├── widgets/
│   └── user_card_test.dart
└── screens/
    └── home_screen_test.dart

integration_test/                        # E2E tests
└── app_test.dart
```

## Mocking External Services

### API Service Mock
```dart
class MockApiService extends Mock implements ApiService {}

void main() {
  late MockApiService mockApi;

  setUp(() {
    mockApi = MockApiService();
  });

  test('fetches data from API', () async {
    when(() => mockApi.getItems())
        .thenAnswer((_) async => ApiResponse(
              data: [testItem],
              statusCode: 200,
            ));

    final result = await mockApi.getItems();

    expect(result.data, hasLength(1));
    expect(result.statusCode, equals(200));
  });
}
```

### SharedPreferences Mock
```dart
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({
      'theme_mode': 'dark',
      'language': 'ko',
    });
  });

  test('reads settings from SharedPreferences', () async {
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('language'), equals('ko'));
  });
}
```

## Test Coverage Verification

### Run Coverage Report
```bash
flutter test --coverage
genhtml coverage/lcov.info -o coverage/html
open coverage/html/index.html
```

### Coverage Summary
```bash
lcov --summary coverage/lcov.info
```

## Common Testing Mistakes to Avoid

### WRONG: Testing Implementation Details
```dart
// Don't test internal state directly
expect(bloc.state.internalCache.length, equals(5));
```

### CORRECT: Test Observable Behavior
```dart
// Test emitted states
expect(bloc.state.status, equals(LoadStatus.loaded));
expect(bloc.state.items, hasLength(5));
```

### WRONG: No Test Isolation
```dart
// Tests depend on each other
test('creates item', () { /* ... */ });
test('updates same item', () { /* depends on previous test */ });
```

### CORRECT: Independent Tests
```dart
// Each test sets up its own data
test('creates item', () {
  final item = createTestItem();
  // Test logic
});

test('updates item', () {
  final item = createTestItem();
  // Update logic
});
```

## Continuous Testing

### Watch Mode During Development
```bash
# Re-runs tests on file changes (using very_good_cli)
very_good test --watch

# Or with a file watcher
flutter test --watch
```

### Pre-Commit Hook
```bash
# Runs before every commit
flutter analyze && flutter test
```

## Best Practices

1. **Write Tests First** - Always TDD
2. **One Assert Per Test** - Focus on single behavior
3. **Descriptive Test Names** - Explain what's tested
4. **Arrange-Act-Assert** - Clear test structure
5. **Mock External Dependencies** - Isolate unit tests
6. **Test Edge Cases** - Null, empty list, boundary values
7. **Test Error Paths** - Not just happy paths
8. **Keep Tests Fast** - Unit tests < 50ms each
9. **Clean Up After Tests** - No side effects
10. **Review Coverage Reports** - Identify gaps

## Success Metrics

- 80%+ code coverage achieved
- All tests passing (green)
- No skipped or disabled tests
- Fast test execution (< 30s for unit tests)
- E2E tests cover critical user flows
- Tests catch bugs before production

---

**Remember**: Tests are not optional. They are the safety net that enables confident refactoring, rapid development, and production reliability.
