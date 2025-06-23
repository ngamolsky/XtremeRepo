import { Outlet, createRootRoute } from "@tanstack/react-router";
import AuthWrapper from "../components/AuthWrapper";
import Navigation from "../components/Navigation";
import { Toaster } from "../components/ui/toaster";

export const Route = createRootRoute({
  component: () => (
    <AuthWrapper>
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Outlet />
        </main>
        <Toaster />
      </div>
    </AuthWrapper>
  ),
});
