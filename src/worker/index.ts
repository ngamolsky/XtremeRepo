import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createClient } from "@supabase/supabase-js";
import {
  jsonSchema,
  stepCountIs,
  streamText,
  tool,
  type ModelMessage,
} from "ai";
import { Database } from "../types/database.types";
import { handleUpload } from "./uploadParser";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/upload" && request.method === "POST") {
      return handleUpload(request);
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChat(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};

type Env = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  AI_PROVIDER?: ChatProvider;
};

type ChatProvider = "openai" | "anthropic";
type ChatModelId =
  | "gpt-5.5"
  | "gpt-5.4-mini"
  | "claude-opus-4-8"
  | "claude-sonnet-4-6";

type ChatModelConfig = {
  id: ChatModelId;
  provider: ChatProvider;
};

type ClientChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type PageContext = {
  pathname?: string;
  title?: string;
  visibleHeading?: string;
  visibleSummary?: string;
};

type ChatRequestBody = {
  messages?: ClientChatMessage[];
  model?: unknown;
  provider?: ChatProvider;
  pageContext?: PageContext;
};

type DataClient = ReturnType<typeof createClient<Database>>;
type RunnerRow = Pick<Database["public"]["Tables"]["runners"]["Row"], "email" | "id" | "name">;
type ResultInsert = Database["public"]["Tables"]["results"]["Insert"];

type AddLegPerformanceInput = {
  year: number;
  legNumber: number;
  legVersion: number;
  runnerName: string;
  lapTime: string;
  notes?: string;
  createRunnerIfMissing?: boolean;
  overwriteExisting?: boolean;
};

type SetYearNotesInput = {
  year: number;
  notes: string;
};

type SetLegPerformanceNotesInput = {
  year: number;
  legNumber: number;
  notes: string;
};

const jsonHeaders = {
  "Content-Type": "application/json",
};

const chatModels: Record<ChatModelId, ChatModelConfig> = {
  "gpt-5.5": {
    id: "gpt-5.5",
    provider: "openai",
  },
  "gpt-5.4-mini": {
    id: "gpt-5.4-mini",
    provider: "openai",
  },
  "claude-opus-4-8": {
    id: "claude-opus-4-8",
    provider: "anthropic",
  },
  "claude-sonnet-4-6": {
    id: "claude-sonnet-4-6",
    provider: "anthropic",
  },
};

const defaultModelIds: Record<ChatProvider, ChatModelId> = {
  openai: "gpt-5.4-mini",
  anthropic: "claude-sonnet-4-6",
};

async function handleChat(request: Request, env: Env): Promise<Response> {
  const body = await readChatRequest(request);
  const selectedModel = resolveSelectedModel(body.model, body.provider, env);

  if (!selectedModel) {
    return Response.json(
      { error: `Unsupported model. Choose one of: ${Object.keys(chatModels).join(", ")}.` },
      { status: 400, headers: jsonHeaders }
    );
  }

  const messages = sanitizeMessages(body.messages);
  const authorizationHeader = request.headers.get("authorization") ?? undefined;

  if (messages.length === 0) {
    return Response.json(
      { error: "Send at least one chat message." },
      { status: 400, headers: jsonHeaders }
    );
  }

  const missingKey =
    selectedModel.provider === "openai" ? !env.OPENAI_API_KEY : !env.ANTHROPIC_API_KEY;

  if (missingKey) {
    const keyName = selectedModel.provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
    return Response.json(
      { error: `Missing ${keyName}. Add it to your worker environment to enable ${selectedModel.id}.` },
      { status: 400, headers: jsonHeaders }
    );
  }

  const model = resolveModel(selectedModel, env);
  const supabase = createRelayClient(env, authorizationHeader);
  const result = streamText({
    model,
    messages,
    system: buildSystemPrompt(body.pageContext),
    tools: createRelayTools(supabase),
    stopWhen: stepCountIs(5),
  });

  return result.toTextStreamResponse({
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function readChatRequest(request: Request): Promise<ChatRequestBody> {
  try {
    return (await request.json()) as ChatRequestBody;
  } catch {
    return {};
  }
}

function resolveProvider(requestedProvider: ChatProvider | undefined, env: Env): ChatProvider {
  if (requestedProvider === "anthropic" || requestedProvider === "openai") {
    return requestedProvider;
  }

  return env.AI_PROVIDER === "anthropic" ? "anthropic" : "openai";
}

function resolveSelectedModel(
  requestedModelId: unknown,
  requestedProvider: ChatProvider | undefined,
  env: Env
): ChatModelConfig | null {
  if (typeof requestedModelId === "string") {
    return isChatModelId(requestedModelId) ? chatModels[requestedModelId] : null;
  }

  const provider = resolveProvider(requestedProvider, env);
  return chatModels[defaultModelIds[provider]];
}

function isChatModelId(modelId: string): modelId is ChatModelId {
  return Object.prototype.hasOwnProperty.call(chatModels, modelId);
}

function resolveModel(selectedModel: ChatModelConfig, env: Env) {
  if (selectedModel.provider === "anthropic") {
    return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(selectedModel.id);
  }

  return createOpenAI({ apiKey: env.OPENAI_API_KEY })(selectedModel.id);
}

function sanitizeMessages(messages: ClientChatMessage[] | undefined): ModelMessage[] {
  if (!messages) {
    return [];
  }

  return messages
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0
    )
    .slice(-12)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 4000),
    }));
}

function createRelayClient(env: Env, authorizationHeader?: string): DataClient {
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase worker environment variables.");
  }

  return createClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    global: {
      headers: authorizationHeader ? { Authorization: authorizationHeader } : {},
    },
  });
}

function buildSystemPrompt(pageContext: PageContext | undefined): string {
  const page = [
    pageContext?.title && `Page title: ${pageContext.title}`,
    pageContext?.pathname && `Route: ${pageContext.pathname}`,
    pageContext?.visibleHeading && `Visible heading: ${pageContext.visibleHeading}`,
    pageContext?.visibleSummary && `Visible page summary: ${pageContext.visibleSummary}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `You are the Xtreme Falcons race data agent.

Answer questions about relay race results, team members, legs, years, paces, and rankings. Use the provided tools before making factual claims about the data. Treat lower pace values as faster, and lower percentile values as better because they mean closer to the top of the field.

You can also add individual leg performance results and maintain optional fun tidbit notes on years or individual leg runs. For a leg performance write, collect exactly: race year, leg number, leg version, runner name, and lap time. Notes are optional. Ask short follow-up questions until every required field is known. Do not invent missing fields. If the runner is missing or ambiguous, ask the user to choose an existing runner or explicitly confirm creating a new runner. If a result already exists for the same race year and leg number, ask the user to confirm replacement before overwriting. Once a write succeeds, summarize the saved row.

If the user asks a question that depends on the current screen, use the page context below to scope the answer first. Keep answers concise and practical, cite the years/runners/legs you used, and say when the data does not contain enough information.

Current page context:
${page || "No page context provided."}`;
}

function createRelayTools(supabase: DataClient) {
  return {
    getRaceOverview: tool({
      description:
        "Get high-level race history, yearly summaries, total leg count, and top runner/leg records.",
      inputSchema: jsonSchema<Record<string, never>>({
        type: "object",
        properties: {},
        additionalProperties: false,
      }),
      execute: async () => {
        const [yearlySummary, runnerStats, legVersionStats, results] = await Promise.all([
          fetchRows(supabase.from("v_yearly_summary").select("*").order("year", { ascending: false })),
          fetchRows(supabase.from("v_runner_stats").select("*").order("total_races", { ascending: false })),
          fetchRows(supabase.from("v_leg_version_stats").select("*")),
          fetchRows(supabase.from("v_results_with_pace").select("*")),
        ]);

        return {
          yearlySummary,
          totals: {
            yearsCompeted: yearlySummary.length,
            legResults: results.length,
            runners: runnerStats.filter((runner) => runner.runner_name).length,
            legVersions: legVersionStats.length,
          },
          topRunnersByParticipation: runnerStats.slice(0, 8),
          fastestLegVersions: [...legVersionStats]
            .filter((leg) => leg.best_pace !== null)
            .sort((a, b) => (a.best_pace || Number.POSITIVE_INFINITY) - (b.best_pace || Number.POSITIVE_INFINITY))
            .slice(0, 8),
        };
      },
    }),
    findRunner: tool({
      description:
        "Find team member stats and race results by runner name. Use for questions about a person or comparing a named runner.",
      inputSchema: jsonSchema<{ runnerName: string }>({
        type: "object",
        properties: {
          runnerName: {
            type: "string",
            description: "Full or partial runner name.",
          },
        },
        required: ["runnerName"],
        additionalProperties: false,
      }),
      execute: async ({ runnerName }) => {
        const query = runnerName.trim();
        const [stats, results] = await Promise.all([
          fetchRows(
            supabase
              .from("v_runner_stats")
              .select("*")
              .ilike("runner_name", `%${escapeLike(query)}%`)
              .limit(10)
          ),
          fetchRows(
            supabase
              .from("v_results_with_pace")
              .select("*")
              .ilike("runner_name", `%${escapeLike(query)}%`)
              .order("year", { ascending: false })
              .limit(80)
          ),
        ]);

        return { query, stats, results };
      },
    }),
    getLegDetails: tool({
      description:
        "Get stats and historical results for one leg number, optionally scoped to a leg version.",
      inputSchema: jsonSchema<{ legNumber: number; version?: number }>({
        type: "object",
        properties: {
          legNumber: {
            type: "number",
            description: "Relay leg number.",
          },
          version: {
            type: "number",
            description: "Optional route version for the leg.",
          },
        },
        required: ["legNumber"],
        additionalProperties: false,
      }),
      execute: async ({ legNumber, version }) => {
        let statQuery = supabase
          .from("v_leg_version_stats")
          .select("*")
          .eq("leg_number", legNumber);
        let resultQuery = supabase
          .from("v_results_with_pace")
          .select("*")
          .eq("leg_number", legNumber)
          .order("year", { ascending: false });

        if (typeof version === "number") {
          statQuery = statQuery.eq("leg_version", version);
          resultQuery = resultQuery.eq("leg_version", version);
        }

        const [stats, results] = await Promise.all([
          fetchRows(statQuery),
          fetchRows(resultQuery.limit(80)),
        ]);

        return { legNumber, version: version ?? null, stats, results };
      },
    }),
    getYearResults: tool({
      description:
        "Get summary and all leg results for a race year. Use for questions about a specific year's race.",
      inputSchema: jsonSchema<{ year: number }>({
        type: "object",
        properties: {
          year: {
            type: "number",
            description: "Race year, such as 2025.",
          },
        },
        required: ["year"],
        additionalProperties: false,
      }),
      execute: async ({ year }) => {
        const [summary, results] = await Promise.all([
          fetchRows(supabase.from("v_yearly_summary").select("*").eq("year", year).limit(1)),
          fetchRows(
            supabase
              .from("v_results_with_pace")
              .select("*")
              .eq("year", year)
              .order("leg_number", { ascending: true })
          ),
        ]);

        return { year, summary: summary[0] ?? null, results };
      },
    }),
    addLegPerformance: tool({
      description:
        "Add or replace one runner's performance result for a relay leg. Call only after the user has provided race year, leg number, leg version, runner name, and lap time.",
      inputSchema: jsonSchema<AddLegPerformanceInput>({
        type: "object",
        properties: {
          year: {
            type: "number",
            description: "Race year, such as 2025.",
          },
          legNumber: {
            type: "number",
            description: "Relay leg number.",
          },
          legVersion: {
            type: "number",
            description: "Route version for that leg.",
          },
          runnerName: {
            type: "string",
            description: "Exact runner name.",
          },
          lapTime: {
            type: "string",
            description: "Lap time as HH:MM:SS, H:MM:SS, or a clear hours/minutes/seconds phrase.",
          },
          notes: {
            type: "string",
            description: "Optional fun tidbit notes for this specific leg run.",
          },
          createRunnerIfMissing: {
            type: "boolean",
            description:
              "Set true only when the user explicitly confirms creating a runner if no exact runner exists.",
          },
          overwriteExisting: {
            type: "boolean",
            description:
              "Set true only when the user explicitly confirms replacing an existing result for the same year and leg.",
          },
        },
        required: ["year", "legNumber", "legVersion", "runnerName", "lapTime"],
        additionalProperties: false,
      }),
      execute: async (input) => addLegPerformance(supabase, input),
    }),
    setYearNotes: tool({
      description:
        "Set or clear optional fun tidbit notes for a race year. Call after the user provides the year and note text.",
      inputSchema: jsonSchema<SetYearNotesInput>({
        type: "object",
        properties: {
          year: {
            type: "number",
            description: "Race year, such as 2025.",
          },
          notes: {
            type: "string",
            description: "Notes to save. Use an empty string to clear notes.",
          },
        },
        required: ["year", "notes"],
        additionalProperties: false,
      }),
      execute: async (input) => setYearNotes(supabase, input),
    }),
    setLegPerformanceNotes: tool({
      description:
        "Set or clear optional fun tidbit notes for one existing leg run. Call after the user provides year, leg number, and note text.",
      inputSchema: jsonSchema<SetLegPerformanceNotesInput>({
        type: "object",
        properties: {
          year: {
            type: "number",
            description: "Race year, such as 2025.",
          },
          legNumber: {
            type: "number",
            description: "Relay leg number.",
          },
          notes: {
            type: "string",
            description: "Notes to save. Use an empty string to clear notes.",
          },
        },
        required: ["year", "legNumber", "notes"],
        additionalProperties: false,
      }),
      execute: async (input) => setLegPerformanceNotes(supabase, input),
    }),
  };
}

async function addLegPerformance(supabase: DataClient, input: AddLegPerformanceInput) {
  const year = normalizeInteger(input.year);
  const legNumber = normalizeInteger(input.legNumber);
  const legVersion = normalizeInteger(input.legVersion);
  const runnerName = input.runnerName.trim();
  const lapTime = normalizeLapTime(input.lapTime);

  const missingFields = [
    !year && "race year",
    !legNumber && "leg number",
    !legVersion && "leg version",
    !runnerName && "runner name",
    !lapTime && "lap time as HH:MM:SS",
  ].filter(Boolean);

  if (missingFields.length > 0) {
    return {
      ok: false,
      action: "ask_for_missing_fields",
      missingFields,
    };
  }

  const [placement, legDefinition] = await Promise.all([
    fetchMaybeRow(
      supabase
        .from("placements")
        .select("*")
        .eq("year", year)
        .maybeSingle()
    ),
    fetchMaybeRow(
      supabase
        .from("leg_definitions")
        .select("*")
        .eq("number", legNumber)
        .eq("version", legVersion)
        .maybeSingle()
    ),
  ]);

  if (!placement) {
    return {
      ok: false,
      action: "ask_for_existing_race_year_or_placement",
      message:
        "This race year is not in placements yet. Ask for official placement details or choose an existing year before adding leg performance.",
      year,
    };
  }

  if (!legDefinition) {
    const matchingLegVersions = await fetchRows(
      supabase
        .from("leg_definitions")
        .select("*")
        .eq("number", legNumber)
        .order("version", { ascending: true })
    );

    return {
      ok: false,
      action: "ask_for_valid_leg_version",
      message: "That leg/version is not defined.",
      legNumber,
      requestedVersion: legVersion,
      availableVersions: matchingLegVersions,
    };
  }

  const runner = await resolveRunner(supabase, runnerName, Boolean(input.createRunnerIfMissing));

  if (!runner.ok) {
    return runner;
  }

  const existingResult = await fetchMaybeRow(
    supabase
      .from("v_results_with_pace")
      .select("*")
      .eq("year", year)
      .eq("leg_number", legNumber)
      .maybeSingle()
  );

  if (existingResult && !input.overwriteExisting) {
    return {
      ok: false,
      action: "confirm_overwrite_existing_result",
      message:
        "A result already exists for this year and leg. Ask the user whether to replace it before writing.",
      requested: {
        year,
        legNumber,
        legVersion,
        runnerName: runner.runner.name,
        lapTime,
        notes: normalizeNotes(input.notes),
      },
      existingResult,
    };
  }

  const payload: ResultInsert = {
    year,
    leg_number: legNumber,
    leg_version: legVersion,
    user_id: runner.runner.id,
    lap_time: lapTime,
    notes: normalizeNotes(input.notes),
  };

  await fetchRows(
    supabase
      .from("results")
      .upsert(payload, { onConflict: "year,leg_number" })
      .select("*")
  );

  const savedResult = await fetchMaybeRow(
    supabase
      .from("v_results_with_pace")
      .select("*")
      .eq("year", year)
      .eq("leg_number", legNumber)
      .maybeSingle()
  );

  return {
    ok: true,
    action: existingResult ? "replaced_leg_performance" : "added_leg_performance",
    result: savedResult,
  };
}

async function setYearNotes(supabase: DataClient, input: SetYearNotesInput) {
  const year = normalizeInteger(input.year);

  if (!year) {
    return {
      ok: false,
      action: "ask_for_missing_fields",
      missingFields: ["race year"],
    };
  }

  const placement = await fetchMaybeRow(
    supabase
      .from("placements")
      .select("*")
      .eq("year", year)
      .maybeSingle()
  );

  if (!placement) {
    return {
      ok: false,
      action: "ask_for_existing_race_year_or_placement",
      message: "This race year is not in placements yet. Ask for official placement details before saving a year note.",
      year,
    };
  }

  const updatedRows = await fetchRows(
    supabase
      .from("placements")
      .update({ notes: normalizeNotes(input.notes) })
      .eq("year", year)
      .select("*")
  );

  return {
    ok: true,
    action: "saved_year_notes",
    placement: updatedRows[0],
  };
}

async function setLegPerformanceNotes(
  supabase: DataClient,
  input: SetLegPerformanceNotesInput
) {
  const year = normalizeInteger(input.year);
  const legNumber = normalizeInteger(input.legNumber);

  const missingFields = [
    !year && "race year",
    !legNumber && "leg number",
  ].filter(Boolean);

  if (missingFields.length > 0) {
    return {
      ok: false,
      action: "ask_for_missing_fields",
      missingFields,
    };
  }

  const existingResult = await fetchMaybeRow(
    supabase
      .from("results")
      .select("*")
      .eq("year", year)
      .eq("leg_number", legNumber)
      .maybeSingle()
  );

  if (!existingResult) {
    return {
      ok: false,
      action: "ask_for_existing_leg_run",
      message: "No leg result exists for that year and leg number yet. Ask for the full leg performance details first.",
      year,
      legNumber,
    };
  }

  await fetchRows(
    supabase
      .from("results")
      .update({ notes: normalizeNotes(input.notes) })
      .eq("year", year)
      .eq("leg_number", legNumber)
      .select("*")
  );

  const savedResult = await fetchMaybeRow(
    supabase
      .from("v_results_with_pace")
      .select("*")
      .eq("year", year)
      .eq("leg_number", legNumber)
      .maybeSingle()
  );

  return {
    ok: true,
    action: "saved_leg_performance_notes",
    result: savedResult,
  };
}

async function resolveRunner(
  supabase: DataClient,
  runnerName: string,
  createRunnerIfMissing: boolean
):
  | Promise<{ ok: true; runner: RunnerRow }>
  | Promise<{
      ok: false;
      action: "ask_for_runner_name" | "ask_to_create_runner";
      message: string;
      runnerName: string;
      possibleMatches: RunnerRow[];
    }> {
  const exactMatches = await fetchRows(
    supabase
      .from("runners")
      .select("id,name,email")
      .ilike("name", runnerName)
      .limit(5)
  );

  if (exactMatches.length === 1) {
    return { ok: true, runner: exactMatches[0] };
  }

  if (exactMatches.length > 1) {
    return {
      ok: false,
      action: "ask_for_runner_name",
      message: "More than one runner matched that name. Ask for the exact runner.",
      runnerName,
      possibleMatches: exactMatches,
    };
  }

  const possibleMatches = await fetchRows(
    supabase
      .from("runners")
      .select("id,name,email")
      .ilike("name", `%${escapeLike(runnerName)}%`)
      .limit(8)
  );

  if (!createRunnerIfMissing) {
    return {
      ok: false,
      action: "ask_to_create_runner",
      message:
        "No exact runner matched. Ask the user to choose a possible match or confirm creating a new runner.",
      runnerName,
      possibleMatches,
    };
  }

  const inserted = await fetchRows(
    supabase
      .from("runners")
      .insert({ name: runnerName })
      .select("id,name,email")
  );

  return { ok: true, runner: inserted[0] };
}

async function fetchRows<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function fetchMaybeRow<T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>
): Promise<T | null> {
  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

function normalizeInteger(value: number): number | null {
  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }

  return value;
}

function normalizeLapTime(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  const clockTime = trimmed.match(/^(\d{1,3}):([0-5]?\d):([0-5]?\d)$/);

  if (clockTime) {
    return [
      clockTime[1].padStart(2, "0"),
      clockTime[2].padStart(2, "0"),
      clockTime[3].padStart(2, "0"),
    ].join(":");
  }

  const minutesSeconds = trimmed.match(/^(\d{2,3}):([0-5]?\d)$/);

  if (minutesSeconds) {
    const totalMinutes = Number(minutesSeconds[1]);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const seconds = Number(minutesSeconds[2]);

    return [hours, minutes, seconds]
      .map((part) => part.toString().padStart(2, "0"))
      .join(":");
  }

  const hours = Number(trimmed.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/)?.[1] ?? 0);
  const minutes = Number(trimmed.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/)?.[1] ?? 0);
  const seconds = Number(trimmed.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)\b/)?.[1] ?? 0);

  if (hours + minutes + seconds > 0) {
    const totalSeconds = Math.round(hours * 3600 + minutes * 60 + seconds);
    const normalizedHours = Math.floor(totalSeconds / 3600);
    const normalizedMinutes = Math.floor((totalSeconds % 3600) / 60);
    const normalizedSeconds = totalSeconds % 60;

    return [normalizedHours, normalizedMinutes, normalizedSeconds]
      .map((part) => part.toString().padStart(2, "0"))
      .join(":");
  }

  return null;
}

function normalizeNotes(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
