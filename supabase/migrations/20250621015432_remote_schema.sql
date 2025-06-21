drop trigger if exists "link_auth_user_trigger" on "public"."runners";

drop trigger if exists "update_runners_updated_at" on "public"."runners";

drop policy "Allow authenticated users to read runners" on "public"."runners";

revoke delete on table "public"."runners" from "anon";

revoke insert on table "public"."runners" from "anon";

revoke references on table "public"."runners" from "anon";

revoke select on table "public"."runners" from "anon";

revoke trigger on table "public"."runners" from "anon";

revoke truncate on table "public"."runners" from "anon";

revoke update on table "public"."runners" from "anon";

revoke delete on table "public"."runners" from "authenticated";

revoke insert on table "public"."runners" from "authenticated";

revoke references on table "public"."runners" from "authenticated";

revoke select on table "public"."runners" from "authenticated";

revoke trigger on table "public"."runners" from "authenticated";

revoke truncate on table "public"."runners" from "authenticated";

revoke update on table "public"."runners" from "authenticated";

revoke delete on table "public"."runners" from "service_role";

revoke insert on table "public"."runners" from "service_role";

revoke references on table "public"."runners" from "service_role";

revoke select on table "public"."runners" from "service_role";

revoke trigger on table "public"."runners" from "service_role";

revoke truncate on table "public"."runners" from "service_role";

revoke update on table "public"."runners" from "service_role";

alter table "public"."results" drop constraint "results_user_id_fkey";

alter table "public"."runners" drop constraint "runners_auth_user_id_fkey";

alter table "public"."runners" drop constraint "runners_email_unique";

drop function if exists "public"."link_auth_user"();

drop function if exists "public"."link_runner_to_auth_user"();

drop function if exists "public"."update_updated_at_column"();

drop view if exists "public"."v_leg_version_stats";

drop view if exists "public"."v_runner_stats";

drop view if exists "public"."v_yearly_summary";

drop view if exists "public"."team_performance_summary";

drop view if exists "public"."v_results_with_pace";

drop function if exists "public"."parse_time_to_minutes"(time_interval interval);

alter table "public"."runners" drop constraint "runners_pkey";

drop index if exists "public"."runners_email_unique";

drop index if exists "public"."runners_pkey";

drop table "public"."runners";

alter table "public"."results" drop column "user_id";

alter table "public"."results" add column "runner" text;

create or replace view "public"."team_performance_summary" as  WITH yearly_totals AS (
         SELECT r.year,
            sum(EXTRACT(epoch FROM r.lap_time)) AS total_seconds,
            sum(ld.distance) AS total_distance
           FROM (results r
             JOIN leg_definitions ld ON (((r.leg_number = ld.number) AND (r.leg_version = ld.version))))
          GROUP BY r.year
        ), yearly_stats AS (
         SELECT yt.year,
            yt.total_seconds,
            make_interval(secs => (yt.total_seconds)::double precision) AS total_time,
                CASE
                    WHEN (yt.total_distance > (0)::double precision) THEN ((yt.total_seconds)::double precision / yt.total_distance)
                    ELSE NULL::double precision
                END AS average_pace,
            p.division_place,
            p.division_teams,
            p.overall_place,
            p.overall_teams
           FROM (yearly_totals yt
             JOIN placements p ON ((yt.year = p.year)))
        )
 SELECT year,
    total_time,
        CASE
            WHEN (average_pace IS NOT NULL) THEN make_interval(secs => round(average_pace))
            ELSE NULL::interval
        END AS average_pace,
    division_place,
    division_teams,
    overall_place,
    overall_teams,
    (lag(overall_place) OVER (ORDER BY year) - overall_place) AS improvement
   FROM yearly_stats
  ORDER BY year;


create policy "Allow authenticated users to insert placements"
on "public"."placements"
as permissive
for insert
to authenticated
with check (true);


create policy "Allow authenticated users to update placements"
on "public"."placements"
as permissive
for update
to authenticated
using (true);


create policy "Allow authenticated users to insert results"
on "public"."results"
as permissive
for insert
to authenticated
with check (true);


create policy "Allow authenticated users to update results"
on "public"."results"
as permissive
for update
to authenticated
using (true);



