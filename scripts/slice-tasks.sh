#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Slice a Markdown document with `### Task N` headers into per-task files.
#
# Full slices contain:
#   - Common header (everything before the first `### Task N`)
#   - The Task N section (until the next `### Task` or any `## ` heading)
#   - Common footer (any sections after the last Task — e.g. 회귀 매트릭스,
#     공통 검증 항목)
#
# Compact TASKS slices contain:
#   - Minimal common context
#   - The Task N section
#   - Only conventions / task-list rows / risks relevant to that Task where
#     they can be inferred from the source structure
#
# Slice metadata:
#   <!-- sliced from <input> @ sha <12-char SHA-1> at <ISO 8601 UTC> -->
#   <!-- task-id: Task N -->
#   <!-- slice-mode: compact -->  # compact mode only
#
# The harness uses the embedded SHA to detect stale slices and re-run this
# script when the source has changed.
# ─────────────────────────────────────────────────────────────────────────────

usage() {
  cat <<'EOF'
Usage: slice-tasks.sh --mode full|compact <input-md> <output-dir>

Splits a Markdown document with `### Task N` headers into per-task slices.

Arguments:
  <input-md>     Source Markdown (e.g., code-harness/TASKS.md)
  <output-dir>   Output directory for slices (e.g., code-harness/tasks/)

Options:
  --mode full     Preserve the historical behavior: full header + task + footer
  --mode compact  Emit smaller execution-oriented slices

Examples:
  ./scripts/slice-tasks.sh --mode compact code-harness/TASKS.md code-harness/tasks/
  ./scripts/slice-tasks.sh --mode full    code-harness/QA.md    code-harness/qa/

Output filenames:
  Task IDs are sanitized: "Task 1" -> "Task-1.md"

Stale slices (Task IDs no longer present in <input-md>) are removed.
EOF
  exit 1
}

MODE=""
if [ "${1:-}" = "--mode" ]; then
  [ $# -eq 4 ] || usage
  MODE="$2"
  shift 2
elif [ "${1:-}" = "--full" ]; then
  MODE="full"
  shift
elif [ "${1:-}" = "--compact" ]; then
  MODE="compact"
  shift
fi

[ $# -eq 2 ] || usage
INPUT="$1"
OUTPUT_DIR="$2"

case "$MODE" in
full | compact) ;;
*)
  echo "Error: invalid mode: $MODE" >&2
  usage
  ;;
esac

if [ ! -f "$INPUT" ]; then
  echo "Error: input file not found: $INPUT" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

SHA=$(shasum -a 1 "$INPUT" | awk '{print $1}' | cut -c1-12)
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

TMP_LIST=$(mktemp)
trap 'rm -f "$TMP_LIST"' EXIT

awk \
  -v OUTPUT_DIR="$OUTPUT_DIR" \
  -v SHA="$SHA" \
  -v TS="$TS" \
  -v INPUT="$INPUT" \
  -v LIST="$TMP_LIST" \
  -v MODE="$MODE" \
  '
BEGIN {
  state = "header"
  preamble_buf = ""
  header_buf = ""
  footer_buf = ""
  current_h2 = ""
  current_h2_buf = ""
  h2_count = 0
  footer_h2 = ""
  footer_h2_buf = ""
  footer_h2_count = 0
  footer_task_note = ""
  footer_task_note_buf = ""
  current_task = ""
  current_buf = ""
  task_count = 0
}

function store_header_section() {
  if (current_h2 != "") {
    header_sections[current_h2] = current_h2_buf
    header_order[++h2_count] = current_h2
    current_h2 = ""
    current_h2_buf = ""
  }
}

function store_footer_section() {
  store_footer_task_note()
  if (footer_h2 != "") {
    footer_sections[footer_h2] = footer_h2_buf
    footer_order[++footer_h2_count] = footer_h2
    footer_h2 = ""
    footer_h2_buf = ""
  }
}

function store_footer_task_note(task_id) {
  if (footer_task_note != "") {
    match(footer_task_note, /Task [0-9]+/)
    task_id = substr(footer_task_note, RSTART, RLENGTH)
    footer_task_notes[task_id] = footer_task_notes[task_id] footer_task_note_buf
    footer_task_note = ""
    footer_task_note_buf = ""
  }
}

function section_with_prefix(sections, order, count, prefix, i, key) {
  for (i = 1; i <= count; i++) {
    key = order[i]
    if (index(key, prefix) == 1) {
      return sections[key]
    }
  }
  return ""
}

function h1_from_preamble(buf, n, lines, i) {
  n = split(buf, lines, "\n")
  for (i = 1; i <= n; i++) {
    if (lines[i] ~ /^# /) {
      return lines[i]
    }
  }
  return "# Task Slice"
}

function extract_convention_ids(text, ids, order, s, id, count) {
  delete ids
  delete order
  s = text
  count = 0
  while (match(s, /C[0-9]+[a-z]?/)) {
    id = substr(s, RSTART, RLENGTH)
    if (!(id in ids)) {
      ids[id] = 1
      order[++count] = id
    }
    s = substr(s, RSTART + RLENGTH)
  }
  return count
}

function has_any_id(line, ids, id, pattern) {
  for (id in ids) {
    pattern = "\\|[[:space:]]*" id "[[:space:]]*\\|"
    if (line ~ pattern) return 1
  }
  return 0
}

function filtered_conventions(section, task_text, ids, id_order, id_count, n, lines, i, line, out) {
  id_count = extract_convention_ids(task_text, ids, id_order)
  if (section == "" || id_count == 0) return ""

  out = "## 적용 컨벤션 (This Task)\n\n"
  n = split(section, lines, "\n")
  for (i = 1; i <= n; i++) {
    line = lines[i]
    if (line ~ /^\| # \|/ || line ~ /^\|---/ || line ~ /^`docs\/CONVENTIONS\.md`/ || line ~ /^$/) {
      out = out line "\n"
    } else if (line ~ /^\|/ && has_any_id(line, ids)) {
      out = out line "\n"
    }
  }
  out = out "\n"
  return out
}

function task_table_row(section, tid, n, lines, i, line, num, out, pattern) {
  if (section == "") return ""
  num = tid
  sub(/^Task /, "", num)
  pattern = "^\\|[[:space:]]*" num "[[:space:]]*\\|"
  out = "## 현재 Task 위치\n\n"
  n = split(section, lines, "\n")
  for (i = 1; i <= n; i++) {
    line = lines[i]
    if (line ~ /^\| # \|/ || line ~ /^\|---/) {
      out = out line "\n"
    } else if (line ~ pattern) {
      out = out line "\n"
    }
  }
  out = out "\n"
  return out
}

function related_risks(section, tid, task_text, n, lines, i, line, out, added) {
  if (section == "") return ""
  out = "## 관련 리스크\n\n"
  n = split(section, lines, "\n")
  for (i = 1; i <= n; i++) {
    line = lines[i]
    if (line ~ /^\| # \|/ || line ~ /^\|---/) {
      out = out line "\n"
    } else if (line ~ /^\|/ && (index(line, tid) > 0)) {
      out = out line "\n"
      added = 1
    }
  }
  if (!added) return ""
  return out "\n"
}

function maybe_section(prefix, s) {
  s = section_with_prefix(header_sections, header_order, h2_count, prefix)
  if (s != "") return s "\n"
  return ""
}

function write_full(out, tid) {
  printf "<!-- sliced from %s @ sha %s at %s -->\n", INPUT, SHA, TS > out
  printf "<!-- task-id: %s -->\n\n", tid > out
  if (header_buf != "") {
    printf "%s\n", header_buf > out
  }
  printf "%s", tasks[tid] > out
  if (footer_buf != "") {
    printf "\n%s", footer_buf > out
  }
}

function write_compact(out, tid, overview, tech, arch, conv, task_list, risks, task_note) {
  overview = maybe_section("## 1.")
  tech = maybe_section("## 2.")
  arch = maybe_section("## 3.")
  conv = filtered_conventions(section_with_prefix(header_sections, header_order, h2_count, "## 4."), tasks[tid])
  task_list = task_table_row(section_with_prefix(header_sections, header_order, h2_count, "## 6."), tid)
  risks = related_risks(section_with_prefix(footer_sections, footer_order, footer_h2_count, "## 9."), tid, tasks[tid])
  task_note = footer_task_notes[tid]

  printf "<!-- sliced from %s @ sha %s at %s -->\n", INPUT, SHA, TS > out
  printf "<!-- task-id: %s -->\n", tid > out
  printf "<!-- slice-mode: compact -->\n\n" > out
  printf "%s\n\n", h1_from_preamble(preamble_buf) > out
  printf "%s", overview > out
  printf "%s", tech > out
  printf "%s", arch > out
  printf "%s", conv > out
  printf "%s", task_list > out
  printf "## Task 상세\n\n" > out
  printf "%s", tasks[tid] > out
  if (task_note != "") {
    printf "\n## Task별 추가 사항\n\n%s", task_note > out
  }
  if (risks != "") {
    printf "\n%s", risks > out
  }
}

# A footer can contain ordinary h3 headings such as
# those headings as footer content instead of treating them as slice headers.
state == "footer" && /^### Task [0-9]+/ {
  footer_buf = footer_buf $0 "\n"
  if (footer_h2 != "") {
    footer_h2_buf = footer_h2_buf $0 "\n"
  }
  store_footer_task_note()
  footer_task_note = $0
  footer_task_note_buf = $0 "\n"
  next
}

# Task header: `### Task N` (with optional ":" or " - 제목" suffix)
/^### Task [0-9]+/ {
  if (state == "header") {
    store_header_section()
  }
  match($0, /Task [0-9]+/)
  task_id = substr($0, RSTART, RLENGTH)

  if (state == "task" && current_task != "") {
    tasks[current_task] = current_buf
    task_order[++task_count] = current_task
  }

  state = "task"
  current_task = task_id
  current_buf = $0 "\n"
  next
}

# Any h2 heading: ends task section, starts footer
state == "task" && /^## / {
  if (current_task != "") {
    tasks[current_task] = current_buf
    task_order[++task_count] = current_task
    current_task = ""
  }
  state = "footer"
  footer_h2 = $0
  footer_buf = footer_buf $0 "\n"
  footer_h2_buf = $0 "\n"
  next
}

state == "header" {
  header_buf = header_buf $0 "\n"
  if ($0 ~ /^## /) {
    store_header_section()
    current_h2 = $0
    current_h2_buf = $0 "\n"
  } else if (current_h2 != "") {
    current_h2_buf = current_h2_buf $0 "\n"
  } else {
    preamble_buf = preamble_buf $0 "\n"
  }
  next
}

state == "task" {
  current_buf = current_buf $0 "\n"
  next
}

state == "footer" {
  footer_buf = footer_buf $0 "\n"
  if ($0 ~ /^## /) {
    store_footer_section()
    footer_h2 = $0
    footer_h2_buf = $0 "\n"
  } else if (footer_h2 != "") {
    footer_h2_buf = footer_h2_buf $0 "\n"
  }
  if (footer_task_note != "") {
    footer_task_note_buf = footer_task_note_buf $0 "\n"
  }
  next
}

END {
  if (state == "header") {
    store_header_section()
  } else if (state == "footer") {
    store_footer_section()
  }

  if (state == "task" && current_task != "") {
    tasks[current_task] = current_buf
    task_order[++task_count] = current_task
  }

  if (task_count == 0) {
    print "ERROR: no `### Task N` headers found in " INPUT > "/dev/stderr"
    exit 1
  }

  for (i = 1; i <= task_count; i++) {
    tid = task_order[i]
    fname = tid
    gsub(/ /, "-", fname)
    out = OUTPUT_DIR "/" fname ".md"

    if (MODE == "compact") {
      write_compact(out, tid)
    } else {
      write_full(out, tid)
    }
    close(out)

    print fname ".md" >> LIST
  }
}
' "$INPUT"

echo "Slicing complete: $INPUT -> $OUTPUT_DIR/"
echo "  Mode:          $MODE"

# Remove stale slices (Task IDs that no longer exist in the source)
shopt -s nullglob
removed=0
for existing in "$OUTPUT_DIR"/Task-*.md; do
  basename=$(basename "$existing")
  if ! grep -qxF "$basename" "$TMP_LIST"; then
    rm "$existing"
    echo "  - removed stale: $basename"
    removed=$((removed + 1))
  fi
done

count=$(wc -l <"$TMP_LIST" | tr -d ' ')
echo "  Total slices: $count"
[ $removed -gt 0 ] && echo "  Removed stale: $removed"
echo "  Source SHA:   $SHA"
