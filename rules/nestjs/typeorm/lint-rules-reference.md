<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/typescript/gen-eslint-reference.mjs -->
<!-- Source: rules/nestjs/typeorm/eslint.rules.mjs -->

# Lint Rules Reference (nestjs/typeorm)

## Framework 금지 패키지 (순수 레이어 차단)

Framework 차단 — model/port/exception에서 TypeORM 타입(@Entity, Repository 등) 금지.
도메인은 순수 타입 유지, TypeORM 엔티티는 provider/ 에 별도 배치.
사용 가능 위치: provider/ (Port 구현체), infrastructure/ (커넥션).

- `typeorm` (+ 서브경로)
