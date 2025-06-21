import { createFileRoute } from "@tanstack/react-router";
import TeamView from "../components/TeamView";

export const Route = createFileRoute("/team")({
  component: TeamView,
});
