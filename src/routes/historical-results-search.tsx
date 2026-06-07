import { createFileRoute } from "@tanstack/react-router";
import HistoricalResultsSearchView from "../components/HistoricalResultsSearchView";

export const Route = createFileRoute("/historical-results-search")({
  component: HistoricalResultsSearchView,
});
