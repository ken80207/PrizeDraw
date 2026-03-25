package com.prizedraw.infrastructure.external.storage

import aws.sdk.kotlin.runtime.auth.credentials.StaticCredentialsProvider
import aws.sdk.kotlin.services.s3.S3Client
import aws.sdk.kotlin.services.s3.model.DeleteObjectRequest
import aws.sdk.kotlin.services.s3.model.PutObjectRequest
import aws.sdk.kotlin.services.s3.presigners.presignPutObject
import aws.smithy.kotlin.runtime.content.ByteStream
import aws.smithy.kotlin.runtime.net.url.Url
import com.prizedraw.application.ports.output.IStorageService
import org.slf4j.LoggerFactory
import kotlin.time.Duration.Companion.seconds

/**
 * AWS S3 (or S3-compatible, e.g. MinIO) implementation of [IStorageService].
 *
 * Uses the AWS SDK for Kotlin with suspend-based operations.
 * For MinIO or other S3-compatible stores, set [S3Config.endpointUrl]
 * to the custom endpoint URL (e.g. `http://localhost:9000`).
 *
 * Returned CDN URLs have the form: `cdnBaseUrl + "/" + key`.
 */
public class S3StorageService(
    private val config: S3Config,
) : IStorageService {
    public data class S3Config(
        val accessKeyId: String,
        val secretAccessKey: String,
        val region: String = "ap-northeast-1",
        val bucketName: String,
        val cdnBaseUrl: String,
        val endpointUrl: String? = null,
    )

    private val log = LoggerFactory.getLogger(S3StorageService::class.java)

    private val credentialsProvider =
        StaticCredentialsProvider {
            accessKeyId = config.accessKeyId
            secretAccessKey = config.secretAccessKey
        }

    private fun buildClient(): S3Client =
        S3Client {
            region = config.region
            credentialsProvider = this@S3StorageService.credentialsProvider
            if (!config.endpointUrl.isNullOrBlank()) {
                endpointUrl = Url.parse(config.endpointUrl)
                forcePathStyle = true
            }
        }

    override suspend fun upload(
        key: String,
        bytes: ByteArray,
        contentType: String,
    ): String {
        log.debug("Uploading {} bytes to s3://{}/{}", bytes.size, config.bucketName, key)
        buildClient().use { client ->
            client.putObject(
                PutObjectRequest {
                    bucket = config.bucketName
                    this.key = key
                    this.contentType = contentType
                    contentLength = bytes.size.toLong()
                    body = ByteStream.fromBytes(bytes)
                },
            )
        }
        return "${config.cdnBaseUrl}/$key"
    }

    override suspend fun delete(key: String) {
        log.debug("Deleting s3://{}/{}", config.bucketName, key)
        buildClient().use { client ->
            client.deleteObject(
                DeleteObjectRequest {
                    bucket = config.bucketName
                    this.key = key
                },
            )
        }
    }

    override suspend fun generateUploadUrl(
        key: String,
        contentType: String,
        expiresInSeconds: Int,
    ): String {
        val request =
            PutObjectRequest {
                bucket = config.bucketName
                this.key = key
                this.contentType = contentType
            }
        val presigned =
            buildClient().use { client ->
                client.presignPutObject(request, expiresInSeconds.seconds)
            }
        return presigned.url.toString()
    }
}
