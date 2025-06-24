import { createFileRoute } from "@tanstack/react-router";
import RaceDetailView from "../components/RaceDetailView";

type HistorySearch = {
  edit?: boolean;
};

export const Route = createFileRoute("/history/$year")({
  validateSearch: (search: Record<string, unknown>): HistorySearch => {
    return {
      edit: search.edit === "true" || search.edit === true,
    };
  },
  component: RaceDetailView,
});