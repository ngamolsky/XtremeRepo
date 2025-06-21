import { createFileRoute } from "@tanstack/react-router";
import UploadView from "../components/UploadView";

export const Route = createFileRoute("/upload")({
  component: UploadView,
}); 