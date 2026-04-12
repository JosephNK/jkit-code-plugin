#!/usr/bin/env python3
"""Flutter iOS xcscheme 템플릿 생성 스크립트

flavor별 xcscheme 파일을 생성합니다.
기본 Runner.xcscheme의 buildConfiguration 값을 flavor에 맞게 변경합니다.

사용법:
    python flutter_ios_xcscheme_template.py <flavor>

예시:
    python flutter_ios_xcscheme_template.py production
    python flutter_ios_xcscheme_template.py development
"""

import sys

# Flutter 템플릿 고정 UUID (모든 flutter create 프로젝트에서 동일)
RUNNER_BLUEPRINT_ID = "97C146ED1CF9000F007C117D"
RUNNER_TESTS_BLUEPRINT_ID = "331C8080294A63A400263BE5"

VALID_FLAVORS = ("production", "development", "staging", "qa")


def generate_xcscheme(flavor: str) -> str:
    """flavor별 xcscheme XML 생성

    Args:
        flavor: 빌드 flavor (production, development, staging, qa)
    """
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Scheme
   LastUpgradeVersion = "1510"
   version = "1.3">
   <BuildAction
      parallelizeBuildables = "YES"
      buildImplicitDependencies = "YES">
      <BuildActionEntries>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{RUNNER_BLUEPRINT_ID}"
               BuildableName = "Runner.app"
               BlueprintName = "Runner"
               ReferencedContainer = "container:Runner.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction
      buildConfiguration = "Debug-{flavor}"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      customLLDBInitFile = "$(SRCROOT)/Flutter/ephemeral/flutter_lldbinit"
      shouldUseLaunchSchemeArgsEnv = "YES">
      <MacroExpansion>
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "{RUNNER_BLUEPRINT_ID}"
            BuildableName = "Runner.app"
            BlueprintName = "Runner"
            ReferencedContainer = "container:Runner.xcodeproj">
         </BuildableReference>
      </MacroExpansion>
      <Testables>
         <TestableReference
            skipped = "NO"
            parallelizable = "YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{RUNNER_TESTS_BLUEPRINT_ID}"
               BuildableName = "RunnerTests.xctest"
               BlueprintName = "RunnerTests"
               ReferencedContainer = "container:Runner.xcodeproj">
            </BuildableReference>
         </TestableReference>
      </Testables>
   </TestAction>
   <LaunchAction
      buildConfiguration = "Debug-{flavor}"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      customLLDBInitFile = "$(SRCROOT)/Flutter/ephemeral/flutter_lldbinit"
      launchStyle = "0"
      useCustomWorkingDirectory = "NO"
      ignoresPersistentStateOnLaunch = "NO"
      debugDocumentVersioning = "YES"
      debugServiceExtension = "internal"
      enableGPUValidationMode = "1"
      allowLocationSimulation = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "{RUNNER_BLUEPRINT_ID}"
            BuildableName = "Runner.app"
            BlueprintName = "Runner"
            ReferencedContainer = "container:Runner.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction
      buildConfiguration = "Profile-{flavor}"
      shouldUseLaunchSchemeArgsEnv = "YES"
      savedToolIdentifier = ""
      useCustomWorkingDirectory = "NO"
      debugDocumentVersioning = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "{RUNNER_BLUEPRINT_ID}"
            BuildableName = "Runner.app"
            BlueprintName = "Runner"
            ReferencedContainer = "container:Runner.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction
      buildConfiguration = "Debug-{flavor}">
   </AnalyzeAction>
   <ArchiveAction
      buildConfiguration = "Release-{flavor}"
      revealArchiveInOrganizer = "YES">
   </ArchiveAction>
</Scheme>"""


def main():
    if len(sys.argv) < 2:
        print(
            "Usage: flutter_ios_xcscheme_template.py <flavor>",
            file=sys.stderr,
        )
        print(
            f"  flavor: {', '.join(VALID_FLAVORS)}",
            file=sys.stderr,
        )
        sys.exit(1)

    flavor = sys.argv[1]
    if flavor not in VALID_FLAVORS:
        print(
            f"Error: Invalid flavor '{flavor}'. "
            f"Must be one of: {', '.join(VALID_FLAVORS)}",
            file=sys.stderr,
        )
        sys.exit(1)

    print(generate_xcscheme(flavor))


if __name__ == "__main__":
    main()
