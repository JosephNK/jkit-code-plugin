#!/usr/bin/env python3
"""Flutter AppRouter 파일 생성 및 저장 스크립트"""

import argparse
from pathlib import Path

DEFAULT_ROUTER_PATH = "lib/router/router.dart"


def generate_router() -> str:
    """AppRouter 템플릿 코드 생성"""
    return """import 'package:flutter/material.dart';
import 'package:flutter_leaf_kit/flutter_leaf_kit_state.dart';
import 'package:go_router/go_router.dart';

class AppRouter {
  AppRouter._();

  static final GoRouter router = GoRouter(
    routes: <RouteBase>[

    ],
  );
}
"""


def setup_router(output_path: str) -> str:
    """router.dart 파일 생성

    Args:
        output_path: 출력 파일 경로

    Returns:
        생성된 파일 경로
    """
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(generate_router(), encoding="utf-8")
    return str(path)


def main():
    parser = argparse.ArgumentParser(description="Flutter AppRouter 파일 생성")
    parser.add_argument(
        "-entry",
        default="",
        help="엔트리 디렉토리 (예: app). 생략 시 lib/router/router.dart",
    )
    args = parser.parse_args()

    if args.entry:
        output_path = f"{args.entry}/{DEFAULT_ROUTER_PATH}"
    else:
        output_path = DEFAULT_ROUTER_PATH

    created = setup_router(output_path)
    print(created)


if __name__ == "__main__":
    main()
