plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.kotlin.serialization)
}

kotlin {
    explicitApi()

    // JVM — consumed by :server
    jvm()

    // JS — consumed by web game room engine
    js(IR) {
        browser()
        binaries.library()
    }

    @Suppress("UnusedPrivateProperty")
    sourceSets {
        commonMain.dependencies {
            api(project(":api-contracts"))
            implementation(libs.kotlinx.serialization.json)
            implementation(libs.kotlinx.datetime)
        }
        commonTest.dependencies {
            implementation(kotlin("test"))
            implementation(libs.kotest.assertions.core)
        }
        jvmTest.dependencies {
            implementation(libs.kotest.runner.junit5)
            implementation(libs.kotest.property)
        }
    }
}

tasks.named<Test>("jvmTest") {
    useJUnitPlatform()
}
