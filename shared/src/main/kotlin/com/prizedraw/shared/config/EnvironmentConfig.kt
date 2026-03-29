package com.prizedraw.shared.config

/** Application environment, resolved from the `APP_ENV` environment variable. */
public enum class Environment { DEV, STAGING, PROD }

/** Provides the current runtime environment. */
public object EnvironmentConfig {
    /** The current environment, defaulting to [Environment.DEV]. */
    public val current: Environment by lazy {
        when (System.getenv("APP_ENV")?.uppercase()) {
            "STAGING" -> Environment.STAGING
            "PROD", "PRODUCTION" -> Environment.PROD
            else -> Environment.DEV
        }
    }

    /** Returns `true` when running in [Environment.DEV]. */
    public val isDev: Boolean get() = current == Environment.DEV

    /** Returns `true` when running in [Environment.STAGING]. */
    public val isStaging: Boolean get() = current == Environment.STAGING

    /** Returns `true` when running in [Environment.PROD]. */
    public val isProd: Boolean get() = current == Environment.PROD
}
