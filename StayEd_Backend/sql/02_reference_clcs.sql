-- StayEd reference Community Learning Centers used by the updated setup wizard.
-- Run this inside stayed_db after the core schema. It is safe to run more than once.

BEGIN;

WITH reference_clcs(clc_name, municipality, barangay, address) AS (
    VALUES
        ('Poblacion CLC', 'Binalonan', 'Poblacion', 'Poblacion, Binalonan, Pangasinan'),
        ('San Felipe Sur CLC', 'Binalonan', 'San Felipe Sur', 'San Felipe Sur, Binalonan, Pangasinan'),
        ('San Felipe Norte CLC', 'Binalonan', 'San Felipe Norte', 'San Felipe Norte, Binalonan, Pangasinan'),
        ('Cabalitian CLC', 'Binalonan', 'Cabalitian', 'Cabalitian, Binalonan, Pangasinan'),
        ('Alacan CLC', 'Binalonan', 'Alacan', 'Alacan, Binalonan, Pangasinan'),
        ('Buenlag CLC', 'Binalonan', 'Buenlag', 'Buenlag, Binalonan, Pangasinan'),
        ('Poblacion Manaoag CLC', 'Manaoag', 'Poblacion', 'Poblacion, Manaoag, Pangasinan'),
        ('Pantal CLC', 'Manaoag', 'Pantal', 'Pantal, Manaoag, Pangasinan'),
        ('Nancamaliran CLC', 'Urdaneta City', 'Nancamaliran', 'Nancamaliran, Urdaneta City, Pangasinan'),
        ('Bactad CLC', 'Urdaneta City', 'Bactad', 'Bactad, Urdaneta City, Pangasinan')
)
INSERT INTO clc (clc_name, municipality, barangay, address, status)
SELECT r.clc_name, r.municipality, r.barangay, r.address, 'ACTIVE'
FROM reference_clcs r
WHERE NOT EXISTS (
    SELECT 1
    FROM clc c
    WHERE LOWER(c.clc_name) = LOWER(r.clc_name)
      AND LOWER(c.municipality) = LOWER(r.municipality)
);

COMMIT;
