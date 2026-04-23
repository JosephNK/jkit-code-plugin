#!/usr/bin/env node
// Flutter Android build.gradle.kts 템플릿 생성 스크립트

import process from 'node:process';

function toScheme(appName) {
  return appName.toLowerCase();
}

function generateBuildGradle(appName, packageName) {
  const scheme = toScheme(appName);

  return `plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}
android {
    namespace = "${packageName}"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "${packageName}"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        manifestPlaceholders["scheme"] = "${scheme}"
    }

    signingConfigs {
        getByName("debug") {
            keyAlias = keystoreProperties["debug_keyAlias"] as String
            keyPassword = keystoreProperties["debug_keyPassword"] as String
            storeFile = keystoreProperties["debug_storeFile"]?.let { file(it) }
            storePassword = keystoreProperties["debug_storePassword"] as String
        }
        create("release") {
            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["keyPassword"] as String
            storeFile = keystoreProperties["storeFile"]?.let { file(it) }
            storePassword = keystoreProperties["storePassword"] as String
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            proguardFiles (getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName("debug")
        }
        release {
            isMinifyEnabled = false
            isShrinkResources = false
            proguardFiles (getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName("release")
        }
    }

    flavorDimensions += "build-type"

    productFlavors {
        create("production") {
            dimension = "build-type"
            resValue(type = "string", name = "app_name", value = "${appName}")
            applicationIdSuffix = ""
            manifestPlaceholders["scheme"] = "${scheme}"
        }
        create("staging") {
            dimension = "build-type"
            resValue(type = "string", name = "app_name", value = "${appName} (stg)")
            applicationIdSuffix = ".stg"
            manifestPlaceholders["scheme"] = "${scheme}-stg"
        }
        create("development") {
            dimension = "build-type"
            resValue(type = "string", name = "app_name", value = "${appName} (dev)")
            applicationIdSuffix = ".dev"
            manifestPlaceholders["scheme"] = "${scheme}-dev"
        }
        create("qa") {
            dimension = "build-type"
            resValue(type = "string", name = "app_name", value = "${appName} (qa)")
            applicationIdSuffix = ".test"
            manifestPlaceholders["scheme"] = "${scheme}-test"
        }
    }
}

flutter {
    source = "../.."
}`;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 2) {
    process.stderr.write('Usage: flutter-android-build-gradle-template.mjs <AppName> <package_name>\n');
    process.stderr.write('Example: flutter-android-build-gradle-template.mjs MyApp com.example.myapp\n');
    process.exit(1);
  }

  const appName = argv[0];
  const packageName = argv[1];
  console.log(generateBuildGradle(appName, packageName));
}

main();
