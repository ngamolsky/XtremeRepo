import { createFileRoute } from "@tanstack/react-router";
import RunnerDetail from "../components/RunnerDetail";

export const Route = createFileRoute("/runners/$runnerName")({
  component: RunnerDetail,
});
