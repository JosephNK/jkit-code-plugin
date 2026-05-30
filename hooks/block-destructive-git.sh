#!/bin/bash
# Destructive git 명령어 차단 훅
# PreToolUse(Bash) 이벤트에서 실행됨
#
# 차단 대상: Claude가 직접 실행하면 안 되는 git 명령어. 사용자가 의도적으로
# 직접 터미널에 입력해야 하는 명령들. exit 2로 차단하면 Claude는 차단 사유를
# 받아 다른 방법을 모색하거나 사용자에게 확인을 요청한다.
#
# 차단 사유 카테고리:
#   - 작업 손실 위험 (reset --hard, clean -fd, checkout --, restore)
#   - 복구 어려운 변경 (push --force, branch -D, rebase, commit --amend)
#   - 복잡한 working tree에서 충돌 유발 (stash push/pop/apply/drop/clear)
#   - 히스토리 재작성 (filter-branch, reflog delete/expire)

set -u

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ "$TOOL_NAME" != "Bash" ]; then
  exit 0
fi

# 주의: 과거 "# DESTRUCTIVE-OK" 주석 우회는 제거되었다. Claude가 주석을 직접
# 붙여 가드를 무력화할 수 있어 강제력이 없었기 때문. 대신 각 규칙이 "복구
# 불가능한 상황"만 정밀하게 차단하고, 안전한 부분집합(미push·clean·merged 등)은
# 조건으로 통과시킨다. 조건으로 살릴 수 없는 진짜 위험 작업은 사용자가 직접 실행.

# 매칭 전용 문자열: 따옴표("...", '...') 안 내용을 제거한다.
# 커밋 메시지·인자 문자열에 들어간 플래그(예: -m "explain --amend")가
# 실제 플래그로 오탐되는 것을 막는다. 표시는 항상 원본 $COMMAND 사용.
MATCH=$(printf '%s' "$COMMAND" | sed -E "s/\"[^\"]*\"//g; s/'[^']*'//g")

# 헬퍼: 차단 메시지 출력 후 exit 2
block() {
  local reason="$1"
  local hint="$2"
  echo "차단: destructive git 명령어가 감지되었습니다."
  echo "사유: $reason"
  echo "명령어: $COMMAND"
  if [ -n "$hint" ]; then
    echo "권장: $hint"
  fi
  echo ""
  echo "사용자가 의도하는 작업이라면 사용자가 직접 터미널에 입력해 실행하세요."
  exit 2
}

# ─── git stash 계열 (read-only·비파괴는 허용) ─────────────────────
# 허용: git stash list, git stash show, git stash create, git stash apply
#       (create: working tree·stash 미변경. apply: stash를 남겨둬 비파괴적)
# 차단: git stash (단독), git stash push/pop/drop/clear/branch/store
if echo "$MATCH" | grep -qE '(^|[;&|`(]|\s)git\s+stash(\s+(push|pop|drop|clear|branch|store)\b|\s*$|\s*[;&|])'; then
  block "git stash push/pop/drop/clear는 working tree 변경·stash 손실을 유발할 수 있습니다." \
        "조회는 git stash list/show, 복원은 git stash apply(stash 보존) 사용. 그 외는 사용자가 직접."
fi

# ─── git reset 위험 옵션 ──────────────────────────────────────────
# 차단: --hard, --merge, --keep
# 허용: --soft, --mixed (default), 그 외 일반 reset
# 조건부: 추적 파일에 수정사항이 없으면(working tree clean) uncommitted 손실이
# 없고 브랜치 포인터만 이동(reflog로 복구 가능)하므로 허용. dirty면 차단.
if echo "$MATCH" | grep -qE '(^|[;&|`(]|\s)git\s+reset\s+(--hard|--merge|--keep)\b' && \
   [ -n "$(git status --porcelain --untracked-files=no 2>/dev/null)" ]; then
  block "git reset --hard/--merge/--keep는 working tree의 uncommitted 변경을 복구 불가능하게 덮어씁니다." \
        "변경을 살리려면 git stash apply 가능 상태로 두거나 git reset --soft 사용. dirty 상태 hard reset은 사용자가 직접."
fi

# ─── git clean -f / -fd / -fx 등 ──────────────────────────────────
# 차단: -f/--force 가 포함된 clean (untracked 영구 삭제)
# 허용: -n/--dry-run 이 함께 있으면 실제 삭제하지 않으므로 통과
if echo "$MATCH" | grep -qE '(^|[;&|`(]|\s)git\s+clean\b[^;&|]*\s(-[a-zA-Z]*f[a-zA-Z]*|--force)\b' && \
   ! echo "$MATCH" | grep -qE '(^|[;&|`(]|\s)git\s+clean\b[^;&|]*\s(-[a-zA-Z]*n[a-zA-Z]*|--dry-run)\b'; then
  block "git clean -f는 untracked 파일을 영구 삭제합니다." \
        "지울 파일을 먼저 보려면 git clean -n. 실제 삭제는 사용자가 직접."
fi

# ─── git checkout -- / git checkout . (파일 강제 복구) ──────────
# 차단: git checkout -- <path>, git checkout .
# 허용: git checkout <branch>, git checkout -b <branch>, git checkout HEAD~1 등
# 조건부: 추적 파일에 수정사항이 없으면(working tree clean) 버릴 게 없어 no-op이므로 허용.
# (untracked는 checkout --의 영향 밖이라 -uno로 제외하고 판단)
if echo "$MATCH" | grep -qE '(^|[;&|`(]|\s)git\s+checkout\s+(--\s|\.\s*$|\.\s*[;&|])' && \
   [ -n "$(git status --porcelain --untracked-files=no 2>/dev/null)" ]; then
  block "git checkout --/. 는 working tree의 수정사항을 버립니다." \
        "특정 파일만 되돌리려면 git restore --source=HEAD <path> 등을 사용자가 직접."
fi

# ─── git restore (--staged 미포함, working tree 덮어씀) ──────────
# 차단: git restore <path>, git restore .
# 허용: git restore --staged <path> (unstage만, 비교적 안전)
# --source 옵션 사용도 결국 working tree를 덮으므로 차단
# 조건부: 추적 파일에 수정사항이 없으면(clean) 버릴 게 없어 no-op이므로 허용.
if echo "$MATCH" | grep -qE '(^|[;&|`(]|\s)git\s+restore\b' && \
   ! echo "$MATCH" | grep -qE '(^|[;&|`(]|\s)git\s+restore\s+([^|;&]*\s)?--staged\b' && \
   [ -n "$(git status --porcelain --untracked-files=no 2>/dev/null)" ]; then
  block "git restore (--staged 없이)는 working tree 변경을 버립니다." \
        "unstage만 원하면 git restore --staged <path>. 진짜 복구는 사용자가 직접."
fi

# ─── git push --force / -f (--force-with-lease는 허용) ───────────
# [^;&|]*로 push 명령 내부 인자만 검사 (뒤따르는 다른 명령의 -f 오탐 방지).
# bare --force/-f는 원격을 무조건 덮어쓰므로 차단. --force-with-lease는
# "원격이 예상과 다르면 거부"하는 안전장치가 있어 허용.
# (--force\b는 --force-with-lease의 force 부분에도 매칭되므로, lease가 있으면
#  두 번째 grep으로 예외 처리한다.)
if echo "$MATCH" | grep -qE '(^|[;&|`(]|\s)git\s+push\b[^;&|]*\s(-f\b|--force\b)' && \
   ! echo "$MATCH" | grep -qE '(^|[;&|`(]|\s)git\s+push\b[^;&|]*\s--force-with-lease\b'; then
  block "git push --force/-f는 upstream 히스토리를 무조건 덮어씁니다." \
        "안전장치 있는 git push --force-with-lease를 쓰거나, 사용자가 직접 실행."
fi

# ─── git branch -D / --delete --force ─────────────────────────────
# 조건부: 강제 삭제 대상이 모두 "merged(현재 HEAD에 머지됨) 또는 원격에 존재"면
# 커밋이 다른 곳에 남아 손실이 없으므로 허용. 하나라도 unmerged+unpushed면 차단.
# 검증 불가(레포 밖 등) 시에는 보수적으로 차단.
if echo "$MATCH" | grep -qE '(^|[;&|`(]|\s)git\s+branch\s+(-D\b|.*--delete.*--force\b|.*--force.*--delete\b)'; then
  # 'git branch ' 이후 ~ 명령 구분자 전까지에서 옵션(-..)을 뺀 브랜치명 토큰 추출
  BR_SEG=$(echo "$MATCH" | sed -E 's/.*git[[:space:]]+branch[[:space:]]+//; s/[;&|].*//')
  BR_NAMES=$(echo "$BR_SEG" | tr ' ' '\n' | grep -vE '^(-|$)')
  UNSAFE=""
  for b in $BR_NAMES; do
    # merged into HEAD?
    if git branch --merged HEAD 2>/dev/null | sed 's/^[*+ ]*//' | grep -qx "$b"; then continue; fi
    # 로컬 브랜치이고 원격에 포함(=push됨)?
    if git rev-parse --verify --quiet "refs/heads/$b" >/dev/null 2>&1 && \
       [ -n "$(git branch -r --contains "$b" 2>/dev/null)" ]; then continue; fi
    UNSAFE="$UNSAFE $b"
  done
  if [ -n "$UNSAFE" ]; then
    block "git branch -D 대상 중 머지·푸시되지 않은 브랜치가 있어 커밋이 영구 손실될 수 있습니다:$UNSAFE" \
          "안전 삭제(git branch -d)로 되는지 확인하거나, 강제 삭제는 사용자가 직접."
  fi
  # 모두 merged 또는 pushed면 통과 (커밋 손실 없음)
fi

# ─── git rebase ───────────────────────────────────────────────────
# 진행 중 rebase 마무리(--abort/--continue/--skip/--quit)와 읽기전용
# 조회(--show-current-patch)는 항상 허용.
#
# 조건부 차단(amend와 동일 논리): rebase 자체가 위험한 게 아니라, 이미
# push된 커밋을 재작성하면 push --force가 필요해 협업자에게 영향을 준다.
# HEAD가 어떤 원격 브랜치에도 없으면(미push 로컬 커밋) local 정리로 보고 허용.
# 한계: rebase 범위가 미push 경계를 넘어가도 HEAD 기준으로만 판단한다.
if echo "$MATCH" | grep -qE '(^|[;&|`(]|\s)git\s+rebase\b' && \
   ! echo "$MATCH" | grep -qE '(^|[;&|`(]|\s)git\s+rebase\s+(--abort|--continue|--skip|--quit|--show-current-patch)\b'; then
  if git branch -r --contains HEAD 2>/dev/null | grep -q .; then
    block "git rebase 대상에 이미 push된 커밋(HEAD)이 포함됩니다. 재작성 시 push --force가 필요해 협업자에게 영향을 줍니다." \
          "미push 로컬 커밋 범위만 rebase하거나, push된 히스토리 재작성은 사용자가 직접."
  fi
  # 미push 로컬 커밋이면 통과 (local 히스토리 정리 — 안전)
fi

# ─── git commit --amend ───────────────────────────────────────────
# [^;&|]*로 commit 명령 내부 인자만 검사. MATCH는 따옴표 내용을 지워
# -m "...--amend..." 처럼 메시지에 포함된 --amend 오탐을 방지.
#
# 조건부 차단: amend 자체가 위험한 게 아니라, 이미 push된 커밋을 amend하면
# push --force가 필요해 협업자에게 영향을 준다. 따라서 amend 대상(HEAD)이
# 어떤 원격 브랜치에도 없으면(미push 로컬 커밋) 허용하고, 원격에 이미
# 올라가 있을 때만 차단한다.
if echo "$MATCH" | grep -qE '(^|[;&|`(]|\s)git\s+commit\s+[^;&|]*--amend\b'; then
  if git branch -r --contains HEAD 2>/dev/null | grep -q .; then
    block "git commit --amend 대상 커밋(HEAD)이 이미 원격에 push되어 있습니다. amend하면 히스토리가 갈라져 push --force가 필요하고 협업자에게 영향을 줍니다." \
          "미push 로컬 커밋만 amend하거나 새 커밋(fixup)을 사용. 이미 push된 커밋 amend가 정말 필요하면 사용자가 직접."
  fi
  # 미push 로컬 커밋이면 통과 (로컬 히스토리만 변경 — 안전)
fi

# ─── git filter-branch / filter-repo ──────────────────────────────
if echo "$MATCH" | grep -qE '(^|[;&|`(]|\s)git\s+(filter-branch|filter-repo)\b'; then
  block "filter-branch/filter-repo는 전체 히스토리를 재작성합니다." \
        "역사 재작성은 사용자가 직접 실행."
fi

# ─── git reflog delete / expire ───────────────────────────────────
if echo "$MATCH" | grep -qE '(^|[;&|`(]|\s)git\s+reflog\s+(delete|expire)\b'; then
  block "reflog delete/expire는 복구용 reflog를 지웁니다." \
        "reflog 정리는 사용자가 직접."
fi

# ─── git update-ref -d ────────────────────────────────────────────
if echo "$MATCH" | grep -qE '(^|[;&|`(]|\s)git\s+update-ref\s+(-d|--delete)\b'; then
  block "update-ref -d는 ref를 직접 삭제합니다." \
        "ref 삭제는 사용자가 직접."
fi

exit 0
