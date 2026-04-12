# Architecture

Hexagonal Architecture (Ports and Adapters) + NestJS modular structure.
Domain logic is pure TypeScript with no framework dependencies.
Core principle: **Business logic knows nothing about external infrastructure.**

## Project Structure

```
src/
├── modules/
│   └── <group>/<domain>/          # Internal structure of each domain module:
│       ├── model/                 # Entity, Value Object, pure domain functions
│       ├── port/                  # All Port interfaces (inbound + outbound)
│       ├── service/               # Inbound-port implementation (business logic)
│       ├── controller/            # Driving Adapter (HTTP)
│       ├── provider/              # Outbound Adapter (DB, external services)
│       ├── dto/                   # Input/output DTOs
│       ├── exception/             # Domain-specific exceptions
│       └── <domain>.module.ts     # NestJS module (DI assembly)
│
├── common/                # Shared utilities (DI-compatible)
│   ├── authentication/    # Guards, auth-related
│   ├── exceptions/        # Exception Filters, domain exception base
│   ├── interfaces/        # Shared interfaces
│   ├── middlewares/       # Global middlewares
│   ├── pipes/             # Validation Pipes
│   └── dtos/              # Shared DTOs
│
└── infrastructure/        # Infrastructure modules (DI-compatible)
    ├── database/          # Database configuration
    ├── email/             # Email delivery
    ├── i18n/              # Internationalization
    ├── logger/            # Logging
    └── transaction/       # Transaction management
```

File naming (`*.port.ts`, `*.service.ts`, `*.adapter.ts`) distinguishes roles.

## Components

```
[inbound-adapter]  controller/   Request entry point (REST, GraphQL, gRPC, CLI...)
        |
[inbound-port]     port/         Interface toward service logic
        |
[service]          service/      Inbound-port implementation (core business logic)
        |
[outbound-port]    port/         Interface toward external world
        |
[outbound-adapter] provider/     Outbound-port implementation (DB, AI, search engine...)
```

## Data Flow

### Request (call direction)

```
Client (HTTP Request)
    |
Controller          Receives request, validates DTO
    |
Inbound Port        Interface toward service
    |
Service             Composes business logic (pure TS, depends only on Ports)
    |
Outbound Port       Interface toward external world
    |
Provider            Actual DB/API call
```

### Response (return direction)

```
Provider            Raw data from DB/external service
    |
Domain Model        Pure TS entity (readonly immutable object)
    |
Service             Applies business logic, returns Domain Model
    |
Controller          Maps to response DTO
    |
Client (HTTP Response)
```

### Dependency Direction

```
Controller -> Inbound Port (interface) <- Service -> Outbound Port (interface) <- Provider
                                            |                                       |
                                       Domain Model  <-  <-  <-  <-  <-  <-  <-  <-
                                                   (all layers depend on this)
```

## Layer Details

### model — Entity, Value Object, Pure Functions

Framework imports strictly prohibited. The most stable layer in the project.

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
// Pure function. No external dependencies.
export function calculateTotal(items: ReadonlyArray<OrderItem>): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
```

### port — Port Interfaces

Inbound-port and outbound-port are co-located in one folder, distinguished by naming.

```typescript
// port/create-order.port.ts
// inbound-port: contract toward service logic (implemented by Service)
export interface CreateOrderPort {
  execute(input: CreateOrderInput): Promise<Order>;
}

// port/order-repository.port.ts
// outbound-port: contract toward external world (implemented by Provider)
export interface OrderRepositoryPort {
  save(order: Order): Promise<Order>;
  findById(id: string): Promise<Order | null>;
}

// port/port-tokens.ts
export const CREATE_ORDER_PORT = Symbol('CreateOrderPort');
export const ORDER_REPOSITORY_PORT = Symbol('OrderRepositoryPort');
```

### service — Inbound-Port Implementation

Composes Ports to orchestrate business flows.

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

Receives HTTP requests and delegates to services.

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

Implements Port interfaces to communicate with actual external services.

```typescript
// provider/order-repository.adapter.ts
@Injectable()
export class OrderRepositoryAdapter implements OrderRepositoryPort {
  constructor(private readonly dataSource: DataSource) {}

  async save(order: Order): Promise<Order> {
    // Actual DB implementation
  }

  async findById(id: string): Promise<Order | null> {
    // Actual DB implementation
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

NestJS module wires Ports to their implementations.

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
