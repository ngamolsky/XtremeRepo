import { createFileRoute } from "@tanstack/react-router";
import LegsView from "../components/LegsView";

export const Route = createFileRoute("/legs/")({
  component: LegsView,
});
