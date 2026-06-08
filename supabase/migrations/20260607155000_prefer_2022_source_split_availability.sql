-- For 2022, prefer the official spreadsheet's explicit partial split availability
-- over earlier canonical-result split backfills. The spreadsheet has dashes for
-- Xtreme laps 6-7, so source-based bogeys should stop at the available source
-- split legs instead of using curated canonical leg rows for missing source laps.
DELETE FROM public.historical_leg_splits AS split
USING public.our_team_result_links AS link,
      public.historical_team_results AS result
WHERE link.year = 2022
  AND split.team_result_id = link.historical_team_result_id
  AND result.id = link.historical_team_result_id
  AND split.metadata ->> 'backfilled_from' = 'canonical_official_results'
  AND NOT (
    CASE split.leg_number
      WHEN 1 THEN trim(split_part(result.raw_text, '|', 6))
      WHEN 2 THEN trim(split_part(result.raw_text, '|', 7))
      WHEN 3 THEN trim(split_part(result.raw_text, '|', 8))
      WHEN 4 THEN trim(split_part(result.raw_text, '|', 9))
      WHEN 5 THEN trim(split_part(result.raw_text, '|', 10))
      WHEN 6 THEN trim(split_part(result.raw_text, '|', 11))
      WHEN 7 THEN trim(split_part(result.raw_text, '|', 12))
      ELSE ''
    END ~ '^[0-9]+:[0-9]{2}(?::[0-9]{2})?(\.[0-9]+)?$'
  );
