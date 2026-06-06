import { createFileRoute } from "@tanstack/react-router";
import PhotoDetailView from "../components/PhotoDetailView";

export const Route = createFileRoute("/photos/$photoId")({
  component: PhotoDetailView,
});
