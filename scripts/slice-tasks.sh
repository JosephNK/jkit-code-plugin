#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Slice a Markdown document with `### Task N` headers into per-task files.
#
# Each slice contains:
#   - Common header (everything before the first `### Task N`)
#   - The Task N section (until the next `### Task` or any `## ` heading)
#   - Common footer (any sections after the last Task — e.g. 회귀 매트릭스,
#     공통 검증 항목)
#
# Slice header (first 2 lines of every output file):
#   <!-- sliced from <input> @ sha <12-char SHA-1> at <ISO 8601 UTC> -->
#   <!-- task-id: Task N -->
#
# The harness uses the embedded SHA to detect stale slices and re-run this
# script when the source has changed.
# ─────────────────────────────────────────────────────────────────────────────

usage() {
  cat <<'EOF'
Usage: slice-tasks.sh <input-md> <output-dir>

Splits a Markdown document with `### Task N` headers into per-task slices.

Arguments:
  <input-md>     Source Markdown (e.g., code-harness/TASKS.md)
  <output-dir>   Output directory for slices (e.g., code-harness/tasks/)

Examples:
  ./scripts/slice-tasks.sh code-harness/TASKS.md code-harness/tasks/
  ./scripts/slice-tasks.sh code-harness/QA.md    code-harness/qa/

Output filenames:
  Task IDs are sanitized: "Task 1" -> "Task-1.md"

Stale slices (Task IDs no longer present in <input-md>) are removed.
EOF
  exit 1
}

[ $# -eq 2 ] || usage
INPUT="$1"
OUTPUT_DIR="$2"

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
'
BEGIN {
  state = "header"
  header_buf = ""
  footer_buf = ""
  current_task = ""
  current_buf = ""
  task_count = 0
}

# Task header: `### Task N` (with optional ":" or " - 제목" suffix)
/^### Task [0-9]+/ {
  match($0, /Task [0-9]+/)
  task_id = substr($0, RSTART, RLENGTH)

  if (state == "task" && current_task != "") {
    tasks[current_task] = current_buf
    task_order[++task_count] = current_task
  } else if (state == "footer") {
    print "ERROR: `### Task` header found after a `## ` heading at line " NR ": " $0 > "/dev/stderr"
    exit 1
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
  footer_buf = footer_buf $0 "\n"
  next
}

state == "header" {
  header_buf = header_buf $0 "\n"
  next
}

state == "task" {
  current_buf = current_buf $0 "\n"
  next
}

state == "footer" {
  footer_buf = footer_buf $0 "\n"
  next
}

END {
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

    printf "<!-- sliced from %s @ sha %s at %s -->\n", INPUT, SHA, TS > out
    printf "<!-- task-id: %s -->\n\n", tid > out
    if (header_buf != "") {
      printf "%s\n", header_buf > out
    }
    printf "%s", tasks[tid] > out
    if (footer_buf != "") {
      printf "\n%s", footer_buf > out
    }
    close(out)

    print fname ".md" >> LIST
  }
}
' "$INPUT"

echo "Slicing complete: $INPUT -> $OUTPUT_DIR/"

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

count=$(wc -l < "$TMP_LIST" | tr -d ' ')
echo "  Total slices: $count"
[ $removed -gt 0 ] && echo "  Removed stale: $removed"
echo "  Source SHA:   $SHA"
