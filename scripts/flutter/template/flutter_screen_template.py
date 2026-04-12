#!/usr/bin/env python3
"""Flutter Screen 템플릿 생성 스크립트"""

import sys


def to_snake_case(name: str) -> str:
    """PascalCase를 snake_case로 변환"""
    result = []
    for i, char in enumerate(name):
        if char.isupper() and i > 0:
            result.append("_")
        result.append(char.lower())
    return "".join(result)


def generate_screen(screen_name: str) -> str:
    """Screen 템플릿 코드 생성"""

    # Screen 접미사가 없으면 추가
    if not screen_name.endswith("Screen"):
        screen_name = f"{screen_name}Screen"

    # Bloc 이름 생성 (Screen 접미사 제거)
    bloc_name = screen_name[:-6]  # 'Screen' 제거

    return f"""import 'package:flutter/material.dart';
import 'package:flutter_leaf_kit/flutter_leaf_kit.dart';

import '../bloc/{to_snake_case(bloc_name)}_bloc.dart';
import '../widgets/{to_snake_case(bloc_name)}_app_bar.dart';
import '../widgets/{to_snake_case(bloc_name)}_body_view.dart';

class {screen_name} extends LeafScreenStatefulWidget {{
  const {screen_name}({{super.key}});

  @override
  State<{screen_name}> createState() => _{screen_name}State();
}}

class _{screen_name}State extends LeafScreenState<{screen_name}> {{
  @override
  Color? get backgroundColor => null;

  @override
  Widget? buildScreen(BuildContext context) {{
    return BlocScreenConsumer<{bloc_name}Bloc, {bloc_name}State>(
      builder: (context, state) {{
        return buildScaffold(context, state);
      }},
      successListener: (context, state) {{}},
    );
  }}

  @override
  PreferredSizeWidget? buildAppBar(BuildContext context, Object? state) {{
    return const {bloc_name}AppBar();
  }}

  @override
  Widget buildBody(BuildContext context, Object? state) {{
    return const {bloc_name}BodyView();
  }}
}}
"""


def main():
    if len(sys.argv) < 2:
        print("Usage: screen_template.py <ScreenName>", file=sys.stderr)
        print("Example: screen_template.py Login", file=sys.stderr)
        sys.exit(1)

    screen_name = sys.argv[1]
    print(generate_screen(screen_name))


if __name__ == "__main__":
    main()
