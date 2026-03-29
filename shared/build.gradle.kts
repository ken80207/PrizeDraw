plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ktlint)
    alias(libs.plugins.detekt)
}

group = "com.prizedraw"
version = "0.1.0"

kotlin {
    jvmToolchain(21)
    explicitApi()
}

dependencies {
    // db-schema — shared module consumers get all table definitions and Exposed transitively.
    api(project(":db-schema"))

    // Ktor server core — HealthCheck plugin installs Ktor routes; exported so consumers can
    // call Application extension functions without re-declaring this dependency.
    api(libs.ktor.server.core)

    // Ktor client — used by shared HTTP utilities; exported for consumers that call out to
    // other services.
    api(libs.ktor.client.core)
    api(libs.ktor.client.cio)
    api(libs.ktor.client.content.negotiation)
    api(libs.ktor.serialization.kotlinx.json)

    // Micrometer — HealthCheck plugin writes readiness gauges; exported so per-service modules
    // can register custom metrics without re-declaring the dependency.
    api(libs.micrometer.registry.prometheus)

    // Resilience4j — CircuitBreakers factory is part of the shared API surface.
    api(libs.resilience4j.circuitbreaker)
    api(libs.resilience4j.kotlin)

    // Nimbus JOSE+JWT — JwtVerifier exposes JWT claim types in its API.
    api(libs.nimbus.jose.jwt)

    // Logback — runtime logging backend; implementation scope is sufficient as consumers
    // interact with SLF4J API only.
    implementation(libs.logback.classic)

    // Testing
    testImplementation(libs.kotest.runner.junit5)
    testImplementation(libs.kotest.assertions.core)
    testImplementation(libs.ktor.server.test.host)
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
    jvmArgs("-XX:+EnableDynamicAgentLoading")
}
