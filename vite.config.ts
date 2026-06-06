import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

import { defineConfig, loadEnv } from "vite";

function readWranglerVars() {
  const rawConfig = readFileSync(new URL("./wrangler.jsonc", import.meta.url), "utf8");
  const json = rawConfig
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(json).vars ?? {};
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const wranglerVars = readWranglerVars();
  const isProduction = mode === "production";

  const supabaseUrl = isProduction
    ? wranglerVars.VITE_SUPABASE_URL
    : env.VITE_SUPABASE_URL ?? wranglerVars.VITE_SUPABASE_URL;
  const supabaseAnonKey = isProduction
    ? wranglerVars.VITE_SUPABASE_ANON_KEY
    : env.VITE_SUPABASE_ANON_KEY ?? wranglerVars.VITE_SUPABASE_ANON_KEY;

  return {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(supabaseAnonKey),
    },
    plugins: [tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }), cloudflare(), react()],
  };
});
