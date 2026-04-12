#!/usr/bin/env python3
"""Flutter Android build.gradle.kts 템플릿 생성 스크립트"""

import sys


def to_scheme(app_name: str) -> str:
    """PascalCase 앱 이름을 소문자 scheme으로 변환

    예: Vocabit -> vocabit, MyApp -> myapp
    """
    return app_name.lower()


def generate_build_gradle(app_name: str, package_name: str) -> str:
    """build.gradle.kts 템플릿 코드 생성

    Args:
        app_name: 앱 이름 (PascalCase, 예: MyApp)
        package_name: 패키지 이름 (예: com.example.myapp)
    """
    scheme = to_scheme(app_name)

    return f"""plugins {{
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}}

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {{
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}}
android {{
    namespace = "{package_name}"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {{
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }}

    kotlinOptions {{
        jvmTarget = JavaVersion.VERSION_17.toString()
    }}

    defaultConfig {{
        applicationId = "{package_name}"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        manifestPlaceholders["scheme"] = "{scheme}"
    }}

    signingConfigs {{
        getByName("debug") {{
            keyAlias = keystoreProperties["debug_keyAlias"] as String
            keyPassword = keystoreProperties["debug_keyPassword"] as String
            storeFile = keystoreProperties["debug_storeFile"]?.let {{ file(it) }}
            storePassword = keystoreProperties["debug_storePassword"] as String
        }}
        create("release") {{
            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["keyPassword"] as String
            storeFile = keystoreProperties["storeFile"]?.let {{ file(it) }}
            storePassword = keystoreProperties["storePassword"] as String
        }}
    }}

    buildTypes {{
        debug {{
            isMinifyEnabled = false
            proguardFiles (getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName("debug")
        }}
        release {{
            isMinifyEnabled = false
            isShrinkResources = false
            proguardFiles (getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName("release")
        }}
    }}

    flavorDimensions += "build-type"

    productFlavors {{
        create("production") {{
            dimension = "build-type"
            resValue(type = "string", name = "app_name", value = "{app_name}")
            applicationIdSuffix = ""
            manifestPlaceholders["scheme"] = "{scheme}"
        }}
        create("staging") {{
            dimension = "build-type"
            resValue(type = "string", name = "app_name", value = "{app_name} (stg)")
            applicationIdSuffix = ".stg"
            manifestPlaceholders["scheme"] = "{scheme}-stg"
        }}
        create("development") {{
            dimension = "build-type"
            resValue(type = "string", name = "app_name", value = "{app_name} (dev)")
            applicationIdSuffix = ".dev"
            manifestPlaceholders["scheme"] = "{scheme}-dev"
        }}
        create("qa") {{
            dimension = "build-type"
            resValue(type = "string", name = "app_name", value = "{app_name} (qa)")
            applicationIdSuffix = ".test"
            manifestPlaceholders["scheme"] = "{scheme}-test"
        }}
    }}
}}

flutter {{
    source = "../.."
}}"""


def main():
    if len(sys.argv) < 3:
        print(
            "Usage: flutter_android_build_gradle_template.py <AppName> <package_name>",
            file=sys.stderr,
        )
        print(
            "Example: flutter_android_build_gradle_template.py MyApp com.example.myapp",
            file=sys.stderr,
        )
        sys.exit(1)

    app_name = sys.argv[1]
    package_name = sys.argv[2]
    print(generate_build_gradle(app_name, package_name))


if __name__ == "__main__":
    main()
