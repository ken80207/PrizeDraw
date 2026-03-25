package com.prizedraw.api.plugins

import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.plugins.requestvalidation.RequestValidation
import io.ktor.server.plugins.requestvalidation.ValidationResult

/**
 * Installs Ktor [RequestValidation].
 *
 * Specific DTO validators are registered per route file via `validate<T> { ... }` blocks.
 * This plugin installation is the hook point; route-level validators are registered in
 * their respective route files when they call `install(RequestValidation)` on the route scope.
 *
 * A global no-op validator is registered here to satisfy the plugin requirement.
 */
public fun Application.configureRequestValidation() {
    install(RequestValidation) {
        // Route-specific validators are registered in their route files.
        // This block is intentionally empty — it activates the plugin globally.
        validate<Any> { ValidationResult.Valid }
    }
}
