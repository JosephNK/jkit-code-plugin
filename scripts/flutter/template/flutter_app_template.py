#!/usr/bin/env python3
"""Flutter App 위젯 템플릿 생성 스크립트"""

import sys


def to_snake_case(name: str) -> str:
    """PascalCase를 snake_case로 변환"""
    result = []
    for i, char in enumerate(name):
        if char.isupper() and i > 0:
            result.append("_")
        result.append(char.lower())
    return "".join(result)


def generate_app(app_name: str, package_name: str = "") -> str:
    """App 위젯 템플릿 코드 생성

    Args:
        app_name: 앱 이름 (PascalCase, 예: MyApp)
        package_name: 패키지 이름 (snake_case, 예: my_app).
                      생략 시 app_name으로부터 자동 생성.
    """
    # App 접미사가 없으면 추가
    if not app_name.endswith("App"):
        class_name = f"{app_name}App"
    else:
        class_name = app_name
        app_name = app_name[:-3]  # 'App' 제거

    # 패키지 이름 결정
    if not package_name:
        package_name = f"{to_snake_case(app_name)}_app"

    return f"""import 'package:flutter/material.dart';
import 'package:flutter_leaf_kit/flutter_leaf_kit.dart';
import 'router/router.dart';

class {class_name} extends StatefulWidget {{
  const {class_name}({{super.key}});

  @override
  State<{class_name}> createState() => _{class_name}State();
}}

class _{class_name}State extends State<{class_name}> {{
  @override
  Widget build(BuildContext context) {{
    return LeafTheme(
      data: LeafThemeData.light(),
      child: MaterialApp.router(
        title: '{class_name}',
        theme: LeafThemeData.light().toThemeData(brightness: Brightness.light),
        darkTheme: LeafThemeData.dark().toThemeData(brightness: Brightness.dark),
        routerConfig: AppRouter.router,
        localizationsDelegates: context.localizationDelegates,
        supportedLocales: context.supportedLocales,
        locale: context.locale,
      ),
    );
  }}
}}
"""


def main():
    if len(sys.argv) < 2:
        print(
            "Usage: flutter_app_template.py <AppName> [package_name]",
            file=sys.stderr,
        )
        print("Example: flutter_app_template.py MyApp", file=sys.stderr)
        print(
            "Example: flutter_app_template.py MyApp my_app",
            file=sys.stderr,
        )
        sys.exit(1)

    app_name = sys.argv[1]
    package_name = sys.argv[2] if len(sys.argv) > 2 else ""
    print(generate_app(app_name, package_name))


if __name__ == "__main__":
    main()
