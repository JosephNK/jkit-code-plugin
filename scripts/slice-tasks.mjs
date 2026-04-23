#!/usr/bin/env node
// =============================================================================
// Slice a Markdown document with `### Task N` headers into per-task files.
//
// Full slices contain:
//   - Common header (everything before the first `### Task N`)
//   - The Task N section (until the next `### Task` or any `## ` heading)
//   - Common footer (any sections after the last Task — e.g. 회귀 매트릭스,
//     공통 검증 항목)
//
// Compact TASKS slices contain:
//   - Minimal common context
//   - The Task N section
//   - Only conventions / task-list rows / risks relevant to that Task where
//     they can be inferred from the source structure
//
// Slice metadata:
//   <!-- sliced from <input> @ sha <12-char SHA-1> at <ISO 8601 UTC> -->
//   <!-- task-id: Task N -->
//   <!-- slice-mode: compact -->  # compact mode only
//
// The harness uses the embedded SHA to detect stale slices and re-run this
// script when the source has changed.
// =============================================================================

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const HELP = `Usage: slice-tasks.mjs --mode full|compact <input-md> <output-dir>

Splits a Markdown document with \`### Task N\` headers into per-task slices.

Arguments:
  <input-md>     Source Markdown (e.g., code-harness/TASKS.md)
  <output-dir>   Output directory for slices (e.g., code-harness/tasks/)

Options:
  --mode full     Preserve the historical behavior: full header + task + footer
  --mode compact  Emit smaller execution-oriented slices

Examples:
  ./scripts/slice-tasks.mjs --mode compact code-harness/TASKS.md code-harness/tasks/
  ./scripts/slice-tasks.mjs --mode full    code-harness/QA.md    code-harness/qa/

Output filenames:
  Task IDs are sanitized: "Task 1" -> "Task-1.md"

Stale slices (Task IDs no longer present in <input-md>) are removed.
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const rest = argv.slice(2);
  let mode = '';

  if (rest[0] === '--mode') {
    if (rest.length !== 4) usage();
    mode = rest[1];
    rest.splice(0, 2);
  } else if (rest[0] === '--full') {
    mode = 'full';
    rest.shift();
  } else if (rest[0] === '--compact') {
    mode = 'compact';
    rest.shift();
  }

  if (rest.length !== 2) usage();
  const [input, outputDir] = rest;

  if (mode !== 'full' && mode !== 'compact') {
    process.stderr.write(`Error: invalid mode: ${mode}\n`);
    usage();
  }

  return { mode, input, outputDir };
}

function readLines(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function sha1Prefix(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12);
}

function utcNowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

const TASK_HEADER_RE = /^### Task [0-9]+/;
const H2_RE = /^## /;
const H1_RE = /^# /;
const TASK_ID_RE = /Task [0-9]+/;

function sliceBuffers(lines) {
  let state = 'header';
  let preambleBuf = '';
  let headerBuf = '';
  let footerBuf = '';
  let currentH2 = '';
  let currentH2Buf = '';
  const headerSections = {};
  const headerOrder = [];
  let footerH2 = '';
  let footerH2Buf = '';
  const footerSections = {};
  const footerOrder = [];
  let footerTaskNote = '';
  let footerTaskNoteBuf = '';
  const footerTaskNotes = {};
  let currentTask = '';
  let currentBuf = '';
  const tasks = {};
  const taskOrder = [];

  const storeHeaderSection = () => {
    if (currentH2 !== '') {
      headerSections[currentH2] = currentH2Buf;
      headerOrder.push(currentH2);
      currentH2 = '';
      currentH2Buf = '';
    }
  };
  const storeFooterTaskNote = () => {
    if (footerTaskNote !== '') {
      const m = footerTaskNote.match(TASK_ID_RE);
      if (m) {
        const tid = m[0];
        footerTaskNotes[tid] = (footerTaskNotes[tid] || '') + footerTaskNoteBuf;
      }
      footerTaskNote = '';
      footerTaskNoteBuf = '';
    }
  };
  const storeFooterSection = () => {
    storeFooterTaskNote();
    if (footerH2 !== '') {
      footerSections[footerH2] = footerH2Buf;
      footerOrder.push(footerH2);
      footerH2 = '';
      footerH2Buf = '';
    }
  };

  for (const line of lines) {
    // Rule 1: In footer, `### Task N` becomes a per-task note, not a new slice.
    if (state === 'footer' && TASK_HEADER_RE.test(line)) {
      footerBuf += line + '\n';
      if (footerH2 !== '') {
        footerH2Buf += line + '\n';
      }
      storeFooterTaskNote();
      footerTaskNote = line;
      footerTaskNoteBuf = line + '\n';
      continue;
    }

    // Rule 2: General Task header (header/task states only, since Rule 1
    // already consumed footer-state hits).
    if (TASK_HEADER_RE.test(line)) {
      if (state === 'header') {
        storeHeaderSection();
      }
      const m = line.match(TASK_ID_RE);
      const taskId = m[0];

      if (state === 'task' && currentTask !== '') {
        tasks[currentTask] = currentBuf;
        taskOrder.push(currentTask);
      }

      state = 'task';
      currentTask = taskId;
      currentBuf = line + '\n';
      continue;
    }

    // Rule 3: h2 while in task -> close task, open footer.
    if (state === 'task' && H2_RE.test(line)) {
      if (currentTask !== '') {
        tasks[currentTask] = currentBuf;
        taskOrder.push(currentTask);
        currentTask = '';
      }
      state = 'footer';
      footerH2 = line;
      footerBuf += line + '\n';
      footerH2Buf = line + '\n';
      continue;
    }

    // Rule 4: header fallback.
    if (state === 'header') {
      headerBuf += line + '\n';
      if (H2_RE.test(line)) {
        storeHeaderSection();
        currentH2 = line;
        currentH2Buf = line + '\n';
      } else if (currentH2 !== '') {
        currentH2Buf += line + '\n';
      } else {
        preambleBuf += line + '\n';
      }
      continue;
    }

    // Rule 5: task body.
    if (state === 'task') {
      currentBuf += line + '\n';
      continue;
    }

    // Rule 6: footer body.
    if (state === 'footer') {
      footerBuf += line + '\n';
      if (H2_RE.test(line)) {
        storeFooterSection();
        footerH2 = line;
        footerH2Buf = line + '\n';
      } else if (footerH2 !== '') {
        footerH2Buf += line + '\n';
      }
      if (footerTaskNote !== '') {
        footerTaskNoteBuf += line + '\n';
      }
      continue;
    }
  }

  if (state === 'header') {
    storeHeaderSection();
  } else if (state === 'footer') {
    storeFooterSection();
  }
  if (state === 'task' && currentTask !== '') {
    tasks[currentTask] = currentBuf;
    taskOrder.push(currentTask);
  }

  return {
    preambleBuf,
    headerBuf,
    footerBuf,
    headerSections,
    headerOrder,
    footerSections,
    footerOrder,
    footerTaskNotes,
    tasks,
    taskOrder,
  };
}

function sectionWithPrefix(sections, order, prefix) {
  for (const key of order) {
    if (key.startsWith(prefix)) return sections[key];
  }
  return '';
}

function h1FromPreamble(buf) {
  for (const line of buf.split('\n')) {
    if (H1_RE.test(line)) return line;
  }
  return '# Task Slice';
}

// Find all convention IDs (C1, C23, C5a, ...) in the text.
function extractConventionIds(text) {
  const ids = new Set();
  const order = [];
  for (const match of text.matchAll(/C[0-9]+[a-z]?/g)) {
    if (!ids.has(match[0])) {
      ids.add(match[0]);
      order.push(match[0]);
    }
  }
  return { ids, order };
}

function filteredConventions(section, taskText) {
  const { ids, order } = extractConventionIds(taskText);
  if (section === '' || order.length === 0) return '';

  const idPatterns = [];
  for (const id of ids) {
    idPatterns.push(new RegExp(`\\|\\s*${id}\\s*\\|`));
  }
  const hasAnyId = (line) => idPatterns.some((re) => re.test(line));

  let out = '## 적용 컨벤션 (This Task)\n\n';
  for (const line of section.split('\n')) {
    if (
      /^\| # \|/.test(line) ||
      /^\|---/.test(line) ||
      /^`docs\/CONVENTIONS\.md`/.test(line) ||
      line === ''
    ) {
      out += line + '\n';
    } else if (/^\|/.test(line) && hasAnyId(line)) {
      out += line + '\n';
    }
  }
  out += '\n';
  return out;
}

function taskTableRow(section, tid) {
  if (section === '') return '';
  const num = tid.replace(/^Task /, '');
  const pattern = new RegExp(`^\\|\\s*${num}\\s*\\|`);
  let out = '## 현재 Task 위치\n\n';
  for (const line of section.split('\n')) {
    if (/^\| # \|/.test(line) || /^\|---/.test(line)) {
      out += line + '\n';
    } else if (pattern.test(line)) {
      out += line + '\n';
    }
  }
  out += '\n';
  return out;
}

function relatedRisks(section, tid) {
  if (section === '') return '';
  let out = '## 관련 리스크\n\n';
  let added = false;
  for (const line of section.split('\n')) {
    if (/^\| # \|/.test(line) || /^\|---/.test(line)) {
      out += line + '\n';
    } else if (/^\|/.test(line) && line.includes(tid)) {
      out += line + '\n';
      added = true;
    }
  }
  if (!added) return '';
  return out + '\n';
}

function maybeSection(buffers, prefix) {
  const s = sectionWithPrefix(buffers.headerSections, buffers.headerOrder, prefix);
  if (s !== '') return s + '\n';
  return '';
}

function writeFull(outPath, tid, meta, buffers) {
  let out = '';
  out += `<!-- sliced from ${meta.input} @ sha ${meta.sha} at ${meta.ts} -->\n`;
  out += `<!-- task-id: ${tid} -->\n\n`;
  if (buffers.headerBuf !== '') {
    out += buffers.headerBuf + '\n';
  }
  out += buffers.tasks[tid];
  if (buffers.footerBuf !== '') {
    out += '\n' + buffers.footerBuf;
  }
  fs.writeFileSync(outPath, out);
}

function writeCompact(outPath, tid, meta, buffers) {
  const overview = maybeSection(buffers, '## 1.');
  const tech = maybeSection(buffers, '## 2.');
  const arch = maybeSection(buffers, '## 3.');
  const conv = filteredConventions(
    sectionWithPrefix(buffers.headerSections, buffers.headerOrder, '## 4.'),
    buffers.tasks[tid],
  );
  const taskList = taskTableRow(
    sectionWithPrefix(buffers.headerSections, buffers.headerOrder, '## 6.'),
    tid,
  );
  const risks = relatedRisks(
    sectionWithPrefix(buffers.footerSections, buffers.footerOrder, '## 9.'),
    tid,
  );
  const taskNote = buffers.footerTaskNotes[tid] || '';

  let out = '';
  out += `<!-- sliced from ${meta.input} @ sha ${meta.sha} at ${meta.ts} -->\n`;
  out += `<!-- task-id: ${tid} -->\n`;
  out += `<!-- slice-mode: compact -->\n\n`;
  out += `${h1FromPreamble(buffers.preambleBuf)}\n\n`;
  out += overview;
  out += tech;
  out += arch;
  out += conv;
  out += taskList;
  out += `## Task 상세\n\n`;
  out += buffers.tasks[tid];
  if (taskNote !== '') {
    out += `\n## Task별 추가 사항\n\n${taskNote}`;
  }
  if (risks !== '') {
    out += '\n' + risks;
  }
  fs.writeFileSync(outPath, out);
}

function main() {
  const args = parseArgs(process.argv);

  if (!fs.existsSync(args.input)) {
    process.stderr.write(`Error: input file not found: ${args.input}\n`);
    process.exit(1);
  }

  fs.mkdirSync(args.outputDir, { recursive: true });

  const meta = {
    input: args.input,
    sha: sha1Prefix(args.input),
    ts: utcNowIso(),
  };

  const lines = readLines(args.input);
  const buffers = sliceBuffers(lines);

  if (buffers.taskOrder.length === 0) {
    process.stderr.write(`ERROR: no \`### Task N\` headers found in ${args.input}\n`);
    process.exit(1);
  }

  const emittedBasenames = new Set();
  for (const tid of buffers.taskOrder) {
    const fname = tid.replaceAll(' ', '-');
    const outPath = path.join(args.outputDir, `${fname}.md`);
    if (args.mode === 'compact') {
      writeCompact(outPath, tid, meta, buffers);
    } else {
      writeFull(outPath, tid, meta, buffers);
    }
    emittedBasenames.add(`${fname}.md`);
  }

  process.stdout.write(`Slicing complete: ${args.input} -> ${args.outputDir}/\n`);
  process.stdout.write(`  Mode:          ${args.mode}\n`);

  let removed = 0;
  for (const entry of fs.readdirSync(args.outputDir)) {
    if (!/^Task-.*\.md$/.test(entry)) continue;
    if (!emittedBasenames.has(entry)) {
      fs.unlinkSync(path.join(args.outputDir, entry));
      process.stdout.write(`  - removed stale: ${entry}\n`);
      removed++;
    }
  }

  process.stdout.write(`  Total slices: ${emittedBasenames.size}\n`);
  if (removed > 0) {
    process.stdout.write(`  Removed stale: ${removed}\n`);
  }
  process.stdout.write(`  Source SHA:   ${meta.sha}\n`);
}

main();
