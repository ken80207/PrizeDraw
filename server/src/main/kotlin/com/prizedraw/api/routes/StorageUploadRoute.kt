package com.prizedraw.api.routes

import com.prizedraw.api.plugins.requireStaffWithRole
import com.prizedraw.application.ports.output.IStorageService
import com.prizedraw.contracts.dto.storage.UploadResponse
import com.prizedraw.contracts.endpoints.StorageEndpoints
import com.prizedraw.contracts.enums.StaffRole
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.PartData
import io.ktor.http.content.forEachPart
import io.ktor.server.application.call
import io.ktor.server.request.receiveMultipart
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.post
import io.ktor.utils.io.toByteArray
import java.util.UUID

private val allowedContentTypes = setOf("image/jpeg", "image/png", "image/webp")
private const val MAX_FILE_SIZE = 5L * 1024 * 1024

/**
 * Registers the shared file upload endpoint.
 *
 * Receives multipart form data, uploads to S3, returns the CDN URL.
 * Requires [StaffRole.OPERATOR] or above.
 */
@Suppress("CyclomaticComplexMethod")
public fun Route.storageUploadRoute() {
    val storageService: IStorageService by inject()

    post(StorageEndpoints.UPLOAD) {
        call.requireStaffWithRole(StaffRole.OPERATOR) ?: return@post

        val multipart = call.receiveMultipart()
        var uploadedUrl: String? = null
        var validationError: String? = null

        multipart.forEachPart { part ->
            if (validationError == null && part is PartData.FileItem && part.name == "file") {
                val contentType = part.contentType?.toString() ?: ""
                if (contentType !in allowedContentTypes) {
                    validationError = "Unsupported file type: $contentType"
                    part.dispose()
                    return@forEachPart
                }

                val bytes = part.provider().toByteArray()
                if (bytes.size > MAX_FILE_SIZE) {
                    validationError = "File too large (max 5MB)"
                    part.dispose()
                    return@forEachPart
                }

                val ext =
                    when (contentType) {
                        "image/jpeg" -> "jpg"
                        "image/png" -> "png"
                        "image/webp" -> "webp"
                        else -> "bin"
                    }
                val key = "uploads/${UUID.randomUUID()}.$ext"
                uploadedUrl = storageService.upload(key, bytes, contentType)
            }
            part.dispose()
        }

        when {
            validationError != null ->
                call.respond(HttpStatusCode.BadRequest, mapOf("error" to validationError!!))
            uploadedUrl != null ->
                call.respond(HttpStatusCode.OK, UploadResponse(url = uploadedUrl!!))
            else ->
                call.respond(HttpStatusCode.BadRequest, mapOf("error" to "No file provided"))
        }
    }
}
