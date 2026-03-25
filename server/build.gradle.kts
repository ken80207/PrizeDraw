plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.shadow)
    application
}

group = "com.prizedraw"
version = "0.1.0"

application {
    mainClass.set("io.ktor.server.netty.EngineMain")
}

kotlin {
    // Target JVM 21 in production (Docker uses Eclipse Temurin 21).
    // For local dev with JDK 17, override via JAVA_HOME or toolchain resolver.
    jvmToolchain(21)
}

dependencies {
    implementation(project(":api-contracts"))

    // Ktor Server
    implementation(libs.ktor.server.core)
    implementation(libs.ktor.server.netty)
    implementation(libs.ktor.server.content.negotiation)
    implementation(libs.ktor.serialization.kotlinx.json)
    implementation(libs.ktor.server.auth)
    implementation(libs.ktor.server.auth.jwt)
    implementation(libs.ktor.server.websockets)
    implementation(libs.ktor.server.cors)
    implementation(libs.ktor.server.rate.limit)
    implementation(libs.ktor.server.request.validation)
    implementation(libs.ktor.server.status.pages)
    implementation(libs.ktor.server.call.logging)
    implementation(libs.ktor.server.compression)
    implementation(libs.ktor.server.caching.headers)

    // Exposed ORM
    implementation(libs.exposed.core)
    implementation(libs.exposed.dao)
    implementation(libs.exposed.jdbc)
    implementation(libs.exposed.json)
    implementation(libs.exposed.kotlin.datetime)

    // Koin DI
    implementation(libs.koin.ktor)
    implementation(libs.koin.logger.slf4j)

    // KotlinX
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.datetime)

    // Database
    implementation(libs.flyway.core)
    implementation(libs.flyway.database.postgresql)
    implementation(libs.hikaricp)
    implementation(libs.postgresql)

    // Redis
    implementation(libs.lettuce.core)

    // Auth
    implementation(libs.nimbus.jose.jwt)
    implementation(libs.bcrypt)

    // AWS S3
    implementation(libs.aws.s3)

    // Firebase Admin SDK
    implementation(libs.firebase.admin)

    // Monitoring
    implementation(libs.micrometer.registry.prometheus)
    implementation(libs.opentelemetry.api)

    // Logging
    implementation(libs.logback.classic)

    // Testing
    testImplementation(libs.kotest.runner.junit5)
    testImplementation(libs.kotest.assertions.core)
    testImplementation(libs.kotest.property)
    testImplementation(libs.ktor.server.test.host)
    testImplementation(libs.koin.core)
    testImplementation(libs.mockk)
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
    jvmArgs(
        "-XX:+EnableDynamicAgentLoading",
    )
}

tasks.shadowJar {
    archiveBaseName.set("prize-draw-server")
    archiveClassifier.set("")
    archiveVersion.set(version.toString())
    mergeServiceFiles()
}
