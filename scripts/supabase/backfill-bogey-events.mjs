import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";
import { resolveSupabaseTarget } from "./target.mjs";

const isCli = import.meta.url === pathToFileURL(process.argv[1] || "").href;
const args = isCli ? parseArgs(process.argv.slice(2)) : { testOnly: true };

if (isCli && !args.testOnly) {
  const target = await resolveSupabaseTarget({ mode: args.mode, projectRef: args.projectRef });
  const client = createClient(target.url, target.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const teamResults = await fetchAllTeamResults(client);
  const splitRows = [];
  const teamRowsWithSplitCounts = [];

  for (const result of teamResults) {
    const parsed = extractSplitTimes(result.raw_text || "", result.total_time_text);
    teamRowsWithSplitCounts.push({ ...result, splitCount: parsed.splits.length });

    for (const split of parsed.splits) {
      splitRows.push({
        team_result_id: result.id,
        leg_number: split.legNumber,
        split_time_text: split.splitTimeText,
        split_time_seconds: split.splitTimeSeconds,
        runner_name: null,
        metadata: {
          backfilled_from: "scripts/supabase/backfill-bogey-events.mjs",
          total_time_text: parsed.totalTimeText,
          parser: parsed.parser,
        },
      });
    }
  }

  await checkedDelete(client.from("historical_leg_splits").delete().neq("id", "00000000-0000-0000-0000-000000000000"), "historical_leg_splits");
  await insertBatches(client, "historical_leg_splits", splitRows);

  const links = selectOurTeamLinks(teamRowsWithSplitCounts);
  await checkedDelete(client.from("our_team_result_links").delete().neq("id", "00000000-0000-0000-0000-000000000000"), "our_team_result_links");
  await insertBatches(client, "our_team_result_links", links);

  console.log(
    `Backfilled bogey source data into ${target.mode} (${target.projectRef}): teamResults=${teamResults.length}, legSplits=${splitRows.length}, ourTeamLinks=${links.length}`
  );
}

function parseArgs(argv) {
  const parsed = { mode: "local", projectRef: "", testOnly: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--local") parsed.mode = "local";
    else if (arg === "--prod") parsed.mode = "prod";
    else if (arg === "--custom") parsed.mode = "custom";
    else if (arg === "--project-ref") parsed.projectRef = argv[++index] || "";
    else if (arg.startsWith("--project-ref=")) parsed.projectRef = arg.slice("--project-ref=".length);
    else if (arg === "--test-only") parsed.testOnly = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

async function fetchAllTeamResults(client) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from("historical_team_results")
      .select("id,year,bib,team_name_raw,total_time_text,raw_text,is_our_team,overall_place")
      .order("year", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`Could not fetch historical_team_results: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

export function extractSplitTimes(rawText, storedTotalTimeText = null) {
  const matches = [...String(rawText || "").matchAll(/(?<![+\-\d])\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?\b/g)].map((match) => ({
    text: match[0],
    seconds: timeTextToSeconds(match[0]),
  })).filter((entry) => entry.seconds != null);

  if (matches.length < 7) {
    return { parser: "insufficient_times", totalTimeText: storedTotalTimeText, splits: [] };
  }

  const totalFirst = matches.length >= 8 ? matches[0] : null;
  const totalFirstSplits = totalFirst ? matches.slice(1, 8) : [];
  if (totalFirst && timesApproximatelyMatch(totalFirst.seconds, sumSeconds(totalFirstSplits))) {
    return buildParsedSplits("total_first", totalFirst.text, totalFirstSplits);
  }

  const totalLast = matches.length >= 8 ? matches[7] : null;
  const totalLastSplits = totalLast ? matches.slice(0, 7) : [];
  if (totalLast && timesApproximatelyMatch(totalLast.seconds, sumSeconds(totalLastSplits))) {
    return buildParsedSplits("total_last", totalLast.text, totalLastSplits);
  }

  const storedTotalSeconds = timeTextToSeconds(storedTotalTimeText);
  if (storedTotalSeconds != null) {
    const storedTotalIndex = matches.findIndex((match) => match.text === storedTotalTimeText || timesApproximatelyMatch(match.seconds, storedTotalSeconds));
    if (storedTotalIndex !== -1 && matches.length >= storedTotalIndex + 8) {
      const splitsAfterStoredTotal = matches.slice(storedTotalIndex + 1, storedTotalIndex + 8);
      if (timesApproximatelyMatch(storedTotalSeconds, sumSeconds(splitsAfterStoredTotal))) {
        return buildParsedSplits("stored_total_then_splits", storedTotalTimeText, splitsAfterStoredTotal);
      }
    }
  }

  return { parser: "no_complete_split_set", totalTimeText: storedTotalTimeText, splits: [] };
}

function buildParsedSplits(parser, totalTimeText, splitMatches) {
  return {
    parser,
    totalTimeText,
    splits: splitMatches.map((match, index) => ({
      legNumber: index + 1,
      splitTimeText: match.text,
      splitTimeSeconds: match.seconds,
    })),
  };
}

export function selectOurTeamLinks(teamRows) {
  const byYear = new Map();
  for (const row of teamRows) {
    if (!row.is_our_team || row.splitCount !== 7) continue;
    const existing = byYear.get(row.year);
    if (!existing || compareOurTeamCandidates(row, existing) < 0) {
      byYear.set(row.year, row);
    }
  }

  return [...byYear.values()].map((row) => ({
    year: row.year,
    historical_team_result_id: row.id,
    canonical_team_name: "Xtreme Falcons",
    linked_by: "agent_reviewed",
    notes: "Auto-linked by bogey backfill from is_our_team historical result with complete 7-leg splits.",
  }));
}

function compareOurTeamCandidates(left, right) {
  const leftPlace = Number.isFinite(left.overall_place) ? left.overall_place : Number.POSITIVE_INFINITY;
  const rightPlace = Number.isFinite(right.overall_place) ? right.overall_place : Number.POSITIVE_INFINITY;
  return leftPlace - rightPlace || String(left.id).localeCompare(String(right.id));
}

function timeTextToSeconds(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);
  if (!match) return null;
  const first = Number(match[1]);
  const second = Number(match[2]);
  const third = match[3] == null ? null : Number(match[3]);
  return third == null ? first * 60 + second : first * 3600 + second * 60 + third;
}

function sumSeconds(entries) {
  return entries.reduce((total, entry) => total + entry.seconds, 0);
}

function timesApproximatelyMatch(left, right) {
  return Math.abs(left - right) <= 10;
}

async function insertBatches(client, table, rows) {
  for (let offset = 0; offset < rows.length; offset += 500) {
    const batch = rows.slice(offset, offset + 500);
    if (batch.length === 0) continue;
    const { error } = await client.from(table).insert(batch);
    if (error) throw new Error(`Could not insert ${table}: ${error.message}`);
  }
}

async function checkedDelete(query, label) {
  const { error } = await query;
  if (error) throw new Error(`Could not delete ${label}: ${error.message}`);
}
