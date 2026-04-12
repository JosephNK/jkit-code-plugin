# Flutter Code Review

Comprehensive security and quality review of uncommitted changes:

1. Get changed files: git diff --name-only HEAD

2. For each changed file, check for:

**Security Issues (CRITICAL):**
- Hardcoded credentials, API keys, tokens
- SQL injection vulnerabilities
- Insecure data storage (SharedPreferences for sensitive data)
- Missing input validation
- Insecure dependencies
- Path traversal risks
- Unencrypted network communication

**Code Quality (HIGH):**
- Functions > 50 lines
- Files > 800 lines
- Nesting depth > 4 levels
- Missing error handling
- `print()` / `debugPrint()` statements left in production code
- TODO/FIXME comments
- Missing documentation for public APIs
- Unused imports or variables

**Best Practices (MEDIUM):**
- Mutation patterns (use immutable instead)
- Missing `const` constructors where applicable
- Missing tests for new code
- BLoC state not handled exhaustively
- Widget tree too deep (extract sub-widgets)
- Missing `Key` parameter on public widgets
- Hardcoded strings (use l10n)

3. Generate report with:
   - Severity: CRITICAL, HIGH, MEDIUM, LOW
   - File location and line numbers
   - Issue description
   - Suggested fix

4. Block commit if CRITICAL or HIGH issues found

Never approve code with security vulnerabilities!
