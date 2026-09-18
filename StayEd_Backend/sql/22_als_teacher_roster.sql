-- Panel requirement: teacher self-registration must reject anyone whose
-- name isn't on the division's official ALS Teachers roster. This table
-- holds that authoritative list (from LIST_OF_ALS_TEACHERS.csv, "ALTERNATIVE
-- LEARNING SYSTEM TEACHERS" section only -- the EPS/supervisor section above
-- it is administrative staff, not classroom teachers registering here).
-- Names are stored exactly as issued; app/services/roster_service.py does
-- normalized/fuzzy matching against full_name at registration time, since a
-- teacher's free-typed name will rarely match this formatting byte-for-byte.
-- Safe to run more than once.

BEGIN;

CREATE TABLE IF NOT EXISTS als_teacher_roster (
    roster_id BIGSERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    als_district TEXT,
    station_school TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

WITH roster(full_name, als_district, station_school) AS (
    VALUES
        ('Mariwin R. Lingad', 'Manaoag I', 'Pedro Bautista ES'),
        ('Evelyn F. Portento', 'Manaoag I', 'Manaoag CS SPED Center'),
        ('Mark Anthony B. Soriano', 'Manaoag II', 'Nalsian ES'),
        ('Jerry L. Moulic', 'Mangaldan I', 'Mangaldan CS'),
        ('Marilyn A. Salinas', 'Mangaldan I', 'Mangaldan CS'),
        ('Rap Rap P. Panelo', 'Mangaldan I', 'Mangaldan CS'),
        ('Aurea I. Prado', 'Mangaldan II', 'Lanas ES'),
        ('Marilou P. De Leon', 'Mangaldan II', 'Embarcadero ES'),
        ('Jocelyn A. Edic', 'San Fabian I', 'Pangulong Marcos ES'),
        ('Jonathan J. Jugo', 'San Fabian I', 'Rabon ES'),
        ('Aurora M. Fabia', 'San Fabian I', 'San Fabian West Central ES'),
        ('Jomar A. Malasan', 'San Fabian II', 'East Central ES'),
        ('Jennifer P. Biasura', 'San Fabian II', 'East Central ES'),
        ('Jennica D. Cruz', 'San Jacinto', 'East CS'),
        ('Lessie E. Laguit', 'San Jacinto', 'Lobong ES'),
        ('Ma. Teresa T. Libao', 'Binalonan I', 'Sta. Catalina IS'),
        ('Joselito G. Nuñez', 'Binalonan I', 'Binalonan North CS'),
        ('Maria Cristina A. Prado', 'Binalonan I', 'Binalonan North CS'),
        ('Shirley I. Laroya', 'Binalonan II', 'Binalonan South CS'),
        ('Romeo Arcangel', 'Binalonan II', 'Binalonan South CS'),
        ('Analiza G. Castillo', 'Binalonan II', 'Linmansangan IS'),
        ('Gemma C. Matias', 'Laoac', 'Nanbagatan ES'),
        ('Armando D. Tabelin', 'Laoac', 'Don Rufino Tabayoyong CS'),
        ('Jasmine R. Velasco', 'Laoac', 'Cabu-cala ES'),
        ('Romina D. Ibaan', 'Pozorrobio I', 'Pozorrubio CS'),
        ('Sonny C. Ibaan', 'Pozorrobio I', 'Pozorrubio CS'),
        ('Karen Jean T. Mariñas', 'Pozorrobio I', 'Pozorrubio CS'),
        ('Jonathan L. Matias', 'Pozorrobio II', 'Bobonan CS'),
        ('Rena Marie S. Carganilla', 'Pozorrobio II', 'Palacpalac ES'),
        ('Juvilla A. Batrina', 'Pozorrobio II', 'Don Benito ES'),
        ('Ma. Justerine L. Frutas', 'Sison', 'Sison Central IS'),
        ('Cristita W. Quisia-an', 'Sison', 'Cauringan ES'),
        ('Carl Ann M. Tamayo', 'Sison', 'Esperanza IS'),
        ('Mylene A. Patayan', 'Sison', 'Labayug ES'),
        ('Mary Jane D. Pre', 'Asingan I', 'Teofilo Gante ES'),
        ('Ramjek J. Bueno', 'Asingan I', 'Narciso Ramos ES SPED Center'),
        ('Myra L. Moselina', 'Asingan II', 'Asingan North CS'),
        ('Cresencia P. Fernandez', 'Asingan II', 'Asingan North CS'),
        ('Angelito L. Jacob', 'San Manuel', 'Juan C. Laya CS SPED Center'),
        ('Analiza L. Jacob', 'San Manuel', 'Juan C.Laya CS SPED Center'),
        ('Hay-Joan B. Fernandez', 'San Manuel', 'Bomboaya ES'),
        ('Rowena A. Natividad', 'Sta. Maria', 'Cal-litang ES'),
        ('Rebecca L. Dela Cruz', 'Sta. Maria', 'Santa Cruz IS'),
        ('Meena B. Perez', 'Sta. Maria', 'Sta. Maria East IS'),
        ('Elvira R. Viernes', 'Villasis I', 'West Poblacion ES'),
        ('Evajene B. Silvestre', 'Villasis I', 'Villasis I CS SPED Center'),
        ('Rowena M. Tino', 'Villasis II', 'San Blas ES'),
        ('Analiza V. Orpilla', 'Villasis II', 'Bacag CS'),
        ('Jay Jay O. Honorato', 'Natividad', 'San Macario ES'),
        ('Raymundo A. Malapit', 'Natividad', 'Natividad CS'),
        ('Elvis C. Ibera', 'Natividad', 'San Miguel ES'),
        ('Laila Lyn J. Ancheta', 'San Nicolas I', 'San Roque ANP Pilot School'),
        ('Medelita V. Doton', 'San Nicolas I', 'West CS SPED Center'),
        ('Marichan I. Trinidad', 'San Nicolas I', 'San Felipe IS'),
        ('Shanine April M. Laurenciano', 'San Nicolas II', 'East CS'),
        ('Ofemia D. Carilla', 'San Nicolas II', 'East CS'),
        ('May Farrah M. Agyapas', 'San Nicolas II', 'Santa Maria ES'),
        ('Maricar D. Trinidad', 'San Quintin', 'San Quintin CS'),
        ('Cedrick L. dela Cruz', 'San Quintin', 'San Quintin CS'),
        ('Rommel J. Oximer', 'Tayug I', 'Tayug South Central ES'),
        ('Manolito A. Castillo', 'Tayug I', 'Carriedo ES'),
        ('Benjie V. Danao', 'Tayug II', 'Panganiban CS'),
        ('Josephine D. Olivar', 'Tayug II', 'Evangelista ES'),
        ('Nympha Y. Bait', 'Umingan I', 'Umingan Central ES'),
        ('Marlin P. Acosta', 'Umingan I', 'Celestino L. Clariza ES'),
        ('Manuel P. Catalan', 'Alcala', 'Alcala CS'),
        ('Rosalie C. Alberto', 'Alcala', 'Pindangan West ES'),
        ('Ma. Victoria Guevarra', 'Alcala', 'Alcala CS'),
        ('Edwin O. Peralta', 'Balungao', 'Balungao CS'),
        ('Belinda A. Peralta', 'Balungao', 'Balungao CS/ Balungao Dist. Jail'),
        ('Ma. Aricion B. Aguado', 'Bautista', 'Bautista CS SPED Center'),
        ('Jesusa Laura G. Pauco', 'Bautista', 'Baluyot NHS'),
        ('Riza N. Casingal', 'Bautista', 'Coloscaoayan NHS'),
        ('Concepcion B. Fonacier', 'Rosales I', 'Rosales South CS'),
        ('Florida M. Garcia', 'Rosales I', 'Guiling-Coliling ES'),
        ('Mary Grace S. Fajardo', 'Rosales II', 'Acop ES'),
        ('Romil G. Corpuz', 'Rosales II', 'San Luis ES'),
        ('Kristina P. Rivera', 'Rosales II', 'Rosales North CS'),
        ('Marilou A. Morta', 'Sto. Tomas', 'Ernesting Gonzales CS'),
        ('Hertrudes G. Villar', 'Sto. Tomas', 'Ernesting Gonzales CS'),
        ('Donald L. Pacheco', 'Umingan II', 'Bantug ES'),
        ('Christopher E. Galleguez', 'Umingan II', 'Pemienta ES'),
        ('Liberty A. Peralta', 'Umingan II', 'Don Montano IS'),
        ('Segundo L. Erestingcol III', 'BPOSA-Mangaldan', 'Mangaldan NHS'),
        ('Minnie G. Gotomanga', 'BPOSA-Mangaldan', 'Mangaldan NHS'),
        ('Analiza C. Riva', 'BPOSA-Mangaldan', 'Mangaldan NHS'),
        ('Analiza A. Erestingcol', 'BPOSA-Mangaldan', 'Mangaldan NHS')
)
INSERT INTO als_teacher_roster (full_name, als_district, station_school)
SELECT r.full_name, r.als_district, r.station_school
FROM roster r
WHERE NOT EXISTS (
    SELECT 1 FROM als_teacher_roster t WHERE LOWER(t.full_name) = LOWER(r.full_name)
);

COMMIT;
