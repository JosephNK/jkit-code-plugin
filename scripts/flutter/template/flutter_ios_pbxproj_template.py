#!/usr/bin/env python3
"""Flutter iOS project.pbxproj 템플릿 생성 스크립트

flutter create 직후의 clean project.pbxproj를 읽어서
4개 flavor (production/development/staging/qa) × 3개 빌드 타입 (Debug/Release/Profile)
= 12개 빌드 설정으로 확장합니다.

기존 파일의 헤더 섹션(PBXBuildFile ~ PBXVariantGroup)은 그대로 보존하고,
XCBuildConfiguration과 XCConfigurationList 섹션만 재생성합니다.

사용법:
    python flutter_ios_pbxproj_template.py <AppName> <package_name> <existing_pbxproj_path>

예시:
    python flutter_ios_pbxproj_template.py MyApp com.example.myapp app/ios/Runner.xcodeproj/project.pbxproj
"""

import re
import sys

# ---------------------------------------------------------------------------
# Flavor 설정
# ---------------------------------------------------------------------------
FLAVORS = [
    {
        "name": "production",
        "display_suffix": "",
        "url_scheme_suffix": "",
        "bundle_id_suffix": "",
    },
    {
        "name": "development",
        "display_suffix": " (dev)",
        "url_scheme_suffix": "-dev",
        "bundle_id_suffix": ".dev",
    },
    {
        "name": "staging",
        "display_suffix": " (stg)",
        "url_scheme_suffix": "-stg",
        "bundle_id_suffix": ".stg",
    },
    {
        "name": "qa",
        "display_suffix": " (qa)",
        "url_scheme_suffix": "-test",
        "bundle_id_suffix": ".test",
    },
]

# ---------------------------------------------------------------------------
# UUID 매핑
# production: Flutter 기본 UUID 재사용
# development/staging/qa: 고정 UUID (24자 hex)
# ---------------------------------------------------------------------------
FLAVOR_UUIDS = {
    "production": {
        "project": {
            "debug": "97C147031CF9000F007C117D",
            "release": "97C147041CF9000F007C117D",
            "profile": "249021D3217E4FDB00AE95B9",
        },
        "runner": {
            "debug": "97C147061CF9000F007C117D",
            "release": "97C147071CF9000F007C117D",
            "profile": "249021D4217E4FDB00AE95B9",
        },
        "tests": {
            "debug": "331C8088294A63A400263BE5",
            "release": "331C8089294A63A400263BE5",
            "profile": "331C808A294A63A400263BE5",
        },
    },
    "development": {
        "project": {
            "debug": "F1A000010000000000000001",
            "release": "F1A000020000000000000001",
            "profile": "F1A000030000000000000001",
        },
        "runner": {
            "debug": "F1A000040000000000000001",
            "release": "F1A000050000000000000001",
            "profile": "F1A000060000000000000001",
        },
        "tests": {
            "debug": "F1A000070000000000000001",
            "release": "F1A000080000000000000001",
            "profile": "F1A000090000000000000001",
        },
    },
    "staging": {
        "project": {
            "debug": "F1B000010000000000000001",
            "release": "F1B000020000000000000001",
            "profile": "F1B000030000000000000001",
        },
        "runner": {
            "debug": "F1B000040000000000000001",
            "release": "F1B000050000000000000001",
            "profile": "F1B000060000000000000001",
        },
        "tests": {
            "debug": "F1B000070000000000000001",
            "release": "F1B000080000000000000001",
            "profile": "F1B000090000000000000001",
        },
    },
    "qa": {
        "project": {
            "debug": "F1C000010000000000000001",
            "release": "F1C000020000000000000001",
            "profile": "F1C000030000000000000001",
        },
        "runner": {
            "debug": "F1C000040000000000000001",
            "release": "F1C000050000000000000001",
            "profile": "F1C000060000000000000001",
        },
        "tests": {
            "debug": "F1C000070000000000000001",
            "release": "F1C000080000000000000001",
            "profile": "F1C000090000000000000001",
        },
    },
}

# Flutter 템플릿 고정 UUID (xcconfig 파일 참조)
DEBUG_XCCONFIG_REF = "9740EEB21CF90195004384FC"
RELEASE_XCCONFIG_REF = "7AFA3C8E1D35360C0083082E"

# XCConfigurationList UUID (Flutter 템플릿 고정)
CONFIG_LIST_PROJECT = "97C146E91CF9000F007C117D"
CONFIG_LIST_RUNNER = "97C147051CF9000F007C117D"
CONFIG_LIST_TESTS = "331C8087294A63A400263BE5"

# 섹션 마커
BEGIN_BUILD_CONFIG = "/* Begin XCBuildConfiguration section */"
END_BUILD_CONFIG = "/* End XCBuildConfiguration section */"
BEGIN_CONFIG_LIST = "/* Begin XCConfigurationList section */"
END_CONFIG_LIST = "/* End XCConfigurationList section */"

# ---------------------------------------------------------------------------
# Project-level 빌드 설정 (상수 - 모든 flavor에서 동일)
# ---------------------------------------------------------------------------
PROJECT_DEBUG_SETTINGS = """\t\t\t\tALWAYS_SEARCH_USER_PATHS = NO;
\t\t\t\tASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS = YES;
\t\t\t\tCLANG_ANALYZER_NONNULL = YES;
\t\t\t\tCLANG_CXX_LANGUAGE_STANDARD = "gnu++0x";
\t\t\t\tCLANG_CXX_LIBRARY = "libc++";
\t\t\t\tCLANG_ENABLE_MODULES = YES;
\t\t\t\tCLANG_ENABLE_OBJC_ARC = YES;
\t\t\t\tCLANG_WARN_BLOCK_CAPTURE_AUTORELEASING = YES;
\t\t\t\tCLANG_WARN_BOOL_CONVERSION = YES;
\t\t\t\tCLANG_WARN_COMMA = YES;
\t\t\t\tCLANG_WARN_CONSTANT_CONVERSION = YES;
\t\t\t\tCLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS = YES;
\t\t\t\tCLANG_WARN_DIRECT_OBJC_ISA_USAGE = YES_ERROR;
\t\t\t\tCLANG_WARN_EMPTY_BODY = YES;
\t\t\t\tCLANG_WARN_ENUM_CONVERSION = YES;
\t\t\t\tCLANG_WARN_INFINITE_RECURSION = YES;
\t\t\t\tCLANG_WARN_INT_CONVERSION = YES;
\t\t\t\tCLANG_WARN_NON_LITERAL_NULL_CONVERSION = YES;
\t\t\t\tCLANG_WARN_OBJC_IMPLICIT_RETAIN_SELF = YES;
\t\t\t\tCLANG_WARN_OBJC_LITERAL_CONVERSION = YES;
\t\t\t\tCLANG_WARN_OBJC_ROOT_CLASS = YES_ERROR;
\t\t\t\tCLANG_WARN_RANGE_LOOP_ANALYSIS = YES;
\t\t\t\tCLANG_WARN_STRICT_PROTOTYPES = YES;
\t\t\t\tCLANG_WARN_SUSPICIOUS_MOVE = YES;
\t\t\t\tCLANG_WARN_UNREACHABLE_CODE = YES;
\t\t\t\tCLANG_WARN__DUPLICATE_METHOD_MATCH = YES;
\t\t\t\t"CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "iPhone Developer";
\t\t\t\tCOPY_PHASE_STRIP = NO;
\t\t\t\tDEBUG_INFORMATION_FORMAT = dwarf;
\t\t\t\tENABLE_STRICT_OBJC_MSGSEND = YES;
\t\t\t\tENABLE_TESTABILITY = YES;
\t\t\t\tENABLE_USER_SCRIPT_SANDBOXING = NO;
\t\t\t\tGCC_C_LANGUAGE_STANDARD = gnu99;
\t\t\t\tGCC_DYNAMIC_NO_PIC = NO;
\t\t\t\tGCC_NO_COMMON_BLOCKS = YES;
\t\t\t\tGCC_OPTIMIZATION_LEVEL = 0;
\t\t\t\tGCC_PREPROCESSOR_DEFINITIONS = (
\t\t\t\t\t"DEBUG=1",
\t\t\t\t\t"$(inherited)",
\t\t\t\t);
\t\t\t\tGCC_WARN_64_TO_32_BIT_CONVERSION = YES;
\t\t\t\tGCC_WARN_ABOUT_RETURN_TYPE = YES_ERROR;
\t\t\t\tGCC_WARN_UNDECLARED_SELECTOR = YES;
\t\t\t\tGCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;
\t\t\t\tGCC_WARN_UNUSED_FUNCTION = YES;
\t\t\t\tGCC_WARN_UNUSED_VARIABLE = YES;
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 13.0;
\t\t\t\tMTL_ENABLE_DEBUG_INFO = YES;
\t\t\t\tONLY_ACTIVE_ARCH = YES;
\t\t\t\tSDKROOT = iphoneos;
\t\t\t\tTARGETED_DEVICE_FAMILY = "1,2";"""

PROJECT_RELEASE_SETTINGS = """\t\t\t\tALWAYS_SEARCH_USER_PATHS = NO;
\t\t\t\tASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS = YES;
\t\t\t\tCLANG_ANALYZER_NONNULL = YES;
\t\t\t\tCLANG_CXX_LANGUAGE_STANDARD = "gnu++0x";
\t\t\t\tCLANG_CXX_LIBRARY = "libc++";
\t\t\t\tCLANG_ENABLE_MODULES = YES;
\t\t\t\tCLANG_ENABLE_OBJC_ARC = YES;
\t\t\t\tCLANG_WARN_BLOCK_CAPTURE_AUTORELEASING = YES;
\t\t\t\tCLANG_WARN_BOOL_CONVERSION = YES;
\t\t\t\tCLANG_WARN_COMMA = YES;
\t\t\t\tCLANG_WARN_CONSTANT_CONVERSION = YES;
\t\t\t\tCLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS = YES;
\t\t\t\tCLANG_WARN_DIRECT_OBJC_ISA_USAGE = YES_ERROR;
\t\t\t\tCLANG_WARN_EMPTY_BODY = YES;
\t\t\t\tCLANG_WARN_ENUM_CONVERSION = YES;
\t\t\t\tCLANG_WARN_INFINITE_RECURSION = YES;
\t\t\t\tCLANG_WARN_INT_CONVERSION = YES;
\t\t\t\tCLANG_WARN_NON_LITERAL_NULL_CONVERSION = YES;
\t\t\t\tCLANG_WARN_OBJC_IMPLICIT_RETAIN_SELF = YES;
\t\t\t\tCLANG_WARN_OBJC_LITERAL_CONVERSION = YES;
\t\t\t\tCLANG_WARN_OBJC_ROOT_CLASS = YES_ERROR;
\t\t\t\tCLANG_WARN_RANGE_LOOP_ANALYSIS = YES;
\t\t\t\tCLANG_WARN_STRICT_PROTOTYPES = YES;
\t\t\t\tCLANG_WARN_SUSPICIOUS_MOVE = YES;
\t\t\t\tCLANG_WARN_UNREACHABLE_CODE = YES;
\t\t\t\tCLANG_WARN__DUPLICATE_METHOD_MATCH = YES;
\t\t\t\t"CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "iPhone Developer";
\t\t\t\tCOPY_PHASE_STRIP = NO;
\t\t\t\tDEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
\t\t\t\tENABLE_NS_ASSERTIONS = NO;
\t\t\t\tENABLE_STRICT_OBJC_MSGSEND = YES;
\t\t\t\tENABLE_USER_SCRIPT_SANDBOXING = NO;
\t\t\t\tGCC_C_LANGUAGE_STANDARD = gnu99;
\t\t\t\tGCC_NO_COMMON_BLOCKS = YES;
\t\t\t\tGCC_WARN_64_TO_32_BIT_CONVERSION = YES;
\t\t\t\tGCC_WARN_ABOUT_RETURN_TYPE = YES_ERROR;
\t\t\t\tGCC_WARN_UNDECLARED_SELECTOR = YES;
\t\t\t\tGCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;
\t\t\t\tGCC_WARN_UNUSED_FUNCTION = YES;
\t\t\t\tGCC_WARN_UNUSED_VARIABLE = YES;
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 13.0;
\t\t\t\tMTL_ENABLE_DEBUG_INFO = NO;
\t\t\t\tSDKROOT = iphoneos;
\t\t\t\tSUPPORTED_PLATFORMS = iphoneos;
\t\t\t\tSWIFT_COMPILATION_MODE = wholemodule;
\t\t\t\tSWIFT_OPTIMIZATION_LEVEL = "-O";
\t\t\t\tTARGETED_DEVICE_FAMILY = "1,2";
\t\t\t\tVALIDATE_PRODUCT = YES;"""

# Profile project settings = Release project settings (동일)

# ---------------------------------------------------------------------------
# 헬퍼 함수
# ---------------------------------------------------------------------------


def pbx_quote(value: str) -> str:
    """pbxproj 값에 특수문자가 있으면 따옴표로 감싸기"""
    if not value or " " in value or "-" in value or "(" in value or ")" in value:
        return f'"{value}"'
    return value


def extract_team_id(content: str) -> str:
    """기존 pbxproj에서 DEVELOPMENT_TEAM 값 추출"""
    match = re.search(r"DEVELOPMENT_TEAM\s*=\s*(\S+?);", content)
    if match:
        return match.group(1).strip('"')
    return ""


def extract_header(content: str) -> str:
    """XCBuildConfiguration 섹션 이전의 모든 내용 추출"""
    idx = content.find(BEGIN_BUILD_CONFIG)
    if idx == -1:
        print("Error: XCBuildConfiguration section not found", file=sys.stderr)
        sys.exit(1)
    return content[:idx]


# ---------------------------------------------------------------------------
# XCBuildConfiguration 생성
# ---------------------------------------------------------------------------


def project_config(uuid: str, flavor: str, build_type: str) -> str:
    """Project-level XCBuildConfiguration 생성"""
    name = f"{build_type}-{flavor}"
    if build_type == "Debug":
        settings = PROJECT_DEBUG_SETTINGS
    else:
        settings = PROJECT_RELEASE_SETTINGS

    return (
        f"\t\t{uuid} /* {name} */ = {{\n"
        f"\t\t\tisa = XCBuildConfiguration;\n"
        f"\t\t\tbuildSettings = {{\n"
        f"{settings}\n"
        f"\t\t\t}};\n"
        f'\t\t\tname = "{name}";\n'
        f"\t\t}};"
    )


def runner_config(
    uuid: str,
    flavor: str,
    build_type: str,
    display_name: str,
    url_scheme: str,
    bundle_id: str,
    team_id: str,
) -> str:
    """Runner target XCBuildConfiguration 생성"""
    name = f"{build_type}-{flavor}"

    if build_type == "Debug":
        xcconfig_ref = DEBUG_XCCONFIG_REF
        xcconfig_name = "Debug.xcconfig"
    else:
        xcconfig_ref = RELEASE_XCCONFIG_REF
        xcconfig_name = "Release.xcconfig"

    swift_opt = ""
    if build_type == "Debug":
        swift_opt = '\t\t\t\tSWIFT_OPTIMIZATION_LEVEL = "-Onone";\n'

    return (
        f"\t\t{uuid} /* {name} */ = {{\n"
        f"\t\t\tisa = XCBuildConfiguration;\n"
        f"\t\t\tbaseConfigurationReference = {xcconfig_ref} /* {xcconfig_name} */;\n"
        f"\t\t\tbuildSettings = {{\n"
        f"\t\t\t\tAPP_DISPLAY_NAME = {pbx_quote(display_name)};\n"
        f"\t\t\t\tAPP_URL_SCHEMES = {pbx_quote(url_scheme)};\n"
        f"\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;\n"
        f"\t\t\t\tCLANG_ENABLE_MODULES = YES;\n"
        f'\t\t\t\tCURRENT_PROJECT_VERSION = "$(FLUTTER_BUILD_NUMBER)";\n'
        f"\t\t\t\tDEVELOPMENT_TEAM = {team_id};\n"
        f"\t\t\t\tENABLE_BITCODE = NO;\n"
        f"\t\t\t\tINFOPLIST_FILE = Runner/Info.plist;\n"
        f"\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (\n"
        f'\t\t\t\t\t"$(inherited)",\n'
        f'\t\t\t\t\t"@executable_path/Frameworks",\n'
        f"\t\t\t\t);\n"
        f"\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = {bundle_id};\n"
        f'\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";\n'
        f'\t\t\t\tSWIFT_OBJC_BRIDGING_HEADER = "Runner/Runner-Bridging-Header.h";\n'
        f"{swift_opt}"
        f"\t\t\t\tSWIFT_VERSION = 5.0;\n"
        f'\t\t\t\tVERSIONING_SYSTEM = "apple-generic";\n'
        f"\t\t\t}};\n"
        f'\t\t\tname = "{name}";\n'
        f"\t\t}};"
    )


def tests_config(uuid: str, flavor: str, build_type: str) -> str:
    """RunnerTests target XCBuildConfiguration 생성"""
    name = f"{build_type}-{flavor}"

    swift_extra = ""
    if build_type == "Debug":
        swift_extra = (
            "\t\t\t\tSWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;\n"
            '\t\t\t\tSWIFT_OPTIMIZATION_LEVEL = "-Onone";\n'
        )

    return (
        f"\t\t{uuid} /* {name} */ = {{\n"
        f"\t\t\tisa = XCBuildConfiguration;\n"
        f"\t\t\tbuildSettings = {{\n"
        f'\t\t\t\tBUNDLE_LOADER = "$(TEST_HOST)";\n'
        f"\t\t\t\tCODE_SIGN_STYLE = Automatic;\n"
        f"\t\t\t\tCURRENT_PROJECT_VERSION = 1;\n"
        f"\t\t\t\tGENERATE_INFOPLIST_FILE = YES;\n"
        f"\t\t\t\tMARKETING_VERSION = 1.0;\n"
        f'\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = "$(PRODUCT_BUNDLE_IDENTIFIER).RunnerTests";\n'
        f'\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";\n'
        f"{swift_extra}"
        f"\t\t\t\tSWIFT_VERSION = 5.0;\n"
        f'\t\t\t\tTEST_HOST = "$(BUILT_PRODUCTS_DIR)/Runner.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/Runner";\n'
        f"\t\t\t}};\n"
        f'\t\t\tname = "{name}";\n'
        f"\t\t}};"
    )


# ---------------------------------------------------------------------------
# XCConfigurationList 생성
# ---------------------------------------------------------------------------


def config_list(uuid: str, target_name: str, target_type: str, context: str) -> str:
    """XCConfigurationList 항목 생성"""
    lines = [
        f'\t\t{uuid} /* Build configuration list for {target_type} "{target_name}" */ = {{',
        f"\t\t\tisa = XCConfigurationList;",
        f"\t\t\tbuildConfigurations = (",
    ]

    # Debug 4개, Release 4개, Profile 4개
    for build_type in ("Debug", "Release", "Profile"):
        bt_lower = build_type.lower()
        for flavor_cfg in FLAVORS:
            flavor = flavor_cfg["name"]
            uid = FLAVOR_UUIDS[flavor][context][bt_lower]
            lines.append(f"\t\t\t\t{uid} /* {build_type}-{flavor} */,")

    lines.extend(
        [
            f"\t\t\t);",
            f"\t\t\tdefaultConfigurationIsVisible = 0;",
            f'\t\t\tdefaultConfigurationName = "Release-production";',
            f"\t\t}};",
        ]
    )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 메인 생성 함수
# ---------------------------------------------------------------------------


def generate_pbxproj(app_name: str, package_name: str, existing_content: str) -> str:
    """project.pbxproj 전체 생성"""
    scheme = app_name.lower()
    team_id = extract_team_id(existing_content)
    header = extract_header(existing_content)

    # XCBuildConfiguration 섹션 생성
    configs = [BEGIN_BUILD_CONFIG]

    for flavor_cfg in FLAVORS:
        flavor = flavor_cfg["name"]
        display_name = app_name + flavor_cfg["display_suffix"]
        url_scheme = scheme + flavor_cfg["url_scheme_suffix"]
        bundle_id = package_name + flavor_cfg["bundle_id_suffix"]
        uuids = FLAVOR_UUIDS[flavor]

        for build_type in ("Debug", "Release", "Profile"):
            bt_lower = build_type.lower()

            # Project-level config
            configs.append(
                project_config(uuids["project"][bt_lower], flavor, build_type)
            )
            # Runner target config
            configs.append(
                runner_config(
                    uuids["runner"][bt_lower],
                    flavor,
                    build_type,
                    display_name,
                    url_scheme,
                    bundle_id,
                    team_id,
                )
            )
            # RunnerTests target config
            configs.append(tests_config(uuids["tests"][bt_lower], flavor, build_type))

    configs.append(END_BUILD_CONFIG)

    # XCConfigurationList 섹션 생성
    config_lists = [
        "",
        BEGIN_CONFIG_LIST,
        config_list(CONFIG_LIST_TESTS, "RunnerTests", "PBXNativeTarget", "tests"),
        config_list(CONFIG_LIST_PROJECT, "Runner", "PBXProject", "project"),
        config_list(CONFIG_LIST_RUNNER, "Runner", "PBXNativeTarget", "runner"),
        END_CONFIG_LIST,
    ]

    # Footer
    footer = (
        "\t};\n" "\trootObject = 97C146E61CF9000F007C117D /* Project object */;\n" "}\n"
    )

    return header + "\n".join(configs) + "\n".join(config_lists) + "\n" + footer


def main():
    if len(sys.argv) < 4:
        print(
            "Usage: flutter_ios_pbxproj_template.py"
            " <AppName> <package_name> <existing_pbxproj_path>",
            file=sys.stderr,
        )
        print(
            "Example: flutter_ios_pbxproj_template.py"
            " MyApp com.example.myapp"
            " app/ios/Runner.xcodeproj/project.pbxproj",
            file=sys.stderr,
        )
        sys.exit(1)

    app_name = sys.argv[1]
    package_name = sys.argv[2]
    existing_path = sys.argv[3]

    with open(existing_path, "r") as f:
        existing_content = f.read()

    result = generate_pbxproj(app_name, package_name, existing_content)
    print(result.rstrip("\n"))


if __name__ == "__main__":
    main()
