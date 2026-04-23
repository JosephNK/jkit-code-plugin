#!/usr/bin/env node
// Flutter BodyView 템플릿 생성 스크립트

import process from 'node:process';

function generateBodyView(viewNameIn) {
  let viewName = viewNameIn;
  if (!viewName.endsWith('BodyView')) {
    viewName = `${viewName}BodyView`;
  }

  const displayName = viewName.slice(0, -8);

  return `import 'package:flutter/material.dart';
import 'package:flutter_leaf_kit/flutter_leaf_kit_component.dart';

class ${viewName} extends StatelessWidget {
  const ${viewName}({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: LeafText('${displayName} Body'),
    );
  }
}
`;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 1) {
    process.stderr.write('Usage: flutter-body-view-template.mjs <ViewName>\n');
    process.stderr.write('Example: flutter-body-view-template.mjs Home\n');
    process.stderr.write('Example: flutter-body-view-template.mjs Settings\n');
    process.exit(1);
  }

  const viewName = argv[0];
  console.log(generateBodyView(viewName));
}

main();
