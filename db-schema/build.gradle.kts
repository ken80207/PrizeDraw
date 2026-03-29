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
}

dependencies {
    // api-contracts provides shared enums (CampaignStatus, PrizeState, etc.) used in table column
    // definitions. Exposed via `api()` so consumers transitively receive the contract types.
    api(project(":api-contracts"))

    // Exposed ORM — all artefacts exported via `api()` so consumers can reference Table subclasses,
    // Column<T>, and the kotlinx-datetime integration without re-declaring these dependencies.
    api(libs.exposed.core)
    api(libs.exposed.dao)
    api(libs.exposed.jdbc)
    api(libs.exposed.json)
    api(libs.exposed.kotlin.datetime)

    // KotlinX — datetime is used in column definitions; serialization for jsonb helpers.
    api(libs.kotlinx.datetime)
    api(libs.kotlinx.serialization.json)

    // PostgreSQL JDBC driver required at compile time for PGobject used in pgEnum extension.
    implementation(libs.postgresql)
}
