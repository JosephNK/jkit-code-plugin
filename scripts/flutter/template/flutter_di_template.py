#!/usr/bin/env python3
"""Flutter DI 등록 템플릿 생성 스크립트

injection_container.dart에 추가할 BLoC 등록 코드를 생성합니다.
"""

import sys


def to_snake_case(name: str) -> str:
    """PascalCase를 snake_case로 변환"""
    result = []
    for i, char in enumerate(name):
        if char.isupper() and i > 0:
            result.append("_")
        result.append(char.lower())
    return "".join(result)


def generate_di_registration(screen_name: str, feature_dir: str) -> str:
    """DI 등록 코드 생성

    Args:
        screen_name: 스크린 이름 (PascalCase, 예: Login, Settings)
        feature_dir: feature 디렉토리 경로 (예: login, user/settings)
    """
    snake_name = to_snake_case(screen_name)

    import_line = (
        f"import '../features/{feature_dir}/presentation"
        f"/bloc/{snake_name}_bloc.dart';"
    )

    registration_line = f"  sl.registerFactory(() => {screen_name}Bloc());"

    return f"""{import_line}

// Add to setupDependencies() BLoCs section:
{registration_line}"""


def main():
    if len(sys.argv) < 2:
        print(
            "Usage: flutter_di_template.py <ScreenName> [feature_dir]",
            file=sys.stderr,
        )
        print("Example: flutter_di_template.py Login login", file=sys.stderr)
        print(
            "Example: flutter_di_template.py Settings user/settings",
            file=sys.stderr,
        )
        sys.exit(1)

    screen_name = sys.argv[1]
    snake_name = to_snake_case(screen_name)
    feature_dir = sys.argv[2] if len(sys.argv) > 2 else snake_name

    print(generate_di_registration(screen_name, feature_dir))


if __name__ == "__main__":
    main()
