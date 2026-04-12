#!/usr/bin/env python3
"""Flutter GoRoute 템플릿 생성 스크립트"""

import argparse


def generate_route(
    screen_name: str,
    path: str = "/",
    no_transition: bool = False,
) -> str:
    """GoRoute 템플릿 코드 생성

    Args:
        screen_name: 스크린 이름 (PascalCase, 예: Login, Home)
        path: 라우트 경로 (예: /, /home)
        no_transition: True이면 pageBuilder + NoTransitionPage 래핑
    """
    if no_transition:
        return f"""GoRoute(
        path: '{path}',
        pageBuilder: (BuildContext context, GoRouterState state) {{
          return NoTransitionPage<void>(
            child: MultiBlocProvider(
              providers: [
                BlocProvider(
                  create: (_) => sl<{screen_name}Bloc>()..add({screen_name}LoadRequested()),
                ),
              ],
              child: const {screen_name}Screen(),
            ),
          );
        }},
      ),"""

    return f"""GoRoute(
        path: '{path}',
        builder: (BuildContext context, GoRouterState state) {{
          return MultiBlocProvider(
            providers: [
              BlocProvider(
                create: (_) => sl<{screen_name}Bloc>()..add({screen_name}LoadRequested()),
              ),
            ],
            child: {screen_name}Screen(),
          );
        }},
      ),"""


def main():
    parser = argparse.ArgumentParser(description="Flutter GoRoute 템플릿 생성")
    parser.add_argument("screen_name", help="스크린 이름 (PascalCase, 예: Login)")
    parser.add_argument("path", nargs="?", default="/", help="라우트 경로 (기본: /)")
    parser.add_argument(
        "-nt",
        action="store_true",
        help="NoTransitionPage 래핑 (pageBuilder 사용)",
    )
    args = parser.parse_args()

    print(generate_route(args.screen_name, args.path, args.nt))


if __name__ == "__main__":
    main()
