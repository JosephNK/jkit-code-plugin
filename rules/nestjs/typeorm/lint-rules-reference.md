<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/gen-lint-reference.mjs -->
<!-- Source: rules/nestjs/typeorm/eslint.rules.mjs -->

# Lint Rules Reference (nestjs/typeorm)

## Framework 금지 패키지 (순수 레이어 차단)

TypeORM을 "프레임워크" 패키지로 분류하여 model/, port/, exception/ 에서 차단.
- model/ 에 TypeORM 데코레이터(@Entity, @Column)를 직접 붙이면 ORM 스키마가
  도메인 모델과 결합되어 순수성이 깨진다.
  → TypeORM 엔티티는 provider/ 하위에 별도로 두고, model은 순수 타입으로 유지.
- port/ 는 인터페이스 순수성을 위해 TypeORM Repository/QueryBuilder 타입 금지.
- exception/ 는 도메인 예외이므로 ORM 관련 에러 타입 금지.

TypeORM 사용 가능 위치: provider/ (Port 구현체), infrastructure/ (커넥션 초기화)

- `typeorm`
- `typeorm/*`
