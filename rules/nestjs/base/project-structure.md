# Project Structure

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
├── infrastructure/        # Infrastructure modules (DI-compatible)
│   ├── database/          # Database configuration
│   ├── email/             # Email delivery
│   ├── i18n/              # Internationalization
│   ├── logger/            # Logging
│   └── transaction/       # Transaction management
│
└── libs/                  # Standalone library-like modules (self-contained, high autonomy)
```

File naming (`*.port.ts`, `*.service.ts`, `*.adapter.ts`) distinguishes roles.
