-- Remove the fictional demo/placeholder CLCs from 02_reference_clcs.sql now
-- that the real Division II roster (31_seed_division_ii_clcs.sql) covers
-- Binalonan and Manaoag with actual CLCs. These 8 rows were never on the
-- official ALS Teachers roster -- only delete each one if nothing real has
-- been linked to it yet, so a demo account/class that happens to reference
-- one is left alone instead of breaking a foreign key.
BEGIN;

WITH placeholder_clcs(clc_name, municipality) AS (
    VALUES
        ('Poblacion CLC', 'Binalonan'),
        ('San Felipe Sur CLC', 'Binalonan'),
        ('San Felipe Norte CLC', 'Binalonan'),
        ('Cabalitian CLC', 'Binalonan'),
        ('Alacan CLC', 'Binalonan'),
        ('Buenlag CLC', 'Binalonan'),
        ('Poblacion Manaoag CLC', 'Manaoag'),
        ('Pantal CLC', 'Manaoag')
),
removable AS (
    SELECT c.clc_id
    FROM clc c
    JOIN placeholder_clcs p
        ON LOWER(BTRIM(c.clc_name)) = LOWER(BTRIM(p.clc_name))
       AND LOWER(BTRIM(c.municipality)) = LOWER(BTRIM(p.municipality))
    WHERE NOT EXISTS (SELECT 1 FROM teacher_clc tc WHERE tc.clc_id = c.clc_id)
      AND NOT EXISTS (SELECT 1 FROM learning_class lc WHERE lc.clc_id = c.clc_id)
)
DELETE FROM clc
WHERE clc_id IN (SELECT clc_id FROM removable);

COMMIT;
