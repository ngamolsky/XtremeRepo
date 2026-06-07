import React from "react";
import { Search } from "lucide-react";
import { supabase } from "../lib/supabase";

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
};

type SearchResponse = {
  query?: string;
  model?: string;
  results?: SearchResult[];
  error?: string;
};

const chunkTypeOptions = [
  { value: "", label: "All chunks" },
  { value: "team_result", label: "Team results" },
  { value: "leg_result", label: "Leg results" },
  { value: "source_summary", label: "Source summaries" },
  { value: "row", label: "Raw rows / OCR" },
  { value: "ocr_block", label: "OCR blocks" },
];

const exampleQueries = [
  "Xtreme Falcons Vasan leg 4",
  "West Valley masters team 2025",
  "women open Tahoe relay lap 7",
];

const HistoricalResultsSearchView: React.FC = () => {
  const [query, setQuery] = React.useState("Xtreme Falcons Vasan leg 4");
  const [year, setYear] = React.useState("");
  const [chunkType, setChunkType] = React.useState("team_result");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = React.useState("Run a semantic search over embedded historical result source chunks.");

  const runSearch = React.useCallback(async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setStatus("error");
      setMessage("Enter a search query first.");
      return;
    }

    setStatus("loading");
    setMessage("Embedding query and searching historical source evidence…");

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
          chunkType: chunkType || null,
        }),
      });
      const payload = (await response.json()) as SearchResponse;

      if (!response.ok || payload.error) {
        throw new Error(payload.error || "Historical semantic search failed.");
      }

      setResults(payload.results || []);
      setStatus("success");
      setMessage(
        `Found ${(payload.results || []).length} semantic match${(payload.results || []).length === 1 ? "" : "es"}. Model: ${payload.model || "text-embedding-3-small"}.`
      );
    } catch (error) {
      setResults([]);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Historical semantic search failed.");
    }
  }, [chunkType, query, year]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-sm font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-200">
              <Search className="h-4 w-4" />
              Historical source discovery
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-slate-50">
              Historical Results Search
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">
              Semantic search over embedded Lake Tahoe Relay historical source chunks. Use it for fuzzy discovery, then inspect the source filename, document, and row evidence before treating a result as canonical.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_160px_220px_auto]">
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
              placeholder="runner, team, category, leg, or messy historical wording"
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

          <label className="block">
            <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">Chunk type</span>
            <select
              value={chunkType}
              onChange={(event) => setChunkType(event.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-primary-900"
            >
              {chunkTypeOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
          {results.map((result, index) => (
            <article
              key={result.id}
              className="rounded-xl border border-gray-200 p-4 dark:border-slate-800 dark:bg-slate-900/40"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                <span>#{index + 1}</span>
                <span>{formatSimilarity(result.similarity)} similarity</span>
                <span>{result.year || "Unknown year"}</span>
                <span>{result.chunk_type || "chunk"}</span>
                {result.leg_number ? <span>Leg {result.leg_number}v{result.leg_version || 1}</span> : null}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr]">
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-slate-950/70">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                    Team total
                  </div>
                  <div className="mt-1 text-xl font-bold text-gray-900 dark:text-slate-50">
                    {result.performance?.totalTimeText || "—"}
                  </div>
                  <div className="mt-2 text-sm text-gray-600 dark:text-slate-300">
                    {result.performance?.teamName || result.team_name || "Unknown team"}
                    {result.performance?.leaderboardPlace ? ` · place ${result.performance.leaderboardPlace}` : ""}
                  </div>
                </div>

                <div className="rounded-lg bg-gray-50 p-3 dark:bg-slate-950/70">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                    Leg performance
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {(result.performance?.legPerformances || []).map((leg) => (
                      <div key={leg.legNumber} className="rounded-md bg-white px-3 py-2 dark:bg-slate-900">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                          {leg.label}
                        </div>
                        <div className="mt-1 font-semibold text-gray-900 dark:text-slate-50">
                          {leg.timeText || "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold text-gray-700 dark:text-slate-200">
                  Raw searchable text
                </summary>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-800 dark:text-slate-100">
                  {result.chunk_text}
                </p>
              </details>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Evidence label="Team" value={result.performance?.teamName || result.team_name} />
                <Evidence label="Runner" value={result.performance?.runnerName || result.runner_name} />
                <Evidence label="Bib" value={result.performance?.bib || result.bib} />
                <Evidence label="Division" value={result.performance?.division || result.division} />
                <Evidence label="Total time" value={result.performance?.totalTimeText} />
                <Evidence label="Pace" value={result.performance?.paceText} />
                <Evidence label="Difference" value={result.performance?.differenceText} />
                <Evidence label="Row" value={result.row_label} />
              </dl>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

const Evidence: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
  <div>
    <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
      {label}
    </dt>
    <dd className="mt-1 break-words text-gray-800 dark:text-slate-100">{value || "—"}</dd>
  </div>
);

function formatSimilarity(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(3);
}

export default HistoricalResultsSearchView;
