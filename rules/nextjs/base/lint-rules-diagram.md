<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/typescript/gen-eslint-reference.mjs -->
<!-- Source: rules/nextjs/base/eslint.rules.mjs (baseBoundaryRules) -->

# Lint Rules — Dependency Diagram (nextjs/base)

> 레이어 간 의존성 시각화 (`baseBoundaryRules` allow-list 기반).
> 텍스트 조회 / Allow 매트릭스 / 레이어별 상세: `lint-rules-reference.md` 참조.

```mermaid
graph LR
  subgraph g_domain [domain]
    domain_model["domain-model"]
    domain_error["domain-error"]
    domain_port["domain-port"]
    domain_service["domain-service"]
  end
  subgraph g_api [api]
    api_client["api-client"]
    api_endpoint["api-endpoint"]
    api_dto["api-dto"]
    api_mapper["api-mapper"]
    api_repository["api-repository"]
    api_hook["api-hook"]
  end
  subgraph g_shared [shared]
    shared_ui["shared-ui"]
    shared_type["shared-type"]
  end
  subgraph g_page [page]
    page_component["page-component"]
    page_provider["page-provider"]
    page["page"]
  end
  db["db"]
  lib_shared["lib-shared"]
  dictionary["dictionary"]
  email_template["email-template"]
  route_handler["route-handler"]
  domain_port --> domain_model
  domain_service --> domain_model
  domain_service --> domain_port
  domain_service --> domain_error
  api_mapper --> domain_model
  api_mapper --> api_dto
  api_repository --> api_client
  api_repository --> api_endpoint
  api_repository --> api_mapper
  api_repository --> domain_port
  api_repository --> domain_error
  api_repository --> domain_model
  api_repository --> db
  api_hook --> domain_service
  shared_ui --> domain_model
  shared_ui --> shared_type
  page_component --> api_hook
  page_component --> shared_ui
  page_component --> domain_model
  page_component --> lib_shared
  page_component --> shared_type
  page_provider --> lib_shared
  dictionary --> shared_type
  shared_type --> dictionary
  email_template --> dictionary
  email_template --> shared_type
  route_handler --> domain_model
  route_handler --> domain_error
  route_handler --> domain_service
  route_handler --> shared_type
  page --> page_component
  page --> page_provider
  page --> shared_ui
  page --> dictionary
  page --> shared_type
```
