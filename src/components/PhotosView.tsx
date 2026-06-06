import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Folder,
  Image,
  Search,
  Star,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { Tables } from "../types/database.types";

type RacePhoto = Tables<"race_photos">;
type PhotoWithUrl = RacePhoto & { url: string };
type PhotoFolder = {
  categories: string[];
  coverPhoto: PhotoWithUrl;
  photos: PhotoWithUrl[];
  races: string[];
  year: number;
};

const PhotosView: React.FC = () => {
  const search = useSearch({ from: "/photos/" });
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [photos, setPhotos] = useState<PhotoWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const selectedYear = search.year ?? null;
  const selectedRace = search.race ?? "";

  useEffect(() => {
    let cancelled = false;

    async function loadPhotos() {
      setLoading(true);
      setLoadError(null);

      const { data, error } = await supabase
        .from("race_photos")
        .select("*")
        .order("year", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (cancelled) {
        return;
      }

      if (error) {
        setLoadError(error.message);
        setPhotos([]);
      } else {
        setPhotos(
          (data ?? []).map((photo) => ({
            ...photo,
            url: supabase.storage.from(photo.storage_bucket).getPublicUrl(photo.storage_path)
              .data.publicUrl,
          }))
        );
      }

      setLoading(false);
    }

    loadPhotos();

    return () => {
      cancelled = true;
    };
  }, []);

  const folders = useMemo<PhotoFolder[]>(() => {
    const photosByYear = new Map<number, PhotoWithUrl[]>();

    photos.forEach((photo) => {
      const currentPhotos = photosByYear.get(photo.year) ?? [];
      currentPhotos.push(photo);
      photosByYear.set(photo.year, currentPhotos);
    });

    return Array.from(photosByYear.entries())
      .sort(([yearA], [yearB]) => yearB - yearA)
      .map(([year, yearPhotos]) => ({
        categories: Array.from(new Set(yearPhotos.map((photo) => photo.category))).sort(),
        coverPhoto:
          yearPhotos.find((photo) => photo.featured) ??
          yearPhotos[0],
        photos: yearPhotos,
        races: Array.from(new Set(yearPhotos.map((photo) => photo.race))).sort(),
        year,
      }));
  }, [photos]);

  const photosForSelectedYear = useMemo(() => {
    if (selectedYear === null) {
      return photos;
    }

    return photos.filter((photo) => photo.year === selectedYear);
  }, [photos, selectedYear]);

  const photosForSelectedAlbum = useMemo(() => {
    if (!selectedRace) {
      return photosForSelectedYear;
    }

    return photosForSelectedYear.filter((photo) => photo.race === selectedRace);
  }, [photosForSelectedYear, selectedRace]);

  const years = useMemo(
    () => Array.from(new Set(photos.map((photo) => photo.year))).sort((a, b) => b - a),
    [photos]
  );

  const filteredPhotos = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return photosForSelectedAlbum.filter((photo) => {
      const searchableText = [
        photo.year,
        photo.caption,
        photo.alt_text,
        photo.race,
        photo.event_name,
        photo.category,
        photo.source,
        photo.original_filename,
        ...(photo.tags ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch =
        normalizedSearch === "" || searchableText.includes(normalizedSearch);

      return matchesSearch;
    });
  }, [photosForSelectedAlbum, searchTerm]);

  const filteredFolders = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return folders.filter((folder) => {
      const searchableText = [
        folder.year,
        ...folder.races,
        ...folder.categories,
        ...folder.photos.flatMap((photo) => [
          photo.caption,
          photo.alt_text,
          photo.event_name,
          photo.source,
          photo.original_filename,
          ...photo.tags,
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch =
        normalizedSearch === "" || searchableText.includes(normalizedSearch);

      return matchesSearch;
    });
  }, [folders, searchTerm]);

  function handleOpenFolder(year: number) {
    updatePhotoSearch(year, "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleYearChange(value: string) {
    updatePhotoSearch(value === "all" ? null : Number(value), "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleClearRaceFilter() {
    updatePhotoSearch(selectedYear, "");
  }

  function updatePhotoSearch(year: number | null, race: string) {
    void navigate({
      to: "/photos",
      search: {
        race: race || undefined,
        year: year ?? undefined,
      },
    });
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-4 text-center sm:text-left md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {selectedYear === null
              ? "Race Photos"
              : selectedRace
                ? `${selectedYear} ${selectedRace} Photos`
                : `${selectedYear} Race Photos`}
          </h1>
          <p className="text-lg text-gray-600">
            {selectedYear === null
              ? "Captured memories from our relay race adventures"
              : selectedRace
                ? `${photosForSelectedAlbum.length} photos linked to ${selectedRace}`
                : `${photosForSelectedYear.length} photos from ${selectedYear}`}
          </p>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search captions, races, tags..."
                aria-label="Search captions, races, event names, categories, sources, filenames, tags, and years"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <select
              value={selectedYear ?? "all"}
              onChange={(event) => handleYearChange(event.target.value)}
              aria-label="Filter photos by year"
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
            >
              <option value="all">All Years</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
        {selectedRace && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700">
              {selectedRace}
            </span>
            <button
              type="button"
              onClick={handleClearRaceFilter}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              <X className="h-4 w-4" />
              <span>Clear race filter</span>
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="card overflow-hidden">
              <div className="h-64 animate-pulse bg-gray-100 dark:bg-slate-800" />
              <div className="p-4 space-y-3">
                <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100 dark:bg-slate-800" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-slate-800" />
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="text-center py-12">
          <Image className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Could not load photos</h3>
          <p className="text-gray-600">{loadError}</p>
        </div>
      ) : selectedYear === null && filteredFolders.length === 0 ? (
        <div className="text-center py-12">
          <Image className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No photos found</h3>
          <p className="text-gray-600">Try adjusting your search or year filter</p>
        </div>
      ) : selectedYear === null ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredFolders.map((folder) => (
            <button
              key={folder.year}
              type="button"
              data-testid={`photo-year-folder-${folder.year}`}
              onClick={() => handleOpenFolder(folder.year)}
              className="card group overflow-hidden text-left focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-slate-800">
                <img
                  src={folder.coverPhoto.url}
                  alt={`${folder.year} ${folder.coverPhoto.race}`}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-4 text-white">
                  <div>
                    <h2 className="text-3xl font-bold leading-none">{folder.year}</h2>
                    <p className="mt-1 text-sm font-medium text-white/85">
                      {formatCount(folder.photos.length, "photo")}
                    </p>
                  </div>
                  <span className="rounded-full bg-white/90 p-3 text-primary-700 shadow-sm">
                    <Folder className="h-6 w-6" />
                  </span>
                </div>
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>{formatCount(folder.races.length, "race")}</span>
                  <span>{formatCount(folder.categories.length, "category")}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {folder.categories.slice(0, 4).map((category) => (
                    <span
                      key={category}
                      className={`rounded-full px-2 py-1 text-xs font-medium ${getCategoryClass(category)}`}
                    >
                      {formatLabel(category)}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : filteredPhotos.length === 0 ? (
        <div className="text-center py-12">
          <Image className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No photos found</h3>
          <p className="text-gray-600">Try adjusting your search or year filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPhotos.map((photo) => {
            const caption = photo.caption || `${photo.year} ${photo.race}`;

            return (
              <Link
                key={photo.id}
                to="/photos/$photoId"
                params={{ photoId: photo.id }}
                data-testid="photo-card"
                className="card block overflow-hidden hover:shadow-lg transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-slate-800">
                  <img
                    src={photo.url}
                    alt={photo.alt_text || caption}
                    loading="lazy"
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute top-4 right-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryClass(photo.category)}`}>
                      {formatLabel(photo.category)}
                    </span>
                  </div>
                  {photo.featured && (
                    <div className="absolute left-4 top-4">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs font-medium text-primary-700 shadow-sm">
                        <Star className="h-3 w-3 fill-current" />
                        Cover
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">{caption}</h3>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>{photo.race}</span>
                    <span>{photo.year}</span>
                  </div>
                  {photo.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {photo.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-slate-800 dark:text-slate-300"
                        >
                          {formatLabel(tag)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

    </div>
  );
};

function formatLabel(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getCategoryClass(category: string) {
  switch (category) {
    case "action":
      return "bg-red-100 text-red-800";
    case "team":
      return "bg-blue-100 text-blue-800";
    case "celebration":
      return "bg-yellow-100 text-yellow-800";
    case "preparation":
      return "bg-green-100 text-green-800";
    case "scenery":
      return "bg-cyan-100 text-cyan-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function formatCount(count: number, singularLabel: string) {
  return `${count} ${singularLabel}${count === 1 ? "" : "s"}`;
}

export default PhotosView;
