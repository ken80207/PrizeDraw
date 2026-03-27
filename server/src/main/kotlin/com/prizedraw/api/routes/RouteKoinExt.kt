package com.prizedraw.api.routes

import io.ktor.server.routing.Route
import io.ktor.server.routing.application
import org.koin.core.parameter.ParametersDefinition
import org.koin.core.qualifier.Qualifier
import org.koin.ktor.ext.getKoin

/**
 * Route-scoped [inject] that delegates to the **Application**-level Koin instance.
 *
 * koin-ktor 4.0.x has a bug where [Route.getKoin()] references the removed
 * `io.ktor.server.routing.RoutingKt` class (Ktor 2.x API). This extension
 * sidesteps the issue by going through [Application.getKoin()] instead.
 */
internal inline fun <reified T : Any> Route.inject(
    qualifier: Qualifier? = null,
    noinline parameters: ParametersDefinition? = null,
): Lazy<T> = lazy { application.getKoin().get(qualifier, parameters) }
