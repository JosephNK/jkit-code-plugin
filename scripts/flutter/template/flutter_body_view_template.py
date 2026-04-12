#!/usr/bin/env python3
"""Flutter BodyView 템플릿 생성 스크립트"""

import sys


def to_snake_case(name: str) -> str:
    """PascalCase를 snake_case로 변환"""
    result = []
    for i, char in enumerate(name):
        if char.isupper() and i > 0:
            result.append("_")
        result.append(char.lower())
    return "".join(result)


def generate_body_view(view_name: str) -> str:
    """BodyView 템플릿 코드 생성"""

    # BodyView 접미사가 없으면 추가
    if not view_name.endswith("BodyView"):
        view_name = f"{view_name}BodyView"

    # 표시할 텍스트용 이름 (BodyView 제거)
    display_name = view_name[:-8]  # 'BodyView' 제거

    return f"""import 'package:flutter/material.dart';
import 'package:flutter_leaf_kit/flutter_leaf_kit_component.dart';

class {view_name} extends StatelessWidget {{
  const {view_name}({{super.key}});

  @override
  Widget build(BuildContext context) {{
    return const Center(
      child: LeafText('{display_name} Body'),
    );
  }}
}}
"""


def main():
    if len(sys.argv) < 2:
        print("Usage: flutter_body_view_template.py <ViewName>", file=sys.stderr)
        print("Example: flutter_body_view_template.py Home", file=sys.stderr)
        print("Example: flutter_body_view_template.py Settings", file=sys.stderr)
        sys.exit(1)

    view_name = sys.argv[1]
    print(generate_body_view(view_name))


if __name__ == "__main__":
    main()
