import { createFileRoute } from "@tanstack/react-router";
import RaceDetailView from "../components/RaceDetailView";

export const Route = createFileRoute("/races/$year")({
  component: RaceDetailView,
});
