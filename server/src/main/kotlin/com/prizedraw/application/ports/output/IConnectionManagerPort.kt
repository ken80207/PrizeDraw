package com.prizedraw.application.ports.output

/**
 * Output port marker interface for the WebSocket connection manager.
 *
 * Provides a Koin-bindable interface for [com.prizedraw.infrastructure.websocket.ConnectionManager]
 * so routes and services can resolve it through the dependency injection container.
 */
public interface IConnectionManagerPort
