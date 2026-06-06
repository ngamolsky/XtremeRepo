import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, Calendar, Image, MessageSquare, Save, Tag } from "lucide-react";
import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Tables } from "../types/database.types";

type RacePhoto = Tables<"race_photos">;
type RacePhotoNote = Tables<"race_photo_notes">;
type PhotoWithUrl = RacePhoto & { url: string };

const PhotoDetailView: React.FC = () => {
  const { photoId } = useParams({ from: "/photos/$photoId" });
  const [photo, setPhoto] = useState<PhotoWithUrl | null>(null);
  const [notes, setNotes] = useState<RacePhotoNote[]>([]);
  const [noteText, setNoteText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPhoto() {
      setLoading(true);
      setLoadError(null);
      setNoteError(null);

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
      } else if (!photoResult.data) {
        setLoadError("Photo not found");
        setPhoto(null);
        setNotes([]);
      } else if (notesResult.error) {
        setLoadError(notesResult.error.message);
        setPhoto(null);
        setNotes([]);
      } else {
        const loadedPhoto = photoResult.data;
        setPhoto({
          ...loadedPhoto,
          url: supabase.storage
            .from(loadedPhoto.storage_bucket)
            .getPublicUrl(loadedPhoto.storage_path).data.publicUrl,
        });
        setNotes(notesResult.data ?? []);
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
      setNoteText("");
    }

    setSaving(false);
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
                  <p className="mt-3 text-xs text-gray-500">{formatDate(note.created_at)}</p>
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

export default PhotoDetailView;
