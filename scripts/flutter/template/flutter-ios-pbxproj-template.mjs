#!/usr/bin/env node
// Flutter iOS project.pbxproj 템플릿 생성 스크립트
//
// flutter create 직후의 clean project.pbxproj를 읽어서
// 4개 flavor (production/development/staging/qa) × 3개 빌드 타입 (Debug/Release/Profile)
// = 12개 빌드 설정으로 확장합니다.
//
// 기존 파일의 헤더 섹션(PBXBuildFile ~ PBXVariantGroup)은 그대로 보존하고,
// XCBuildConfiguration과 XCConfigurationList 섹션만 재생성합니다.

import fs from 'node:fs';
import process from 'node:process';

// ---------------------------------------------------------------------------
// Flavor 설정
// ---------------------------------------------------------------------------
const FLAVORS = [
  {
    name: 'production',
    display_suffix: '',
    url_scheme_suffix: '',
    bundle_id_suffix: '',
  },
  {
    name: 'development',
    display_suffix: ' (dev)',
    url_scheme_suffix: '-dev',
    bundle_id_suffix: '.dev',
  },
  {
    name: 'staging',
    display_suffix: ' (stg)',
    url_scheme_suffix: '-stg',
    bundle_id_suffix: '.stg',
  },
  {
    name: 'qa',
    display_suffix: ' (qa)',
    url_scheme_suffix: '-test',
    bundle_id_suffix: '.test',
  },
];

// ---------------------------------------------------------------------------
// UUID 매핑
// production: Flutter 기본 UUID 재사용
// development/staging/qa: 고정 UUID (24자 hex)
// ---------------------------------------------------------------------------
const FLAVOR_UUIDS = {
  production: {
    project: {
      debug: '97C147031CF9000F007C117D',
      release: '97C147041CF9000F007C117D',
      profile: '249021D3217E4FDB00AE95B9',
    },
    runner: {
      debug: '97C147061CF9000F007C117D',
      release: '97C147071CF9000F007C117D',
      profile: '249021D4217E4FDB00AE95B9',
    },
    tests: {
      debug: '331C8088294A63A400263BE5',
      release: '331C8089294A63A400263BE5',
      profile: '331C808A294A63A400263BE5',
    },
  },
  development: {
    project: {
      debug: 'F1A000010000000000000001',
      release: 'F1A000020000000000000001',
      profile: 'F1A000030000000000000001',
    },
    runner: {
      debug: 'F1A000040000000000000001',
      release: 'F1A000050000000000000001',
      profile: 'F1A000060000000000000001',
    },
    tests: {
      debug: 'F1A000070000000000000001',
      release: 'F1A000080000000000000001',
      profile: 'F1A000090000000000000001',
    },
  },
  staging: {
    project: {
      debug: 'F1B000010000000000000001',
      release: 'F1B000020000000000000001',
      profile: 'F1B000030000000000000001',
    },
    runner: {
      debug: 'F1B000040000000000000001',
      release: 'F1B000050000000000000001',
      profile: 'F1B000060000000000000001',
    },
    tests: {
      debug: 'F1B000070000000000000001',
      release: 'F1B000080000000000000001',
      profile: 'F1B000090000000000000001',
    },
  },
  qa: {
    project: {
      debug: 'F1C000010000000000000001',
      release: 'F1C000020000000000000001',
      profile: 'F1C000030000000000000001',
    },
    runner: {
      debug: 'F1C000040000000000000001',
      release: 'F1C000050000000000000001',
      profile: 'F1C000060000000000000001',
    },
    tests: {
      debug: 'F1C000070000000000000001',
      release: 'F1C000080000000000000001',
      profile: 'F1C000090000000000000001',
    },
  },
};

// Flutter 템플릿 고정 UUID (xcconfig 파일 참조)
const DEBUG_XCCONFIG_REF = '9740EEB21CF90195004384FC';
const RELEASE_XCCONFIG_REF = '7AFA3C8E1D35360C0083082E';

// XCConfigurationList UUID (Flutter 템플릿 고정)
const CONFIG_LIST_PROJECT = '97C146E91CF9000F007C117D';
const CONFIG_LIST_RUNNER = '97C147051CF9000F007C117D';
const CONFIG_LIST_TESTS = '331C8087294A63A400263BE5';

// 섹션 마커
const BEGIN_BUILD_CONFIG = '/* Begin XCBuildConfiguration section */';
const END_BUILD_CONFIG = '/* End XCBuildConfiguration section */';
const BEGIN_CONFIG_LIST = '/* Begin XCConfigurationList section */';
const END_CONFIG_LIST = '/* End XCConfigurationList section */';

// ---------------------------------------------------------------------------
// Project-level 빌드 설정 (상수 - 모든 flavor에서 동일)
// ---------------------------------------------------------------------------
const PROJECT_DEBUG_SETTINGS = `\t\t\t\tALWAYS_SEARCH_USER_PATHS = NO;
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
\t\t\t\tTARGETED_DEVICE_FAMILY = "1,2";`;

const PROJECT_RELEASE_SETTINGS = `\t\t\t\tALWAYS_SEARCH_USER_PATHS = NO;
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
\t\t\t\tVALIDATE_PRODUCT = YES;`;

// ---------------------------------------------------------------------------
// 헬퍼 함수
// ---------------------------------------------------------------------------

function pbxQuote(value) {
  if (!value || value.includes(' ') || value.includes('-') || value.includes('(') || value.includes(')')) {
    return `"${value}"`;
  }
  return value;
}

function extractTeamId(content) {
  const match = content.match(/DEVELOPMENT_TEAM\s*=\s*(\S+?);/);
  if (match) {
    return match[1].replace(/^"|"$/g, '');
  }
  return '';
}

function extractHeader(content) {
  const idx = content.indexOf(BEGIN_BUILD_CONFIG);
  if (idx === -1) {
    process.stderr.write('Error: XCBuildConfiguration section not found\n');
    process.exit(1);
  }
  return content.slice(0, idx);
}

// ---------------------------------------------------------------------------
// XCBuildConfiguration 생성
// ---------------------------------------------------------------------------

function projectConfig(uuid, flavor, buildType) {
  const name = `${buildType}-${flavor}`;
  const settings = buildType === 'Debug' ? PROJECT_DEBUG_SETTINGS : PROJECT_RELEASE_SETTINGS;

  return (
    `\t\t${uuid} /* ${name} */ = {\n` +
    `\t\t\tisa = XCBuildConfiguration;\n` +
    `\t\t\tbuildSettings = {\n` +
    `${settings}\n` +
    `\t\t\t};\n` +
    `\t\t\tname = "${name}";\n` +
    `\t\t};`
  );
}

function runnerConfig(uuid, flavor, buildType, displayName, urlScheme, bundleId, teamId) {
  const name = `${buildType}-${flavor}`;

  let xcconfigRef;
  let xcconfigName;
  if (buildType === 'Debug') {
    xcconfigRef = DEBUG_XCCONFIG_REF;
    xcconfigName = 'Debug.xcconfig';
  } else {
    xcconfigRef = RELEASE_XCCONFIG_REF;
    xcconfigName = 'Release.xcconfig';
  }

  let swiftOpt = '';
  if (buildType === 'Debug') {
    swiftOpt = '\t\t\t\tSWIFT_OPTIMIZATION_LEVEL = "-Onone";\n';
  }

  return (
    `\t\t${uuid} /* ${name} */ = {\n` +
    `\t\t\tisa = XCBuildConfiguration;\n` +
    `\t\t\tbaseConfigurationReference = ${xcconfigRef} /* ${xcconfigName} */;\n` +
    `\t\t\tbuildSettings = {\n` +
    `\t\t\t\tAPP_DISPLAY_NAME = ${pbxQuote(displayName)};\n` +
    `\t\t\t\tAPP_URL_SCHEMES = ${pbxQuote(urlScheme)};\n` +
    `\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;\n` +
    `\t\t\t\tCLANG_ENABLE_MODULES = YES;\n` +
    `\t\t\t\tCURRENT_PROJECT_VERSION = "$(FLUTTER_BUILD_NUMBER)";\n` +
    `\t\t\t\tDEVELOPMENT_TEAM = ${teamId};\n` +
    `\t\t\t\tENABLE_BITCODE = NO;\n` +
    `\t\t\t\tINFOPLIST_FILE = Runner/Info.plist;\n` +
    `\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (\n` +
    `\t\t\t\t\t"$(inherited)",\n` +
    `\t\t\t\t\t"@executable_path/Frameworks",\n` +
    `\t\t\t\t);\n` +
    `\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = ${bundleId};\n` +
    `\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";\n` +
    `\t\t\t\tSWIFT_OBJC_BRIDGING_HEADER = "Runner/Runner-Bridging-Header.h";\n` +
    `${swiftOpt}` +
    `\t\t\t\tSWIFT_VERSION = 5.0;\n` +
    `\t\t\t\tVERSIONING_SYSTEM = "apple-generic";\n` +
    `\t\t\t};\n` +
    `\t\t\tname = "${name}";\n` +
    `\t\t};`
  );
}

function testsConfig(uuid, flavor, buildType) {
  const name = `${buildType}-${flavor}`;

  let swiftExtra = '';
  if (buildType === 'Debug') {
    swiftExtra =
      '\t\t\t\tSWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;\n' +
      '\t\t\t\tSWIFT_OPTIMIZATION_LEVEL = "-Onone";\n';
  }

  return (
    `\t\t${uuid} /* ${name} */ = {\n` +
    `\t\t\tisa = XCBuildConfiguration;\n` +
    `\t\t\tbuildSettings = {\n` +
    `\t\t\t\tBUNDLE_LOADER = "$(TEST_HOST)";\n` +
    `\t\t\t\tCODE_SIGN_STYLE = Automatic;\n` +
    `\t\t\t\tCURRENT_PROJECT_VERSION = 1;\n` +
    `\t\t\t\tGENERATE_INFOPLIST_FILE = YES;\n` +
    `\t\t\t\tMARKETING_VERSION = 1.0;\n` +
    `\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = "$(PRODUCT_BUNDLE_IDENTIFIER).RunnerTests";\n` +
    `\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";\n` +
    `${swiftExtra}` +
    `\t\t\t\tSWIFT_VERSION = 5.0;\n` +
    `\t\t\t\tTEST_HOST = "$(BUILT_PRODUCTS_DIR)/Runner.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/Runner";\n` +
    `\t\t\t};\n` +
    `\t\t\tname = "${name}";\n` +
    `\t\t};`
  );
}

// ---------------------------------------------------------------------------
// XCConfigurationList 생성
// ---------------------------------------------------------------------------

function configList(uuid, targetName, targetType, context) {
  const lines = [
    `\t\t${uuid} /* Build configuration list for ${targetType} "${targetName}" */ = {`,
    `\t\t\tisa = XCConfigurationList;`,
    `\t\t\tbuildConfigurations = (`,
  ];

  for (const buildType of ['Debug', 'Release', 'Profile']) {
    const btLower = buildType.toLowerCase();
    for (const flavorCfg of FLAVORS) {
      const flavor = flavorCfg.name;
      const uid = FLAVOR_UUIDS[flavor][context][btLower];
      lines.push(`\t\t\t\t${uid} /* ${buildType}-${flavor} */,`);
    }
  }

  lines.push(
    `\t\t\t);`,
    `\t\t\tdefaultConfigurationIsVisible = 0;`,
    `\t\t\tdefaultConfigurationName = "Release-production";`,
    `\t\t};`,
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 메인 생성 함수
// ---------------------------------------------------------------------------

function generatePbxproj(appName, packageName, existingContent) {
  const scheme = appName.toLowerCase();
  const teamId = extractTeamId(existingContent);
  const header = extractHeader(existingContent);

  const configs = [BEGIN_BUILD_CONFIG];

  for (const flavorCfg of FLAVORS) {
    const flavor = flavorCfg.name;
    const displayName = appName + flavorCfg.display_suffix;
    const urlScheme = scheme + flavorCfg.url_scheme_suffix;
    const bundleId = packageName + flavorCfg.bundle_id_suffix;
    const uuids = FLAVOR_UUIDS[flavor];

    for (const buildType of ['Debug', 'Release', 'Profile']) {
      const btLower = buildType.toLowerCase();

      configs.push(projectConfig(uuids.project[btLower], flavor, buildType));
      configs.push(
        runnerConfig(
          uuids.runner[btLower],
          flavor,
          buildType,
          displayName,
          urlScheme,
          bundleId,
          teamId,
        ),
      );
      configs.push(testsConfig(uuids.tests[btLower], flavor, buildType));
    }
  }

  configs.push(END_BUILD_CONFIG);

  const configLists = [
    '',
    BEGIN_CONFIG_LIST,
    configList(CONFIG_LIST_TESTS, 'RunnerTests', 'PBXNativeTarget', 'tests'),
    configList(CONFIG_LIST_PROJECT, 'Runner', 'PBXProject', 'project'),
    configList(CONFIG_LIST_RUNNER, 'Runner', 'PBXNativeTarget', 'runner'),
    END_CONFIG_LIST,
  ];

  const footer = '\t};\n\trootObject = 97C146E61CF9000F007C117D /* Project object */;\n}\n';

  return header + configs.join('\n') + configLists.join('\n') + '\n' + footer;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 3) {
    process.stderr.write(
      'Usage: flutter-ios-pbxproj-template.mjs <AppName> <package_name> <existing_pbxproj_path>\n',
    );
    process.stderr.write(
      'Example: flutter-ios-pbxproj-template.mjs MyApp com.example.myapp app/ios/Runner.xcodeproj/project.pbxproj\n',
    );
    process.exit(1);
  }

  const appName = argv[0];
  const packageName = argv[1];
  const existingPath = argv[2];

  const existingContent = fs.readFileSync(existingPath, 'utf8');
  const result = generatePbxproj(appName, packageName, existingContent);
  console.log(result.replace(/\n+$/, ''));
}

main();
