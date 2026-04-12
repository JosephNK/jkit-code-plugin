#!/usr/bin/env python3
"""Flutter AppBar 템플릿 생성 스크립트"""

import sys


def to_snake_case(name: str) -> str:
    """PascalCase를 snake_case로 변환"""
    result = []
    for i, char in enumerate(name):
        if char.isupper() and i > 0:
            result.append("_")
        result.append(char.lower())
    return "".join(result)


def generate_app_bar(app_bar_name: str) -> str:
    """AppBar 템플릿 코드 생성"""

    # AppBar 접미사가 없으면 추가
    if not app_bar_name.endswith("AppBar"):
        app_bar_name = f"{app_bar_name}AppBar"

    return f"""import 'package:flutter/material.dart';
import 'package:flutter_leaf_kit/flutter_leaf_kit.dart';

class {app_bar_name} extends StatelessWidget implements PreferredSizeWidget {{
  final Widget? leading;
  final double? leadingWidth;
  final Widget? title;
  final double? titleSpacing;
  final List<Widget> actions;
  final double? actionsRightMargin;
  final double? toolbarHeight;
  final bool? centerTitle;
  final Color? backgroundColor;
  final Color? backButtonColor;
  final Color? bottomBorderColor;
  final PreferredSizeWidget? bottom;

  const {app_bar_name}({{
    super.key,
    this.leading,
    this.leadingWidth,
    this.title,
    this.titleSpacing,
    this.actions = const [],
    this.actionsRightMargin,
    this.toolbarHeight,
    this.centerTitle,
    this.backgroundColor,
    this.backButtonColor,
    this.bottomBorderColor,
    this.bottom,
  }});

  @override
  Size get preferredSize => Size.fromHeight(
    toolbarHeight ?? kLeafToolbarHeight + (bottom?.preferredSize.height ?? 0.0),
  );

  @override
  Widget build(BuildContext context) {{
    return LeafAppBar(
      leading: leading,
      leadingWidth: (leading != null) ? leadingWidth : null,
      title: title,
      titleSpacing: titleSpacing,
      centerTitle: centerTitle,
      backgroundColor: backgroundColor,
      backButtonColor: backButtonColor,
      bottomBorderColor: bottomBorderColor ?? Colors.transparent,
      actions: actions,
      actionsRightMargin: actionsRightMargin,
    );
  }}
}}
"""


def main():
    if len(sys.argv) < 2:
        print("Usage: flutter_app_bar_template.py <AppBarName>", file=sys.stderr)
        print("Example: flutter_app_bar_template.py Home", file=sys.stderr)
        print("Example: flutter_app_bar_template.py Settings", file=sys.stderr)
        sys.exit(1)

    app_bar_name = sys.argv[1]
    print(generate_app_bar(app_bar_name))


if __name__ == "__main__":
    main()
