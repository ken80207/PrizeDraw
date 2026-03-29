package com.prizedraw.schema.tables

import org.jetbrains.exposed.sql.Column
import org.jetbrains.exposed.sql.Table
import org.postgresql.util.PGobject

/**
 * Defines a column that maps to a PostgreSQL ENUM type.
 *
 * The value is stored/read as the enum's [name] string, but sent to PG
 * as a [PGobject] with the correct type name so the `=` operator resolves
 * against the enum type rather than `character varying`, avoiding the
 * `operator does not exist: some_enum_type = character varying` error.
 *
 * @param T the Kotlin enum class mirroring the PG enum's values.
 * @param columnName the SQL column name.
 * @param pgEnumTypeName the PostgreSQL type name (e.g. `"kuji_campaign_status"`).
 */
public inline fun <reified T : Enum<T>> Table.pgEnum(
    columnName: String,
    pgEnumTypeName: String,
): Column<T> =
    customEnumeration(
        name = columnName,
        sql = pgEnumTypeName,
        fromDb = { value -> enumValueOf<T>(value as String) },
        toDb = { value ->
            PGobject().apply {
                type = pgEnumTypeName
                this.value = value.name
            }
        },
    )
