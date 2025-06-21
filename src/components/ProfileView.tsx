import { AlertTriangle } from "lucide-react";
import React from "react";
import { Route } from "../routes/profile";

export const ProfileView: React.FC = () => {
  const { runnerFound } = Route.useLoaderData();

  if (!runnerFound) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
        <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-yellow-800 mb-2">
          No Runner Profile Found
        </h2>
        <p className="text-yellow-700">
          No runner profile is associated with your account. Please contact{" "}
          <a
            href="mailto:help@xtreme-falcons.com"
            className="font-medium underline hover:text-yellow-800"
          >
            help@xtreme-falcons.com
          </a>{" "}
          to get set up.
        </p>
      </div>
    );
  }

  // This part of the component should ideally not be reached because the loader redirects if a runner is found.
  // It's here as a fallback.
  return (
    <div className="text-center p-8">
      <p>Loading your profile...</p>
    </div>
  );
};
