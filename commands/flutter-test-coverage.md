# Flutter Test Coverage

Analyze test coverage, identify gaps, and generate missing tests to reach 80%+ coverage.

## Step 1: Run Coverage

```bash
# Run all tests with coverage
flutter test --coverage

# Generate HTML report (optional, requires lcov)
genhtml coverage/lcov.info -o coverage/html
open coverage/html/index.html
```

Coverage output: `coverage/lcov.info`

## Step 2: Analyze Coverage Report

1. Run the coverage command
2. Parse the output with `lcov`
3. List files **below 80% coverage**, sorted worst-first
4. For each under-covered file, identify:
   - Untested functions or methods
   - Missing branch coverage (if/else, switch, error paths)
   - Dead code that inflates the denominator

```bash
# Summary
lcov --summary coverage/lcov.info

# Per-file breakdown
lcov --list coverage/lcov.info
```

## Step 3: Generate Missing Tests

For each under-covered file, generate tests following this priority:

1. **Happy path** — Core functionality with valid inputs
2. **Error handling** — Invalid inputs, missing data, network failures
3. **Edge cases** — Empty lists, null, boundary values (0, -1, double.maxFinite)
4. **Branch coverage** — Each if/else, switch case, ternary

### Test Generation Rules

- Place tests mirroring source structure: `lib/src/foo.dart` → `test/src/foo_test.dart` (or project convention)
- Use existing test patterns from the project (import style, assertion library, mocking approach)
- Mock external dependencies (database, APIs, file system) with `mocktail` or `mockito`
- Each test should be independent — no shared mutable state between tests
- Name tests descriptively: `'should return 409 when creating user with duplicate email'`
- Use `group()` to organize related test cases
- Use `setUp()` / `tearDown()` for common test fixtures

### Test File Structure

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

// Mock classes
class MockAuthRepository extends Mock implements AuthRepository {}

void main() {
  late MockAuthRepository mockRepo;

  setUp(() {
    mockRepo = MockAuthRepository();
  });

  group('AuthService', () {
    group('login', () {
      test('should return user on valid credentials', () {
        // arrange
        when(() => mockRepo.login(any(), any()))
            .thenAnswer((_) async => mockUser);

        // act
        final result = await authService.login('email', 'pass');

        // assert
        expect(result, equals(mockUser));
        verify(() => mockRepo.login('email', 'pass')).called(1);
      });

      test('should throw on invalid credentials', () {
        // arrange
        when(() => mockRepo.login(any(), any()))
            .thenThrow(AuthException('Invalid credentials'));

        // act & assert
        expect(
          () => authService.login('email', 'wrong'),
          throwsA(isA<AuthException>()),
        );
      });
    });
  });
}
```

## Step 4: Verify

1. Run the full test suite — all tests must pass
2. Re-run coverage — verify improvement
3. If still below 80%, repeat Step 3 for remaining gaps

```bash
# Run tests and verify all pass
flutter test

# Re-run coverage
flutter test --coverage
lcov --summary coverage/lcov.info
```

## Step 5: Report

Show before/after comparison:

```
Coverage Report
──────────────────────────────────────────────────
File                                Before  After
lib/src/services/auth_service.dart  45%     88%
lib/src/utils/validation.dart       32%     82%
──────────────────────────────────────────────────
Overall:                            67%     84%
```

## Focus Areas

- Functions with complex branching (high cyclomatic complexity)
- Error handlers and catch blocks
- Utility functions used across the codebase
- BLoC/Cubit event handlers and state transitions
- Repository methods (data source → model mapping)
- Edge cases: null, empty string, empty list, zero, negative numbers
