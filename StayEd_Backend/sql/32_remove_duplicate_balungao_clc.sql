-- Remove the duplicate Balungao roster entry caused by an internal-space
-- spelling variation. Preserve the oldest active row and any linked data.
BEGIN;

WITH ranked AS (
    SELECT
        clc_id,
        ROW_NUMBER() OVER (
            ORDER BY (status = 'ACTIVE') DESC, clc_id
        ) AS row_number
    FROM clc
    WHERE LOWER(BTRIM(municipality)) = 'balungao'
      AND REGEXP_REPLACE(LOWER(BTRIM(clc_name)), '\s+', ' ', 'g')
          = 'balungao cs/ balungao dist. jail'
),
unlinked_duplicates AS (
    SELECT duplicate.clc_id
    FROM ranked duplicate
    WHERE duplicate.row_number > 1
      AND NOT EXISTS (
          SELECT 1 FROM teacher_clc tc WHERE tc.clc_id = duplicate.clc_id
      )
      AND NOT EXISTS (
          SELECT 1 FROM learning_class lc WHERE lc.clc_id = duplicate.clc_id
      )
)
DELETE FROM clc
WHERE clc_id IN (SELECT clc_id FROM unlinked_duplicates);

COMMIT;