import { RootRoute, Route, Router } from "@tanstack/react-router";
import App from "../App";
import Dashboard from "../components/Dashboard";
import HistoryView from "../components/HistoryView";
import LegsView from "../components/LegsView";
import PhotosView from "../components/PhotosView";
import TeamView from "../components/TeamView";

// Create a root route
const rootRoute = new RootRoute({
  component: App,
});

// Create routes for each tab
const indexRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Dashboard,
});

const dashboardRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: Dashboard,
});

const teamRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/team",
  component: TeamView,
});

const legsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/legs",
  component: LegsView,
});

const historyRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/history",
  component: HistoryView,
});

const photosRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/photos",
  component: PhotosView,
});

// Create the router
const routeTree = rootRoute.addChildren([
  indexRoute,
  dashboardRoute,
  teamRoute,
  legsRoute,
  historyRoute,
  photosRoute,
]);

export const router = new Router({ routeTree });

// Register your router for maximum type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
