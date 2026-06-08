import { Link } from "@tanstack/react-router";
import React from "react";
import { Search } from "lucide-react";
import { supabase } from "../lib/supabase";
import { LegPill } from "./LegPill";

type LegPerformance = {
  legNumber: number;
  label: string;
  timeText: string | null;
  status: "recorded" | "missing";
};

type StructuredPerformance = {
  teamName: string | null;
  runnerName: string | null;
  bib: string | null;
  division: string | null;
  totalTimeText: string | null;
  leaderboardPlace: number | null;
  legPerformances: LegPerformance[];
  differenceText: string | null;
  percentBackText: string | null;
  paceText: string | null;
  summary: string;
};

type CanonicalRaceLeg = {
  year: number | null;
  legNumber: number | null;
  legVersion: number | null;
  runnerId: string | null;
  runnerName: string | null;
  lapTime: string | null;
  timeInMinutes: number | null;
  pace: number | null;
  sourceType: string | null;
};

type CanonicalRace = {
  linked: boolean;
  matchMethod: "year_bib" | "none";
  year: number | null;
  bib: number | null;
  division: string | null;
  overallPlace: number | null;
  overallTeams: number | null;
  divisionPlace: number | null;
  divisionTeams: number | null;
  totalTime: string | null;
  runners: string[];
  legs: CanonicalRaceLeg[];
};

type SearchResult = {
  id: string;
  year: number | null;
  chunk_type: string | null;
  chunk_text: string | null;
  team_name: string | null;
  runner_name: string | null;
  bib: string | null;
  division: string | null;
  leg_number: number | null;
  leg_version: number | null;
  similarity: number | null;
  source_filename: string;
  source_url?: string | null;
  document_name?: string | null;
  document_type?: string | null;
  page_number?: number | null;
  sheet_index?: number | null;
  row_label: string;
  performance?: StructuredPerformance;
  canonicalRace?: CanonicalRace;
};

type SearchResponse = {
  query?: string;
  model?: string;
  results?: SearchResult[];
  error?: string;
};

const exampleQueries = [
  "Xtreme Falcons",
  "Extreme Falcons 2024",
  "Mixed Open 2024",
];

const HistoricalResultsSearchView: React.FC = () => {
  const [query, setQuery] = React.useState("");
  const [year, setYear] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = React.useState("Search structured annual historical result rows.");

  const runSearch = React.useCallback(async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setStatus("error");
      setMessage("Enter a search query first.");
      return;
    }

    setStatus("loading");
    setMessage("Searching imported historical team results…");

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        throw new Error("Sign in before searching historical results.");
      }

      const response = await fetch("/api/historical-results/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: trimmedQuery,
          matchCount: 12,
          year: year ? Number(year) : null,
        }),
      });
      const payload = (await response.json()) as SearchResponse;

      if (!response.ok || payload.error) {
        throw new Error(payload.error || "Historical results search failed.");
      }

      const nextResults = payload.results || [];
      setResults(nextResults);
      setStatus("success");
      setMessage(
        nextResults.length === 0
          ? "No matching historical team results found. If this looks wrong, the source year may not be imported yet or the query may be too narrow."
          : `Found ${nextResults.length} matching historical team result${nextResults.length === 1 ? "" : "s"}.`
      );
    } catch (error) {
      setResults([]);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Historical results search failed.");
    }
  }, [query, year]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-sm font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-200">
              <Search className="h-4 w-4" />
              Historical team results
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-slate-50">
              Historical Results Search
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">
              Search imported Lake Tahoe Relay team-result rows and show the matching race record with its nested leg performance records.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_160px_auto]">
          <label className="block">
            <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">Search query</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void runSearch();
                }
              }}
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-primary-900"
              placeholder="team, bib, division, year, or source wording"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">Year</span>
            <input
              value={year}
              onChange={(event) => setYear(event.target.value.replace(/\D/g, "").slice(0, 4))}
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-primary-900"
              placeholder="Any"
            />
          </label>

          <button
            type="button"
            onClick={() => void runSearch()}
            disabled={status === "loading"}
            className="self-end rounded-xl bg-primary-600 px-5 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-400 dark:disabled:bg-slate-700"
          >
            {status === "loading" ? "Searching…" : "Search"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {exampleQueries.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setQuery(example)}
              className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:border-primary-300 hover:text-primary-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-primary-700 dark:hover:text-primary-200"
            >
              {example}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between gap-4">
          <p
            className={`text-sm font-medium ${
              status === "error" ? "text-red-700 dark:text-red-300" : "text-gray-600 dark:text-slate-300"
            }`}
          >
            {message}
          </p>
        </div>

        <div className="mt-5 space-y-4">
          {results.map((result) => (
            <article
              key={result.id}
              className="rounded-xl border border-gray-200 p-4 dark:border-slate-800 dark:bg-slate-900/40"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                    Race record
                  </div>
                  <h3 className="mt-1 text-xl font-bold text-gray-900 dark:text-slate-50">
                    {result.year || "Unknown year"} · {result.performance?.teamName || result.team_name || "Unknown team"}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm text-gray-600 dark:text-slate-300">
                    {result.performance?.bib || result.bib ? <span>Bib {result.performance?.bib || result.bib}</span> : null}
                    {result.performance?.division || result.division ? <span>{result.performance?.division || result.division}</span> : null}
                    {result.performance?.leaderboardPlace ? <span>Place {result.performance.leaderboardPlace}</span> : null}
                  </div>
                </div>
                <div className="rounded-xl bg-gray-50 px-4 py-3 text-right dark:bg-slate-950/70">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                    Total
                  </div>
                  <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-slate-50">
                    {result.performance?.totalTimeText || result.canonicalRace?.totalTime || "—"}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                  Leg performance records
                </div>
                {result.canonicalRace?.legs.length ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {result.canonicalRace?.legs.map((leg) => (
                      <div
                        key={`${leg.legNumber || "leg"}-${leg.legVersion || 1}-${leg.runnerName || "runner"}`}
                        className="rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-slate-950/70"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          {leg.legNumber ? (
                            <LegPill
                              leg={leg.legNumber}
                              version={leg.legVersion || 1}
                              className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-100 dark:bg-primary-950/50 dark:text-primary-200 dark:hover:bg-primary-900/70"
                            >
                              Leg {leg.legNumber}v{leg.legVersion || 1}
                            </LegPill>
                          ) : (
                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-slate-900 dark:text-slate-300">
                              Leg ?
                            </span>
                          )}
                          {leg.runnerName ? (
                            <Link
                              to="/runners/$runnerName"
                              params={{ runnerName: leg.runnerName }}
                              className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-900/70"
                            >
                              {leg.runnerName}
                            </Link>
                          ) : (
                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-slate-900 dark:text-slate-300">
                              Unknown runner
                            </span>
                          )}
                        </div>
                        <div className="mt-2 font-semibold text-gray-900 dark:text-slate-50">
                          {leg.lapTime || "—"}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-400">
                          {leg.pace ? formatPace(leg.pace) : "No pace"}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
                    No linked leg performance records for this race yet.
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

function formatPace(value: number | null): string {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return "—";
  }
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}/mi`;
}

export default HistoricalResultsSearchView;
