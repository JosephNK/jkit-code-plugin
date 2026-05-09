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

# ─── git stash 계열 (read-only는 허용) ────────────────────────────
# 허용: git stash list, git stash show
# 차단: git stash (단독), git stash push/pop/apply/drop/clear/branch/create/store
if echo "$COMMAND" | grep -qE '(^|[;&|`(]|\s)git\s+stash(\s+(push|pop|apply|drop|clear|branch|create|store)\b|\s*$|\s*[;&|])'; then
  block "git stash 계열은 복잡한 working tree에서 충돌·작업 손실을 유발할 수 있습니다." \
        "검증·실험 목적이면 stash 대신 git diff/git status 또는 별도 worktree(git worktree add) 사용."
fi

# ─── git reset 위험 옵션 ──────────────────────────────────────────
# 차단: --hard, --merge, --keep
# 허용: --soft, --mixed (default), 그 외 일반 reset
if echo "$COMMAND" | grep -qE '(^|[;&|`(]|\s)git\s+reset\s+(--hard|--merge|--keep)\b'; then
  block "git reset --hard/--merge/--keep는 working tree 변경을 복구 불가능하게 덮어씁니다." \
        "필요하면 git reset --soft 또는 git reset(default mixed)을 사용. 진짜 hard reset은 사용자가 직접."
fi

# ─── git clean -f / -fd / -fx 등 ──────────────────────────────────
# 차단: -f 또는 -ff 가 포함된 모든 clean (untracked 영구 삭제)
if echo "$COMMAND" | grep -qE '(^|[;&|`(]|\s)git\s+clean\s+(-[a-zA-Z]*f[a-zA-Z]*|--force)\b'; then
  block "git clean -f는 untracked 파일을 영구 삭제합니다." \
        "지울 파일을 먼저 보려면 git clean -n. 실제 삭제는 사용자가 직접."
fi

# ─── git checkout -- / git checkout . (파일 강제 복구) ──────────
# 차단: git checkout -- <path>, git checkout .
# 허용: git checkout <branch>, git checkout -b <branch>, git checkout HEAD~1 등
if echo "$COMMAND" | grep -qE '(^|[;&|`(]|\s)git\s+checkout\s+(--\s|\.\s*$|\.\s*[;&|])'; then
  block "git checkout --/. 는 working tree의 수정사항을 버립니다." \
        "특정 파일만 되돌리려면 git restore --source=HEAD <path> 등을 사용자가 직접."
fi

# ─── git restore (--staged 미포함, working tree 덮어씀) ──────────
# 차단: git restore <path>, git restore .
# 허용: git restore --staged <path> (unstage만, 비교적 안전)
# --source 옵션 사용도 결국 working tree를 덮으므로 차단
if echo "$COMMAND" | grep -qE '(^|[;&|`(]|\s)git\s+restore\b' && \
   ! echo "$COMMAND" | grep -qE '(^|[;&|`(]|\s)git\s+restore\s+([^|;&]*\s)?--staged\b'; then
  block "git restore (--staged 없이)는 working tree 변경을 버립니다." \
        "unstage만 원하면 git restore --staged <path>. 진짜 복구는 사용자가 직접."
fi

# ─── git push --force / -f / --force-with-lease ──────────────────
if echo "$COMMAND" | grep -qE '(^|[;&|`(]|\s)git\s+push\b.*\s(-f\b|--force\b|--force-with-lease\b)'; then
  block "git push --force/-f/--force-with-lease는 upstream 히스토리를 덮어씁니다." \
        "협업자에게 영향을 줍니다. 사용자가 의도와 결과를 확인 후 직접 실행."
fi

# ─── git branch -D / --delete --force ─────────────────────────────
if echo "$COMMAND" | grep -qE '(^|[;&|`(]|\s)git\s+branch\s+(-D\b|.*--delete.*--force\b|.*--force.*--delete\b)'; then
  block "git branch -D는 머지되지 않은 브랜치를 강제 삭제합니다." \
        "안전 삭제는 git branch -d. 강제 삭제는 사용자가 직접."
fi

# ─── git rebase ───────────────────────────────────────────────────
# 모든 rebase 차단 (--abort/--continue/--skip만 허용 — 진행 중인 rebase 마무리)
if echo "$COMMAND" | grep -qE '(^|[;&|`(]|\s)git\s+rebase\b' && \
   ! echo "$COMMAND" | grep -qE '(^|[;&|`(]|\s)git\s+rebase\s+(--abort|--continue|--skip|--quit)\b'; then
  block "git rebase는 히스토리를 재작성합니다." \
        "히스토리 재작성은 사용자가 직접 실행. 진행 중 rebase 마무리는 --abort/--continue 허용."
fi

# ─── git commit --amend ───────────────────────────────────────────
if echo "$COMMAND" | grep -qE '(^|[;&|`(]|\s)git\s+commit\s+.*--amend\b|(^|[;&|`(]|\s)git\s+commit\s+--amend\b'; then
  block "git commit --amend는 이전 커밋을 재작성합니다." \
        "새 커밋을 만들거나, amend가 정말 필요하면 사용자가 직접."
fi

# ─── git filter-branch / filter-repo ──────────────────────────────
if echo "$COMMAND" | grep -qE '(^|[;&|`(]|\s)git\s+(filter-branch|filter-repo)\b'; then
  block "filter-branch/filter-repo는 전체 히스토리를 재작성합니다." \
        "역사 재작성은 사용자가 직접 실행."
fi

# ─── git reflog delete / expire ───────────────────────────────────
if echo "$COMMAND" | grep -qE '(^|[;&|`(]|\s)git\s+reflog\s+(delete|expire)\b'; then
  block "reflog delete/expire는 복구용 reflog를 지웁니다." \
        "reflog 정리는 사용자가 직접."
fi

# ─── git update-ref -d ────────────────────────────────────────────
if echo "$COMMAND" | grep -qE '(^|[;&|`(]|\s)git\s+update-ref\s+(-d|--delete)\b'; then
  block "update-ref -d는 ref를 직접 삭제합니다." \
        "ref 삭제는 사용자가 직접."
fi

exit 0
