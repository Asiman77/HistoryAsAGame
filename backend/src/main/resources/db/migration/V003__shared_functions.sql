-- Functions shared by every module's tables: search folding and CHECK helpers that mirror
-- the Java types in az.tarix.platform.shared (HistoricalDate, LocalizedText, slug rules).

-- Azerbaijani search folding: "Şah İsmayıl" and "sah ismayil" fold to the same text.
-- translate() runs before lower() so the result never depends on the database locale
-- (lower('İ') and lower('I') differ between locales). Note: the target string in
-- BACKEND_SPEC.md §7.2 ('eeiiiisscgggoouu') maps ç to g; the correct one is below.
--   source:  Ə ə I ı İ i Ş ş Ç ç Ğ ğ Ö ö Ü ü
--   target:  e e i i i i s s c c g g o o u u
CREATE FUNCTION az_fold(input text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT lower(translate(input, 'ƏəIıİiŞşÇçĞğÖöÜü', 'eeiiiissccggoouu'))
$$;

-- Slug: lower-case latin letters, digits and single hyphens, at most 120 characters.
CREATE FUNCTION is_slug(input text) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT length(input) <= 120 AND input ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
$$;

-- LocalizedText: a JSON object of non-empty strings keyed by language; "az" is mandatory.
CREATE FUNCTION is_localized_text(input jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT jsonb_typeof(input) = 'object'
     AND input ? 'az'
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_each(input) e
       WHERE e.key !~ '^[a-z]{2}$' OR jsonb_typeof(e.value) <> 'string' OR length(e.value #>> '{}') = 0
     )
$$;

-- A month/day that exists in some year (29 February allowed).
CREATE FUNCTION is_calendar_day(m int, d int) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT m BETWEEN 1 AND 12 AND d BETWEEN 1 AND
    CASE WHEN m = 2 THEN 29 WHEN m IN (4, 6, 9, 11) THEN 30 ELSE 31 END
$$;

-- HistoricalDate columns (*_year, *_month, *_day, *_precision, *_certainty) are consistent:
-- precision matches the parts given, and a DAY date is a real date in that year
-- (proleptic Gregorian, astronomical year numbering: 0 = 1 BC, -1 = 2 BC).
-- Never returns NULL: a CHECK constraint treats NULL as passing, so a missing part must be false.
CREATE FUNCTION is_historical_date(y int, m int, d int, prec text, cert text) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT coalesce(
         y IS NOT NULL
     AND cert IN ('EXACT', 'APPROXIMATE', 'DISPUTED')
     AND CASE prec
           WHEN 'YEAR'  THEN m IS NULL AND d IS NULL
           WHEN 'MONTH' THEN m BETWEEN 1 AND 12 AND d IS NULL
           WHEN 'DAY'   THEN m BETWEEN 1 AND 12 AND d BETWEEN 1 AND
                              CASE WHEN m = 2 THEN
                                     CASE WHEN (y % 4 = 0 AND y % 100 <> 0) OR y % 400 = 0 THEN 29 ELSE 28 END
                                   WHEN m IN (4, 6, 9, 11) THEN 30 ELSE 31 END
           ELSE false
         END, false)
$$;

-- Sort key of a HistoricalDate: year * 10000 + month * 100 + day (missing parts = 0).
-- Orders correctly for negative years too, because month/day add less than one year step.
CREATE FUNCTION historical_sort_key(y int, m int, d int) RETURNS bigint
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT y::bigint * 10000 + coalesce(m, 0) * 100 + coalesce(d, 0)
$$;
