---
description: Enforce test-driven development workflow. Scaffold interfaces, generate tests FIRST, then implement minimal code to pass. Ensure 80%+ coverage.
---

# Flutter TDD Command

This command invokes the **flutter-tdd-guide** agent to enforce test-driven development methodology.

## What This Command Does

1. **Scaffold Interfaces** - Define classes/abstract interfaces first
2. **Generate Tests First** - Write failing tests (RED)
3. **Implement Minimal Code** - Write just enough to pass (GREEN)
4. **Refactor** - Improve code while keeping tests green (REFACTOR)
5. **Verify Coverage** - Ensure 80%+ test coverage

## When to Use

Use `/flutter-tdd` when:
- Implementing new features
- Adding new functions/widgets
- Fixing bugs (write test that reproduces bug first)
- Refactoring existing code
- Building critical business logic

## How It Works

The tdd-guide agent will:

1. **Define classes/interfaces** for inputs/outputs
2. **Write tests that will FAIL** (because code doesn't exist yet)
3. **Run tests** and verify they fail for the right reason
4. **Write minimal implementation** to make tests pass
5. **Run tests** and verify they pass
6. **Refactor** code while keeping tests green
7. **Check coverage** and add more tests if below 80%

## TDD Cycle

```
RED → GREEN → REFACTOR → REPEAT

RED:      Write a failing test
GREEN:    Write minimal code to pass
REFACTOR: Improve code, keep tests passing
REPEAT:   Next feature/scenario
```

## Example Usage

```
User: /flutter-tdd I need a function to calculate market liquidity score

Agent (flutter-tdd-guide):
# TDD Session: Market Liquidity Score Calculator

## Step 1: Define Interface (SCAFFOLD)

```dart
// lib/src/liquidity.dart
import 'dart:math' as math;

class MarketData {
  const MarketData({
    required this.totalVolume,
    required this.bidAskSpread,
    required this.activeTraders,
    required this.lastTradeTime,
  });

  final double totalVolume;
  final double bidAskSpread;
  final int activeTraders;
  final DateTime lastTradeTime;
}

double calculateLiquidityScore(MarketData market) {
  // TODO: Implementation
  throw UnimplementedError('Not implemented');
}
```

## Step 2: Write Failing Test (RED)

```dart
// test/liquidity_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:app/src/liquidity.dart';

void main() {
  group('calculateLiquidityScore', () {
    test('should return high score for liquid market', () {
      final market = MarketData(
        totalVolume: 100000,
        bidAskSpread: 0.01,
        activeTraders: 500,
        lastTradeTime: DateTime.now(),
      );

      final score = calculateLiquidityScore(market);

      expect(score, greaterThan(80));
      expect(score, lessThanOrEqualTo(100));
    });

    test('should return low score for illiquid market', () {
      final market = MarketData(
        totalVolume: 100,
        bidAskSpread: 0.5,
        activeTraders: 2,
        lastTradeTime: DateTime.now().subtract(const Duration(days: 1)),
      );

      final score = calculateLiquidityScore(market);

      expect(score, lessThan(30));
      expect(score, greaterThanOrEqualTo(0));
    });

    test('should handle edge case: zero volume', () {
      final market = MarketData(
        totalVolume: 0,
        bidAskSpread: 0,
        activeTraders: 0,
        lastTradeTime: DateTime.now(),
      );

      final score = calculateLiquidityScore(market);

      expect(score, equals(0));
    });
  });
}
```

## Step 3: Run Tests - Verify FAIL

```bash
flutter test test/liquidity_test.dart

00:02 +0 -1: calculateLiquidityScore should return high score for liquid market
  UnimplementedError: Not implemented

00:02 +0 -1: Some tests failed.
```

Tests fail as expected. Ready to implement.

## Step 4: Implement Minimal Code (GREEN)

```dart
// lib/src/liquidity.dart
import 'dart:math' as math;

double calculateLiquidityScore(MarketData market) {
  // Handle zero volume edge case
  if (market.totalVolume == 0) {
    return 0;
  }

  // Calculate component scores (0-100 scale)
  final volumeScore = math.min(market.totalVolume / 1000, 100.0);
  final spreadScore = math.max(100 - (market.bidAskSpread * 1000), 0.0);
  final traderScore = math.min(market.activeTraders / 10, 100.0);

  // Recent activity bonus
  final hoursSinceLastTrade =
      DateTime.now().difference(market.lastTradeTime).inMinutes / 60.0;
  final recencyScore = math.max(100 - (hoursSinceLastTrade * 10), 0.0);

  // Weighted average
  final score = volumeScore * 0.4 +
      spreadScore * 0.3 +
      traderScore * 0.2 +
      recencyScore * 0.1;

  return score.clamp(0, 100);
}
```

## Step 5: Run Tests - Verify PASS

```bash
flutter test test/liquidity_test.dart

00:02 +3: All tests passed!
```

All tests passing!

## Step 6: Refactor (IMPROVE)

```dart
// lib/src/liquidity.dart - Refactored with constants and better readability
import 'dart:math' as math;

class _Weights {
  const _Weights._();
  static const double volume = 0.4;
  static const double spread = 0.3;
  static const double traders = 0.2;
  static const double recency = 0.1;
}

class _ScaleFactors {
  const _ScaleFactors._();
  static const double volume = 1000;
  static const double spread = 1000;
  static const double traders = 10;
  static const double recencyPenalty = 10;
}

double calculateLiquidityScore(MarketData market) {
  if (market.totalVolume == 0) return 0;

  final volumeScore = math.min(market.totalVolume / _ScaleFactors.volume, 100.0);
  final spreadScore =
      (100 - (market.bidAskSpread * _ScaleFactors.spread)).clamp(0.0, 100.0);
  final traderScore = math.min(market.activeTraders / _ScaleFactors.traders, 100.0);

  final hoursSinceLastTrade =
      DateTime.now().difference(market.lastTradeTime).inMinutes / 60.0;
  final recencyScore =
      (100 - (hoursSinceLastTrade * _ScaleFactors.recencyPenalty)).clamp(0.0, 100.0);

  final weightedScore = volumeScore * _Weights.volume +
      spreadScore * _Weights.spread +
      traderScore * _Weights.traders +
      recencyScore * _Weights.recency;

  return weightedScore.clamp(0, 100);
}
```

## Step 7: Verify Tests Still Pass

```bash
flutter test test/liquidity_test.dart

00:02 +3: All tests passed!
```

Refactoring complete, tests still passing!

## Step 8: Check Coverage

```bash
flutter test --coverage test/liquidity_test.dart
lcov --summary coverage/lcov.info

Summary:
  lines: 100.0% (18 of 18 lines)
  functions: 100.0%
  branches: 100.0%

Coverage: 100% (Target: 80%)
```

TDD session complete!
```

## TDD Best Practices

**DO:**
- Write the test FIRST, before any implementation
- Run tests and verify they FAIL before implementing
- Write minimal code to make tests pass
- Refactor only after tests are green
- Add edge cases and error scenarios
- Aim for 80%+ coverage (100% for critical code)

**DON'T:**
- Write implementation before tests
- Skip running tests after each change
- Write too much code at once
- Ignore failing tests
- Test implementation details (test behavior)
- Mock everything (prefer integration tests)

## Test Types to Include

**Unit Tests** (Function-level):
- Happy path scenarios
- Edge cases (empty, null, max values)
- Error conditions
- Boundary values

**Widget Tests** (Component-level):
- Widget rendering and layout
- User interaction (tap, scroll, input)
- State changes via BLoC/Provider
- Navigation behavior

**Integration Tests** (Feature-level):
- API service calls with mock server
- Repository layer with mock data sources
- BLoC/Cubit with mock repositories

**E2E Tests** (`integration_test/`):
- Critical user flows
- Multi-step processes
- Full app integration

## Coverage Requirements

- **80% minimum** for all code
- **100% required** for:
  - Financial calculations
  - Authentication logic
  - Security-critical code
  - Core business logic

## Important Notes

**MANDATORY**: Tests must be written BEFORE implementation. The TDD cycle is:

1. **RED** - Write failing test
2. **GREEN** - Implement to pass
3. **REFACTOR** - Improve code

Never skip the RED phase. Never write code before tests.

## Integration with Other Commands

- Use `/flutter-plan` first to understand what to build
- Use `/flutter-tdd` to implement with tests
- Use `/flutter-build-fix` if build errors occur
- Use `/flutter-code-review` to review implementation
- Use `/flutter-test-coverage` to verify coverage

## Related Agents

This command invokes the `flutter-tdd-guide` agent located at:
`~/.claude/agents/flutter-tdd-guide.md`

And can reference the `flutter-tdd-workflow` skill at:
`~/.claude/skills/flutter-tdd-workflow/`
