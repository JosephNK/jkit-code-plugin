#!/usr/bin/env python3
"""Flutter BLoC 템플릿 생성 스크립트"""

import sys


def to_snake_case(name: str) -> str:
    """PascalCase를 snake_case로 변환"""
    result = []
    for i, char in enumerate(name):
        if char.isupper() and i > 0:
            result.append("_")
        result.append(char.lower())
    return "".join(result)


def generate_bloc(bloc_name: str) -> str:
    """Bloc 메인 파일 템플릿 코드 생성"""
    snake_name = to_snake_case(bloc_name)

    return f"""import 'package:flutter_leaf_kit/flutter_leaf_kit_common.dart';
import 'package:flutter_leaf_kit/flutter_leaf_kit_state.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

part '{snake_name}_bloc.freezed.dart';
part '{snake_name}_event.dart';
part '{snake_name}_state.dart';

class {bloc_name}Bloc extends Bloc<{bloc_name}Event, {bloc_name}State> {{
  {bloc_name}Bloc() : super(const {bloc_name}Initial()) {{
    on<{bloc_name}LoadRequested>(_onLoadRequested);
    on<{bloc_name}RefreshRequested>(_onRefreshRequested);
  }}

  Future<void> _onLoadRequested(
    {bloc_name}LoadRequested event,
    Emitter<{bloc_name}State> emit,
  ) async {{
    emit(const {bloc_name}Loading());
    try {{
      // TODO: 데이터 로드 로직 구현
      emit(const {bloc_name}Loaded());
    }} catch (e) {{
      emit({bloc_name}Error(message: e.toString()));
    }}
  }}

  Future<void> _onRefreshRequested(
    {bloc_name}RefreshRequested event,
    Emitter<{bloc_name}State> emit,
  ) async {{
    emit(const {bloc_name}Loading());
    try {{
      // TODO: 데이터 새로고침 로직 구현
      emit(const {bloc_name}Loaded());
    }} catch (e) {{
      emit({bloc_name}Error(message: e.toString()));
    }}
  }}
}}
"""


def generate_event(bloc_name: str) -> str:
    """Event 파일 템플릿 코드 생성"""
    snake_name = to_snake_case(bloc_name)

    return f"""part of '{snake_name}_bloc.dart';

@freezed
sealed class {bloc_name}Event with _${bloc_name}Event {{
  const factory {bloc_name}Event.loadRequested() = {bloc_name}LoadRequested;
  const factory {bloc_name}Event.refreshRequested() = {bloc_name}RefreshRequested;
}}
"""


def generate_state(bloc_name: str) -> str:
    """State 파일 템플릿 코드 생성"""
    snake_name = to_snake_case(bloc_name)

    return f"""part of '{snake_name}_bloc.dart';

@freezed
sealed class {bloc_name}State with _${bloc_name}State {{
  const factory {bloc_name}State.initial() = {bloc_name}Initial;
  const factory {bloc_name}State.loading() = {bloc_name}Loading;
  const factory {bloc_name}State.loaded() = {bloc_name}Loaded;
  const factory {bloc_name}State.error({{required String message}}) = {bloc_name}Error;
}}
"""


def main():
    if len(sys.argv) < 2:
        print("Usage: bloc_template.py <BlocName> [bloc|event|state]", file=sys.stderr)
        print("Example: bloc_template.py Home", file=sys.stderr)
        print("Example: bloc_template.py Home bloc", file=sys.stderr)
        print("Example: bloc_template.py Home event", file=sys.stderr)
        print("Example: bloc_template.py Home state", file=sys.stderr)
        sys.exit(1)

    bloc_name = sys.argv[1]

    # Bloc 접미사가 있으면 제거
    if bloc_name.endswith("Bloc"):
        bloc_name = bloc_name[:-4]

    file_type = sys.argv[2] if len(sys.argv) > 2 else "bloc"

    if file_type == "bloc":
        print(generate_bloc(bloc_name))
    elif file_type == "event":
        print(generate_event(bloc_name))
    elif file_type == "state":
        print(generate_state(bloc_name))
    else:
        print(f"Unknown file type: {file_type}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
