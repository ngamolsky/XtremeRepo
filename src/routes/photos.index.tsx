import { createFileRoute } from "@tanstack/react-router";
import PhotosView from "../components/PhotosView";

export const Route = createFileRoute("/photos/")({
  validateSearch: (search: Record<string, unknown>) => ({
    race: typeof search.race === "string" ? search.race : undefined,
    year: parseSearchYear(search.year),
  }),
  component: PhotosView,
});

function parseSearchYear(value: unknown) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed >= 1900 && parsed <= 2100
    ? parsed
    : undefined;
}
