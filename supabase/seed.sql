-- Reset tables
TRUNCATE TABLE results CASCADE;
TRUNCATE TABLE placements CASCADE;
TRUNCATE TABLE leg_definitions CASCADE;

-- Seed leg_definitions first (no foreign key dependencies)
INSERT INTO leg_definitions (number, version, distance, elevation_gain) VALUES 
(1, 1, 9.6, NULL),
(2, 1, 8.2, NULL),
(3, 1, 10.3, NULL),
(4, 1, 12.3, NULL),
(5, 1, 10.6, NULL),
(6, 1, 10.5, NULL),
(7, 1, 10.5, NULL),
(1, 2, 9.05, 528),
(2, 2, 13.1, 1234),
(3, 2, 9.6, 510),
(4, 2, 9.5, 552),
(5, 2, 10.7, 527),
(6, 2, 8.65, 1268),
(7, 2, 11.02, 244);

-- Seed placements next
INSERT INTO placements (year, division, division_place, division_teams, overall_place, overall_teams, bib) VALUES 
(2024, 'Mixed Open', 10, 19, 29, 43, 16),
(2023, 'Mixed Open', 8, 17, 20, 41, 29),
(2022, 'Mixed Open', 6, 12, 19, 26, 24),
(2019, 'Men''s Open', 10, 10, 57, 70, 2),
(2018, 'Men''s Open', 8, 9, 56, 66, 7),
(2017, 'Men''s Open', 8, 9, 47, 63, 3),
(2016, 'Men''s Open', 7, 8, 54, 62, 18),
(2015, 'Men''s Open', 13, 13, 83, 89, 22),
(2014, 'Mixed Open', 11, 11, 105, 122, 98),
(2013, 'Men''s Open', 15, 17, 103, 120, 41),
(2012, 'Men''s Open', 19, 20, 99, 119, 15),
(2011, 'Men''s Open', 19, 19, 97, 119, 30),
(2009, 'Men''s Open', 18, 23, 62, 116, 22),
(2008, 'Men''s Open', 21, 24, 79, 112, 52);

-- Finally seed results (depends on both leg_definitions and placements)
INSERT INTO results (year, leg_number, leg_version, runner, lap_time) VALUES 
(2009, 1, 1, 'Sean Lubbers', '01:42:00'::interval),
(2009, 2, 1, 'Chris Badolato', '00:55:00'::interval),
(2009, 3, 1, 'Rocky Lubbers', '02:28:00'::interval),
(2009, 4, 1, 'Peter Lubbers', '01:30:00'::interval),
(2009, 5, 1, 'Turi', '01:23:00'::interval),
(2009, 6, 1, 'Peter Lubbers', '01:28:00'::interval),
(2009, 7, 1, 'Hayes', '01:26:00'::interval),
(2011, 1, 1, NULL, '02:11:33'::interval),
(2011, 2, 1, NULL, '01:25:43'::interval),
(2011, 3, 1, NULL, '01:57:49'::interval),
(2011, 4, 1, NULL, '01:26:03'::interval),
(2011, 5, 1, NULL, '01:35:12'::interval),
(2011, 6, 1, NULL, '01:59:09'::interval),
(2011, 7, 1, NULL, '01:29:58'::interval),
(2012, 1, 1, 'Ricky Mendoza', '01:30:16'::interval),
(2012, 2, 1, 'Sean Lubbers', '01:25:22'::interval),
(2012, 3, 1, 'Lisa Brooks', '01:59:48'::interval),
(2012, 4, 1, 'Peter Lubbers', '02:06:17'::interval),
(2012, 5, 1, 'Rocky Lubbers', '02:03:25'::interval),
(2012, 6, 1, 'Nick Searle', '01:30:48'::interval),
(2012, 7, 1, 'Sean Searle', '01:24:09'::interval),
(2013, 1, 1, 'Rocky Lubbers', '01:48:13'::interval),
(2013, 2, 1, 'Peter Lubbers', '01:34:25'::interval),
(2013, 3, 1, 'Pamela H.', '01:51:18'::interval),
(2013, 4, 1, 'Damien', '01:45:53'::interval),
(2013, 5, 1, 'Oliver', '01:52:47'::interval),
(2013, 6, 1, 'Turi', '02:05:46'::interval),
(2013, 7, 1, 'Sean Lubbers', '01:32:27'::interval),
(2014, 1, 1, NULL, '01:41:59'::interval),
(2014, 2, 1, NULL, '01:13:10'::interval),
(2014, 3, 1, NULL, '01:41:46'::interval),
(2014, 4, 1, NULL, '02:01:46'::interval),
(2014, 5, 1, NULL, '01:49:14'::interval),
(2014, 6, 1, NULL, '01:46:11'::interval),
(2014, 7, 1, NULL, '01:57:53'::interval),
(2015, 1, 1, NULL, '01:53:09'::interval),
(2015, 2, 1, NULL, '01:07:38'::interval),
(2015, 3, 1, NULL, '01:45:52'::interval),
(2015, 4, 1, NULL, '01:54:06'::interval),
(2015, 5, 1, NULL, '02:15:10'::interval),
(2015, 6, 1, NULL, '02:11:07'::interval),
(2015, 7, 1, NULL, '01:34:34'::interval),
(2016, 1, 1, 'Rocky Lubbers', '01:48:38'::interval),
(2016, 2, 1, 'Sean Lubbers', '01:24:32'::interval),
(2016, 3, 1, 'Peter Lubbers', '01:28:24'::interval),
(2016, 4, 1, 'Nick Searle', '01:58:59'::interval),
(2016, 5, 1, NULL, '01:42:56'::interval),
(2016, 6, 1, NULL, '01:47:14'::interval),
(2016, 7, 1, 'Sean Searle', '01:57:31'::interval),
(2017, 1, 2, 'Sean Lubbers', '01:19:59'::interval),
(2017, 2, 2, 'Peter Lubbers', '02:11:05'::interval),
(2017, 3, 2, 'Rocky Lubbers', '01:33:07'::interval),
(2017, 4, 2, 'Lisa Brooks', '01:40:02'::interval),
(2017, 5, 2, 'Nikita Gamolsky', '01:39:37'::interval),
(2017, 6, 2, 'Sean Searle', '01:24:54'::interval),
(2017, 7, 2, 'Nick Searle', '01:32:51'::interval),
(2018, 1, 2, 'Rocky Lubbers', '01:27:24'::interval),
(2018, 2, 2, 'Sean Lubbers', '02:16:55'::interval),
(2018, 3, 2, 'Gabe Pannell', '01:27:14'::interval),
(2018, 4, 2, 'Elias Denny', '01:38:05'::interval),
(2018, 5, 2, 'Nick Searle', '01:36:03'::interval),
(2018, 6, 2, 'Nikita Gamolsky', '01:24:05'::interval),
(2018, 7, 2, 'Peter Lubbers', '01:42:14'::interval),
(2019, 1, 2, 'Gabe Pannell', '01:22:58'::interval),
(2019, 2, 2, 'Peter Lubbers', '02:26:39'::interval),
(2019, 3, 2, 'Rocky Lubbers', '01:35:03'::interval),
(2019, 4, 2, 'Nikita Gamolsky', '01:40:13'::interval),
(2019, 5, 2, 'Sean Lubbers', '01:26:44'::interval),
(2019, 6, 2, 'Nick Searle', '01:26:45'::interval),
(2019, 7, 2, 'Elias Denny', '02:04:04'::interval),
(2022, 1, 2, 'Gabe Pannell', '01:23:43'::interval),
(2022, 2, 2, 'Sean Lubbers', '02:03:21'::interval),
(2022, 3, 2, 'Rocky Lubbers', '01:40:33'::interval),
(2022, 4, 2, 'Nick Searle', '01:22:05'::interval),
(2022, 5, 2, 'Nikita Gamolsky', '01:53:47'::interval),
(2022, 6, 2, 'Morgen Harvey', '01:35:15'::interval),
(2022, 7, 2, 'Peter Lubbers', '01:31:35'::interval),
(2023, 1, 2, 'Nikita Gamolsky', '01:22:48'::interval),
(2023, 2, 2, 'Peter Lubbers', '01:41:47'::interval),
(2023, 3, 2, 'Nick Searle', '01:34:42'::interval),
(2023, 4, 2, 'Rocky Lubbers', '01:45:49'::interval),
(2023, 5, 2, 'Gabe Pannell', '01:34:41'::interval),
(2023, 6, 2, 'Multiple Runners', '01:22:13'::interval),
(2023, 7, 2, 'Sean Lubbers', '01:22:40'::interval),
(2024, 1, 2, 'Annie Strugatsky', '01:35:05'::interval),
(2024, 2, 2, 'Sean Lubbers', '01:59:15'::interval),
(2024, 3, 2, 'Nick Searle', '01:27:03'::interval),
(2024, 4, 2, 'Lisa Brooks', '01:32:37'::interval),
(2024, 5, 2, 'Sean Searle', '01:47:20'::interval),
(2024, 6, 2, 'Multiple Runners', '01:27:42'::interval),
(2024, 7, 2, 'Peter Lubbers', '01:39:44'::interval),
(2008, 1, 1, 'Hayes', '01:21:28'::interval),
(2008, 2, 1, 'Peter Lubbers', '01:02:59'::interval),
(2008, 3, 1, 'Rocky Lubbers', '02:10:24'::interval),
(2008, 4, 1, 'Turi', '01:38:33'::interval),
(2008, 5, 1, 'Sean Lubbers', '02:09:58'::interval),
(2008, 6, 1, 'Chris', '01:13:09'::interval),
(2008, 7, 1, 'Amber', '01:48:37'::interval);

-- Create the team_performance_summary view
CREATE OR REPLACE VIEW team_performance_summary AS
WITH yearly_totals AS (
  SELECT 
    r.year,
    sum(EXTRACT(epoch FROM r.lap_time)) AS total_seconds,
    sum(ld.distance) AS total_distance
  FROM results r
  JOIN leg_definitions ld ON r.leg_number = ld.number AND r.leg_version = ld.version
  GROUP BY r.year
), 
yearly_stats AS (
  SELECT 
    yt.year,
    yt.total_seconds,
    make_interval(secs => yt.total_seconds::double precision) AS total_time,
    CASE
      WHEN yt.total_distance > 0 THEN yt.total_seconds::double precision / yt.total_distance
      ELSE NULL::double precision
    END AS average_pace,
    p.division_place,
    p.division_teams,
    p.overall_place,
    p.overall_teams
  FROM yearly_totals yt
  JOIN placements p ON yt.year = p.year
)
SELECT 
  year,
  total_time,
  CASE
    WHEN average_pace IS NOT NULL THEN make_interval(secs => round(average_pace))
    ELSE NULL::interval
  END AS average_pace,
  division_place,
  division_teams,
  overall_place,
  overall_teams,
  lag(overall_place) OVER (ORDER BY year) - overall_place AS improvement
FROM yearly_stats
ORDER BY year; 