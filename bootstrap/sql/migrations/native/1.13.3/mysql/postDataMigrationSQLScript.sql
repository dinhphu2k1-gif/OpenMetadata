-- Backfill IntakeForm formFields from the legacy requiredFields representation.
-- requiredFields is only trusted when it is actually an array, and only object
-- entries are carried over, so a JSON null or scalar left by an older write can
-- never turn into a malformed formFields array.
UPDATE intake_form_entity AS intake_form
SET json = JSON_SET(
    json,
    '$.formFields',
    COALESCE(
        (
            SELECT JSON_ARRAYAGG(
                JSON_SET(required_field.field_json, '$.required', CAST('true' AS JSON))
            )
            FROM JSON_TABLE(
                CASE
                    WHEN JSON_TYPE(JSON_EXTRACT(intake_form.json, '$.requiredFields')) = 'ARRAY'
                        THEN JSON_EXTRACT(intake_form.json, '$.requiredFields')
                    ELSE JSON_ARRAY()
                END,
                '$[*]' COLUMNS (field_json JSON PATH '$')
            ) AS required_field
            WHERE JSON_TYPE(required_field.field_json) = 'OBJECT'
        ),
        JSON_ARRAY()
    )
)
WHERE JSON_CONTAINS_PATH(json, 'one', '$.requiredFields')
  AND NOT JSON_CONTAINS_PATH(json, 'one', '$.formFields');

-- Backfill glossary_business_snapshot.archiveReason for snapshots archived before the column
-- existed. A Data Dictionary cutover archives the glossary snapshot, its terms and its Data
-- Quality Rules with one shared timestamp, so a term archived at the same instant as the glossary
-- snapshot of its scope was superseded; every other archived snapshot was deleted by a user.
UPDATE glossary_business_snapshot AS snapshot
SET snapshot.archiveReason = CASE
    WHEN snapshot.entityType = 'glossary' THEN 'SUPERSEDED'
    WHEN EXISTS (
        SELECT 1
        FROM (
            SELECT businessVersion, archivedAt
            FROM glossary_business_snapshot
            WHERE entityType = 'glossary' AND archivedAt IS NOT NULL
        ) AS cutover
        WHERE cutover.businessVersion = snapshot.parentBusinessVersion
          AND cutover.archivedAt = snapshot.archivedAt
    ) THEN 'SUPERSEDED'
    ELSE 'DELETED'
END
WHERE snapshot.archivedAt IS NOT NULL
  AND snapshot.archiveReason IS NULL;
