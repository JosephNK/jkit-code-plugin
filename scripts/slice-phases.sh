#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Slice a Markdown document with `#### Phase N` headers into per-phase files.
#
# Assumes a PHASES.md produced by /jkit:code-phases with structure:
#   ## 1. 개요
#   ## 2. 기술 스택
#   ## 3. 아키텍처 요약
#   ## 4. 적용 컨벤션 요약
#   ## 5. Phase 목록
#   ## 6. Phase 상세
#     #### Phase 0
#     #### Phase 0.5   (decimal numbers supported for insertions)
#     ...
#   ## 7. 의존 관계 그래프
#   ## 8. 재정렬/수정 이력
#   ## 9. 리스크
#
# Full slices contain:
#   - Common header (everything before the first `#### Phase N`)
#   - The Phase N section (until the next `#### Phase` or any `## ` heading)
#   - Common footer (any sections after the last Phase)
#
# Compact slices contain:
#   - Minimal common context (sections 1~4)
#   - Current Phase row from section 5
#   - The Phase N section under `## Phase 상세`
#   - Related risks row from section 9 (if present)
#
# Slice metadata:
#   <!-- sliced from <input> @ sha <12-char SHA-1> at <ISO 8601 UTC> -->
#   <!-- phase-id: Phase N -->
#   <!-- slice-mode: compact -->  # compact mode only
#
# The harness uses the embedded SHA to detect stale slices.
# ─────────────────────────────────────────────────────────────────────────────

usage() {
  cat <<'EOF'
Usage: slice-phases.sh --mode full|compact <input-md> <output-dir>

Splits a Markdown document with `#### Phase N` headers into per-phase slices.

Arguments:
  <input-md>     Source Markdown (e.g., code-harness/PHASES.md)
  <output-dir>   Output directory for slices (e.g., code-harness/phases/)

Options:
  --mode full     Full header + phase + footer
  --mode compact  Execution-oriented compact slice

Examples:
  ./scripts/slice-phases.sh --mode compact code-harness/PHASES.md code-harness/phases/
  ./scripts/slice-phases.sh --mode full    code-harness/PHASES.md code-harness/phases/

Output filenames:
  Phase IDs sanitized: "Phase 1" -> "Phase-1.md", "Phase 0.5" -> "Phase-0.5.md"

Stale slices (Phase IDs no longer present in <input-md>) are removed.
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
  current_phase = ""
  current_buf = ""
  phase_count = 0
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
  if (footer_h2 != "") {
    footer_sections[footer_h2] = footer_h2_buf
    footer_order[++footer_h2_count] = footer_h2
    footer_h2 = ""
    footer_h2_buf = ""
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
  return "# Phase Slice"
}

function phase_table_row(section, pid, n, lines, i, line, out) {
  if (section == "") return ""
  out = "## 현재 Phase 위치\n\n"
  n = split(section, lines, "\n")
  for (i = 1; i <= n; i++) {
    line = lines[i]
    if (line ~ /^\| # \|/ || line ~ /^\|---/) {
      out = out line "\n"
    } else if (line ~ /^\|/ && (index(line, pid) > 0)) {
      out = out line "\n"
    }
  }
  out = out "\n"
  return out
}

function related_risks(section, pid, n, lines, i, line, out, added) {
  if (section == "") return ""
  out = "## 관련 리스크\n\n"
  n = split(section, lines, "\n")
  for (i = 1; i <= n; i++) {
    line = lines[i]
    if (line ~ /^\| ID \|/ || line ~ /^\| # \|/ || line ~ /^\|---/) {
      out = out line "\n"
    } else if (line ~ /^\|/ && (index(line, pid) > 0)) {
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

function write_full(out, pid) {
  printf "<!-- sliced from %s @ sha %s at %s -->\n", INPUT, SHA, TS > out
  printf "<!-- phase-id: %s -->\n\n", pid > out
  if (header_buf != "") {
    printf "%s\n", header_buf > out
  }
  printf "%s", phases[pid] > out
  if (footer_buf != "") {
    printf "\n%s", footer_buf > out
  }
}

function write_compact(out, pid, overview, tech, arch, conv, phase_list, risks) {
  overview = maybe_section("## 1.")
  tech = maybe_section("## 2.")
  arch = maybe_section("## 3.")
  conv = maybe_section("## 4.")
  phase_list = phase_table_row(section_with_prefix(header_sections, header_order, h2_count, "## 5."), pid)
  risks = related_risks(section_with_prefix(footer_sections, footer_order, footer_h2_count, "## 9."), pid)

  printf "<!-- sliced from %s @ sha %s at %s -->\n", INPUT, SHA, TS > out
  printf "<!-- phase-id: %s -->\n", pid > out
  printf "<!-- slice-mode: compact -->\n\n" > out
  printf "%s\n\n", h1_from_preamble(preamble_buf) > out
  printf "%s", overview > out
  printf "%s", tech > out
  printf "%s", arch > out
  printf "%s", conv > out
  printf "%s", phase_list > out
  printf "## Phase 상세\n\n" > out
  printf "%s", phases[pid] > out
  if (risks != "") {
    printf "\n%s", risks > out
  }
}

# Phase header: `#### Phase N` (integer or decimal)
/^#### Phase [0-9]+(\.[0-9]+)?/ {
  if (state == "header") {
    store_header_section()
  }
  match($0, /Phase [0-9]+(\.[0-9]+)?/)
  phase_id = substr($0, RSTART, RLENGTH)

  if (state == "phase" && current_phase != "") {
    phases[current_phase] = current_buf
    phase_order[++phase_count] = current_phase
  }

  state = "phase"
  current_phase = phase_id
  current_buf = $0 "\n"
  next
}

# Any h2 heading: ends phase section, starts footer
state == "phase" && /^## / {
  if (current_phase != "") {
    phases[current_phase] = current_buf
    phase_order[++phase_count] = current_phase
    current_phase = ""
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

state == "phase" {
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
  next
}

END {
  if (state == "header") {
    store_header_section()
  } else if (state == "footer") {
    store_footer_section()
  }

  if (state == "phase" && current_phase != "") {
    phases[current_phase] = current_buf
    phase_order[++phase_count] = current_phase
  }

  if (phase_count == 0) {
    print "ERROR: no `#### Phase N` headers found in " INPUT > "/dev/stderr"
    exit 1
  }

  for (i = 1; i <= phase_count; i++) {
    pid = phase_order[i]
    fname = pid
    gsub(/ /, "-", fname)
    out = OUTPUT_DIR "/" fname ".md"

    if (MODE == "compact") {
      write_compact(out, pid)
    } else {
      write_full(out, pid)
    }
    close(out)

    print fname ".md" >> LIST
  }
}
' "$INPUT"

echo "Slicing complete: $INPUT -> $OUTPUT_DIR/"
echo "  Mode:          $MODE"

# Remove stale slices (Phase IDs that no longer exist in the source)
shopt -s nullglob
removed=0
for existing in "$OUTPUT_DIR"/Phase-*.md; do
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
