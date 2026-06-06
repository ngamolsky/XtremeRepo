import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    mode: "local",
    backup: false,
    projectRef: process.env.SUPABASE_PROJECT_REF || "",
    verify: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--local") {
      args.mode = "local";
    } else if (arg === "--prod") {
      args.mode = "prod";
    } else if (arg === "--custom") {
      args.mode = "custom";
    } else if (arg === "--backup") {
      args.backup = true;
    } else if (arg === "--no-verify") {
      args.verify = false;
    } else if (arg === "--project-ref") {
      args.projectRef = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--project-ref=")) {
      args.projectRef = arg.slice("--project-ref=".length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

export function runSupabaseCli(args) {
  return execFileSync("npx", ["supabase", ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      SUPABASE_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export async function resolveSupabaseTarget({ mode, projectRef } = {}) {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      mode: mode || "custom",
      url: process.env.SUPABASE_URL,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      anonKey: process.env.SUPABASE_ANON_KEY || "",
      projectRef: projectRef || projectRefFromUrl(process.env.SUPABASE_URL),
    };
  }

  if (mode === "prod") {
    const url = process.env.SUPABASE_URL || readWranglerSupabaseUrl();
    const resolvedProjectRef = projectRef || projectRefFromUrl(url);
    const keys = JSON.parse(
      runSupabaseCli([
        "projects",
        "api-keys",
        "--project-ref",
        resolvedProjectRef,
        "-o",
        "json",
      ])
    );
    const serviceRoleKey = keys.find((key) => key.name === "service_role")?.api_key;
    const anonKey = keys.find((key) => key.name === "anon")?.api_key || "";

    if (!serviceRoleKey) {
      throw new Error(`Could not find service_role key for project ${resolvedProjectRef}`);
    }

    return {
      mode: "prod",
      url,
      serviceRoleKey,
      anonKey,
      projectRef: resolvedProjectRef,
    };
  }

  if (mode === "custom") {
    throw new Error(
      "Custom mode requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment."
    );
  }

  const status = JSON.parse(runSupabaseCli(["status", "-o", "json"]));
  const localUrl = status.API_URL || status.REST_URL?.replace(/\/rest\/v1$/, "");
  const serviceRoleKey = status.SERVICE_ROLE_KEY || status.SECRET_KEY;

  if (!localUrl || !serviceRoleKey) {
    throw new Error("Could not discover local Supabase URL/service role key.");
  }

  return {
    mode: "local",
    url: localUrl,
    serviceRoleKey,
    anonKey: status.ANON_KEY || status.PUBLISHABLE_KEY || "",
    projectRef: "local",
  };
}

function readWranglerSupabaseUrl() {
  const wranglerConfig = readFileSync("wrangler.jsonc", "utf8");
  const match = wranglerConfig.match(/"VITE_SUPABASE_URL"\s*:\s*"([^"]+)"/);

  if (!match) {
    throw new Error("Could not find VITE_SUPABASE_URL in wrangler.jsonc.");
  }

  return match[1];
}

function projectRefFromUrl(url) {
  const { hostname } = new URL(url);
  const [projectRef] = hostname.split(".");

  if (!projectRef) {
    throw new Error(`Could not infer Supabase project ref from ${url}`);
  }

  return projectRef;
}
