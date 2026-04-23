<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/gen-lint-reference.mjs -->
<!-- Source: rules/nestjs/base/eslint.rules.mjs (baseBoundaryRules) -->

# Lint Rules — Dependency Diagram (nestjs/base)

> 레이어 간 의존성 시각화 (`baseBoundaryRules` allow-list 기반).
> 텍스트 조회 / Allow 매트릭스 / 레이어별 상세: `lint-rules-reference.md` 참조.

```mermaid
graph LR
  model["model"]
  exception["exception"]
  common["common"]
  port["port"]
  service["service"]
  infrastructure["infrastructure"]
  controller["controller"]
  dto["dto"]
  libs["libs"]
  provider["provider"]
  exception --> common
  port --> model
  port --> common
  service --> model
  service --> port
  service --> exception
  service --> common
  service --> infrastructure
  controller --> port
  controller --> dto
  controller --> model
  controller --> exception
  controller --> common
  controller --> libs
  provider --> port
  provider --> model
  provider --> common
  provider --> infrastructure
  dto --> model
  dto --> common
  infrastructure --> common
  libs --> model
  libs --> port
  libs --> service
  libs --> controller
  libs --> provider
  libs --> exception
  libs --> dto
  libs --> common
  libs --> infrastructure
```
