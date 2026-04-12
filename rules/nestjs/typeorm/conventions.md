## TypeORM

Use TypeORM for database persistence.

### Naming

- **Provider**: `*.orm-entity.ts` (TypeORM persistence model), `*.mapper.ts` (data transformer), `*.scheduler.ts` (cron/scheduled tasks)

### Date Columns

All TypeORM Date columns must use `type: 'timestamptz'` (`@CreateDateColumn`, `@UpdateDateColumn`, `@Column` included).
