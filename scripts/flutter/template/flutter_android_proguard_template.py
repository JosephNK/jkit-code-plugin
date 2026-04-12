#!/usr/bin/env python3
"""Flutter Android proguard-rules.pro 템플릿 생성 스크립트"""


def generate_proguard() -> str:
    """proguard-rules.pro 템플릿 코드 생성"""
    return """# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.kts.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html"""


def main():
    print(generate_proguard())


if __name__ == "__main__":
    main()
