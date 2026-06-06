import { Link } from "@tanstack/react-router";
import React, { useEffect, useMemo, useState } from "react";
import { Calendar, Camera, Filter, Image, Search, Tag, Upload } from "lucide-react";
import { supabase } from "../lib/supabase";
import { Tables } from "../types/database.types";

type RacePhoto = Tables<"race_photos">;
type PhotoWithUrl = RacePhoto & { url: string };

const PhotosView: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [photos, setPhotos] = useState<PhotoWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(photos.map((photo) => photo.category))).sort()],
    [photos]
  );

  const years = useMemo(
    () => [
      "all",
      ...Array.from(new Set(photos.map((photo) => photo.year.toString()))).sort((a, b) =>
        b.localeCompare(a)
      ),
    ],
    [photos]
  );

  const filteredPhotos = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return photos.filter((photo) => {
      const matchesCategory =
        selectedCategory === "all" || photo.category === selectedCategory;
      const matchesYear = selectedYear === "all" || photo.year.toString() === selectedYear;
      const searchableText = [
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

      return matchesCategory && matchesYear && matchesSearch;
    });
  }, [photos, searchTerm, selectedCategory, selectedYear]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Race Photos</h1>
        <p className="text-lg text-gray-600">Capturing memories from our relay race adventures</p>
      </div>

      <div className="card p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search photos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Tag className="w-5 h-5 text-gray-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category === "all" ? "All Categories" : formatLabel(category)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year === "all" ? "All Years" : year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6 text-center">
          <Camera className="w-8 h-8 text-primary-600 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-gray-900">{filteredPhotos.length}</h3>
          <p className="text-gray-600">Photos Found</p>
        </div>
        <div className="card p-6 text-center">
          <Calendar className="w-8 h-8 text-green-600 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-gray-900">
            {new Set(filteredPhotos.map((photo) => photo.year)).size}
          </h3>
          <p className="text-gray-600">Years Covered</p>
        </div>
        <div className="card p-6 text-center">
          <Tag className="w-8 h-8 text-purple-600 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-gray-900">
            {new Set(filteredPhotos.map((photo) => photo.category)).size}
          </h3>
          <p className="text-gray-600">Categories</p>
        </div>
        <div className="card p-6 text-center">
          <Filter className="w-8 h-8 text-orange-600 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-gray-900">
            {new Set(filteredPhotos.map((photo) => photo.race)).size}
          </h3>
          <p className="text-gray-600">Races</p>
        </div>
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
      ) : filteredPhotos.length === 0 ? (
        <div className="text-center py-12">
          <Image className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No photos found</h3>
          <p className="text-gray-600">Try adjusting your filters or search terms</p>
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
                className="card block overflow-hidden hover:shadow-lg transition-all duration-200 group"
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

      <div className="bg-gradient-to-r from-primary-50 to-purple-50 rounded-xl border border-primary-200 p-8 text-center">
        <Upload className="w-12 h-12 text-primary-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Have photos to share?</h3>
        <p className="text-gray-600 mb-4">
          Help us build our photo collection by sharing your race memories
        </p>
        <button className="btn-primary">Upload Photos</button>
      </div>
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

export default PhotosView;
