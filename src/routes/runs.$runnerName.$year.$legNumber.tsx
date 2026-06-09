import { createFileRoute } from "@tanstack/react-router";
import RunInstanceDetail from "../components/RunInstanceDetail";

export const Route = createFileRoute(
  "/runs/$runnerName/$year/$legNumber"
)({
  component: RunInstanceDetail,
});
