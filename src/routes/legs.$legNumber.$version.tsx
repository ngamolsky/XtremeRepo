import { createFileRoute } from "@tanstack/react-router";
import LegDetail from "../components/LegDetail";

export const Route = createFileRoute("/legs/$legNumber/$version")({
  component: LegDetail,
});
