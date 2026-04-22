# Architecture

> 이 문서: 헥사고날 개념 + 레이어별 코드 패턴 (WHY / HOW).
> 레이어 경로 매핑: `@jkit/eslint-rules/nestjs/base/lint-rules-structure-reference.md`
> 레이어 의존성 규칙 (allow 매트릭스 / 무시 경로): `@jkit/eslint-rules/nestjs/base/lint-rules-reference.md`

Hexagonal Architecture (Ports and Adapters) + NestJS 모듈 구조.
도메인 로직은 프레임워크 의존성 없는 순수 TypeScript.
핵심 원칙: **비즈니스 로직은 외부 인프라를 모른다.**

## Layer Diagram

```
[inbound-adapter]  controller/   요청 진입점 (REST, GraphQL, gRPC, CLI...)
        |
[inbound-port]     port/         service 로직을 향한 인터페이스
        |
[service]          service/      inbound-port 구현 (핵심 비즈니스 로직)
        |
[outbound-port]    port/         외부 세계를 향한 인터페이스
        |
[outbound-adapter] provider/     outbound-port 구현 (DB, AI, search engine...)
```

## Data Flow

### Request (호출 방향)

```
Client (HTTP Request)
    |
Controller          요청 수신, DTO 검증
    |
Inbound Port        service 를 향한 인터페이스
    |
Service             비즈니스 로직 조합 (순수 TS, Port 만 의존)
    |
Outbound Port       외부 세계를 향한 인터페이스
    |
Provider            실제 DB / API 호출
```

### Response (반환 방향)

```
Provider            DB / 외부 서비스의 raw 데이터
    |
Domain Model        순수 TS 엔티티 (readonly immutable)
    |
Service             비즈니스 로직 적용, Domain Model 반환
    |
Controller          response DTO 로 매핑
    |
Client (HTTP Response)
```

### Dependency Direction

```
Controller -> Inbound Port (interface) <- Service -> Outbound Port (interface) <- Provider
                                            |                                       |
                                       Domain Model  <-  <-  <-  <-  <-  <-  <-  <-
                                                   (모든 레이어가 이것에 의존)
```

## Layer Details

### model — Entity, Value Object, Pure Functions

프레임워크 import 엄격히 금지. 프로젝트에서 가장 안정적인 레이어.

```typescript
// model/order.entity.ts
export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export interface Order {
  readonly id: string;
  readonly items: ReadonlyArray<OrderItem>;
  readonly status: OrderStatus;
  readonly totalAmount: number;
}
```

```typescript
// model/order.functions.ts
// 순수 함수. 외부 의존성 없음.
export function calculateTotal(items: ReadonlyArray<OrderItem>): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
```

### port — Port Interfaces

inbound-port 와 outbound-port 를 한 폴더에 배치, 네이밍으로 구분.

```typescript
// port/create-order.port.ts
// inbound-port: service 를 향한 계약 (Service 가 구현)
export interface CreateOrderPort {
  execute(input: CreateOrderInput): Promise<Order>;
}

// port/order-repository.port.ts
// outbound-port: 외부 세계를 향한 계약 (Provider 가 구현)
export interface OrderRepositoryPort {
  save(order: Order): Promise<Order>;
  findById(id: string): Promise<Order | null>;
}

// port/port-tokens.ts
export const CREATE_ORDER_PORT = Symbol('CreateOrderPort');
export const ORDER_REPOSITORY_PORT = Symbol('OrderRepositoryPort');
```

### service — Inbound-Port Implementation

Port 를 조합하여 비즈니스 흐름을 orchestrate.

```typescript
// service/create-order.service.ts
@Injectable()
export class CreateOrderService implements CreateOrderPort {
  constructor(
    @Inject(ORDER_REPOSITORY_PORT)
    private readonly orderRepository: OrderRepositoryPort,
  ) {}

  async execute(input: CreateOrderInput): Promise<Order> {
    const totalAmount = calculateTotal(input.items);
    const order: Order = {
      id: generateId(),
      items: input.items,
      status: 'pending',
      totalAmount,
    };
    return this.orderRepository.save(order);
  }
}
```

### controller — Inbound Adapter

HTTP 요청 수신 후 service 에 위임.

```typescript
// controller/order.controller.ts
@Controller('orders')
export class OrderController {
  constructor(
    @Inject(CREATE_ORDER_PORT)
    private readonly createOrder: CreateOrderPort,
  ) {}

  @Post()
  async create(@Body() dto: CreateOrderDto): Promise<Order> {
    return this.createOrder.execute(dto);
  }
}
```

### provider — Outbound Adapter

Port interface 를 구현하여 실제 외부 서비스와 통신.

```typescript
// provider/order-repository.adapter.ts
@Injectable()
export class OrderRepositoryAdapter implements OrderRepositoryPort {
  constructor(private readonly dataSource: DataSource) {}

  async save(order: Order): Promise<Order> {
    // 실제 DB 구현
  }

  async findById(id: string): Promise<Order | null> {
    // 실제 DB 구현
  }
}
```

### exception — Domain-Specific Exceptions

```typescript
// exception/order-not-found.error.ts
export class OrderNotFoundError extends Error {
  constructor(id: string) {
    super(`Order not found: ${id}`);
    this.name = 'OrderNotFoundError';
  }
}
```

### module — DI Assembly

NestJS module 이 Port 를 구현체와 연결.

```typescript
// order.module.ts
@Module({
  controllers: [OrderController],
  providers: [
    { provide: ORDER_REPOSITORY_PORT, useClass: OrderRepositoryAdapter },
    { provide: CREATE_ORDER_PORT, useClass: CreateOrderService },
  ],
})
export class OrderModule {}
```
