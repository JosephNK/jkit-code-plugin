#!/usr/bin/env node
// Flutter AppBar 템플릿 생성 스크립트

import process from 'node:process';

function generateAppBar(appBarNameIn) {
  let appBarName = appBarNameIn;
  if (!appBarName.endsWith('AppBar')) {
    appBarName = `${appBarName}AppBar`;
  }

  return `import 'package:flutter/material.dart';
import 'package:flutter_leaf_kit/flutter_leaf_kit.dart';

class ${appBarName} extends StatelessWidget implements PreferredSizeWidget {
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

  const ${appBarName}({
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
  });

  @override
  Size get preferredSize => Size.fromHeight(
    toolbarHeight ?? kLeafToolbarHeight + (bottom?.preferredSize.height ?? 0.0),
  );

  @override
  Widget build(BuildContext context) {
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
  }
}
`;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 1) {
    process.stderr.write('Usage: flutter-app-bar-template.mjs <AppBarName>\n');
    process.stderr.write('Example: flutter-app-bar-template.mjs Home\n');
    process.stderr.write('Example: flutter-app-bar-template.mjs Settings\n');
    process.exit(1);
  }

  const appBarName = argv[0];
  console.log(generateAppBar(appBarName));
}

main();
