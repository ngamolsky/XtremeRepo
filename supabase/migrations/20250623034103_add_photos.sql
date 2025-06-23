create table "public"."photo_tags" (
    "photo_id" uuid not null,
    "runner_id" uuid not null
);


alter table "public"."photo_tags" enable row level security;

create table "public"."photos" (
    "id" uuid not null default gen_random_uuid(),
    "year" smallint not null,
    "leg_number" smallint,
    "leg_version" smallint,
    "storage_path" text not null,
    "file_name" text not null,
    "file_size" bigint,
    "mime_type" text,
    "caption" text,
    "category" text,
    "is_public" boolean default true,
    "uploaded_by" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."photos" enable row level security;

CREATE INDEX photo_tags_photo_id_idx ON public.photo_tags USING btree (photo_id);

CREATE UNIQUE INDEX photo_tags_pkey ON public.photo_tags USING btree (photo_id, runner_id);

CREATE INDEX photo_tags_runner_id_idx ON public.photo_tags USING btree (runner_id);

CREATE INDEX photos_category_idx ON public.photos USING btree (category);

CREATE INDEX photos_created_at_idx ON public.photos USING btree (created_at);

CREATE INDEX photos_is_public_idx ON public.photos USING btree (is_public);

CREATE INDEX photos_leg_number_idx ON public.photos USING btree (leg_number);

CREATE UNIQUE INDEX photos_pkey ON public.photos USING btree (id);

CREATE INDEX photos_uploaded_by_idx ON public.photos USING btree (uploaded_by);

CREATE INDEX photos_year_idx ON public.photos USING btree (year);

alter table "public"."photo_tags" add constraint "photo_tags_pkey" PRIMARY KEY using index "photo_tags_pkey";

alter table "public"."photos" add constraint "photos_pkey" PRIMARY KEY using index "photos_pkey";

alter table "public"."photo_tags" add constraint "photo_tags_photo_id_fkey" FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE not valid;

alter table "public"."photo_tags" validate constraint "photo_tags_photo_id_fkey";

alter table "public"."photo_tags" add constraint "photo_tags_runner_id_fkey" FOREIGN KEY (runner_id) REFERENCES runners(id) ON DELETE CASCADE not valid;

alter table "public"."photo_tags" validate constraint "photo_tags_runner_id_fkey";

alter table "public"."photos" add constraint "photos_category_check" CHECK ((category = ANY (ARRAY['action'::text, 'team'::text, 'celebration'::text, 'preparation'::text, 'finish'::text, 'start'::text, 'candid'::text, 'awards'::text]))) not valid;

alter table "public"."photos" validate constraint "photos_category_check";

alter table "public"."photos" add constraint "photos_leg_number_fkey" FOREIGN KEY (leg_number, leg_version) REFERENCES leg_definitions(number, version) not valid;

alter table "public"."photos" validate constraint "photos_leg_number_fkey";

alter table "public"."photos" add constraint "photos_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) not valid;

alter table "public"."photos" validate constraint "photos_uploaded_by_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$function$
;

grant delete on table "public"."photo_tags" to "anon";

grant insert on table "public"."photo_tags" to "anon";

grant references on table "public"."photo_tags" to "anon";

grant select on table "public"."photo_tags" to "anon";

grant trigger on table "public"."photo_tags" to "anon";

grant truncate on table "public"."photo_tags" to "anon";

grant update on table "public"."photo_tags" to "anon";

grant delete on table "public"."photo_tags" to "authenticated";

grant insert on table "public"."photo_tags" to "authenticated";

grant references on table "public"."photo_tags" to "authenticated";

grant select on table "public"."photo_tags" to "authenticated";

grant trigger on table "public"."photo_tags" to "authenticated";

grant truncate on table "public"."photo_tags" to "authenticated";

grant update on table "public"."photo_tags" to "authenticated";

grant delete on table "public"."photo_tags" to "service_role";

grant insert on table "public"."photo_tags" to "service_role";

grant references on table "public"."photo_tags" to "service_role";

grant select on table "public"."photo_tags" to "service_role";

grant trigger on table "public"."photo_tags" to "service_role";

grant truncate on table "public"."photo_tags" to "service_role";

grant update on table "public"."photo_tags" to "service_role";

grant delete on table "public"."photos" to "anon";

grant insert on table "public"."photos" to "anon";

grant references on table "public"."photos" to "anon";

grant select on table "public"."photos" to "anon";

grant trigger on table "public"."photos" to "anon";

grant truncate on table "public"."photos" to "anon";

grant update on table "public"."photos" to "anon";

grant delete on table "public"."photos" to "authenticated";

grant insert on table "public"."photos" to "authenticated";

grant references on table "public"."photos" to "authenticated";

grant select on table "public"."photos" to "authenticated";

grant trigger on table "public"."photos" to "authenticated";

grant truncate on table "public"."photos" to "authenticated";

grant update on table "public"."photos" to "authenticated";

grant delete on table "public"."photos" to "service_role";

grant insert on table "public"."photos" to "service_role";

grant references on table "public"."photos" to "service_role";

grant select on table "public"."photos" to "service_role";

grant trigger on table "public"."photos" to "service_role";

grant truncate on table "public"."photos" to "service_role";

grant update on table "public"."photos" to "service_role";

create policy "Allow authenticated users to create photo_tags"
on "public"."photo_tags"
as permissive
for insert
to authenticated
with check (true);


create policy "Allow authenticated users to read photo_tags"
on "public"."photo_tags"
as permissive
for select
to authenticated
using (true);


create policy "Allow users to delete their own tags or tags on their photos"
on "public"."photo_tags"
as permissive
for delete
to authenticated
using (((runner_id = ( SELECT runners.id
   FROM runners
  WHERE (runners.auth_user_id = auth.uid()))) OR (photo_id IN ( SELECT photos.id
   FROM photos
  WHERE (photos.uploaded_by = ( SELECT runners.id
           FROM runners
          WHERE (runners.auth_user_id = auth.uid())))))));


create policy "Authenticated users can upload photos"
on "public"."photos"
as permissive
for insert
to authenticated
with check ((auth.uid() = uploaded_by));


create policy "Authenticated users can view photos"
on "public"."photos"
as permissive
for select
to authenticated
using (true);


create policy "Public photos are viewable by everyone"
on "public"."photos"
as permissive
for select
to public
using ((is_public = true));


create policy "Users can delete their own photos"
on "public"."photos"
as permissive
for delete
to authenticated
using ((auth.uid() = uploaded_by));


create policy "Users can update their own photos"
on "public"."photos"
as permissive
for update
to authenticated
using ((auth.uid() = uploaded_by))
with check ((auth.uid() = uploaded_by));


CREATE TRIGGER update_photos_updated_at BEFORE UPDATE ON public.photos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


