-- StayEd reference Community Learning Centers used by the updated setup wizard.
-- Run this inside stayed_db after the core schema. It only ever seeds a
-- completely empty `clc` table (a fresh dev database) -- once any CLC exists
-- (whether from this seed or from real data, e.g. an admin-imported roster),
-- it is a permanent no-op. It must NOT re-check by name/municipality: this
-- file re-runs on every backend start (see db_bootstrap.py), and a real CLC
-- list will rename or remove these reference rows, which previously made the
-- per-row "WHERE NOT EXISTS (... name/municipality match)" guard think they
-- were missing and silently re-insert duplicates on every restart.

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
WHERE NOT EXISTS (SELECT 1 FROM clc);

COMMIT;
