# jkit-code-plugin

Claude Code plugin for Flutter / Next.js / NestJS — project init, code generation, build, TDD, and conventions.

## Quick Start

```bash
# Add marketplace
/plugin marketplace add https://github.com/JosephNK/jkit-code-plugin

# Install plugin
/plugin install jkit@jkit
```

After installation, use `/jkit:init` to initialize your project.

### Local Development (Plugin Testing)

플러그인 개발 시 로컬에서 직접 테스트하려면:

```bash
# 플러그인 디렉토리에서 직접 실행
claude --plugin-dir .

# 다른 경로에서 실행
claude --plugin-dir /path/to/jkit-code-plugin
```

### Team Setup

Add to your project's `.claude/settings.json` so teammates get the plugin automatically:

```json
{
  "extraKnownMarketplaces": {
    "jkit": {
      "source": {
        "source": "github",
        "repo": "JosephNK/jkit-code-plugin"
      }
    }
  }
}
```

## Supported Frameworks

| Framework | Init Command | Convention Stacks |
|-----------|-------------|-------------------|
| **Flutter** | `/jkit:flutter-init` | bloc, freezed, go-router, leaf-kit, easy-localization |
| **Next.js** | `/jkit:nextjs-init` | mantine, design-system, tanstack-query, next-proxy |
| **NestJS** | `/jkit:nestjs-init` | typeorm, gcp, anthropic-ai, custom-lint |

Init 커맨드 실행 시 AGENTS.md, GIT.md, ARCHITECTURE.md, CONVENTIONS.md 등 프로젝트 설정 파일을 자동 생성합니다.

## Commands

### Flutter — Init & Setup

| Command | Description |
|---------|-------------|
| `/jkit:flutter-init` | 프로젝트 초기화 (conventions, pre-commit, pyproject 등) |
| `/jkit:flutter-setup` | app.dart, main.dart, router, 다국어 리소스 생성 |
| `/jkit:flutter-android-setup` | build.gradle.kts, AndroidManifest, proguard 설정 |
| `/jkit:flutter-ios-setup` | pbxproj (4 flavor × 3 build type), xcscheme, Info.plist 설정 |

### Flutter — Development

| Command | Description |
|---------|-------------|
| `/jkit:flutter-plan` | 요구사항 분석 → 리스크 평가 → 구현 계획 생성 |
| `/jkit:flutter-tdd` | RED→GREEN→REFACTOR TDD 워크플로우 |
| `/jkit:flutter-screen` | Screen + BLoC + View + DI + Route 보일러플레이트 생성 |
| `/jkit:flutter-design` | 프로덕션급 UI 디자인 (LeafTheme + Atomic Design) |
| `/jkit:flutter-openapi-gen` | OpenAPI 3.x → BuiltValue 모델 + Dio 서비스 코드 생성 |
| `/jkit:flutter-create-package` | 모노레포 워크스페이스 패키지 생성 |

### Flutter — Quality

| Command | Description |
|---------|-------------|
| `/jkit:flutter-code-review` | 보안/품질/베스트프랙티스 코드 리뷰 |
| `/jkit:flutter-build-fix` | 빌드/분석 에러 점진적 수정 |
| `/jkit:flutter-test-coverage` | 커버리지 분석 + 누락 테스트 자동 생성 (80%+ 목표) |
| `/jkit:check-conventions` | CONVENTIONS.md 기반 변경 파일 규칙 검증 |

### Flutter — Build & Deploy

| Command | Description |
|---------|-------------|
| `/jkit:flutter-build-deploy` | APK / AppBundle / IPA 빌드 (flavor: production/staging/dev/qa) |
| `/jkit:flutter-android-keystore-info` | 키스토어 인증서 정보 조회 |
| `/jkit:flutter-android-signing-report` | 키스토어 alias별 서명 정보 |
| `/jkit:flutter-android-verify-apk` | APK 서명 검증 |

### Flutter — Maintenance

| Command | Description |
|---------|-------------|
| `/jkit:flutter-update-dependencies` | pub.dev 패키지 최신 버전 업데이트 |
| `/jkit:flutter-update-leaf-kit-ref` | flutter_leaf_kit git ref 일괄 업데이트 |
| `/jkit:flutter-update-precommit` | .pre-commit-config.yaml 재생성 |

### Cross-Framework

| Command | Description |
|---------|-------------|
| `/jkit:commit` | 변경 분석 → 한국어 커밋 메시지 자동 생성 (3개 후보) |
| `/jkit:typeorm-migration` | TypeORM 마이그레이션 SQL 생성 (dev/prod 분리) |

## Generator Scripts

Init 커맨드 외에 개별 스크립트로도 실행 가능합니다.

```bash
# Agents, Git, Architecture, Conventions
./scripts/gen-agents.sh <framework> -p /path/to/project -n "Project Name"
./scripts/gen-git.sh -p /path/to/project
./scripts/gen-architecture.sh <framework> -p /path/to/project
./scripts/gen-conventions.sh <framework> -p /path/to/project --with stack1,stack2

# TypeScript (Next.js / NestJS)
./scripts/typescript/gen-eslint.sh <framework> -p /path/to/project --with stack1,stack2
./scripts/typescript/gen-tsconfig.sh <framework> -p /path/to/project --with stack1
./scripts/typescript/gen-husky.sh -p /path/to/project

# Flutter
./scripts/flutter/gen-precommit.sh -p /path/to/project
./scripts/flutter/gen-pyproject.sh -p /path/to/project
./scripts/flutter/gen-scripts.sh -p /path/to/project
```

## Convention System

모듈러 컨벤션 조합 방식:

1. `rules/<framework>/base/conventions.md` — 프레임워크 공통 규칙
2. `rules/<framework>/<stack>/conventions.md` — 스택별 추가 규칙
3. `gen-conventions.sh`가 선택된 스택을 순서대로 concat → 최종 CONVENTIONS.md 생성

### 새 스택 추가

```
rules/<framework>/<stack-name>/
├── conventions.md          # 컨벤션 규칙
├── eslint.manifest         # ESLint 코드 조각 (TypeScript만)
├── eslint.rules.mjs        # ESLint rule export (TypeScript만)
└── tsconfig.patch.json     # TSConfig 패치 (필요 시)
```
