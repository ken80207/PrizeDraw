package com.prizedraw.infrastructure.di

import com.prizedraw.application.events.OutboxWorker
import com.prizedraw.application.ports.output.ILineMessagingService
import com.prizedraw.application.ports.output.INotificationRepository
import com.prizedraw.application.ports.output.INotificationService
import com.prizedraw.application.ports.output.IOAuthTokenValidator
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPaymentGateway
import com.prizedraw.application.ports.output.IPlayerDeviceRepository
import com.prizedraw.application.ports.output.ISmsService
import com.prizedraw.application.ports.output.IStorageService
import com.prizedraw.application.ports.output.IWithdrawalGateway
import com.prizedraw.infrastructure.external.auth.StubOAuthTokenValidator
import com.prizedraw.infrastructure.external.line.LineSignatureVerifier
import com.prizedraw.infrastructure.external.line.LineWebhookAdapter
import com.prizedraw.infrastructure.external.line.StubLineMessagingService
import com.prizedraw.infrastructure.external.payment.StubPaymentGateway
import com.prizedraw.infrastructure.external.payment.StubWithdrawalGateway
import com.prizedraw.infrastructure.external.push.FirebaseNotificationService
import com.prizedraw.infrastructure.external.redis.DistributedLock
import com.prizedraw.infrastructure.external.redis.RedisClient
import com.prizedraw.infrastructure.external.redis.RedisPubSub
import com.prizedraw.infrastructure.external.sms.StubSmsService
import com.prizedraw.infrastructure.external.storage.S3StorageService
import io.ktor.server.config.ApplicationConfig
import org.koin.dsl.module

/**
 * Koin module providing external infrastructure adapters.
 *
 * Binds [IStorageService], [INotificationService], Redis client, distributed lock,
 * and pub/sub from configuration.
 */
@Suppress("CyclomaticComplexMethod", "LongMethod")
public fun externalModule(config: ApplicationConfig) =
    module {
        single<RedisClient> {
            val redisConfig =
                RedisClient.RedisConfig(
                    host = config.propertyOrNull("redis.host")?.getString() ?: "localhost",
                    port = config.propertyOrNull("redis.port")?.getString()?.toInt() ?: 6379,
                    password = config.propertyOrNull("redis.password")?.getString(),
                    database = config.propertyOrNull("redis.database")?.getString()?.toInt() ?: 0,
                    maxPoolSize = config.propertyOrNull("redis.poolSize")?.getString()?.toInt() ?: 20,
                )
            RedisClient(redisConfig)
        }

        single<DistributedLock> {
            DistributedLock(get<RedisClient>())
        }

        single<RedisPubSub> {
            RedisPubSub(get<RedisClient>())
        }

        single<IStorageService> {
            val s3Config =
                S3StorageService.S3Config(
                    // Support both s3.* and storage.* config namespaces
                    accessKeyId =
                        config.propertyOrNull("s3.accessKeyId")?.getString()
                            ?: config.propertyOrNull("storage.accessKey")?.getString() ?: "minioadmin",
                    secretAccessKey =
                        config.propertyOrNull("s3.secretAccessKey")?.getString()
                            ?: config.propertyOrNull("storage.secretKey")?.getString() ?: "minioadmin",
                    region =
                        config.propertyOrNull("s3.region")?.getString()
                            ?: config.propertyOrNull("storage.region")?.getString() ?: "us-east-1",
                    bucketName =
                        config.propertyOrNull("s3.bucketName")?.getString()
                            ?: config.propertyOrNull("storage.bucket")?.getString() ?: "prizedraw",
                    cdnBaseUrl =
                        config.propertyOrNull("s3.cdnBaseUrl")?.getString()
                            ?: "http://localhost:9000/prizedraw",
                    endpointUrl =
                        config.propertyOrNull("s3.endpointUrl")?.getString()
                            ?: config.propertyOrNull("storage.endpoint")?.getString(),
                )
            S3StorageService(s3Config)
        }

        single<INotificationService> {
            FirebaseNotificationService(
                config =
                    FirebaseNotificationService.FirebaseConfig(
                        serviceAccountPath =
                            config
                                .propertyOrNull("firebase.serviceAccountPath")
                                ?.getString() ?: "/etc/prizedraw/firebase-service-account.json",
                        projectId =
                            config
                                .propertyOrNull("firebase.projectId")
                                ?.getString() ?: "prizedraw",
                    ),
                playerDeviceRepository = get<IPlayerDeviceRepository>(),
            )
        }

        // C-6: stub gateway bindings — replace with real adapters for production
        single<IPaymentGateway> {
            StubPaymentGateway()
        }

        single<IWithdrawalGateway> {
            StubWithdrawalGateway()
        }

        // Phase 3: stub OAuth validator — replace with real JWKS validators for production
        single<IOAuthTokenValidator> {
            StubOAuthTokenValidator()
        }

        // Phase 3: stub SMS service — replace with Twilio/AWS SNS adapter for production
        single<ISmsService> {
            StubSmsService()
        }

        single<OutboxWorker> {
            OutboxWorker(
                outboxRepository = get<IOutboxRepository>(),
                notificationService = get<INotificationService>(),
                redisPubSub = get<RedisPubSub>(),
                notificationRepository = get<INotificationRepository>(),
            )
        }

        // Phase 13: LINE Messaging integration — swap StubLineMessagingService for real SDK adapter in prod
        single<ILineMessagingService> {
            StubLineMessagingService()
        }

        single<LineSignatureVerifier> {
            LineSignatureVerifier(
                channelSecret = config.propertyOrNull("line.channelSecret")?.getString() ?: "dev-secret",
            )
        }

        single<LineWebhookAdapter> {
            LineWebhookAdapter(
                supportRepository = get(),
                createTicketUseCase = get(),
                replyTicketUseCase = get(),
                lineMessagingService = get<ILineMessagingService>(),
            )
        }
    }
