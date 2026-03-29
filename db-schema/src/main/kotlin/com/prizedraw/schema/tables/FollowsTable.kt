package com.prizedraw.schema.tables

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

/**
 * Exposed table definition for the `follows` table.
 *
 * Represents unidirectional follow relationships between players.
 */
public object FollowsTable : Table("follows") {
    public val id = uuid("id").autoGenerate()
    public val followerId = uuid("follower_id").references(PlayersTable.id)
    public val followingId = uuid("following_id").references(PlayersTable.id)
    public val createdAt = timestampWithTimeZone("created_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)

    init {
        uniqueIndex("uq_follows_follower_following", followerId, followingId)
        index("idx_follows_follower", false, followerId, createdAt)
        index("idx_follows_following", false, followingId, createdAt)
    }
}
