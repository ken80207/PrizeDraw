@file:Suppress("MagicNumber")

package com.prizedraw.infrastructure.di

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import io.ktor.server.config.ApplicationConfig
import org.flywaydb.core.Flyway
import org.jetbrains.exposed.sql.Database
import org.koin.dsl.module
import javax.sql.DataSource

/**
 * Koin module providing HikariCP [DataSource], Flyway migration, and Exposed [Database].
 *
 * Configuration is read from `application.conf` under the `database` key:
 * ```hocon
 * database {
 *   url      = "jdbc:postgresql://localhost:5432/prizedraw"
 *   username = "prizedraw"
 *   password = "secret"
 *   poolSize = 20
 * }
 * ```
 *
 * Flyway migrations are applied automatically at startup from `db/migration/`.
 */
public fun databaseModule(config: ApplicationConfig) =
    module {
        single<DataSource> {
            val url = config.property("database.url").getString()
            // Support both "username" and "user" config keys for compatibility
            val username =
                config.propertyOrNull("database.username")?.getString()
                    ?: config.property("database.user").getString()
            val password = config.property("database.password").getString()
            val poolSize = config.propertyOrNull("database.poolSize")?.getString()?.toInt() ?: 20

            val hikariConfig =
                HikariConfig().apply {
                    jdbcUrl = url
                    this.username = username
                    this.password = password
                    driverClassName = "org.postgresql.Driver"
                    maximumPoolSize = poolSize
                    minimumIdle = 2
                    idleTimeout = 30_000
                    connectionTimeout = 10_000
                    maxLifetime = 1_800_000
                    isAutoCommit = false
                    transactionIsolation = "TRANSACTION_READ_COMMITTED"
                    poolName = "PrizeDrawPool"
                }
            HikariDataSource(hikariConfig)
        }

        single<Database> {
            val dataSource = get<DataSource>()

            // Run Flyway migrations before Exposed connects
            Flyway
                .configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .baselineOnMigrate(false)
                .validateOnMigrate(true)
                .load()
                .migrate()

            Database.connect(dataSource)
        }
    }
