#!/bin/bash
# 위험 명령어 차단 훅
# PreToolUse 이벤트에서 실행됨

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ "$TOOL_NAME" = "Bash" ]; then
  # rm -rf 광범위 삭제 차단 (/, ~, .., 플래그 순서 무관)
  if echo "$COMMAND" | grep -qE 'rm\s+(-[a-zA-Z]*r[a-zA-Z]*\s+)*-?-?[a-zA-Z]*f[a-zA-Z]*\s+(/|~|\.\.)' || \
     echo "$COMMAND" | grep -qE 'rm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)*-?-?[a-zA-Z]*r[a-zA-Z]*\s+(/|~|\.\.)'; then
    echo "차단: 위험한 삭제 명령어가 감지되었습니다."
    echo "명령어: $COMMAND"
    exit 2
  fi

  # DB 삭제 차단 (localhost/127.0.0.1 또는 호스트 미지정은 허용, 외부 호스트만 차단)
  if echo "$COMMAND" | grep -qiE '(DROP\s+DATABASE|TRUNCATE\s+TABLE|DELETE\s+FROM\s+\S+\s*;)'; then
    if echo "$COMMAND" | grep -qiE '(-h\s+|-host[= ]\s*|--host[= ]\s*)' && \
       ! echo "$COMMAND" | grep -qiE '(-h\s+|-host[= ]\s*|--host[= ]\s*)(localhost|127\.0\.0\.1)'; then
      echo "차단: 외부 DB에 대한 삭제 명령어가 감지되었습니다."
      exit 2
    fi
  fi

  # chmod 777 차단 (0777 포함)
  if echo "$COMMAND" | grep -qE 'chmod\s+0?777'; then
    echo "차단: chmod 777은 보안 정책에 의해 금지되었습니다."
    exit 2
  fi
fi

exit 0
