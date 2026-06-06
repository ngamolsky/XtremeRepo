import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Image,
  MessageSquare,
  Save,
  Star,
  Tag,
  Trash2,
} from "lucide-react";
import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Tables } from "../types/database.types";

type RacePhoto = Tables<"race_photos">;
type RacePhotoNote = Tables<"race_photo_notes">;
type Runner = Pick<Tables<"runners">, "auth_user_id" | "name">;
type PhotoWithUrl = RacePhoto & { url: string };
type NoteAuthor = {
  displayName: string;
};

const PhotoDetailView: React.FC = () => {
  const { photoId } = useParams({ from: "/photos/$photoId" });
  const navigate = useNavigate();
  const [photo, setPhoto] = useState<PhotoWithUrl | null>(null);
  const [notes, setNotes] = useState<RacePhotoNote[]>([]);
  const [noteAuthors, setNoteAuthors] = useState<Record<string, NoteAuthor>>({});
  const [noteText, setNoteText] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingCover, setSettingCover] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPhoto() {
      setLoading(true);
      setLoadError(null);
      setCoverError(null);
      setNoteError(null);
      setDeleteError(null);
      setDeleteConfirmation("");

      const [photoResult, notesResult] = await Promise.all([
        supabase.from("race_photos").select("*").eq("id", photoId).maybeSingle(),
        supabase
          .from("race_photo_notes")
          .select("*")
          .eq("photo_id", photoId)
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) {
        return;
      }

      if (photoResult.error) {
        setLoadError(photoResult.error.message);
        setPhoto(null);
        setNotes([]);
        setNoteAuthors({});
      } else if (!photoResult.data) {
        setLoadError("Photo not found");
        setPhoto(null);
        setNotes([]);
        setNoteAuthors({});
      } else if (notesResult.error) {
        setLoadError(notesResult.error.message);
        setPhoto(null);
        setNotes([]);
        setNoteAuthors({});
      } else {
        const loadedPhoto = photoResult.data;
        const loadedNotes = notesResult.data ?? [];
        const authorIds = getUniqueAuthorIds(loadedNotes);
        const authorsById = await loadNoteAuthors(authorIds);

        if (cancelled) {
          return;
        }

        setPhoto({
          ...loadedPhoto,
          url: supabase.storage
            .from(loadedPhoto.storage_bucket)
            .getPublicUrl(loadedPhoto.storage_path).data.publicUrl,
        });
        setNotes(loadedNotes);
        setNoteAuthors(authorsById);
      }

      setLoading(false);
    }

    loadPhoto();

    return () => {
      cancelled = true;
    };
  }, [photoId]);

  const caption = useMemo(() => {
    if (!photo) {
      return "";
    }

    return photo.caption || `${photo.year} ${photo.race}`;
  }, [photo]);
  const canDelete = deleteConfirmation.trim().toLowerCase() === "delete";

  async function handleAddNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const body = noteText.trim();

    if (!photo || !body) {
      return;
    }

    setSaving(true);
    setNoteError(null);

    const { data, error } = await supabase
      .from("race_photo_notes")
      .insert({ photo_id: photo.id, body })
      .select("*")
      .single();

    if (error) {
      setNoteError(error.message);
    } else if (data) {
      setNotes((currentNotes) => [data, ...currentNotes]);
      if (data.author_id && !noteAuthors[data.author_id]) {
        const authorsById = await loadNoteAuthors([data.author_id]);
        setNoteAuthors((currentAuthors) => ({
          ...currentAuthors,
          ...authorsById,
        }));
      }
      setNoteText("");
    }

    setSaving(false);
  }

  async function handleSetYearCover() {
    if (!photo || photo.featured) {
      return;
    }

    setSettingCover(true);
    setCoverError(null);

    const clearResult = await supabase
      .from("race_photos")
      .update({ featured: false })
      .eq("year", photo.year)
      .neq("id", photo.id);

    if (clearResult.error) {
      setCoverError(clearResult.error.message);
      setSettingCover(false);
      return;
    }

    const { data, error } = await supabase
      .from("race_photos")
      .update({ featured: true })
      .eq("id", photo.id)
      .select("*")
      .single();

    if (error) {
      setCoverError(error.message);
    } else if (data) {
      setPhoto((currentPhoto) => {
        if (!currentPhoto) {
          return currentPhoto;
        }

        return {
          ...currentPhoto,
          ...data,
          url: currentPhoto.url,
        };
      });
    }

    setSettingCover(false);
  }

  async function handleDeletePhoto() {
    if (!photo || !canDelete) {
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    const storageResult = await supabase.storage
      .from(photo.storage_bucket)
      .remove([photo.storage_path]);

    if (storageResult.error) {
      setDeleteError(storageResult.error.message);
      setDeleting(false);
      return;
    }

    const metadataResult = await supabase
      .from("race_photos")
      .delete()
      .eq("id", photo.id);

    if (metadataResult.error) {
      setDeleteError(metadataResult.error.message);
      setDeleting(false);
      return;
    }

    await navigate({
      to: "/photos",
      search: { race: undefined, year: undefined },
    });
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <BackLink />
        <div className="card overflow-hidden">
          <div className="h-[60vh] animate-pulse bg-gray-100 dark:bg-slate-800" />
          <div className="space-y-3 p-6">
            <div className="h-6 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-slate-800" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-gray-100 dark:bg-slate-800" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !photo) {
    return (
      <div className="space-y-6 animate-fade-in">
        <BackLink />
        <div className="text-center py-12">
          <Image className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Could not load photo</h1>
          <p className="text-gray-600">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <BackLink />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <img
              src={photo.url}
              alt={photo.alt_text || caption}
              className="max-h-[75vh] w-full bg-gray-100 object-contain dark:bg-slate-800"
            />
          </div>

          <section className="card p-6">
            <h1 className="text-3xl font-bold text-gray-900">{caption}</h1>
            <div className="mt-4 grid grid-cols-1 gap-4 text-sm text-gray-600 sm:grid-cols-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary-600" />
                <span>{photo.year}</span>
              </div>
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary-600" />
                <span>{formatLabel(photo.category)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Image className="h-4 w-4 text-primary-600" />
                <span>{photo.race}</span>
              </div>
            </div>

            {photo.tags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {photo.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {formatLabel(tag)}
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-6">
            <div className="mb-4 flex items-center gap-2">
              <Star className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">Year Cover</h2>
            </div>

            {coverError && <p className="mb-3 text-sm text-red-600">{coverError}</p>}
            <button
              type="button"
              onClick={handleSetYearCover}
              disabled={photo.featured || settingCover}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 transition-colors hover:border-primary-300 hover:bg-primary-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-500 dark:border-primary-900/60 dark:bg-primary-950/40 dark:text-primary-200 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-400"
            >
              <Star className={`h-4 w-4 ${photo.featured ? "fill-current" : ""}`} />
              <span>
                {photo.featured
                  ? "Current year cover"
                  : settingCover
                    ? "Setting cover..."
                    : "Set as year cover"}
              </span>
            </button>
          </section>

          <section className="card border-red-200 p-6 dark:border-red-900/60">
            <div className="mb-4 flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              <h2 className="text-lg font-semibold text-gray-900">Delete Photo</h2>
            </div>

            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
              <div className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                <p>
                  This removes the image from the gallery and Supabase Storage.
                  Attached notes are deleted too.
                </p>
              </div>
            </div>

            <label className="block text-sm font-medium text-gray-700" htmlFor="delete-photo">
              Type delete to confirm
            </label>
            <input
              id="delete-photo"
              type="text"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              disabled={deleting}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-transparent focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed disabled:bg-gray-100"
            />
            {deleteError && <p className="mt-3 text-sm text-red-600">{deleteError}</p>}
            <button
              type="button"
              onClick={handleDeletePhoto}
              disabled={!canDelete || deleting}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 dark:bg-red-500 dark:hover:bg-red-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-400"
            >
              <Trash2 className="h-4 w-4" />
              <span>{deleting ? "Deleting..." : "Delete photo"}</span>
            </button>
          </section>

          <section className="card p-6">
            <div className="mb-4 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
            </div>

            <form onSubmit={handleAddNote} className="space-y-3">
              <textarea
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                rows={4}
                placeholder="Add a note..."
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-transparent focus:ring-2 focus:ring-primary-500"
              />
              {noteError && <p className="text-sm text-red-600">{noteError}</p>}
              <button
                type="submit"
                disabled={saving || noteText.trim().length === 0}
                className="btn-primary inline-flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? "Saving..." : "Save Note"}</span>
              </button>
            </form>
          </section>

          <section className="space-y-3">
            {notes.length === 0 ? (
              <div className="card p-5 text-sm text-gray-600">No notes yet.</div>
            ) : (
              notes.map((note) => (
                <article key={note.id} className="card p-5">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-gray-800">{note.body}</p>
                  <p className="mt-3 text-xs text-gray-500">
                    {formatNoteByline(note, noteAuthors)}
                  </p>
                </article>
              ))
            )}
          </section>
        </aside>
      </div>
    </div>
  );
};

const BackLink: React.FC = () => (
  <Link
    to="/photos"
    search={{ race: undefined, year: undefined }}
    className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-primary-700"
  >
    <ArrowLeft className="h-4 w-4" />
    <span>Back to photos</span>
  </Link>
);

function formatLabel(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getUniqueAuthorIds(notes: RacePhotoNote[]) {
  return Array.from(
    new Set(
      notes
        .map((note) => note.author_id)
        .filter((authorId): authorId is string => Boolean(authorId))
    )
  );
}

async function loadNoteAuthors(authorIds: string[]) {
  if (authorIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from("runners")
    .select("auth_user_id,name")
    .in("auth_user_id", authorIds);

  if (error) {
    return {};
  }

  return (data as Runner[]).reduce<Record<string, NoteAuthor>>((authorsById, runner) => {
    if (runner.auth_user_id) {
      authorsById[runner.auth_user_id] = { displayName: runner.name };
    }

    return authorsById;
  }, {});
}

function formatNoteByline(
  note: RacePhotoNote,
  noteAuthors: Record<string, NoteAuthor>
) {
  const authorName = note.author_id
    ? noteAuthors[note.author_id]?.displayName ?? `User ${note.author_id.slice(0, 8)}`
    : "Unknown author";

  return `${authorName} recorded ${formatDate(note.created_at)}`;
}

export default PhotoDetailView;
