plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.shadow)
    alias(libs.plugins.ktlint)
    alias(libs.plugins.detekt)
    application
}

group = "com.prizedraw"
version = "0.1.0"

application {
    mainClass.set("com.prizedraw.notification.ApplicationKt")
}

kotlin {
    jvmToolchain(21)
    explicitApi()
}

dependencies {
    // Shared infrastructure: HealthCheck plugin, CircuitBreakers, JwtVerifier,
    // EnvironmentConfig, db-schema table definitions, api-contracts DTOs/enums,
    // Ktor server core + client, Micrometer, and Resilience4j transitively.
    implementation(project(":shared"))

    // Minimal Ktor CIO server for health/metrics only — no Netty needed here.
    implementation(libs.ktor.server.core)
    implementation(libs.ktor.server.cio)
    implementation(libs.ktor.server.metrics.micrometer)

    // Koin DI (standalone — no ktor-koin integration needed, workers start outside Ktor)
    implementation(libs.koin.core)
    implementation(libs.koin.logger.slf4j)

    // KotlinX
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.datetime)
    implementation(libs.kotlinx.coroutines.core)

    // Database — HikariCP + Exposed ORM (Flyway intentionally excluded; Core API owns migrations)
    implementation(libs.hikaricp)
    implementation(libs.postgresql)
    implementation(libs.exposed.core)
    implementation(libs.exposed.jdbc)
    implementation(libs.exposed.json)
    implementation(libs.exposed.kotlin.datetime)

    // Redis pub/sub via Lettuce
    implementation(libs.lettuce.core)

    // Firebase Admin SDK — FCM push notifications
    implementation(libs.firebase.admin)

    // Logging
    implementation(libs.logback.classic)

    // Testing
    testImplementation(libs.kotest.runner.junit5)
    testImplementation(libs.kotest.assertions.core)
    testImplementation(libs.mockk)
    testImplementation(libs.ktor.server.test.host)
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
    jvmArgs("-XX:+EnableDynamicAgentLoading")
}

tasks.shadowJar {
    archiveBaseName.set("notification-worker")
    archiveClassifier.set("")
    archiveVersion.set(version.toString())
    mergeServiceFiles()
    // Prevent implicit dependency conflicts between shadowJar and the application
    // distribution tasks (distTar, distZip, startScripts) produced by the application plugin.
    dependsOn(tasks.distTar, tasks.distZip)
}
