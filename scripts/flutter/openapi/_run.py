#!/usr/bin/env python3
"""OpenAPI 코드 생성기 CLI 러너.

Usage:
    cd ${CLAUDE_PLUGIN_ROOT} && poetry run python scripts/flutter/openapi/_run.py <spec> <api_name> --output-dir <path> [--dry-run]
"""

import sys
from pathlib import Path

# openapi 스크립트 디렉토리를 sys.path에 추가하여 절대 임포트 가능하게 함
_openapi_dir = str(Path(__file__).resolve().parent)
if _openapi_dir not in sys.path:
    sys.path.insert(0, _openapi_dir)

from generate_api import main

if __name__ == "__main__":
    sys.exit(main())
