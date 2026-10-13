-- Backfill IntakeForm formFields from the legacy requiredFields representation.
-- requiredFields is only trusted when it is actually an array: jsonb_array_elements
-- raises "cannot extract elements from a scalar" on a JSON null or scalar value,
-- which would abort the whole upgrade for one malformed row. Non-object entries
-- are skipped for the same reason.
UPDATE intake_form_entity
SET json = jsonb_set(
    json,
    '{formFields}',
    COALESCE(
        (
            SELECT jsonb_agg(required_field.field_json || '{"required": true}'::jsonb)
            FROM jsonb_array_elements(
                CASE
                    WHEN jsonb_typeof(json -> 'requiredFields') = 'array'
                        THEN json -> 'requiredFields'
                    ELSE '[]'::jsonb
                END
            ) AS required_field(field_json)
            WHERE jsonb_typeof(required_field.field_json) = 'object'
        ),
        '[]'::jsonb
    )
)
WHERE jsonb_exists(json, 'requiredFields')
  AND NOT jsonb_exists(json, 'formFields');

-- Backfill glossary_business_snapshot.archiveReason for snapshots archived before the column
-- existed. A Data Dictionary cutover archives the glossary snapshot, its terms and its Data
-- Quality Rules with one shared timestamp, so a term archived at the same instant as the glossary
-- snapshot of its scope was superseded; every other archived snapshot was deleted by a user.
UPDATE glossary_business_snapshot AS snapshot
SET archiveReason = CASE
    WHEN snapshot.entityType = 'glossary' THEN 'SUPERSEDED'
    WHEN EXISTS (
        SELECT 1
        FROM glossary_business_snapshot AS cutover
        WHERE cutover.entityType = 'glossary'
          AND cutover.archivedAt IS NOT NULL
          AND cutover.businessVersion = snapshot.parentBusinessVersion
          AND cutover.archivedAt = snapshot.archivedAt
    ) THEN 'SUPERSEDED'
    ELSE 'DELETED'
END
WHERE snapshot.archivedAt IS NOT NULL
  AND snapshot.archiveReason IS NULL;
