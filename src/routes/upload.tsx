import { createFileRoute } from "@tanstack/react-router";
import UploadView from "../components/UploadView";

type UploadSearch = {
  tab?: "results" | "photos";
};

export const Route = createFileRoute("/upload")({
  validateSearch: (search: Record<string, unknown>): UploadSearch => {
    return {
      tab: (search.tab as "results" | "photos") || "results",
    };
  },
  component: UploadView,
});
