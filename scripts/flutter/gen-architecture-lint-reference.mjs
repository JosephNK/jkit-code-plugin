#!/usr/bin/env node
// =============================================================================
// JKit Flutter Architecture Lint Reference Generator
// -----------------------------------------------------------------------------
// architecture_lint Dart 패키지를 파싱하여 Lint 규칙 참조 문서를 자동 생성한다.
// nestjs/nextjs의 gen-eslint-reference.mjs와 같은 컨셉이지만, source가 분산된
// Dart 파일들이라 텍스트(regex) 기반 파싱을 사용한다.
//
// 사용법:
//   node scripts/flutter/gen-architecture-lint-reference.mjs [options]
//
// 옵션:
//   --check     드리프트 검사: 기존 파일과 다르면 exit 1
//   -h, --help  도움말
//
// 입력 (Source):
//   rules/flutter/base/custom-lint/architecture_lint/lib/src/
//     ├── lints/*.dart           — 11개 룰 (E1~E7, N1~N3, S1)
//     ├── constants.dart         — 패키지 화이트/블랙리스트, maxFileLines
//     ├── classification.dart    — _layerMarkers (경로 → 레이어 매핑)
//     └── layer_semantics.dart   — Role/Contains/Example (doc-only 정형)
//
// 출력:
//   rules/flutter/base/
//     ├── lint-rules-structure-reference.md  — 경로 매핑 + 프로젝트 트리
//     ├── lint-rules-reference.md            — 글로서리 + 규칙 표 + 패키지 표
//     └── lint-rules-diagram.md              — Mermaid 의존성 그래프
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// ─── CLI ────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { check: false };
  for (const a of argv.slice(2)) {
    if (a === '-h' || a === '--help') {
      printHelp();
      process.exit(0);
    } else if (a === '--check') {
      args.check = true;
    } else {
      console.error(`알 수 없는 옵션: ${a}`);
      printHelp();
      process.exit(1);
    }
  }
  return args;
}

function printHelp() {
  console.log(`사용법: node scripts/flutter/gen-architecture-lint-reference.mjs [options]

옵션:
  --check     드리프트 검사 (다르면 exit 1)
  -h, --help  도움말
`);
}

// ─── 경로 ───────────────────────────────────────────────────────────────────

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const SRC_DIR = path.join(
  REPO_ROOT,
  'rules/flutter/base/custom-lint/architecture_lint/lib/src',
);
const OUT_DIR = path.join(REPO_ROOT, 'rules/flutter/base');
const SRC_REL = 'rules/flutter/base/custom-lint/architecture_lint/lib/src/';
const SOURCE_FILES_LABEL =
  'lints/*.dart, constants.dart, classification.dart, layer_semantics.dart';

// ─── Dart 텍스트 파싱 유틸 ──────────────────────────────────────────────────

function readSource(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * 클래스 직전의 `///` doc comment를 추출.
 */
function extractClassDoc(source, className) {
  const lines = source.split('\n');
  const idx = lines.findIndex((l) =>
    new RegExp(`^class\\s+${className}\\b`).test(l),
  );
  if (idx < 0) return '';
  const docLines = [];
  for (let i = idx - 1; i >= 0; i--) {
    const stripped = lines[i].trim();
    if (stripped.startsWith('///')) {
      docLines.unshift(stripped.replace(/^\/\/\/\s?/, ''));
    } else if (stripped === '' && docLines.length === 0) {
      continue; // 빈 줄 skip
    } else {
      break;
    }
  }
  return docLines.join('\n').trim();
}

function extractLintClassName(source) {
  const m = source.match(/^class\s+(\w+Lint)\s+extends\s+DartLint\b/m);
  return m ? m[1] : null;
}

/**
 * `String get <name> => '...';` 또는 멀티라인 리터럴 concat을 추출.
 */
function extractGetter(source, name) {
  const re = new RegExp(`get\\s+${name}\\s*=>\\s*([^;]+);`, 's');
  const m = source.match(re);
  if (!m) return null;
  const body = m[1].trim();
  const literals = collectStringLiterals(body);
  if (literals.length > 0) return literals.join('');
  return body;
}

function extractSeverity(source) {
  const raw = extractGetter(source, 'severity');
  if (!raw) return null;
  const m = raw.match(/AnalysisErrorSeverity\.(\w+)/);
  return m ? m[1].toLowerCase() : raw.toLowerCase();
}

/**
 * matchLint() 본문에서 타깃 레이어 추출.
 * 패턴:
 *   - `if (layer != 'X')` → { kind: 'layer', value: 'X' }
 *   - `if (!setName.contains(layer))` → { kind: 'layerSet', value: 'setName' }
 */
function extractTargetLayer(source) {
  let m = source.match(/if\s*\(\s*layer\s*!=\s*'([^']+)'\s*\)/);
  if (m) return { kind: 'layer', value: m[1] };
  m = source.match(/if\s*\(\s*!\s*(\w+)\s*\.contains\s*\(\s*layer\s*\)\s*\)/);
  if (m) return { kind: 'layerSet', value: m[1] };
  return null;
}

function extractAppliesTo(source) {
  const m = source.match(/if\s*\(\s*node\s+is!\s+(\w+)\s*\)/);
  return m ? m[1] : null;
}

function ruleSummary(doc) {
  if (!doc) return '';
  const firstPara = doc.split(/\n\s*\n/)[0] || '';
  const firstLine = firstPara.split('\n')[0].trim();
  return firstLine.replace(/^[EeNnSs]\d+:\s*/, '');
}

function collectStringLiterals(s) {
  const out = [];
  for (const m of s.matchAll(/'((?:\\.|[^'\\])*)'/g)) {
    out.push(m[1].replace(/\\'/g, "'"));
  }
  return out;
}

// ─── lints/*.dart 파싱 ──────────────────────────────────────────────────────

function parseLintFile(filePath) {
  const content = readSource(filePath);
  const className = extractLintClassName(content);
  if (!className) return null;
  return {
    file: path.basename(filePath),
    className,
    code: extractGetter(content, 'code'),
    message: extractGetter(content, 'message'),
    severity: extractSeverity(content),
    correction: extractGetter(content, 'correction'),
    doc: extractClassDoc(content, className),
    target: extractTargetLayer(content),
    appliesTo: extractAppliesTo(content),
  };
}

function loadAllLints() {
  const lintsDir = path.join(SRC_DIR, 'lints');
  const files = fs
    .readdirSync(lintsDir)
    .filter((f) => f.endsWith('.dart'))
    .sort();
  const rules = [];
  for (const f of files) {
    const r = parseLintFile(path.join(lintsDir, f));
    if (r) rules.push(r);
  }
  return rules;
}

// ─── constants.dart 파싱 ────────────────────────────────────────────────────

/**
 * `const NAME = <Set><String>{ ... };` 또는 `const NAME = 800;` 형태를 파싱.
 *
 * 반환: { raw: Map<name, {items, spreads}>, resolveSet, scalars, docs }
 */
function parseConstants(filePath) {
  const content = readSource(filePath);
  const sets = new Map();
  const scalars = new Map();

  const setRe =
    /const\s+(\w+)\s*=\s*<\s*[\w<>?, ]+\s*>\s*\{\s*([\s\S]*?)\s*\};/g;
  for (const m of content.matchAll(setRe)) {
    const name = m[1];
    const body = m[2];
    const items = [];
    const spreads = [];
    for (const rawLine of body.split('\n')) {
      const line = rawLine.replace(/\/\/.*$/, '').trim();
      if (!line) continue;
      const spreadMatches = line.match(/\.\.\.(\w+),?/g);
      if (spreadMatches) {
        for (const s of spreadMatches) {
          const spreadName = s.replace(/^\.\.\./, '').replace(/,$/, '').trim();
          spreads.push(spreadName);
        }
      }
      for (const lit of collectStringLiterals(line)) {
        items.push(lit);
      }
    }
    sets.set(name, { items, spreads });
  }

  for (const m of content.matchAll(/const\s+(\w+)\s*=\s*(\d+)\s*;/g)) {
    scalars.set(m[1], Number(m[2]));
  }

  function resolveSet(name, seen = new Set()) {
    if (seen.has(name)) return [];
    seen.add(name);
    const entry = sets.get(name);
    if (!entry) return [];
    const out = [...entry.items];
    for (const s of entry.spreads) {
      for (const item of resolveSet(s, seen)) {
        if (!out.includes(item)) out.push(item);
      }
    }
    return out;
  }

  // 각 식별자의 직전 `///` doc 추출
  const docs = new Map();
  const allLines = content.split('\n');
  for (const name of [...sets.keys(), ...scalars.keys()]) {
    const idx = allLines.findIndex((l) =>
      new RegExp(`^const\\s+${name}\\s*=`).test(l.trim()),
    );
    if (idx < 0) continue;
    const docLines = [];
    for (let i = idx - 1; i >= 0; i--) {
      const stripped = allLines[i].trim();
      if (stripped.startsWith('///')) {
        docLines.unshift(stripped.replace(/^\/\/\/\s?/, ''));
      } else if (stripped === '' && docLines.length === 0) {
        continue;
      } else {
        break;
      }
    }
    docs.set(name, docLines.join('\n').trim());
  }

  return { raw: sets, resolveSet, scalars, docs };
}

// ─── classification.dart 파싱 ───────────────────────────────────────────────

function parseLayerMarkers(filePath) {
  const content = readSource(filePath);
  const m = content.match(
    /const\s+_layerMarkers\s*=\s*<\s*String\s*,\s*String\s*>\s*\{([\s\S]*?)\};/,
  );
  if (!m) return [];
  const pairs = [];
  for (const pm of m[1].matchAll(/'([^']+)'\s*:\s*'([^']+)'/g)) {
    pairs.push({ dir: pm[1], layer: pm[2] });
  }
  return pairs;
}

// ─── layer_semantics.dart 파싱 ──────────────────────────────────────────────

function parseLayerSemantics(filePath) {
  const content = readSource(filePath);
  const startM = content.match(
    /const\s+layerSemantics\s*=\s*<\s*String\s*,\s*LayerSemantics\s*>\s*\{/,
  );
  if (!startM) return {};
  const startIdx = startM.index + startM[0].length;
  // 매칭되는 닫는 `};` 까지 슬라이스 (중첩 괄호 카운트)
  let depth = 1;
  let i = startIdx;
  while (i < content.length && depth > 0) {
    const ch = content[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (depth === 0) break;
    i++;
  }
  const body = content.slice(startIdx, i);

  const result = {};
  const entryRe =
    /'(\w+)'\s*:\s*LayerSemantics\s*\(([\s\S]*?)\)\s*,(?=\s*(?:'|\}))/g;
  for (const em of body.matchAll(entryRe)) {
    result[em[1]] = parseLayerSemanticsArgs(em[2]);
  }
  return result;
}

function parseLayerSemanticsArgs(body) {
  const out = { role: '', contains: [], example: '' };

  const roleM = body.match(/role\s*:\s*([\s\S]*?),\s*contains\s*:/);
  if (roleM) {
    out.role = collectStringLiterals(roleM[1]).join('');
  }

  const containsM = body.match(/contains\s*:\s*\[([\s\S]*?)\]\s*,/);
  if (containsM) {
    out.contains = collectStringLiterals(containsM[1]);
  }

  const tripleM = body.match(/example\s*:\s*'''([\s\S]*?)'''/);
  if (tripleM) {
    out.example = tripleM[1].replace(/^\n/, '');
  } else {
    const exM = body.match(/example\s*:\s*([\s\S]*?)\)\s*$/);
    if (exM) out.example = collectStringLiterals(exM[1]).join('');
  }

  return out;
}

// ─── 렌더링 유틸 ────────────────────────────────────────────────────────────

function genHeader(title, sourceLabel) {
  return [
    '<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->',
    '<!-- Generator: scripts/flutter/gen-architecture-lint-reference.mjs -->',
    `<!-- Source: ${SRC_REL} (${sourceLabel}) -->`,
    '',
    `# ${title}`,
    '',
  ];
}

function escapePipe(s) {
  return String(s).replace(/\|/g, '\\|');
}

function extractInlineCodeTokens(text) {
  const out = [];
  for (const m of text.matchAll(/`([^`]+)`/g)) out.push(m[1]);
  return out;
}

// ─── 프로젝트 트리 (project-structure.md 흡수 — 이후 단일 source) ───────────

const PROJECT_TREE = `\`\`\`
Root (Melos workspace)
├── app/
│   └── lib/
│       ├── common/                      # 모든 feature 공유
│       │   ├── env/                     # Env 설정 (envied)
│       │   ├── events/                  # 앱 전역 event bus
│       │   ├── exceptions/              # 공용 예외 정의
│       │   ├── extensions/              # Dart extensions
│       │   ├── services/                # 교차 feature 서비스
│       │   │   └── <service>/           # Port & Adapter 패턴
│       │   │       ├── *_port.dart
│       │   │       └── *_adapter.dart
│       │   ├── theme/                   # 디자인 시스템
│       │   └── widgets/                 # 공용 재사용 위젯
│       ├── di/
│       │   └── injection_container.dart # get_it 설정
│       ├── features/                    # Feature 모듈
│       │   └── <feature>/
│       │       ├── domain/
│       │       │   ├── entities/        # Immutable Value Objects
│       │       │   ├── exceptions/      # 도메인 예외
│       │       │   ├── ports/           # Abstract interfaces (*_port.dart)
│       │       │   └── usecases/        # 비즈니스 로직 (*_usecase.dart)
│       │       ├── infrastructure/
│       │       │   └── adapters/        # Port 구현체 (*_adapter.dart)
│       │       └── presentation/
│       │           ├── bloc/            # 상태 관리 (선택)
│       │           ├── pages/           # Screen entry points
│       │           ├── views/           # 논리적 뷰 섹션
│       │           └── widgets/         # Feature 전용 위젯
│       ├── router/
│       │   └── router.dart              # GoRouter 설정
│       ├── app.dart                     # 앱 root 위젯
│       └── main.dart                    # 진입점
└── packages/
    └── <package>/                       # 공용 / 자동 생성 패키지
        └── src/
            ├── api/<api_name>/          # OpenAPI 자동 생성 클라이언트
            │   ├── models/
            │   ├── services/
            │   └── endpoints.dart
            └── database/                # 로컬 DB 테이블/DAO/마이그레이션
                ├── tables/
                └── daos/
\`\`\``;

// ─── lint-rules-structure-reference.md ──────────────────────────────────────

function renderStructureReference({ layerMarkers }) {
  const lines = genHeader(
    'Lint Rules — Structure Reference (flutter/base)',
    'classification.dart',
  );

  lines.push('## 개요');
  lines.push('');
  lines.push(
    '아키텍처 레이어 ↔ 폴더 매핑. `classification.dart`의 `_layerMarkers`가 ' +
      '런타임에 파일 경로를 레이어로 분류하며, 모든 E/N/S 룰이 이 분류를 통해 ' +
      '대상 파일을 필터링한다.',
  );
  lines.push('');

  lines.push('## 프로젝트 구조');
  lines.push('');
  lines.push(
    '> 아래 트리는 **대표 구조 예시**입니다. lint는 디렉토리 이름 매칭(`/<dir>/`)으로 ' +
      '레이어를 판정하므로 `<feature>`, `<service>` 같은 가변 세그먼트의 실제 이름은 ' +
      '프로젝트마다 다를 수 있습니다.',
  );
  lines.push('');
  lines.push(PROJECT_TREE);
  lines.push('');

  lines.push('## 레이어별 경로 매핑');
  lines.push('');
  lines.push('| 디렉토리 | 레이어 | 비고 |');
  lines.push('| --- | --- | --- |');
  const byLayer = new Map();
  for (const { dir, layer } of layerMarkers) {
    if (!byLayer.has(layer)) byLayer.set(layer, []);
    byLayer.get(layer).push(dir);
  }
  for (const [layer, dirs] of byLayer) {
    const dirsStr = dirs.map((d) => `\`${d}\``).join(' / ');
    const note = dirs.length > 1 ? '여러 디렉토리가 같은 레이어로 집계' : '—';
    lines.push(`| ${dirsStr} | \`${layer}\` | ${note} |`);
  }
  lines.push(
    '| `common/services/<service>/` | `common_services` | classification.dart 의 fallback 분기 |',
  );
  lines.push('');

  return lines.join('\n');
}

// ─── lint-rules-reference.md ─────────────────────────────────────────────────

function ruleAffectedLayer(rule) {
  if (!rule.target) {
    if (rule.appliesTo === 'CatchClause') return '(all)';
    if (rule.appliesTo === 'CompilationUnit') return '(all)';
    if (rule.appliesTo === 'ImportDirective') return '(all features)';
    return '(all)';
  }
  return `\`${rule.target.value}\``;
}

function extractRuleRefs(rule, knownIds) {
  const tokens = new Set();
  for (const t of extractInlineCodeTokens(rule.doc || '')) {
    if (knownIds.has(t)) tokens.add(t);
  }
  if (rule.target?.kind === 'layerSet' && knownIds.has(rule.target.value)) {
    tokens.add(rule.target.value);
  }
  return [...tokens];
}

function renderRulesTable(rules, constants) {
  const knownIds = new Set([
    ...constants.raw.keys(),
    ...constants.scalars.keys(),
  ]);
  const lines = [];
  lines.push('| ID | Severity | Layer | 설명 | 참조 |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const r of rules) {
    const id = r.code ? r.code.split('_')[0].toUpperCase() : '?';
    const sev = r.severity || '—';
    const layer = ruleAffectedLayer(r);
    const summary = ruleSummary(r.doc);
    const refs =
      extractRuleRefs(r, knownIds)
        .map((t) => `\`${t}\``)
        .join(', ') || '—';
    lines.push(
      `| ${id} | ${sev} | ${layer} | ${escapePipe(summary)} | ${refs} |`,
    );
  }
  return lines.join('\n');
}

function renderGlossary(rules, layerSemantics, layerMarkers) {
  const layerOrder = [];
  for (const { layer } of layerMarkers) {
    if (!layerOrder.includes(layer)) layerOrder.push(layer);
  }
  if (!layerOrder.includes('common_services')) layerOrder.push('common_services');

  const blocks = [];
  for (const layer of layerOrder) {
    const sem = layerSemantics[layer];
    if (!sem) continue;
    const targeted = rules.filter(
      (r) => r.target?.kind === 'layer' && r.target.value === layer,
    );
    const lines = [];
    lines.push(`### \`${layer}\``);
    lines.push('');
    lines.push(`**Role** — ${sem.role}`);
    lines.push('');
    if (sem.contains.length) {
      lines.push('**Contains**');
      lines.push('');
      for (const c of sem.contains) lines.push(`- ${c}`);
      lines.push('');
    }
    if (targeted.length) {
      lines.push('**Constraints**');
      lines.push('');
      for (const r of targeted) {
        const id = r.code.split('_')[0].toUpperCase();
        const sev = r.severity || '—';
        lines.push(`- \`${id}\` (${sev}) — ${ruleSummary(r.doc)}`);
      }
      lines.push('');
    }
    if (sem.example) {
      lines.push('```dart');
      lines.push(sem.example.trim());
      lines.push('```');
      lines.push('');
    }
    blocks.push(lines.join('\n').replace(/\n+$/, ''));
  }
  return blocks.join('\n\n');
}

function renderPackageSection(name, members, doc) {
  const lines = [];
  lines.push(`### \`${name}\``);
  lines.push('');
  if (doc) {
    lines.push(doc);
    lines.push('');
  }
  if (members.length === 0) {
    lines.push('_(empty)_');
  } else {
    for (const m of members) lines.push(`- \`${m}\``);
  }
  return lines.join('\n');
}

function renderReference({ rules, layerSemantics, layerMarkers, constants }) {
  const lines = genHeader(
    'Lint Rules Reference (flutter/base)',
    SOURCE_FILES_LABEL,
  );

  lines.push('## 레이어 글로서리 (Layer Glossary)');
  lines.push('');
  lines.push(
    '각 레이어의 책임·포함 파일·제약·대표 코드 형태. ' +
      '`classification.dart`의 `_layerMarkers`로 분류된 파일별 룰 적용 범위를 ' +
      '`layer_semantics.dart`(Role/Contains/Example) + `lints/*.dart`(Constraints)로 채운다.',
  );
  lines.push('');
  lines.push(renderGlossary(rules, layerSemantics, layerMarkers));
  lines.push('');

  lines.push('## 규칙 (Rules)');
  lines.push('');
  lines.push(
    'architecture_lint 패키지가 활성화하는 11개 룰. 시각화된 의존 다이어그램은 ' +
      '`lint-rules-diagram.md` 참조.',
  );
  lines.push('');
  lines.push(renderRulesTable(rules, constants));
  lines.push('');

  const pkgGroups = [
    { name: 'codegenPackages', label: 'Codegen Annotation 패키지 (entities/ 허용)' },
    { name: 'blocAllowedPackages', label: 'Bloc 레이어 허용 외부 패키지' },
    { name: 'infraPackages', label: '인프라 패키지 (도메인 레이어 금지)' },
    { name: 'frameworkPackages', label: 'Framework 패키지 (ports/ 금지)' },
  ];
  lines.push('## 패키지 화이트/블랙리스트');
  lines.push('');
  for (const { name, label } of pkgGroups) {
    if (!constants.raw.has(name)) continue;
    const members = constants.resolveSet(name);
    const doc = constants.docs.get(name) || label;
    lines.push(renderPackageSection(name, members, doc));
    lines.push('');
  }

  lines.push('## 레이어 집합 상수');
  lines.push('');
  for (const name of ['domainLayers', 'crossFeatureForbidden']) {
    if (!constants.raw.has(name)) continue;
    const members = constants.resolveSet(name);
    const doc = constants.docs.get(name) || '';
    lines.push(renderPackageSection(name, members, doc));
    lines.push('');
  }

  if (constants.scalars.size) {
    lines.push('## 스칼라 상수');
    lines.push('');
    lines.push('| 이름 | 값 | 설명 |');
    lines.push('| --- | --- | --- |');
    for (const [name, value] of constants.scalars) {
      const doc = constants.docs.get(name) || '—';
      lines.push(`| \`${name}\` | \`${value}\` | ${escapePipe(doc.split('\n')[0])} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ─── lint-rules-diagram.md ───────────────────────────────────────────────────

/**
 * 룰 message에서 "Only A, B, C are allowed" 패턴을 분석하여
 * 레이어 → 레이어 의존 그래프 도출 (E2/E3 같은 단일-레이어 타깃 룰만).
 */
function deriveLayerEdges(rules) {
  const edges = [];
  for (const r of rules) {
    const target = r.target;
    if (!target || target.kind !== 'layer') continue;
    const from = target.value;
    const msg = r.message || '';
    const onlyM = msg.match(/[Oo]nly\s+([^.]+?)\s+(?:are|is)\s+allowed/);
    if (!onlyM) continue;
    const tokens = onlyM[1].match(/(\w+)\//g);
    if (!tokens) continue;
    for (const t of tokens) {
      const to = t.replace(/\/$/, '');
      if (to !== from) edges.push({ from, to });
    }
  }
  return edges;
}

function renderDiagram({ rules }) {
  const lines = genHeader(
    'Lint Rules — Dependency Diagram (flutter/base)',
    'lints/*.dart (E2/E3 derived)',
  );
  lines.push(
    '> 레이어 간 import 의존성 시각화 (E2/E3 룰의 "Only ... allowed" 메시지에서 도출).',
  );
  lines.push('> 텍스트 조회 / 레이어 글로서리: `lint-rules-reference.md` 참조.');
  lines.push('');

  const edges = deriveLayerEdges(rules);
  const nodes = new Set();
  for (const { from, to } of edges) {
    nodes.add(from);
    nodes.add(to);
  }
  for (const r of rules) {
    if (r.target?.kind === 'layer') nodes.add(r.target.value);
  }

  const sanitize = (s) => s.replace(/-/g, '_');
  lines.push('```mermaid');
  lines.push('graph LR');
  for (const n of nodes) lines.push(`  ${sanitize(n)}["${n}/"]`);
  for (const { from, to } of edges) {
    lines.push(`  ${sanitize(from)} --> ${sanitize(to)}`);
  }
  lines.push('```');
  lines.push('');
  return lines.join('\n');
}

// ─── 메인 ────────────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv);

  const layerMarkers = parseLayerMarkers(path.join(SRC_DIR, 'classification.dart'));
  const constants = parseConstants(path.join(SRC_DIR, 'constants.dart'));
  const layerSemantics = parseLayerSemantics(
    path.join(SRC_DIR, 'layer_semantics.dart'),
  );
  const rules = loadAllLints();

  const writes = [
    {
      path: path.join(OUT_DIR, 'lint-rules-structure-reference.md'),
      content: renderStructureReference({ layerMarkers }) + '\n',
    },
    {
      path: path.join(OUT_DIR, 'lint-rules-reference.md'),
      content:
        renderReference({ rules, layerSemantics, layerMarkers, constants }) +
        '\n',
    },
    {
      path: path.join(OUT_DIR, 'lint-rules-diagram.md'),
      content: renderDiagram({ rules }) + '\n',
    },
  ];

  if (args.check) {
    let drift = false;
    for (const w of writes) {
      const cur = fs.existsSync(w.path) ? fs.readFileSync(w.path, 'utf8') : '';
      if (cur !== w.content) {
        console.error(`[DRIFT] ${path.relative(REPO_ROOT, w.path)}`);
        drift = true;
      }
    }
    if (drift) {
      console.error(
        '\n생성물이 커밋된 파일과 다릅니다. ' +
          '`node scripts/flutter/gen-architecture-lint-reference.mjs` 를 실행하고 결과를 커밋하세요.',
      );
      process.exit(1);
    }
    console.log('드리프트 없음.');
    return;
  }

  for (const w of writes) {
    fs.writeFileSync(w.path, w.content);
    console.log(`생성: ${path.relative(REPO_ROOT, w.path)}`);
  }
}

main();
