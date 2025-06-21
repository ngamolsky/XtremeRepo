-- Insert runners (with consistent UUIDs for referencing)
INSERT INTO public.runners (id, email, name, created_at, updated_at) VALUES
('d99aaef9-1259-4b7d-8731-d89d8ec003d1', NULL, 'Amber', NOW(), NOW()),
('d99aaef9-1259-4b7d-8731-d89d8ec003d2', NULL, 'Annie Strugatsky', NOW(), NOW()),
('d99aaef9-1259-4b7d-8731-d89d8ec003d3', NULL, 'Chris', NOW(), NOW()),
('d99aaef9-1259-4b7d-8731-d89d8ec003d4', NULL, 'Chris Badolato', NOW(), NOW()),
('d99aaef9-1259-4b7d-8731-d89d8ec003d5', NULL, 'Damien', NOW(), NOW()),
('d99aaef9-1259-4b7d-8731-d89d8ec003d6', NULL, 'Elias Denny', NOW(), NOW()),
('d99aaef9-1259-4b7d-8731-d89d8ec003d7', NULL, 'Gabe Pannell', NOW(), NOW()),
('d99aaef9-1259-4b7d-8731-d89d8ec003d8', NULL, 'Hayes', NOW(), NOW()),
('d99aaef9-1259-4b7d-8731-d89d8ec003d9', NULL, 'Lisa Brooks', NOW(), NOW()),
('d99aaef9-1259-4b7d-8731-d89d8ec003da', NULL, 'Morgen Harvey', NOW(), NOW()),
('d99aaef9-1259-4b7d-8731-d89d8ec003db', NULL, 'Multiple Runners', NOW(), NOW()),
('d99aaef9-1259-4b7d-8731-d89d8ec003dc', 'nick@xtreme-falcons.com', 'Nick Searle', NOW(), NOW()),
('d99aaef9-1259-4b7d-8731-d89d8ec003dd', 'nikita@xtreme-falcons.com', 'Nikita Gamolsky', NOW(), NOW()),
('d99aaef9-1259-4b7d-8731-d89d8ec003de', NULL, 'Oliver', NOW(), NOW()),
('d99aaef9-1259-4b7d-8731-d89d8ec003df', NULL, 'Pamela H.', NOW(), NOW()),
('d99aaef9-1259-4b7d-8731-d89d8ec003e0', 'peter@xtreme-falcons.com', 'Peter Lubbers', NOW(), NOW()),
('d99aaef9-1259-4b7d-8731-d89d8ec003e1', NULL, 'Ricky Mendoza', NOW(), NOW()),
('d99aaef9-1259-4b7d-8731-d89d8ec003e2', 'rocky@xtreme-falcons.com', 'Rocky Lubbers', NOW(), NOW()),
('d99aaef9-1259-4b7d-8731-d89d8ec003e3', 'sean@xtreme-falcons.com', 'Sean Lubbers', NOW(), NOW()),
('d99aaef9-1259-4b7d-8731-d89d8ec003e4', 'ssearle@xtreme-falcons.com', 'Sean Searle', NOW(), NOW()),
('d99aaef9-1259-4b7d-8731-d89d8ec003e5', NULL, 'Turi', NOW(), NOW());

-- Insert leg definitions
INSERT INTO public.leg_definitions (number, version, distance, elevation_gain) VALUES
(1, 1, 9.6, NULL),
(1, 2, 9.05, 528),
(2, 1, 8.2, NULL),
(2, 2, 13.1, 1234),
(3, 1, 10.3, NULL),
(3, 2, 9.6, 510),
(4, 1, 12.3, NULL),
(4, 2, 9.5, 552),
(5, 1, 10.6, NULL),
(5, 2, 10.7, 527),
(6, 1, 10.5, NULL),
(6, 2, 8.65, 1268),
(7, 1, 10.5, NULL),
(7, 2, 11.02, 244);

-- Insert placements
INSERT INTO public.placements (year, division, division_place, division_teams, overall_place, overall_teams, bib) VALUES
(2008, 'Men''s Open', 21, 24, 79, 112, 52),
(2009, 'Men''s Open', 18, 23, 62, 116, 22),
(2011, 'Men''s Open', 19, 19, 97, 119, 30),
(2012, 'Men''s Open', 19, 20, 99, 119, 15),
(2013, 'Men''s Open', 15, 17, 103, 120, 41),
(2014, 'Mixed Open', 11, 11, 105, 122, 98),
(2015, 'Men''s Open', 13, 13, 83, 89, 22),
(2016, 'Men''s Open', 7, 8, 54, 62, 18),
(2017, 'Men''s Open', 8, 9, 47, 63, 3),
(2018, 'Men''s Open', 8, 9, 56, 66, 7),
(2019, 'Men''s Open', 10, 10, 57, 70, 2),
(2022, 'Mixed Open', 6, 12, 19, 26, 24),
(2023, 'Mixed Open', 8, 17, 20, 41, 29),
(2024, 'Mixed Open', 10, 19, 29, 43, 16);

-- Insert results (with user_id references)
INSERT INTO public.results (year, leg_number, leg_version, user_id, lap_time) VALUES
-- 2008
(2008, 1, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003d8', INTERVAL '01:21:28'), -- Hayes
(2008, 2, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003e0', INTERVAL '01:02:59'), -- Peter Lubbers
(2008, 3, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003e2', INTERVAL '02:10:24'), -- Rocky Lubbers
(2008, 4, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003e5', INTERVAL '01:38:33'), -- Turi
(2008, 5, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003e3', INTERVAL '02:09:58'), -- Sean Lubbers
(2008, 6, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003d3', INTERVAL '01:13:09'), -- Chris
(2008, 7, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003d1', INTERVAL '01:48:37'), -- Amber

-- 2009
(2009, 1, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003e3', INTERVAL '01:42:00'), -- Sean Lubbers
(2009, 2, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003d4', INTERVAL '00:55:00'), -- Chris Badolato
(2009, 3, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003e2', INTERVAL '02:28:00'), -- Rocky Lubbers
(2009, 4, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003e0', INTERVAL '01:30:00'), -- Peter Lubbers
(2009, 5, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003e5', INTERVAL '01:23:00'), -- Turi
(2009, 6, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003e0', INTERVAL '01:28:00'), -- Peter Lubbers
(2009, 7, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003d8', INTERVAL '01:26:00'), -- Hayes

-- 2011 (null runners preserved as null user_ids)
(2011, 1, 1, NULL, INTERVAL '02:11:33'),
(2011, 2, 1, NULL, INTERVAL '01:25:43'),
(2011, 3, 1, NULL, INTERVAL '01:57:49'),
(2011, 4, 1, NULL, INTERVAL '01:26:03'),
(2011, 5, 1, NULL, INTERVAL '01:35:12'),
(2011, 6, 1, NULL, INTERVAL '01:59:09'),
(2011, 7, 1, NULL, INTERVAL '01:29:58'),

-- 2012
(2012, 1, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003e1', INTERVAL '01:30:16'), -- Ricky Mendoza
(2012, 2, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003e3', INTERVAL '01:25:22'), -- Sean Lubbers
(2012, 3, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003d9', INTERVAL '01:59:48'), -- Lisa Brooks
(2012, 4, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003e0', INTERVAL '02:06:17'), -- Peter Lubbers
(2012, 5, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003e2', INTERVAL '02:03:25'), -- Rocky Lubbers
(2012, 6, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003dc', INTERVAL '01:30:48'), -- Nick Searle
(2012, 7, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003e4', INTERVAL '01:24:09'), -- Sean Searle

-- 2013
(2013, 1, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003e2', INTERVAL '01:48:13'), -- Rocky Lubbers
(2013, 2, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003e0', INTERVAL '01:34:25'), -- Peter Lubbers
(2013, 3, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003df', INTERVAL '01:51:18'), -- Pamela H.
(2013, 4, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003d5', INTERVAL '01:45:53'), -- Damien
(2013, 5, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003de', INTERVAL '01:52:47'), -- Oliver
(2013, 6, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003e5', INTERVAL '02:05:46'), -- Turi
(2013, 7, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003e3', INTERVAL '01:32:27'), -- Sean Lubbers

-- 2014 (null runners preserved as null user_ids)
(2014, 1, 1, NULL, INTERVAL '01:41:59'),
(2014, 2, 1, NULL, INTERVAL '01:13:10'),
(2014, 3, 1, NULL, INTERVAL '01:41:46'),
(2014, 4, 1, NULL, INTERVAL '02:01:46'),
(2014, 5, 1, NULL, INTERVAL '01:49:14'),
(2014, 6, 1, NULL, INTERVAL '01:46:11'),
(2014, 7, 1, NULL, INTERVAL '01:57:53'),

-- 2015 (null runners preserved as null user_ids)
(2015, 1, 1, NULL, INTERVAL '01:53:09'),
(2015, 2, 1, NULL, INTERVAL '01:07:38'),
(2015, 3, 1, NULL, INTERVAL '01:45:52'),
(2015, 4, 1, NULL, INTERVAL '01:54:06'),
(2015, 5, 1, NULL, INTERVAL '02:15:10'),
(2015, 6, 1, NULL, INTERVAL '02:11:07'),
(2015, 7, 1, NULL, INTERVAL '01:34:34'),

-- 2016
(2016, 1, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003e2', INTERVAL '01:48:38'), -- Rocky Lubbers
(2016, 2, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003e3', INTERVAL '01:24:32'), -- Sean Lubbers
(2016, 3, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003e0', INTERVAL '01:28:24'), -- Peter Lubbers
(2016, 4, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003dc', INTERVAL '01:58:59'), -- Nick Searle
(2016, 5, 1, NULL, INTERVAL '01:42:56'),
(2016, 6, 1, NULL, INTERVAL '01:47:14'),
(2016, 7, 1, 'd99aaef9-1259-4b7d-8731-d89d8ec003e4', INTERVAL '01:57:31'), -- Sean Searle

-- 2017 (Version 2 starts here)
(2017, 1, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003e3', INTERVAL '01:19:59'), -- Sean Lubbers
(2017, 2, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003e0', INTERVAL '02:11:05'), -- Peter Lubbers
(2017, 3, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003e2', INTERVAL '01:33:07'), -- Rocky Lubbers
(2017, 4, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003d9', INTERVAL '01:40:02'), -- Lisa Brooks
(2017, 5, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003dd', INTERVAL '01:39:37'), -- Nikita Gamolsky
(2017, 6, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003e4', INTERVAL '01:24:54'), -- Sean Searle
(2017, 7, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003dc', INTERVAL '01:32:51'), -- Nick Searle

-- 2018
(2018, 1, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003e2', INTERVAL '01:27:24'), -- Rocky Lubbers
(2018, 2, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003e3', INTERVAL '02:16:55'), -- Sean Lubbers
(2018, 3, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003d7', INTERVAL '01:27:14'), -- Gabe Pannell
(2018, 4, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003d6', INTERVAL '01:38:05'), -- Elias Denny
(2018, 5, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003dc', INTERVAL '01:36:03'), -- Nick Searle
(2018, 6, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003dd', INTERVAL '01:24:05'), -- Nikita Gamolsky
(2018, 7, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003e0', INTERVAL '01:42:14'), -- Peter Lubbers

-- 2019
(2019, 1, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003d7', INTERVAL '01:22:58'), -- Gabe Pannell
(2019, 2, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003e0', INTERVAL '02:26:39'), -- Peter Lubbers
(2019, 3, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003e2', INTERVAL '01:35:03'), -- Rocky Lubbers
(2019, 4, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003dd', INTERVAL '01:40:13'), -- Nikita Gamolsky
(2019, 5, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003e3', INTERVAL '01:26:44'), -- Sean Lubbers
(2019, 6, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003dc', INTERVAL '01:26:45'), -- Nick Searle
(2019, 7, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003d6', INTERVAL '02:04:04'), -- Elias Denny

-- 2022
(2022, 1, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003d7', INTERVAL '01:23:43'), -- Gabe Pannell
(2022, 2, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003e3', INTERVAL '02:03:21'), -- Sean Lubbers
(2022, 3, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003e2', INTERVAL '01:40:33'), -- Rocky Lubbers
(2022, 4, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003dc', INTERVAL '01:22:05'), -- Nick Searle
(2022, 5, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003dd', INTERVAL '01:53:47'), -- Nikita Gamolsky
(2022, 6, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003da', INTERVAL '01:35:15'), -- Morgen Harvey
(2022, 7, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003e0', INTERVAL '01:31:35'), -- Peter Lubbers

-- 2023
(2023, 1, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003dd', INTERVAL '01:22:48'), -- Nikita Gamolsky
(2023, 2, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003e0', INTERVAL '01:41:47'), -- Peter Lubbers
(2023, 3, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003dc', INTERVAL '01:34:42'), -- Nick Searle
(2023, 4, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003e2', INTERVAL '01:45:49'), -- Rocky Lubbers
(2023, 5, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003d7', INTERVAL '01:34:41'), -- Gabe Pannell
(2023, 6, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003db', INTERVAL '01:22:13'), -- Multiple Runners
(2023, 7, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003e3', INTERVAL '01:22:40'), -- Sean Lubbers

-- 2024
(2024, 1, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003d2', INTERVAL '01:35:05'), -- Annie Strugatsky
(2024, 2, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003e3', INTERVAL '01:59:15'), -- Sean Lubbers
(2024, 3, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003dc', INTERVAL '01:27:03'), -- Nick Searle
(2024, 4, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003d9', INTERVAL '01:32:37'), -- Lisa Brooks
(2024, 5, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003e4', INTERVAL '01:47:20'), -- Sean Searle
(2024, 6, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003db', INTERVAL '01:27:42'), -- Multiple Runners
(2024, 7, 2, 'd99aaef9-1259-4b7d-8731-d89d8ec003e0', INTERVAL '01:39:44'); -- Peter Lubbers
