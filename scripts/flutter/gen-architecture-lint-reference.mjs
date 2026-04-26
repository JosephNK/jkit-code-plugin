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
//     ├── lints/*.dart              — 11개 룰 (E1~E7, N1~N3, S1)
//     ├── constants.dart            — 패키지 화이트/블랙리스트, maxFileLines
//     ├── boundary_element.dart     — projectBoundaryElements (lint 분류 + 트리)
//     ├── structure_annotation.dart — placeholder/하위 폴더 의도 (트리 보강)
//     └── layer_semantics.dart      — Role/Contains/Example (doc-only 정형)
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

// ─── boundary_element.dart / structure_annotation.dart 파싱 ────────────────
//
// NestJS의 baseBoundaryElements / baseStructureAnnotations와 동일 모델.
// Dart const 객체 리터럴을 텍스트(정규식 + 균형 괄호)로 파싱한다.

function findBalanced(text, startIdx, openCh, closeCh) {
  let depth = 1;
  let i = startIdx;
  while (i < text.length && depth > 0) {
    const ch = text[i];
    if (ch === "'" || ch === '"') {
      const quote = ch;
      i++;
      while (i < text.length && text[i] !== quote) {
        if (text[i] === '\\') i += 2;
        else i++;
      }
      i++;
      continue;
    }
    if (ch === openCh) depth++;
    else if (ch === closeCh) {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

function parseBoundaryElementArgs(body) {
  const out = { layer: '', patterns: [], note: null };
  const layerM = body.match(/layer\s*:\s*'((?:\\.|[^'\\])*)'/);
  if (layerM) out.layer = layerM[1];
  const patM = body.match(/patterns\s*:\s*\[([\s\S]*?)\]/);
  if (patM) out.patterns = collectStringLiterals(patM[1]);
  const noteM = body.match(/note\s*:\s*'((?:\\.|[^'\\])*)'/);
  if (noteM) out.note = noteM[1];
  return out;
}

function parseBoundaryElements(filePath) {
  const content = readSource(filePath);
  const startM = content.match(
    /const\s+projectBoundaryElements\s*=\s*<\s*BoundaryElement\s*>\s*\[/,
  );
  if (!startM) return [];
  const startIdx = startM.index + startM[0].length;
  const endIdx = findBalanced(content, startIdx, '[', ']');
  if (endIdx < 0) return [];
  const body = content.slice(startIdx, endIdx);
  const out = [];
  const re = /BoundaryElement\s*\(/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const argStart = m.index + m[0].length;
    const argEnd = findBalanced(body, argStart, '(', ')');
    if (argEnd < 0) break;
    out.push(parseBoundaryElementArgs(body.slice(argStart, argEnd)));
    re.lastIndex = argEnd + 1;
  }
  return out;
}

function parseAnnotationNodeArgs(body) {
  const out = {
    name: '',
    placeholder: false,
    inline: false,
    note: null,
    children: [],
  };

  // children 영역을 먼저 잘라낸 뒤, 본문 외부에서만 name/note/placeholder/inline을 매칭.
  // 그래야 nested AnnotationNode의 필드가 부모로 누출되지 않는다.
  let outer = body;
  const childM = body.match(/children\s*:\s*\[/);
  if (childM) {
    const start = childM.index + childM[0].length;
    const end = findBalanced(body, start, '[', ']');
    if (end > 0) {
      out.children = parseAnnotationNodeList(body.slice(start, end));
      outer = body.slice(0, childM.index) + body.slice(end + 1);
    }
  }

  const nameM = outer.match(/name\s*:\s*'((?:\\.|[^'\\])*)'/);
  if (nameM) out.name = nameM[1];
  if (/placeholder\s*:\s*true\b/.test(outer)) out.placeholder = true;
  if (/inline\s*:\s*true\b/.test(outer)) out.inline = true;
  const noteM = outer.match(/note\s*:\s*'((?:\\.|[^'\\])*)'/);
  if (noteM) out.note = noteM[1];

  return out;
}

function parseAnnotationNodeList(body) {
  const nodes = [];
  const re = /AnnotationNode\s*\(/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const argStart = m.index + m[0].length;
    const argEnd = findBalanced(body, argStart, '(', ')');
    if (argEnd < 0) break;
    nodes.push(parseAnnotationNodeArgs(body.slice(argStart, argEnd)));
    re.lastIndex = argEnd + 1;
  }
  return nodes;
}

function parseStructureRoot(filePath) {
  const content = readSource(filePath);
  const m = content.match(
    /const\s+projectStructureRoot\s*=\s*'((?:\\.|[^'\\])*)'\s*;/,
  );
  return m ? m[1] : '';
}

function parseStructureAnnotations(filePath) {
  const content = readSource(filePath);
  const startM = content.match(
    /const\s+projectStructureAnnotations\s*=\s*<\s*String\s*,\s*List<\s*AnnotationNode\s*>\s*>\s*\{/,
  );
  if (!startM) return {};
  const startIdx = startM.index + startM[0].length;
  const endIdx = findBalanced(content, startIdx, '{', '}');
  if (endIdx < 0) return {};
  const body = content.slice(startIdx, endIdx);

  const result = {};
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i])) i++;
    if (body[i] !== "'" && body[i] !== '"') {
      i++;
      continue;
    }
    const quote = body[i];
    let keyEnd = i + 1;
    while (keyEnd < body.length && body[keyEnd] !== quote) {
      if (body[keyEnd] === '\\') keyEnd += 2;
      else keyEnd++;
    }
    const key = body.slice(i + 1, keyEnd);
    i = keyEnd + 1;
    while (i < body.length && body[i] !== ':') i++;
    i++;
    while (i < body.length && /\s/.test(body[i])) i++;
    if (body[i] !== '[') continue;
    const listStart = i + 1;
    const listEnd = findBalanced(body, listStart, '[', ']');
    if (listEnd < 0) break;
    const listBody = body.slice(listStart, listEnd);
    result[key] = { override: parseAnnotationNodeList(listBody) };
    i = listEnd + 1;
    while (i < body.length && /[\s,]/.test(body[i])) i++;
  }
  return result;
}

// ─── 트리 빌더/렌더러 (typescript generator 포팅) ───────────────────────────

function buildPathTree(elements) {
  const root = { name: '', children: [] };
  for (const el of elements) {
    for (const p of el.patterns) {
      const segments = p.split('/').filter((s) => s.length > 0);
      let cur = root;
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        let child = cur.children.find((c) => c.name === seg);
        if (!child) {
          child = { name: seg, children: [] };
          cur.children.push(child);
        }
        if (i === segments.length - 1) child.element = el;
        cur = child;
      }
    }
  }
  return root;
}

function formatSegment(name) {
  if (name === '*' || name === '**') return name;
  if (name.startsWith('<')) return name + '/';
  if (/\.[a-z0-9]+$/i.test(name)) return name;
  return name + '/';
}

function findNodeByPath(root, pathStr) {
  const segs = pathStr.split('/').filter(Boolean);
  let cur = root;
  for (const s of segs) {
    let child = cur.children.find((c) => c.name === s);
    if (!child) {
      child = { name: s, children: [] };
      cur.children.push(child);
    }
    cur = child;
  }
  return cur;
}

function annotationToTreeNode(a, byName) {
  const node = { name: a.name, children: [] };
  if (a.note) node._note = a.note;
  if (a.placeholder) node._placeholder = true;
  if (a.inline) node._inline = true;
  const matched = byName.get(a.name);
  if (matched) node.element = matched;
  for (const c of a.children) {
    node.children.push(annotationToTreeNode(c, byName));
  }
  return node;
}

function mergeAnnotations(tree, annotations, boundaryElements) {
  if (!annotations) return;
  const byName = new Map();
  for (const el of boundaryElements) {
    for (const p of el.patterns) {
      const segs = p.split('/').filter(Boolean);
      const last = segs[segs.length - 1];
      if (!last) continue;
      if (!byName.has(last)) byName.set(last, el);
    }
  }
  for (const [parentPath, spec] of Object.entries(annotations)) {
    if (!spec || !Array.isArray(spec.override)) continue;
    const node = findNodeByPath(tree, parentPath);
    const overrideNames = new Set(spec.override.map((a) => a.name));
    node.children = node.children.filter(
      (c) => c.name !== '*' && c.name !== '**' && !overrideNames.has(c.name),
    );
    for (const a of spec.override) {
      node.children.push(annotationToTreeNode(a, byName));
    }
  }
}

function renderPathTree(root, rootLabel) {
  const rows = [];
  const walk = (node, prefix, isLast, isRoot) => {
    if (!isRoot) {
      const connector = isLast ? '└── ' : '├── ';
      let display = prefix + connector + formatSegment(node.name);
      let comment = node._note || null;

      // inline merge: 자식이 정확히 1개이고 _inline이면 부모 줄에 결합.
      // 결합된 자식의 note는 부모 note를 덮어쓰고, 자식의 children이 새 walk 대상이 된다.
      let cur = node;
      while (
        cur.children.length === 1 &&
        cur.children[0]._inline
      ) {
        const child = cur.children[0];
        display += formatSegment(child.name);
        if (child._note) comment = child._note;
        cur = child;
      }
      rows.push({ display, comment });

      const childPrefix = prefix + (isLast ? '    ' : '│   ');
      cur.children.forEach((c, i) => {
        walk(c, childPrefix, i === cur.children.length - 1, false);
      });
      return;
    }
    const childPrefix = '';
    node.children.forEach((c, i) => {
      walk(c, childPrefix, i === node.children.length - 1, false);
    });
  };
  walk(root, '', true, true);

  const maxDisplay = Math.max(0, ...rows.map((r) => r.display.length));
  const lines = ['```'];
  if (rootLabel) lines.push(rootLabel);
  for (const r of rows) {
    if (r.comment) {
      const pad = ' '.repeat(maxDisplay - r.display.length + 2);
      lines.push(`${r.display}${pad}# ${r.comment}`);
    } else {
      lines.push(r.display);
    }
  }
  lines.push('```');
  return lines.join('\n');
}

// ─── lint-rules-structure-reference.md ──────────────────────────────────────

function renderStructureReference({
  boundaryElements,
  structureAnnotations,
  structureRoot,
}) {
  const lines = [
    '<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->',
    '<!-- Generator: scripts/flutter/gen-architecture-lint-reference.mjs -->',
    `<!-- Source: ${SRC_REL} (boundary_element.dart, structure_annotation.dart) -->`,
    '',
    '# Lint Rules — Structure Reference (flutter/base)',
    '',
  ];

  lines.push('## 개요');
  lines.push('');
  lines.push(
    '아키텍처 boundary 정의 — 각 layer ↔ 경로 패턴 매핑. ' +
      '`boundary_element.dart`의 `projectBoundaryElements`가 lint 분류와 doc ' +
      '트리의 단일 source이며, `structure_annotation.dart`가 placeholder/' +
      '하위 폴더 의도를 트리에 보강한다.',
  );
  lines.push('');

  lines.push('## 프로젝트 구조');
  lines.push('');
  lines.push(
    '> 아래 트리는 **대표 구조 예시**입니다. lint는 glob(`**`, `*`) 기반으로 ' +
      '매칭하므로 `<feature>`, `<service>`, `<package>` 같은 placeholder ' +
      '세그먼트의 실제 이름은 프로젝트마다 다를 수 있습니다.',
  );
  lines.push('');

  const tree = buildPathTree(boundaryElements);
  mergeAnnotations(tree, structureAnnotations, boundaryElements);
  lines.push(renderPathTree(tree, structureRoot));
  lines.push('');

  lines.push('## 레이어별 경로 매핑');
  lines.push('');
  lines.push('| 레이어 | 경로 패턴 | 비고 |');
  lines.push('| --- | --- | --- |');
  for (const el of boundaryElements) {
    const patterns = el.patterns.map((p) => `\`${p}\``).join(' / ');
    const note = el.note ? escapePipe(el.note) : '—';
    lines.push(`| \`${el.layer}\` | ${patterns} | ${note} |`);
  }
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

function renderGlossary(rules, layerSemantics, boundaryElements) {
  const layerOrder = [];
  for (const el of boundaryElements) {
    if (!layerOrder.includes(el.layer)) layerOrder.push(el.layer);
  }

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

function renderReference({ rules, layerSemantics, boundaryElements, constants }) {
  const lines = genHeader(
    'Lint Rules Reference (flutter/base)',
    SOURCE_FILES_LABEL,
  );

  lines.push('## 레이어 글로서리 (Layer Glossary)');
  lines.push('');
  lines.push(
    '각 레이어의 책임·포함 파일·제약·대표 코드 형태. ' +
      '`boundary_element.dart`의 `projectBoundaryElements`로 분류된 파일별 ' +
      '룰 적용 범위를 `layer_semantics.dart`(Role/Contains/Example) + ' +
      '`lints/*.dart`(Constraints)로 채운다.',
  );
  lines.push('');
  lines.push(renderGlossary(rules, layerSemantics, boundaryElements));
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

  const constants = parseConstants(path.join(SRC_DIR, 'constants.dart'));
  const layerSemantics = parseLayerSemantics(
    path.join(SRC_DIR, 'layer_semantics.dart'),
  );
  const boundaryElements = parseBoundaryElements(
    path.join(SRC_DIR, 'boundary_element.dart'),
  );
  const structureAnnotations = parseStructureAnnotations(
    path.join(SRC_DIR, 'structure_annotation.dart'),
  );
  const structureRoot = parseStructureRoot(
    path.join(SRC_DIR, 'structure_annotation.dart'),
  );
  const rules = loadAllLints();

  const writes = [
    {
      path: path.join(OUT_DIR, 'lint-rules-structure-reference.md'),
      content:
        renderStructureReference({
          boundaryElements,
          structureAnnotations,
          structureRoot,
        }) + '\n',
    },
    {
      path: path.join(OUT_DIR, 'lint-rules-reference.md'),
      content:
        renderReference({ rules, layerSemantics, boundaryElements, constants }) +
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
