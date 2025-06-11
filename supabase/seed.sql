-- Reset the tables
TRUNCATE TABLE public.results CASCADE;
TRUNCATE TABLE public.placements CASCADE;
TRUNCATE TABLE public.leg_definitions CASCADE;

-- Insert leg definitions (version 1)
INSERT INTO public.leg_definitions (number, version, distance, elevation_gain)
VALUES 
  (1, 1, 5.2, 200),  -- 5.2 miles, 200ft elevation gain
  (2, 1, 4.8, 150),  -- 4.8 miles, 150ft elevation gain
  (3, 1, 6.1, 300),  -- 6.1 miles, 300ft elevation gain
  (4, 1, 5.5, 250),  -- 5.5 miles, 250ft elevation gain
  (5, 1, 4.9, 180),  -- 4.9 miles, 180ft elevation gain
  (6, 1, 5.7, 220),  -- 5.7 miles, 220ft elevation gain
  (7, 1, 4.5, 190);  -- 4.5 miles, 190ft elevation gain

-- Insert leg definitions (version 2 - slightly modified course)
INSERT INTO public.leg_definitions (number, version, distance, elevation_gain)
VALUES 
  (1, 2, 5.4, 220),  -- 5.4 miles, 220ft elevation gain
  (2, 2, 4.9, 160),  -- 4.9 miles, 160ft elevation gain
  (3, 2, 6.3, 320),  -- 6.3 miles, 320ft elevation gain
  (4, 2, 5.6, 270),  -- 5.6 miles, 270ft elevation gain
  (5, 2, 5.1, 190),  -- 5.1 miles, 190ft elevation gain
  (6, 2, 5.8, 230),  -- 5.8 miles, 230ft elevation gain
  (7, 2, 4.6, 200);  -- 4.6 miles, 200ft elevation gain

-- Insert placements for different years
INSERT INTO public.placements (year, division, division_place, division_teams, overall_place, overall_teams, bib)
VALUES 
  (2018, 'Mixed Open', 5, 20, 15, 50, 42),
  (2019, 'Mixed Open', 4, 20, 12, 50, 42),
  (2022, 'Masters', 3, 15, 12, 45, 42),
  (2023, 'Masters', 2, 15, 8, 45, 42),
  (2024, 'Masters', 1, 15, 5, 45, 42);

-- Insert results for 2018 (using version 1)
INSERT INTO public.results (year, leg_number, leg_version, runner, lap_time)
VALUES 
  (2018, 1, 1, 'John Smith', '00:38:00'),
  (2018, 2, 1, 'Jane Doe', '00:35:00'),
  (2018, 3, 1, 'Mike Johnson', '00:43:00'),
  (2018, 4, 1, 'Sarah Wilson', '00:41:00'),
  (2018, 5, 1, 'Alex Brown', '00:36:00'),
  (2018, 6, 1, 'Chris Lee', '00:40:00'),
  (2018, 7, 1, 'Emma Davis', '00:34:00');

-- Insert results for 2019 (using version 1)
INSERT INTO public.results (year, leg_number, leg_version, runner, lap_time)
VALUES 
  (2019, 1, 1, 'John Smith', '00:36:00'),
  (2019, 2, 1, 'Jane Doe', '00:33:00'),
  (2019, 3, 1, 'Mike Johnson', '00:41:00'),
  (2019, 4, 1, 'Sarah Wilson', '00:39:00'),
  (2019, 5, 1, 'Alex Brown', '00:34:00'),
  (2019, 6, 1, 'Chris Lee', '00:38:00'),
  (2019, 7, 1, 'Emma Davis', '00:32:00');

-- Insert results for 2022 (using version 1)
INSERT INTO public.results (year, leg_number, leg_version, runner, lap_time)
VALUES 
  (2022, 1, 1, 'John Smith', '00:35:00'),
  (2022, 2, 1, 'Jane Doe', '00:32:00'),
  (2022, 3, 1, 'Mike Johnson', '00:40:00'),
  (2022, 4, 1, 'Sarah Wilson', '00:38:00'),
  (2022, 5, 1, 'Alex Brown', '00:33:00'),
  (2022, 6, 1, 'Chris Lee', '00:37:00'),
  (2022, 7, 1, 'Emma Davis', '00:31:00');

-- Insert results for 2023 (using version 2)
INSERT INTO public.results (year, leg_number, leg_version, runner, lap_time)
VALUES 
  (2023, 1, 2, 'John Smith', '00:34:00'),
  (2023, 2, 2, 'Jane Doe', '00:31:00'),
  (2023, 3, 2, 'Mike Johnson', '00:39:00'),
  (2023, 4, 2, 'Sarah Wilson', '00:37:00'),
  (2023, 5, 2, 'Alex Brown', '00:32:00'),
  (2023, 6, 2, 'Chris Lee', '00:36:00'),
  (2023, 7, 2, 'Emma Davis', '00:30:00');

-- Insert results for 2024 (using version 2)
INSERT INTO public.results (year, leg_number, leg_version, runner, lap_time)
VALUES 
  (2024, 1, 2, 'John Smith', '00:33:00'),
  (2024, 2, 2, 'Jane Doe', '00:30:00'),
  (2024, 3, 2, 'Mike Johnson', '00:38:00'),
  (2024, 4, 2, 'Sarah Wilson', '00:36:00'),
  (2024, 5, 2, 'Alex Brown', '00:31:00'),
  (2024, 6, 2, 'Chris Lee', '00:35:00'),
  (2024, 7, 2, 'Emma Davis', '00:29:00'); 