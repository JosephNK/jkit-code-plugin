# {{PROJECT_NAME}}

### Hard Rules

- **Never add `.claude/` to `.gitignore`.** Only add specific personal paths like `.claude/settings.local.json`, `.claude/sessions/`, `.claude/todos/`. See [GIT.md]({{DOCS_DIR}}GIT.md#gitignore-rules-for-claude) for the complete list.

### Reference

- [Architecture]({{DOCS_DIR}}ARCHITECTURE.md) — **MUST read when writing or modifying code.** Full architecture details with code examples
- [Conventions]({{DOCS_DIR}}CONVENTIONS.md) — **MUST read when writing or modifying code.** Full conventions with code examples
- [Git]({{DOCS_DIR}}GIT.md) — **MUST read when committing or using git/GitHub commands.** Git & GitHub guide with commit conventions
- **Lint Rules** — `@jkit/code-plugin/nextjs/base/lint-rules-reference.md` (plugin source). Layer glossary, rule table, allow matrix. Companions: `lint-rules-structure-reference.md` (boundary elements & path layout), `lint-rules-diagram.md` (dependency graph), `stylelint-rules-reference.md` (CSS rules).
