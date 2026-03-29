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
    mainClass.set("com.prizedraw.realtime.ApplicationKt")
}

kotlin {
    jvmToolchain(21)
    explicitApi()
}

dependencies {
    // Shared infrastructure: HealthCheck plugin, JwtVerifier (LOCAL token verification),
    // CircuitBreakers, EnvironmentConfig, db-schema table definitions, api-contracts DTOs/enums,
    // Ktor server core + client, Micrometer, and Resilience4j transitively.
    implementation(project(":shared"))

    // Ktor server: CIO engine + WebSockets + JWT auth
    implementation(libs.ktor.server.cio)
    implementation(libs.ktor.server.websockets)
    implementation(libs.ktor.server.auth)
    implementation(libs.ktor.server.auth.jwt)
    implementation(libs.ktor.server.content.negotiation)
    implementation(libs.ktor.server.metrics.micrometer)

    // Ktor client CIO (for calling Core API and Draw Service)
    implementation(libs.ktor.client.cio)
    implementation(libs.ktor.client.content.negotiation)

    // Koin DI with Ktor integration
    implementation(libs.koin.ktor)
    implementation(libs.koin.logger.slf4j)

    // KotlinX
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.datetime)
    implementation(libs.kotlinx.coroutines.core)

    // Database — HikariCP + Exposed ORM (no Flyway; Core API owns migrations)
    implementation(libs.hikaricp)
    implementation(libs.postgresql)
    implementation(libs.exposed.core)
    implementation(libs.exposed.jdbc)
    implementation(libs.exposed.json)
    implementation(libs.exposed.kotlin.datetime)

    // Redis pub/sub via Lettuce
    implementation(libs.lettuce.core)

    // Logging
    implementation(libs.logback.classic)

    // Testing
    testImplementation(libs.kotest.runner.junit5)
    testImplementation(libs.kotest.assertions.core)
    testImplementation(libs.mockk)
    testImplementation(libs.ktor.server.test.host)
    testImplementation(libs.ktor.client.mock)
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
    jvmArgs("-XX:+EnableDynamicAgentLoading")
}

tasks.shadowJar {
    archiveBaseName.set("realtime-gateway")
    archiveClassifier.set("")
    archiveVersion.set(version.toString())
    mergeServiceFiles()
    // Prevent implicit dependency conflicts between shadowJar and the application
    // distribution tasks (distTar, distZip, startScripts) produced by the application plugin.
    dependsOn(tasks.distTar, tasks.distZip)
}
