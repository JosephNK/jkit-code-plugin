# Conventions

## Dependency Rules

> Layer structure and flow: see [Architecture](architecture.md#components)

1. **model/ imports nothing** (no frameworks, no external libraries)
2. **service/ depends on model/ and port/ for business logic** (no direct references to controller/ or provider/; framework DI decorators like `@Injectable` and `@Inject` are allowed)
3. **provider/ implements outbound-port from port/**
4. **controller/ accesses service/ through inbound-port from port/**
5. **Module wires Port ↔ implementation via DI**
6. No importing framework/infra packages in `model/`, `port/`, `exception/` (`@Injectable` and `@Inject` only in `service/`)
7. No framework types like `Express.Multer.File` in `port/` — convert to domain types (`ImageInput`)
8. No business logic in controller/ (delegate to service)
9. No circular dependencies between layers

## Code Style

- **Immutability**: Use `readonly` on all Entity and DTO fields
- **Validation**: Validate inputs with Zod/class-validator in controller/
- **Naming**: File suffixes indicate role:
  - **Core**: `*.entity.ts`, `*.port.ts`, `*.service.ts`, `*.adapter.ts`, `*.controller.ts`, `*.dto.ts`, `*.error.ts`
  - **Model helpers**: `*.prompt.ts` (AI prompt builder), `*.types.ts` (type definitions), `*.constants.ts` (constants/enums), no suffix for pure domain functions (e.g., `spelling-grader.ts`, `cost-calculator.ts`)
  - **Port**: `port-tokens.ts` (DI Symbol tokens)
  - **Service**: `*.listener.ts` (event listener)
  - **Request DTO**: `*.request.dto.ts` (inbound request DTO, alias for `create-*.dto.ts`)
- **File size**: 400 lines recommended max, 800 lines hard limit

## Error Handling

- **service/ uses only domain errors (`exception/`)**. Do not throw HTTP exceptions directly.
- **controller/ converts domain exceptions to HTTP exceptions** using `mapDomainException()` from `common/exceptions/exception-mapper.ts` in catch blocks.
- **Exception creation checklist**: When adding a new domain exception (`exception/`):
  1. Create the error class in `exception/`
  2. Register the error code in **all 4** i18n translation files:
     - `src/infrastructure/i18n/locales/en/error.json`
     - `src/infrastructure/i18n/locales/ko/error.json`
     - `src/infrastructure/i18n/locales/ja/error.json`
     - `src/infrastructure/i18n/locales/zh/error.json`
  3. Use the error code (e.g., `VOCAB_ENTRY_DUPLICATE`) as key with the localized message as value

## Response DTO Patterns

Never return entities directly — always transform through a ResponseDto.

### API Documentation (Swagger)

All API endpoints are documented via Swagger decorators. Swagger UI is available at `/api-docs`.

### DTO Structure

```
src/modules/{domain}/dto/
├── create-{domain}.dto.ts       # Create request
├── update-{domain}.dto.ts       # Update request (using PartialType)
├── {domain}-query.dto.ts        # Query parameters
├── {domain}-data.response.dto.ts  # *DataResponseDto — data 직속 DTO
└── {domain}-item.dto.ts           # *ItemDto — 배열 요소 / 하위 객체 / 보조 DTO
```

### Naming Convention

The `ApiSuccessResponse` decorator wraps all responses in `{ success, data }`. DTO class names use suffixes that reflect their role in this structure.

| Role | Suffix | Example |
|---|---|---|
| Direct child of `data` | `*DataResponseDto` | `QuizSessionListDataResponseDto`, `QuizSessionCreateDataResponseDto` |
| Array element / nested object | `*ItemDto` | `QuizSessionItemDto`, `QuizQuestionItemDto` |

- **`*DataResponseDto`**: Top-level DTO mapped directly to the `data` field of a success response. Prefix with the action (`List`, `Create`, `Detail`, etc.). Omit the action prefix when no disambiguation is needed.
- **`*ItemDto`**: DTO for individual elements in `*DataResponseDto.items` or any array field inside a `*DataResponseDto`.
- **Do not use bare `*ResponseDto`**: DTOs used under `data` must be named `*DataResponseDto`, not `*ResponseDto`.

```typescript
// List response example
// GET /quiz-sessions → { success: true, data: QuizSessionListDataResponseDto }
class QuizSessionListDataResponseDto {
  readonly items: readonly QuizSessionItemDto[];
  readonly limit: number;
  readonly total?: number;
}

// Single response example
// POST /quiz-sessions → { success: true, data: QuizSessionCreateDataResponseDto }
class QuizSessionCreateDataResponseDto {
  readonly id: string;
  readonly questions: readonly QuizQuestionItemDto[];
}
```

### Core Principles

- **Entity encapsulation**: Separate DB schema from API response exposure
- **Explicit types**: Apply `@ApiProperty` or `@ApiPropertyOptional` to all fields
- **Example values**: Improve documentation readability with `example` property
- **Union type rules**: DTO field union types follow these rules:
  - **Primitive + null allowed**: `T | null` is allowed when `@ApiProperty({ nullable: true })` is specified
    - `string | null` → `@ApiProperty({ nullable: true })`
    - `number | null` → `@ApiProperty({ nullable: true })`
    - `boolean | null` → `@ApiProperty({ nullable: true })`
  - **`Date | null` allowed**: When `type: String, format: 'date-time', nullable: true` is specified
    - `Date | null` → `@ApiProperty({ type: String, format: 'date-time', nullable: true, example: null })`
  - **No class unions**: Do not use unions of multiple class types like `UserDto | GuestDto`. Consolidate into a shared DTO or separate fields.
  - **No `oneOf`**: Not supported for client code generation in other languages due to lack of dynamic type support.
  - **No `T | undefined`**: Use `@ApiPropertyOptional()` with optional property (`?`) instead.

## Test Strategy

- **Model tests**: Pure function unit tests
- **Service tests**: Mock outbound-ports. Verify business logic without external dependencies
- **Provider tests**: Mock actual external services to verify adapter behavior
- **Controller tests**: Mock inbound-ports. Verify HTTP request/response handling
- **E2E tests**: Assemble full modules and test via HTTP requests

```typescript
// Service unit test example
describe('ExtractVocabularyService', () => {
  it('should extract vocabulary from image', async () => {
    const mockAnalyzer: AiAnalyzerPort = {
      analyzeImage: jest
        .fn()
        .mockResolvedValue('[{"word":"apple","meaning":"사과","pos":"noun"}]'),
    };
    const service = new ExtractVocabularyService(mockAnalyzer);
    const result = await service.execute(mockImage);
    expect(result.words).toHaveLength(1);
  });
});
```
