package com.prizedraw.application.ports.output

/**
 * Output port for uploading and managing files in object storage (S3-compatible).
 *
 * The [upload] method returns a public CDN URL that can be stored in the domain entity
 * as a plain string (e.g. [com.prizedraw.domain.entities.PrizeDefinition.photos]).
 */
public interface IStorageService {
    /**
     * Uploads the given [bytes] to object storage at the specified [key].
     *
     * The key determines the path in the bucket (e.g. `prizes/definition-id/photo-0.jpg`).
     * The implementation is responsible for setting the correct [contentType] on the stored object
     * and returning the public CDN URL.
     *
     * @param key The storage key (path within the bucket).
     * @param bytes The raw file content to upload.
     * @param contentType The MIME type of the content, e.g. `image/jpeg`.
     * @return The public CDN URL of the uploaded object.
     */
    public suspend fun upload(
        key: String,
        bytes: ByteArray,
        contentType: String,
    ): String

    /**
     * Deletes the object at the given [key] from storage.
     *
     * @param key The storage key of the object to delete.
     */
    public suspend fun delete(key: String)

    /**
     * Generates a pre-signed URL that allows a client to upload directly to storage.
     *
     * @param key The storage key where the client will upload.
     * @param contentType The expected MIME type of the upload.
     * @param expiresInSeconds How long the pre-signed URL remains valid.
     * @return The pre-signed upload URL.
     */
    public suspend fun generateUploadUrl(
        key: String,
        contentType: String,
        expiresInSeconds: Int,
    ): String
}
