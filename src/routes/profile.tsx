import { createFileRoute, redirect } from "@tanstack/react-router";
import { ProfileView } from "../components/ProfileView";
import { supabase } from "../lib/supabase";

export const Route = createFileRoute("/profile")({
  beforeLoad: async ({ location }) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({
        to: "/",
        search: {
          redirect: location.href,
        },
      });
    }
  },
  loader: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      // This should not happen if beforeLoad is protecting the route
      throw new Error("User not found");
    }

    const { data: runner, error } = await supabase
      .from("runners")
      .select("name")
      .eq("auth_user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "No rows found"
      console.error("Error fetching runner", error);
      throw new Error("Failed to fetch runner profile");
    }

    if (runner) {
      throw redirect({
        to: "/runners/$runnerName",
        params: {
          runnerName: runner.name,
        },
      });
    }

    return { runnerFound: false };
  },
  component: ProfileView,
});
