-- One-time import of the cleaned Division II CLC roster (2026-09-29).
-- The seed marker keeps normal backend restarts from restoring rows that an
-- administrator intentionally removes later.
BEGIN;

CREATE TABLE IF NOT EXISTS data_seed_log (
    seed_key VARCHAR(150) PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

WITH claimed_seed AS (
    INSERT INTO data_seed_log (seed_key)
    VALUES ('division_ii_clcs_cleaned_2026_09_29')
    ON CONFLICT (seed_key) DO NOTHING
    RETURNING seed_key
),
reference_clcs(clc_name, municipality) AS (
    VALUES
        ('Pedro Bautista ES', 'Manaoag'),
        ('Manaoag CS SPED Center', 'Manaoag'),
        ('Nalsian ES', 'Manaoag'),
        ('Mangaldan CS', 'Mangaldan'),
        ('Lanas ES', 'Mangaldan'),
        ('Embarcadero ES', 'Mangaldan'),
        ('Mangaldan NHS', 'Mangaldan'),
        ('Pangulong Marcos ES', 'San Fabian'),
        ('Rabon ES', 'San Fabian'),
        ('San Fabian West Central ES', 'San Fabian'),
        ('East Central ES', 'San Fabian'),
        ('East CS', 'San Jacinto'),
        ('Lobong ES', 'San Jacinto'),
        ('Sta. Catalina IS', 'Binalonan'),
        ('Binalonan North CS', 'Binalonan'),
        ('Binalonan South CS', 'Binalonan'),
        ('Linmansangan IS', 'Binalonan'),
        ('Nanbagatan ES', 'Laoac'),
        ('Don Rufino Tabayoyong CS', 'Laoac'),
        ('Cabu-cala ES', 'Laoac'),
        ('Pozorrubio CS', 'Pozorrubio'),
        ('Bobonan CS', 'Pozorrubio'),
        ('Palacpalac ES', 'Pozorrubio'),
        ('Don Benito ES', 'Pozorrubio'),
        ('Sison Central IS', 'Sison'),
        ('Cauringan ES', 'Sison'),
        ('Esperanza IS', 'Sison'),
        ('Labayug ES', 'Sison'),
        ('Teofilo Gante ES', 'Asingan'),
        ('Narciso Ramos ES SPED Center', 'Asingan'),
        ('Asingan North CS', 'Asingan'),
        ('Juan C. Laya CS SPED Center', 'San Manuel'),
        ('Bomboaya ES', 'San Manuel'),
        ('Cal-litang ES', 'Santa Maria'),
        ('Santa Cruz IS', 'Santa Maria'),
        ('Sta. Maria East IS', 'Santa Maria'),
        ('West Poblacion ES', 'Villasis'),
        ('Villasis I CS SPED Center', 'Villasis'),
        ('San Blas ES', 'Villasis'),
        ('Bacag CS', 'Villasis'),
        ('San Macario ES', 'Natividad'),
        ('Natividad CS', 'Natividad'),
        ('San Miguel ES', 'Natividad'),
        ('San Roque ANP Pilot School', 'San Nicolas'),
        ('West CS SPED Center', 'San Nicolas'),
        ('San Felipe IS', 'San Nicolas'),
        ('East CS', 'San Nicolas'),
        ('Santa Maria ES', 'San Nicolas'),
        ('San Quintin CS', 'San Quintin'),
        ('Tayug South Central ES', 'Tayug'),
        ('Carriedo ES', 'Tayug'),
        ('Panganiban CS', 'Tayug'),
        ('Evangelista ES', 'Tayug'),
        ('Umingan Central ES', 'Umingan'),
        ('Celestino L. Clariza ES', 'Umingan'),
        ('Bantug ES', 'Umingan'),
        ('Pemienta ES', 'Umingan'),
        ('Don Montano IS', 'Umingan'),
        ('Alcala CS', 'Alcala'),
        ('Pindangan West ES', 'Alcala'),
        ('Balungao CS', 'Balungao'),
        ('Balungao CS/ Balungao Dist. Jail', 'Balungao'),
        ('Bautista CS SPED Center', 'Bautista'),
        ('Baluyot NHS', 'Bautista'),
        ('Coloscaoayan NHS', 'Bautista'),
        ('Rosales South CS', 'Rosales'),
        ('Guiling-Coliling ES', 'Rosales'),
        ('Acop ES', 'Rosales'),
        ('San Luis ES', 'Rosales'),
        ('Rosales North CS', 'Rosales'),
        ('Ernesting Gonzales CS', 'Santo Tomas')
)
INSERT INTO clc (clc_name, municipality, status)
SELECT r.clc_name, r.municipality, 'ACTIVE'
FROM reference_clcs r
CROSS JOIN claimed_seed
WHERE NOT EXISTS (
    SELECT 1
    FROM clc existing
        WHERE REGEXP_REPLACE(LOWER(BTRIM(existing.clc_name)), '\s+', ' ', 'g')
            = REGEXP_REPLACE(LOWER(BTRIM(r.clc_name)), '\s+', ' ', 'g')
      AND LOWER(BTRIM(existing.municipality)) = LOWER(BTRIM(r.municipality))
);

COMMIT;