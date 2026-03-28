package com.prizedraw.infrastructure.di

import com.prizedraw.application.events.LowStockNotificationJob
import com.prizedraw.application.events.OutboxWorker
import com.prizedraw.application.ports.output.ICampaignFavoriteRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.IConnectionManagerPort
import com.prizedraw.application.ports.output.IDistributedLockService
import com.prizedraw.application.ports.output.IFollowRepository
import com.prizedraw.application.ports.output.ILineMessagingService
import com.prizedraw.application.ports.output.INotificationRepository
import com.prizedraw.application.ports.output.INotificationService
import com.prizedraw.application.ports.output.IOAuthTokenValidator
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPaymentGateway
import com.prizedraw.application.ports.output.IPlayerDeviceRepository
import com.prizedraw.application.ports.output.IPubSubService
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
import com.prizedraw.infrastructure.websocket.ConnectionManager
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
        val isProduction = System.getenv("KTOR_ENV") == "production" || System.getenv("APP_ENV") == "production"

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

        single<IPubSubService> { get<RedisPubSub>() }
        single<IDistributedLockService> { get<DistributedLock>() }
        single<IConnectionManagerPort> { get<ConnectionManager>() }

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

        // Stub gateway bindings — guarded by a production fail-fast. Bind real adapters for production.
        single<IPaymentGateway> {
            if (isProduction) {
                error(
                    "Stub payment gateway must not be used in production. Bind a real IPaymentGateway implementation."
                )
            }
            StubPaymentGateway()
        }

        single<IWithdrawalGateway> {
            if (isProduction) {
                error(
                    "Stub withdrawal gateway must not be used in production. Bind a real IWithdrawalGateway implementation."
                )
            }
            StubWithdrawalGateway()
        }

        // Stub OAuth validator — guarded by a production fail-fast. Replace with real JWKS validators for production.
        single<IOAuthTokenValidator> {
            if (isProduction) {
                error(
                    "Stub OAuth token validator must not be used in production. Bind a real IOAuthTokenValidator implementation."
                )
            }
            StubOAuthTokenValidator()
        }

        // Stub SMS service — guarded by a production fail-fast. Replace with Twilio/AWS SNS adapter for production.
        single<ISmsService> {
            if (isProduction) {
                error(
                    "Stub SMS service must not be used in production. Bind a real ISmsService implementation."
                )
            }
            StubSmsService()
        }

        single<OutboxWorker> {
            OutboxWorker(
                outboxRepository = get<IOutboxRepository>(),
                notificationService = get<INotificationService>(),
                pubSub = get<IPubSubService>(),
                notificationRepository = get<INotificationRepository>(),
                followRepository = get<IFollowRepository>(),
            )
        }

        single {
            LowStockNotificationJob(
                campaignRepo = get<ICampaignRepository>(),
                favoriteRepo = get<ICampaignFavoriteRepository>(),
                notificationRepo = get<INotificationRepository>(),
                outboxRepo = get<IOutboxRepository>(),
            )
        }

        // LINE Messaging — guarded by a production fail-fast. Swap for real SDK adapter in production.
        single<ILineMessagingService> {
            if (isProduction) {
                error(
                    "Stub LINE messaging service must not be used in production. Bind a real ILineMessagingService implementation."
                )
            }
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
