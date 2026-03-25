plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.kotlin.serialization)
}

kotlin {
    js(IR) {
        browser {
            webpackTask {
                mainOutputFileName = "prizedraw-kmp.js"
            }
        }
        // Exports a library with a stable public API for web consumption.
        binaries.library()
    }

    @Suppress("UnusedPrivateProperty")
    sourceSets {
        commonMain.dependencies {
            implementation(project(":api-contracts"))
            implementation(libs.kotlinx.serialization.json)
            implementation(libs.kotlinx.datetime)
        }
        commonTest.dependencies {
            implementation(kotlin("test"))
        }
    }
}
