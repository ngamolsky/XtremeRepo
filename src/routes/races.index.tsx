import { createFileRoute } from "@tanstack/react-router";
import HistoryView from "../components/HistoryView";

export const Route = createFileRoute("/races/")({
  component: HistoryView,
});
