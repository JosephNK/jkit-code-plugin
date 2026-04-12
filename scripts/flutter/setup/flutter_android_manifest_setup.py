#!/usr/bin/env python3
"""Flutter Android AndroidManifest.xml 패치 스크립트

기존 AndroidManifest.xml을 읽어서 필요한 설정만 추가/변경합니다.
Flutter 기본 템플릿이나 사용자 커스텀 설정을 보존합니다.

패치 항목:
1. xmlns:tools 네임스페이스 추가
2. INTERNET 퍼미션 추가
3. android:label → @string/app_name 변경
4. application 속성 추가 (requestLegacyExternalStorage, usesCleartextTraffic, allowBackup)
5. launchMode singleTop → singleTask 변경
6. Deep link intent-filter 추가
"""

import re
import sys


DEEP_LINK_INTENT_FILTER = """
            <!-- Scheme -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW"/>
                <category android:name="android.intent.category.DEFAULT"/>
                <category android:name="android.intent.category.BROWSABLE"/>
                <data android:scheme="${scheme}"/>
            </intent-filter>"""

APP_ATTRIBUTES = (
    'android:requestLegacyExternalStorage="true"\n'
    '        android:usesCleartextTraffic="true"\n'
    '        android:allowBackup="false"\n'
    '        tools:replace="android:allowBackup"'
)


def patch_manifest(content: str) -> str:
    """기존 AndroidManifest.xml에 필요한 설정을 패치

    각 패치는 이미 적용되어 있으면 건너뜁니다.
    """
    # 1. xmlns:tools 네임스페이스 추가
    if "xmlns:tools" not in content:
        content = content.replace(
            'xmlns:android="http://schemas.android.com/apk/res/android"',
            'xmlns:android="http://schemas.android.com/apk/res/android"\n'
            '    xmlns:tools="http://schemas.android.com/tools"',
        )

    # 2. INTERNET 퍼미션 추가
    if "android.permission.INTERNET" not in content:
        content = content.replace(
            "\n    <application",
            '\n    <uses-permission android:name="android.permission.INTERNET"/>'
            "\n\n    <application",
            1,
        )

    # 3. android:label → @string/app_name
    if '@string/app_name' not in content:
        content = re.sub(
            r'android:label="[^"]*"',
            'android:label="@string/app_name"',
            content,
            count=1,
        )

    # 4. application 속성 추가 (icon 다음에 삽입)
    if "requestLegacyExternalStorage" not in content:
        content = content.replace(
            'android:icon="@mipmap/ic_launcher">',
            'android:icon="@mipmap/ic_launcher"\n'
            f"        {APP_ATTRIBUTES}>",
        )

    # 5. launchMode → singleTask
    if "singleTop" in content:
        content = content.replace(
            'android:launchMode="singleTop"',
            'android:launchMode="singleTask"',
        )

    # 6. Deep link intent-filter 추가
    if "android.intent.action.VIEW" not in content:
        # LAUNCHER intent-filter 닫힌 직후에 삽입
        launcher_end = "android.intent.category.LAUNCHER"
        pos = content.find(launcher_end)
        if pos != -1:
            # </intent-filter> 위치 찾기
            filter_close = "</intent-filter>"
            close_pos = content.find(filter_close, pos)
            if close_pos != -1:
                insert_pos = close_pos + len(filter_close)
                content = (
                    content[:insert_pos]
                    + DEEP_LINK_INTENT_FILTER
                    + content[insert_pos:]
                )

    return content


def main():
    if len(sys.argv) < 2:
        print(
            "Usage: flutter_android_manifest_setup.py <manifest_path>",
            file=sys.stderr,
        )
        print(
            "Example: flutter_android_manifest_setup.py"
            " app/android/app/src/main/AndroidManifest.xml",
            file=sys.stderr,
        )
        sys.exit(1)

    manifest_path = sys.argv[1]

    with open(manifest_path, "r") as f:
        content = f.read()

    patched = patch_manifest(content)
    print(patched.rstrip("\n"))


if __name__ == "__main__":
    main()
