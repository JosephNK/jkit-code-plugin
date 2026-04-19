#!/usr/bin/env python3
"""Flutter iOS Info.plist 패치 스크립트

기존 Info.plist를 읽어서 필요한 설정만 추가/변경합니다.
Flutter 기본 템플릿이나 사용자 커스텀 설정을 보존합니다.

패치 항목:
1. CFBundleDisplayName: 하드코딩 값 → $(APP_DISPLAY_NAME) 빌드 변수
2. CFBundleURLTypes: Deep link URL scheme 블록 추가

사용법:
    python flutter_ios_info_plist_setup.py <plist_path>

예시:
    python flutter_ios_info_plist_setup.py app/ios/Runner/Info.plist
"""

import sys

URL_TYPES_BLOCK = """\t<key>CFBundleURLTypes</key>
\t<array>
\t\t<dict>
\t\t\t<key>CFBundleTypeRole</key>
\t\t\t<string>Editor</string>
\t\t\t<key>CFBundleURLSchemes</key>
\t\t\t<array>
\t\t\t\t<string>$(APP_URL_SCHEMES)</string>
\t\t\t</array>
\t\t</dict>
\t</array>"""


def patch_info_plist(content: str) -> str:
    """기존 Info.plist에 필요한 설정을 패치

    각 패치는 이미 적용되어 있으면 건너뜁니다 (멱등성 보장).
    """
    # 1. CFBundleDisplayName → $(APP_DISPLAY_NAME)
    if "$(APP_DISPLAY_NAME)" not in content:
        # 기존 CFBundleDisplayName 값을 빌드 변수로 변경
        if "<key>CFBundleDisplayName</key>" in content:
            # 기존 키가 있으면 값만 변경
            lines = content.split("\n")
            new_lines = []
            i = 0
            while i < len(lines):
                new_lines.append(lines[i])
                if "<key>CFBundleDisplayName</key>" in lines[i]:
                    # 다음 줄의 <string> 값을 교체
                    i += 1
                    if i < len(lines):
                        indent = lines[i][: len(lines[i]) - len(lines[i].lstrip())]
                        new_lines.append(
                            f"{indent}<string>$(APP_DISPLAY_NAME)</string>"
                        )
                i += 1
            content = "\n".join(new_lines)
        else:
            # CFBundleDisplayName 키가 없으면 CFBundleDevelopmentRegion 다음에 추가
            content = content.replace(
                "\t<key>CFBundleExecutable</key>",
                "\t<key>CFBundleDisplayName</key>\n"
                "\t<string>$(APP_DISPLAY_NAME)</string>\n"
                "\t<key>CFBundleExecutable</key>",
            )

    # 2. CFBundleURLTypes 블록 추가 (Deep link URL scheme)
    if "CFBundleURLTypes" not in content:
        # </dict> 바로 앞에 삽입
        last_dict_close = content.rfind("</dict>")
        if last_dict_close != -1:
            content = (
                content[:last_dict_close]
                + URL_TYPES_BLOCK
                + "\n"
                + content[last_dict_close:]
            )

    return content


def main():
    if len(sys.argv) < 2:
        print(
            "Usage: flutter_ios_info_plist_setup.py <plist_path>",
            file=sys.stderr,
        )
        print(
            "Example: flutter_ios_info_plist_setup.py" " app/ios/Runner/Info.plist",
            file=sys.stderr,
        )
        sys.exit(1)

    plist_path = sys.argv[1]

    with open(plist_path, "r") as f:
        content = f.read()

    patched = patch_info_plist(content)
    print(patched.rstrip("\n"))


if __name__ == "__main__":
    main()
