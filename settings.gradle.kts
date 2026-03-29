rootProject.name = "prize-draw"

pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
        // JetBrains Compose Multiplatform 1.8.x is published here, not on Gradle Plugin Portal
        maven("https://maven.pkg.jetbrains.space/public/p/compose/dev")
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        // JetBrains Compose Multiplatform runtime artifacts (1.8.x)
        maven("https://maven.pkg.jetbrains.space/public/p/compose/dev")
    }
}

include(":api-contracts")
include(":kmp-game-shared")
include(":db-schema")
include(":shared")
include(":server")
include(":notification-worker")
include(":kmp-shared-js")

// Mobile modules require Android SDK and Kotlin Multiplatform toolchain.
// Skip gracefully when Android SDK is absent (e.g. pure CI server builds).
val androidSdkAvailable =
    System.getenv("ANDROID_HOME") != null ||
        File(System.getProperty("user.home"), "Library/Android/sdk").exists()

if (androidSdkAvailable) {
    include(":mobile:shared")
    include(":mobile:composeApp")
}
