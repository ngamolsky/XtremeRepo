import { createFileRoute } from "@tanstack/react-router";
import PhotosView from "../components/PhotosView";

export const Route = createFileRoute("/photos")({
  component: PhotosView,
});
