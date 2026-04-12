# Architecture

Hexagonal Architecture (Ports and Adapters) + Next.js App Router colocated components.
Domain logic is pure TypeScript with no framework dependencies.
Pages are Server Components (data loading, i18n). Client Components are colocated in `_components/` directories.

## Components

```
[page]             app/[locale]/        Server Component (data fetching, i18n)
    |
[_components]      _components/         Client Component ('use client', event handling)
    |
[hook]             lib/api/hooks/       TanStack Query (useQuery/useMutation)
    |
[service]          lib/domain/services/ Business logic (pure TS, depends only on Ports)
    |
[port]             lib/domain/ports/    Interface (Repository contracts)
    |
[repository]       lib/api/repositories/ Port implementation (API calls via client)
    |
Backend API
```

## Data Flow

### Request (call direction)

```
_components/*       Event triggered (button click, etc.)
    |
Hook                TanStack Query (useQuery/useMutation)
    |
Service             Composes business logic (pure TS, depends only on Ports)
    |
Port                Calls Repository through interface
    |
Repository Impl     Calls API via client
    |
Backend API
```

### Response (return direction)

```
Backend API
    |  HTTP Response (JSON)
API DTO             Raw backend response shape
    |
Repository Impl     Applies Mapper internally
    |  Mapper       DTO to Domain conversion
    |
Domain Model        Pure TS entity (readonly immutable object)
    |
Service             Applies business logic, returns Domain Model
    |
Hook                Stores in cache + updates state
    |
_components/*       Handles loading/error branching (Client Component)
    |
Page                Passes data to layout (Server Component)
    |
RENDERED UI
```

### Dependency Direction

```
Page (SC) -> _components/ (CC) -> Hook -> Service -> Port (interface) <- Repository Impl -> Client + Mapper
                  |                                                       |
             Domain Model  <-  <-  <-  <-  <-  <-  <-  <-  <-  <-  <-  <-
                         (all layers depend on this)
```

## Layer Details

### model — Domain Models

Pure TypeScript. No React/Next.js imports.

```typescript
// lib/domain/models/order.model.ts
export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export interface Order {
  readonly id: string;
  readonly items: ReadonlyArray<OrderItem>;
  readonly status: OrderStatus;
  readonly totalAmount: number;
}
```

### port — Port Interfaces

```typescript
// lib/domain/ports/order-repository.port.ts
export interface OrderRepositoryPort {
  findById(id: string): Promise<Order | null>;
  findAll(): Promise<Order[]>;
}
```

### service — Business Logic

Depends only on Ports. No framework imports.

```typescript
// lib/domain/services/order.service.ts
export class OrderService {
  constructor(private readonly orderRepository: OrderRepositoryPort) {}

  async getOrder(id: string): Promise<Order> {
    const order = await this.orderRepository.findById(id);
    if (!order) throw new OrderNotFoundError(id);
    return order;
  }
}
```

### repository — Port Implementation

```typescript
// lib/api/repositories/order.repository.ts
export class OrderRepository implements OrderRepositoryPort {
  async findById(id: string): Promise<Order | null> {
    const dto = await apiClient.get<OrderDto>(`${ENDPOINTS.ORDERS}/${id}`);
    return dto ? OrderMapper.toDomain(dto) : null;
  }
}
```

### mapper — DTO to Domain Conversion

```typescript
// lib/api/mappers/order.mapper.ts
export class OrderMapper {
  static toDomain(dto: OrderDto): Order {
    return {
      id: dto.id,
      items: dto.items.map(ItemMapper.toDomain),
      status: dto.status,
      totalAmount: dto.total_amount,
    };
  }
}
```

### hook — TanStack Query

```typescript
// lib/api/hooks/use-order.ts
export function useOrder(id: string) {
  const service = useOrderService();
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => service.getOrder(id),
  });
}
```
