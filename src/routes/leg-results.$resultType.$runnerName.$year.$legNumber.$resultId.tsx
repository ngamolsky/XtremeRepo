import { createFileRoute } from "@tanstack/react-router";
import LegResultDetail from "../components/LegResultDetail";

export const Route = createFileRoute(
  "/leg-results/$resultType/$runnerName/$year/$legNumber/$resultId"
)({
  component: LegResultDetail,
});
