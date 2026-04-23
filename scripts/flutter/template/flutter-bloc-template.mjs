#!/usr/bin/env node
// Flutter BLoC 템플릿 생성 스크립트

import process from 'node:process';

function toSnakeCase(name) {
  let out = '';
  for (let i = 0; i < name.length; i++) {
    const ch = name[i];
    if (ch >= 'A' && ch <= 'Z' && i > 0) {
      out += '_';
    }
    out += ch.toLowerCase();
  }
  return out;
}

function generateBloc(blocName) {
  const snakeName = toSnakeCase(blocName);

  return `import 'package:flutter_leaf_kit/flutter_leaf_kit_common.dart';
import 'package:flutter_leaf_kit/flutter_leaf_kit_state.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

part '${snakeName}_bloc.freezed.dart';
part '${snakeName}_event.dart';
part '${snakeName}_state.dart';

class ${blocName}Bloc extends Bloc<${blocName}Event, ${blocName}State> {
  ${blocName}Bloc() : super(const ${blocName}Initial()) {
    on<${blocName}LoadRequested>(_onLoadRequested);
    on<${blocName}RefreshRequested>(_onRefreshRequested);
  }

  Future<void> _onLoadRequested(
    ${blocName}LoadRequested event,
    Emitter<${blocName}State> emit,
  ) async {
    emit(const ${blocName}Loading());
    try {
      // TODO: 데이터 로드 로직 구현
      emit(const ${blocName}Loaded());
    } catch (e) {
      emit(${blocName}Error(message: e.toString()));
    }
  }

  Future<void> _onRefreshRequested(
    ${blocName}RefreshRequested event,
    Emitter<${blocName}State> emit,
  ) async {
    emit(const ${blocName}Loading());
    try {
      // TODO: 데이터 새로고침 로직 구현
      emit(const ${blocName}Loaded());
    } catch (e) {
      emit(${blocName}Error(message: e.toString()));
    }
  }
}
`;
}

function generateEvent(blocName) {
  const snakeName = toSnakeCase(blocName);

  return `part of '${snakeName}_bloc.dart';

@freezed
sealed class ${blocName}Event with _$${blocName}Event {
  const factory ${blocName}Event.loadRequested() = ${blocName}LoadRequested;
  const factory ${blocName}Event.refreshRequested() = ${blocName}RefreshRequested;
}
`;
}

function generateState(blocName) {
  const snakeName = toSnakeCase(blocName);

  return `part of '${snakeName}_bloc.dart';

@freezed
sealed class ${blocName}State with _$${blocName}State {
  const factory ${blocName}State.initial() = ${blocName}Initial;
  const factory ${blocName}State.loading() = ${blocName}Loading;
  const factory ${blocName}State.loaded() = ${blocName}Loaded;
  const factory ${blocName}State.error({required String message}) = ${blocName}Error;
}
`;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 1) {
    process.stderr.write('Usage: bloc_template.py <BlocName> [bloc|event|state]\n');
    process.stderr.write('Example: bloc_template.py Home\n');
    process.stderr.write('Example: bloc_template.py Home bloc\n');
    process.stderr.write('Example: bloc_template.py Home event\n');
    process.stderr.write('Example: bloc_template.py Home state\n');
    process.exit(1);
  }

  let blocName = argv[0];
  if (blocName.endsWith('Bloc')) {
    blocName = blocName.slice(0, -4);
  }

  const fileType = argv[1] ?? 'bloc';

  if (fileType === 'bloc') {
    console.log(generateBloc(blocName));
  } else if (fileType === 'event') {
    console.log(generateEvent(blocName));
  } else if (fileType === 'state') {
    console.log(generateState(blocName));
  } else {
    process.stderr.write(`Unknown file type: ${fileType}\n`);
    process.exit(1);
  }
}

main();
