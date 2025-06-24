import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/history")({
  component: () => <Outlet />,
});
