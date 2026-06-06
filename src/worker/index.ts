import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createClient } from "@supabase/supabase-js";
import {
  jsonSchema,
  stepCountIs,
  streamText,
  tool,
  type ImagePart,
  type ModelMessage,
  type TextPart,
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
  attachments?: ClientChatAttachment[];
};

type ClientChatAttachment = {
  name?: string;
  mediaType?: string;
  dataUrl?: string;
  size?: number;
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
type CurrentRunnerRow = Pick<
  Database["public"]["Tables"]["runners"]["Row"],
  "auth_user_id" | "email" | "id" | "name"
>;
type ResultWithPaceRow = Database["public"]["Views"]["v_results_with_pace"]["Row"];
type RunnerParticipationRow = Database["public"]["Views"]["v_runner_participations"]["Row"];
type LegObservationRow = Database["public"]["Tables"]["leg_result_observations"]["Row"];
type LegObservationWithPaceRow = Database["public"]["Views"]["v_leg_result_observations_with_pace"]["Row"];
type LegObservationInsert = Database["public"]["Tables"]["leg_result_observations"]["Insert"];
type LegObservationUpdate = Database["public"]["Tables"]["leg_result_observations"]["Update"];

type LegObservationSourceType =
  | "apple_watch"
  | "garmin"
  | "phone"
  | "strava"
  | "manual_runner"
  | "manual_admin"
  | "other";

type SaveLegObservationInput = {
  observationId?: string;
  year: number;
  legNumber: number;
  legVersion?: number;
  runnerName: string;
  sourceType?: LegObservationSourceType;
  sourceLabel?: string;
  sourceTags?: string[];
  lapTime?: string;
  movingTime?: string;
  elapsedTime?: string;
  distance?: number | null;
  elevationGain?: number | null;
  metadata?: Record<string, unknown>;
  overwriteExisting?: boolean;
};

type DeleteLegObservationInput = {
  observationId?: string;
  year?: number;
  legNumber?: number;
  legVersion?: number;
  runnerName?: string;
  sourceType?: LegObservationSourceType;
  sourceLabel?: string;
  confirm?: boolean;
};

type CurrentUserContext = {
  authUserId: string | null;
  email: string | null;
  runner: CurrentRunnerRow | null;
};

type RunnerIndexEntry = {
  id: string | null;
  name: string;
  aliases: string[];
  totalRaces: number;
  uniqueYears: number;
  knownLegRuns: number;
  knownLegYears: number[];
  years: number[];
  unknownLegYears: number[];
  legs: Array<{
    year: number;
    legNumber: number;
    legVersion: number;
  }>;
  observations: Array<{
    year: number;
    legNumber: number;
    legVersion: number;
    sourceType: string;
    sourceTags: string[];
    hasOfficialResult: boolean;
  }>;
};

type AgentStreamEvent =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "tool-call";
      id: string;
      toolName: string;
      label: string;
    }
  | {
      type: "tool-result";
      id: string;
      toolName: string;
      label: string;
      status: "done" | "error";
    }
  | {
      type: "error";
      message: string;
    };

type AgentStreamInit = {
  headers?: ConstructorParameters<typeof Headers>[0];
  status?: number;
  statusText?: string;
};

const jsonHeaders = {
  "Content-Type": "application/json",
};

const supportedChatImageMediaTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const maxChatImageSizeBytes = 4 * 1024 * 1024;
const maxImagesPerMessage = 1;

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

  const sanitizedMessages = sanitizeMessages(body.messages);
  const authorizationHeader = request.headers.get("authorization") ?? undefined;

  if (sanitizedMessages.error) {
    return Response.json(
      { error: sanitizedMessages.error },
      { status: 400, headers: jsonHeaders }
    );
  }

  const messages = sanitizedMessages.messages;

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
  const dataAccessError = await verifyRaceDataAccess(supabase, authorizationHeader);

  if (dataAccessError) {
    return dataAccessError;
  }

  const [runnerIndex, currentUser] = await Promise.all([
    getRunnerIndex(supabase).catch(() => []),
    getCurrentUserContext(supabase).catch(() => createAnonymousUserContext()),
  ]);
  const limitToolExecution = createToolExecutionLimiter(5);
  const result = streamText({
    model,
    messages,
    system: buildSystemPrompt(body.pageContext, runnerIndex, currentUser),
    tools: createRelayTools(supabase, limitToolExecution, currentUser),
    stopWhen: stepCountIs(5),
  });

  return streamAgentEvents(result.fullStream, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function verifyRaceDataAccess(
  supabase: DataClient,
  authorizationHeader: string | undefined
): Promise<Response | null> {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return Response.json(
      { error: "Sign in before using the agent so it can read race data and save self recorded observations." },
      { status: 401, headers: jsonHeaders }
    );
  }

  try {
    await Promise.all([
      fetchRows(supabase.from("v_results_with_pace").select("year").limit(1)),
      fetchRowsOrEmptyWhenMissing(supabase.from("v_leg_result_observations_with_pace").select("year").limit(1)),
      fetchRowsOrEmptyWhenMissing(supabase.from("v_comments_with_author").select("id").limit(1)),
      fetchRows(supabase.from("v_runner_participations").select("year").limit(1)),
      fetchRows(supabase.from("runners").select("id").limit(1)),
    ]);
  } catch (error) {
    return Response.json(
      {
        error:
          `The agent could not read race data with your current Supabase session (${getErrorMessage(error)}). ` +
          "Sign out and sign back in, then try again.",
      },
      { status: 403, headers: jsonHeaders }
    );
  }

  return null;
}

function createAnonymousUserContext(): CurrentUserContext {
  return {
    authUserId: null,
    email: null,
    runner: null,
  };
}

async function getCurrentUserContext(supabase: DataClient): Promise<CurrentUserContext> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return createAnonymousUserContext();
  }

  const runner = await fetchMaybeRow(
    supabase
      .from("runners")
      .select("id,name,email,auth_user_id")
      .eq("auth_user_id", user.id)
      .maybeSingle()
  ).catch(() => null);

  return {
    authUserId: user.id,
    email: typeof user.email === "string" ? user.email : null,
    runner,
  };
}

type ToolExecutionLimiter = <Input, Output>(
  execute: (input: Input) => Promise<Output>
) => (input: Input) => Promise<Output>;

function createToolExecutionLimiter(maxConcurrent: number): ToolExecutionLimiter {
  let active = 0;
  const queue: Array<() => void> = [];

  return (execute) => async (input) => {
    await acquireToolExecutionSlot();

    try {
      return await execute(input);
    } finally {
      releaseToolExecutionSlot();
    }
  };

  function acquireToolExecutionSlot() {
    if (active < maxConcurrent) {
      active += 1;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      queue.push(() => {
        active += 1;
        resolve();
      });
    });
  }

  function releaseToolExecutionSlot() {
    active = Math.max(0, active - 1);
    queue.shift()?.();
  }
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

function sanitizeMessages(
  messages: ClientChatMessage[] | undefined
): { messages: ModelMessage[]; error?: string } {
  if (!messages) {
    return { messages: [] };
  }

  const sanitizedMessages: ModelMessage[] = [];

  for (const message of messages
    .filter(
      (message) => message.role === "user" || message.role === "assistant"
    )
    .slice(-12)) {
    const text =
      typeof message.content === "string"
        ? message.content.trim().slice(0, 4000)
        : "";

    if (message.role === "assistant") {
      if (text) {
        sanitizedMessages.push({
          role: "assistant",
          content: text,
        });
      }
      continue;
    }

    const attachmentResult = sanitizeImageAttachments(message.attachments);
    if (attachmentResult.error) {
      return { messages: [], error: attachmentResult.error };
    }

    if (!text && attachmentResult.images.length === 0) {
      continue;
    }

    if (attachmentResult.images.length === 0) {
      sanitizedMessages.push({
        role: "user",
        content: text,
      });
      continue;
    }

    const content: Array<TextPart | ImagePart> = [
      ...(text ? [{ type: "text" as const, text }] : []),
      ...attachmentResult.images,
    ];

    sanitizedMessages.push({
      role: "user",
      content,
    });
  }

  return { messages: sanitizedMessages };
}

function sanitizeImageAttachments(
  attachments: ClientChatAttachment[] | undefined
): { images: ImagePart[]; error?: string } {
  if (!attachments?.length) {
    return { images: [] };
  }

  const images: ImagePart[] = [];

  for (const attachment of attachments.slice(0, maxImagesPerMessage)) {
    const dataUrl = typeof attachment.dataUrl === "string" ? attachment.dataUrl : "";
    const parsedDataUrl = parseImageDataUrl(dataUrl);
    const mediaType = parsedDataUrl?.mediaType || attachment.mediaType;

    if (!parsedDataUrl || !mediaType || !supportedChatImageMediaTypes.has(mediaType)) {
      return {
        images: [],
        error: "Attach a PNG, JPG, or WebP screenshot.",
      };
    }

    const estimatedSize = estimateBase64ByteLength(parsedDataUrl.base64Data);
    if (estimatedSize > maxChatImageSizeBytes) {
      return {
        images: [],
        error: "Keep screenshots under 4 MB.",
      };
    }

    images.push({
      type: "image",
      image: parsedDataUrl.base64Data,
      mediaType,
    });
  }

  return { images };
}

function parseImageDataUrl(
  dataUrl: string
): { mediaType: string; base64Data: string } | null {
  const match = dataUrl.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);

  if (!match) {
    return null;
  }

  return {
    mediaType: match[1].toLowerCase(),
    base64Data: match[2],
  };
}

function estimateBase64ByteLength(base64Data: string): number {
  const padding = base64Data.endsWith("==") ? 2 : base64Data.endsWith("=") ? 1 : 0;
  return Math.floor((base64Data.length * 3) / 4) - padding;
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

function streamAgentEvents(
  stream: AsyncIterable<{ type: string; [key: string]: unknown }>,
  init?: AgentStreamInit
): Response {
  const encoder = new TextEncoder();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/x-ndjson; charset=utf-8");

  const body = new ReadableStream({
    async start(controller) {
      const send = (event: AgentStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        for await (const part of stream) {
          if (part.type === "text-delta" && typeof part.text === "string") {
            send({ type: "text", text: part.text });
          }

          if (
            part.type === "tool-call" &&
            typeof part.toolCallId === "string" &&
            typeof part.toolName === "string"
          ) {
            send({
              type: "tool-call",
              id: part.toolCallId,
              toolName: part.toolName,
              label: describeToolUse(part.toolName, part.input),
            });
          }

          if (
            part.type === "tool-result" &&
            typeof part.toolCallId === "string" &&
            typeof part.toolName === "string"
          ) {
            send({
              type: "tool-result",
              id: part.toolCallId,
              toolName: part.toolName,
              label: describeToolUse(part.toolName, part.input),
              status: "done",
            });
          }

          if (
            part.type === "tool-error" &&
            typeof part.toolCallId === "string" &&
            typeof part.toolName === "string"
          ) {
            send({
              type: "tool-result",
              id: part.toolCallId,
              toolName: part.toolName,
              label: describeToolUse(part.toolName, part.input),
              status: "error",
            });
          }

          if (part.type === "error") {
            send({ type: "error", message: getErrorMessage(part.error) });
          }
        }
      } catch (error) {
        send({ type: "error", message: getErrorMessage(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    ...init,
    headers,
  });
}

async function getRunnerIndex(supabase: DataClient): Promise<RunnerIndexEntry[]> {
  const [runners, stats, results, observations, participations] = await Promise.all([
    fetchRows(supabase.from("runners").select("id,name,email").order("name", { ascending: true })),
    fetchRows(supabase.from("v_runner_stats").select("*")),
    fetchRows(
      supabase
        .from("v_results_with_pace")
        .select("runner_id,runner_name,year,leg_number,leg_version")
        .order("year", { ascending: true })
    ),
    fetchRowsOrEmptyWhenMissing(
      supabase
        .from("v_leg_result_observations_with_pace")
        .select("runner_id,year,leg_number,leg_version,source_type,source_tags,has_canonical_result")
        .order("year", { ascending: true })
    ),
    fetchRows(
      supabase
        .from("v_runner_participations")
        .select("runner_id,year,has_known_leg")
        .order("year", { ascending: true })
    ),
  ]);
  const statsByRunnerId = new Map(
    stats
      .filter((stat) => stat.runner_id)
      .map((stat) => [stat.runner_id as string, stat])
  );
  const legsByRunnerId = groupResultsByRunner(results);
  const observationsByRunnerId = groupObservationsByRunner(observations);
  const participationsByRunnerId = groupParticipationsByRunner(participations);

  return runners
    .filter((runner) => runner.name)
    .map((runner) => {
      const legs = legsByRunnerId.get(runner.id) ?? [];
      const selfRecordedObservations = observationsByRunnerId.get(runner.id) ?? [];
      const participation = participationsByRunnerId.get(runner.id);
      const knownLegYears = uniqueSortedNumbers(legs.map((leg) => leg.year));
      const years = participation?.years ?? uniqueSortedNumbers(legs.map((leg) => leg.year));
      const stat = statsByRunnerId.get(runner.id);

      return {
        id: runner.id,
        name: runner.name,
        aliases: createRunnerAliases(runner.name, runner.email),
        totalRaces: stat?.total_races ?? years.length,
        uniqueYears: stat?.unique_years ?? years.length,
        knownLegRuns: stat?.known_leg_runs ?? legs.length,
        knownLegYears,
        years,
        unknownLegYears: participation?.unknownLegYears ?? [],
        legs,
        observations: selfRecordedObservations,
      };
    });
}

function groupResultsByRunner(results: Pick<ResultWithPaceRow, "runner_id" | "year" | "leg_number" | "leg_version">[]) {
  const byRunnerId = new Map<string, RunnerIndexEntry["legs"]>();

  for (const result of results) {
    if (!result.runner_id || !result.year || !result.leg_number || !result.leg_version) {
      continue;
    }

    const legs = byRunnerId.get(result.runner_id) ?? [];
    legs.push({
      year: result.year,
      legNumber: result.leg_number,
      legVersion: result.leg_version,
    });
    byRunnerId.set(result.runner_id, legs);
  }

  return byRunnerId;
}

function groupObservationsByRunner(
  observations: Pick<
    LegObservationWithPaceRow,
    "runner_id" | "year" | "leg_number" | "leg_version" | "source_type" | "source_tags" | "has_canonical_result"
  >[]
) {
  const byRunnerId = new Map<string, RunnerIndexEntry["observations"]>();

  for (const observation of observations) {
    if (
      !observation.runner_id ||
      !observation.year ||
      !observation.leg_number ||
      !observation.leg_version ||
      !observation.source_type
    ) {
      continue;
    }

    const entries = byRunnerId.get(observation.runner_id) ?? [];
    entries.push({
      year: observation.year,
      legNumber: observation.leg_number,
      legVersion: observation.leg_version,
      sourceType: observation.source_type,
      sourceTags: observation.source_tags || [],
      hasOfficialResult: Boolean(observation.has_canonical_result),
    });
    byRunnerId.set(observation.runner_id, entries);
  }

  return byRunnerId;
}

function groupParticipationsByRunner(
  participations: Pick<RunnerParticipationRow, "runner_id" | "year" | "has_known_leg">[]
) {
  const byRunnerId = new Map<string, { years: number[]; unknownLegYears: number[] }>();

  for (const participation of participations) {
    if (!participation.runner_id || !participation.year) {
      continue;
    }

    const entry = byRunnerId.get(participation.runner_id) ?? {
      years: [],
      unknownLegYears: [],
    };
    entry.years.push(participation.year);

    if (!participation.has_known_leg) {
      entry.unknownLegYears.push(participation.year);
    }

    byRunnerId.set(participation.runner_id, entry);
  }

  return new Map(
    [...byRunnerId.entries()].map(([runnerId, entry]) => [
      runnerId,
      {
        years: uniqueSortedNumbers(entry.years),
        unknownLegYears: uniqueSortedNumbers(entry.unknownLegYears),
      },
    ])
  );
}

function formatCurrentUserContext(currentUser: CurrentUserContext): string {
  const runner = currentUser.runner;

  return [
    currentUser.authUserId && `Auth user id: ${currentUser.authUserId}`,
    currentUser.email && `Email: ${currentUser.email}`,
    runner
      ? `Linked runner: ${runner.name} (${runner.id})`
      : "Linked runner: none",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatRunnerIndexForPrompt(runnerIndex: RunnerIndexEntry[]): string {
  if (runnerIndex.length === 0) {
    return "No runners found.";
  }

  return runnerIndex
    .map((runner) => {
      const aliases = runner.aliases.filter((alias) => alias !== normalizeSearchText(runner.name));
      const legs = runner.legs
        .map((leg) => `${leg.year}:L${leg.legNumber}v${leg.legVersion}`)
        .join(" ");
      const observations = runner.observations
        .map(
          (observation) =>
            `${observation.year}:L${observation.legNumber}v${observation.legVersion}(${[
              observation.sourceType,
              observation.sourceTags.length > 0 && `tags:${observation.sourceTags.join("|")}`,
              observation.hasOfficialResult && "official exists",
            ]
              .filter(Boolean)
              .join(", ")})`
        )
        .join(" ");
      const unknownLegYears = runner.unknownLegYears.join(", ");

      return [
        `- ${runner.name}`,
        aliases.length > 0 && `aliases: ${aliases.join(", ")}`,
        `race-years: ${runner.totalRaces}`,
        `known leg runs: ${runner.knownLegRuns}`,
        `known leg years: ${runner.knownLegYears.join(", ") || "none"}`,
        `participation years: ${runner.years.join(", ") || "none"}`,
        unknownLegYears && `unknown legs in: ${unknownLegYears}`,
        legs && `legs: ${legs}`,
        observations && `self recorded observations: ${observations}`,
      ]
        .filter(Boolean)
        .join("; ");
    })
    .join("\n");
}

async function findRunnerData(supabase: DataClient, runnerName: string) {
  const query = runnerName.trim();
  const runnerIndex = await getRunnerIndex(supabase);
  const matches = runnerIndex
    .map((runner) => ({
      runner,
      score: scoreRunnerMatch(runner, query),
    }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || b.runner.totalRaces - a.runner.totalRaces)
    .slice(0, 6);
  const runnerIds = matches
    .map((match) => match.runner.id)
    .filter((id): id is string => Boolean(id));

  if (runnerIds.length === 0) {
    return {
      query,
      matches: [],
      stats: [],
      results: [],
      observations: [],
      participations: [],
      comments: [],
      message: "No runner matched that name. Ask for another spelling or a more specific name.",
    };
  }

  const [stats, results, observations, participations, comments] = await Promise.all([
    fetchRows(
      supabase
        .from("v_runner_stats")
        .select("*")
        .in("runner_id", runnerIds)
        .order("total_races", { ascending: false })
    ),
    fetchRows(
      supabase
        .from("v_results_with_pace")
        .select("*")
        .in("runner_id", runnerIds)
        .order("year", { ascending: false })
        .order("leg_number", { ascending: true })
    ),
    fetchRowsOrEmptyWhenMissing(
      supabase
        .from("v_leg_result_observations_with_pace")
        .select("*")
        .in("runner_id", runnerIds)
        .order("year", { ascending: false })
        .order("leg_number", { ascending: true })
    ),
    fetchRows(
      supabase
        .from("v_runner_participations")
        .select("*")
        .in("runner_id", runnerIds)
        .order("year", { ascending: false })
    ),
    fetchRowsOrEmptyWhenMissing(
      supabase
        .from("v_comments_with_author")
        .select("*")
        .in("runner_id", runnerIds)
        .order("created_at", { ascending: false })
        .limit(100)
    ),
  ]);

  return {
    query,
    matches: matches.map((match) => ({
      score: match.score,
      runner: match.runner,
      stats: stats.find((stat) => stat.runner_id === match.runner.id) ?? null,
      results: results.filter((result) => result.runner_id === match.runner.id),
      observations: observations.filter((observation) => observation.runner_id === match.runner.id),
      participations: participations.filter((participation) => participation.runner_id === match.runner.id),
      comments: comments.filter((comment) => comment.runner_id === match.runner.id),
    })),
    stats,
    results,
    observations,
    participations,
    comments,
  };
}

function scoreRunnerMatch(runner: RunnerIndexEntry, rawQuery: string): number {
  const query = normalizeSearchText(rawQuery);

  if (!query) {
    return 0;
  }

  const name = normalizeSearchText(runner.name);
  const aliases = runner.aliases.map(normalizeSearchText);
  const queryTokens = query.split(" ").filter(Boolean);
  const nameTokens = name.split(" ").filter(Boolean);

  if (name === query) {
    return 100;
  }

  if (aliases.some((alias) => alias === query)) {
    return 95;
  }

  if (aliases.some((alias) => alias.startsWith(query) && query.length >= 3)) {
    return 85;
  }

  if (queryTokens.length > 1 && queryTokens.every((token) => nameTokens.some((nameToken) => nameToken.startsWith(token)))) {
    return 80;
  }

  if (name.includes(query) && query.length >= 3) {
    return 70;
  }

  if (queryTokens.every((token) => aliases.some((alias) => alias.includes(token)))) {
    return 60;
  }

  return 0;
}

function createRunnerAliases(name: string, email?: string | null): string[] {
  const normalizedName = normalizeSearchText(name);
  const nameParts = normalizedName.split(" ").filter(Boolean);
  const aliases = [
    normalizedName,
    nameParts[0],
    nameParts[nameParts.length - 1],
    nameParts.map((part) => part[0]).join(""),
    email?.split("@")[0],
  ];

  return uniqueStrings(aliases.map((alias) => normalizeSearchText(alias ?? "")).filter(Boolean));
}

function describeToolUse(toolName: string, input: unknown): string {
  const params = isRecord(input) ? input : {};

  switch (toolName) {
    case "getRaceOverview":
      return "Reading race overview";
    case "findRunner":
      return `Finding ${stringValue(params.runnerName) || "runner"}`;
    case "getLegDetails":
      return `Reading leg ${stringValue(params.legNumber) || ""}`.trim();
    case "getYearResults":
      return `Reading ${stringValue(params.year) || "year"} results`;
    case "saveLegObservation":
      return "Saving self recorded leg data";
    case "deleteLegObservation":
      return "Deleting self recorded leg data";
    default:
      return `Using ${formatToolName(toolName)}`;
  }
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function uniqueSortedNumbers(values: Array<number | null>): number[] {
  return [...new Set(values.filter((value): value is number => typeof value === "number"))].sort(
    (a, b) => a - b
  );
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function formatToolName(value: string): string {
  return value.replace(/([A-Z])/g, " $1").toLowerCase();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The agent stream failed.";
}

function buildSystemPrompt(
  pageContext: PageContext | undefined,
  runnerIndex: RunnerIndexEntry[],
  currentUser: CurrentUserContext
): string {
  const page = [
    pageContext?.title && `Page title: ${pageContext.title}`,
    pageContext?.pathname && `Route: ${pageContext.pathname}`,
    pageContext?.visibleHeading && `Visible heading: ${pageContext.visibleHeading}`,
    pageContext?.visibleSummary && `Visible page summary: ${pageContext.visibleSummary}`,
  ]
    .filter(Boolean)
    .join("\n");
  const currentUserContext = formatCurrentUserContext(currentUser);
  const runnerContext = formatRunnerIndexForPrompt(runnerIndex);

  return `You are the Xtreme Falcons race data crew chief.

Answer questions about relay race results, team members, legs, years, paces, and rankings. Use the provided tools before making factual claims about the data. Treat lower pace values as faster, and lower percentile values as better because they mean closer to the top of the field. Use Xtreme Falcons flavor: sound like a sharp race-day crew chief with punchy words like shred, rip, send it, dialed, stoked, hammer, full throttle, and locked in. Keep the vibe fun but never let it blur data quality, uncertainty, safety, or write permissions.

When a question spans many years, prefer getRaceOverview or another aggregate tool over calling getYearResults once for every year. Only call getYearResults for specific years whose full leg-by-leg details are needed.

Use data terms precisely. A "leg run", "ran leg", "result", or "performance" means a known official row from v_results_with_pace/results with a leg number and lap time. A "self recorded observation", "watch data", "Garmin data", "phone data", "Strava data", or "runner-submitted data" means a provisional row from v_leg_result_observations_with_pace/leg_result_observations. Self recorded observations can include times, distances, elevation, source labels, source tags, and raw source metadata. User comments live separately in v_comments_with_author/comments and are read-only to you. Self recorded observations can be shown as race-day tracking evidence until official data exists, but they never count as official leg runs, paces, records, aggregate stats, team totals, placements, or official race results. A "race-year participation", "race", or "roster year" can include a runner whose official leg is unknown. Do not count unknown-leg participation years or self recorded observations as official leg runs unless the user explicitly asks about provisional/self recorded data. When comparing runners' official leg-run counts, use knownLegRuns/results and cite the specific result years and legs that explain the difference. When asked which year one runner ran and another did not, compare known official leg years unless the user says roster, participation, provisional, or self recorded observation.

Resolve names softly. First names, partial names, lowercase names, and common short forms are acceptable when the runner index makes the match clear. Do not ask for full names just because the user supplied only a first name. If a partial name matches multiple runners and the answer would differ, call findRunner for the likely matches, explain the ambiguity briefly, and ask one short clarifying question.

Use the current signed-in user context to resolve first-person references like "me", "my", "my profile", or "my runs". If the signed-in user is not linked to a runner, say that there is no linked runner instead of guessing. The signed-in user is the submitter, not necessarily the runner being discussed; a user may submit self recorded data for another existing runner.

Official data and comments are read-only. You can read official results, placements, participation, runner records, comments, and self recorded observations, but you cannot write, replace, edit, or delete official data or comments. If the user asks you to edit official data, refuse briefly and offer to save the supplied values only as a self recorded observation when they include runner/device/app source data. If the user asks you to add/edit/delete comments, explain that the UI supports comments but you cannot write comments. Do not claim that self recorded data is official, verified, or a replacement for official results.

Your only write capability is adding, updating, or deleting self recorded leg observations with saveLegObservation and deleteLegObservation. For any ad hoc leg data write, use saveLegObservation and label it self recorded. For a self recorded observation, collect race year, leg number, the existing runner name the observation is about, and at least one measured field such as lap time, moving time, elapsed time, distance, or elevation gain. Default leg version to v2 unless the user or source explicitly says another version. Source type defaults to manual_runner; use apple_watch, garmin, phone, strava, manual_runner, manual_admin, or other when the user gives the source. Source labels, source tags, screenshots, app names, device names, files, activity titles, and metadata are useful provenance, but they are not enough by themselves to create a new observation. Ask short follow-up questions until every required field is known. Do not invent missing fields. Do not pass null for unknown distance or elevation gain; omit those fields unless the user or source provides a numeric value. If the runner is missing or ambiguous, ask the user to choose an existing runner; do not create new runners and do not infer the runner from other race-day state. Delete self recorded observations only after the user clearly asks to delete self recorded data and you have a specific observationId or an unambiguous match.

When the user attaches a screenshot or image from Strava, Garmin, Apple Watch, phone fitness apps, or similar sources, treat visible values as self recorded source evidence. Extract only values visible in the image or supplied by the user. Prefer source_type strava for Strava screenshots, and capture as much visible screenshot context as possible in metadata: app name, screenshot filename, visible activity title, date/time, route/location text, elapsed/moving/lap time labels, distance, elevation, pace/splits, heart rate, cadence, calories, device/source labels, units, cropped/obscured fields, and any uncertainty. If year, leg number, runner, or the intended source are not visible or supplied, ask for them before saving; default leg version to v2 unless another version is visible or supplied. Once a write succeeds, summarize the saved row and label it self recorded.

If the user asks a question that depends on the current screen, use the page context below to scope the answer first. Keep answers concise and practical, cite the years/runners/legs you used, and say when the data does not contain enough information.

Current page context:
${page || "No page context provided."}

Current signed-in user:
${currentUserContext || "No signed-in user context found."}

Runner index:
${runnerContext}`;
}

function createRelayTools(
  supabase: DataClient,
  limitToolExecution: ToolExecutionLimiter,
  currentUser: CurrentUserContext
) {
  return {
    getRaceOverview: tool({
      description:
        "Get high-level race history, yearly summaries, total leg count, and top runner/leg records.",
      inputSchema: jsonSchema<Record<string, never>>({
        type: "object",
        properties: {},
        additionalProperties: false,
      }),
      execute: limitToolExecution(async () => {
        const [
          yearlySummary,
          runnerStats,
          legVersionStats,
          results,
          observations,
          participations,
          comments,
        ] = await Promise.all([
          fetchRows(supabase.from("v_yearly_summary").select("*").order("year", { ascending: false })),
          fetchRows(supabase.from("v_runner_stats").select("*").order("total_races", { ascending: false })),
          fetchRows(supabase.from("v_leg_version_stats").select("*")),
          fetchRows(supabase.from("v_results_with_pace").select("*")),
          fetchRowsOrEmptyWhenMissing(supabase.from("v_leg_result_observations_with_pace").select("*")),
          fetchRows(supabase.from("v_runner_participations").select("*")),
          fetchRowsOrEmptyWhenMissing(
            supabase
              .from("v_comments_with_author")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(200)
          ),
        ]);

        return {
          yearlySummary,
          totals: {
            yearsCompeted: yearlySummary.length,
            legResults: results.length,
            selfRecordedObservations: observations.length,
            runnerYearParticipations: participations.length,
            comments: comments.length,
            runners: runnerStats.filter((runner) => runner.runner_name).length,
            legVersions: legVersionStats.length,
          },
          topRunnersByParticipation: runnerStats.slice(0, 8),
          fastestLegVersions: [...legVersionStats]
            .filter((leg) => leg.best_pace !== null)
            .sort((a, b) => (a.best_pace || Number.POSITIVE_INFINITY) - (b.best_pace || Number.POSITIVE_INFINITY))
            .slice(0, 8),
          recentComments: comments.slice(0, 25),
        };
      }),
    }),
    findRunner: tool({
      description:
        "Find team member stats and race results by runner name. Soft matches first names, partial names, and aliases. Use for questions about a person or comparing a named runner.",
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
      execute: limitToolExecution(async ({ runnerName }) => {
        return findRunnerData(supabase, runnerName);
      }),
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
      execute: limitToolExecution(async ({ legNumber, version }) => {
        let statQuery = supabase
          .from("v_leg_version_stats")
          .select("*")
          .eq("leg_number", legNumber);
        let resultQuery = supabase
          .from("v_results_with_pace")
          .select("*")
          .eq("leg_number", legNumber)
          .order("year", { ascending: false });
        let observationQuery = supabase
          .from("v_leg_result_observations_with_pace")
          .select("*")
          .eq("leg_number", legNumber)
          .order("year", { ascending: false });
        let legCommentQuery = supabase
          .from("v_comments_with_author")
          .select("*")
          .eq("target_type", "leg")
          .eq("leg_number", legNumber)
          .order("created_at", { ascending: false });
        let runCommentQuery = supabase
          .from("v_comments_with_author")
          .select("*")
          .eq("target_type", "leg_instance")
          .eq("leg_number", legNumber)
          .order("created_at", { ascending: false });

        if (typeof version === "number") {
          statQuery = statQuery.eq("leg_version", version);
          resultQuery = resultQuery.eq("leg_version", version);
          observationQuery = observationQuery.eq("leg_version", version);
          legCommentQuery = legCommentQuery.eq("leg_version", version);
          runCommentQuery = runCommentQuery.eq("leg_version", version);
        }

        const [stats, results, observations, legComments, runComments] = await Promise.all([
          fetchRows(statQuery),
          fetchRows(resultQuery.limit(80)),
          fetchRowsOrEmptyWhenMissing(observationQuery.limit(80)),
          fetchRowsOrEmptyWhenMissing(legCommentQuery.limit(80)),
          fetchRowsOrEmptyWhenMissing(runCommentQuery.limit(80)),
        ]);

        return {
          legNumber,
          version: version ?? null,
          stats,
          results,
          observations,
          comments: {
            leg: legComments,
            runInstances: runComments,
          },
        };
      }),
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
      execute: limitToolExecution(async ({ year }) => {
        const [
          summary,
          results,
          observations,
          participations,
          raceComments,
          runComments,
        ] = await Promise.all([
          fetchRows(supabase.from("v_yearly_summary").select("*").eq("year", year).limit(1)),
          fetchRows(
            supabase
              .from("v_results_with_pace")
              .select("*")
              .eq("year", year)
              .order("leg_number", { ascending: true })
          ),
          fetchRowsOrEmptyWhenMissing(
            supabase
              .from("v_leg_result_observations_with_pace")
              .select("*")
              .eq("year", year)
              .order("leg_number", { ascending: true })
          ),
          fetchRows(
            supabase
              .from("v_runner_participations")
              .select("*")
              .eq("year", year)
              .order("runner_name", { ascending: true })
          ),
          fetchRowsOrEmptyWhenMissing(
            supabase
              .from("v_comments_with_author")
              .select("*")
              .eq("target_type", "race")
              .eq("year", year)
              .order("created_at", { ascending: false })
          ),
          fetchRowsOrEmptyWhenMissing(
            supabase
              .from("v_comments_with_author")
              .select("*")
              .eq("target_type", "leg_instance")
              .eq("year", year)
              .order("created_at", { ascending: false })
          ),
        ]);

        return {
          year,
          summary: summary[0] ?? null,
          results,
          observations,
          participations,
          comments: {
            race: raceComments,
            runInstances: runComments,
          },
        };
      }),
    }),
    saveLegObservation: tool({
      description:
        "Add or update self recorded runner/device data for a leg. Use this by default for ad hoc times, watch/Garmin/phone/Strava data, runner-submitted distance/elevation, or any data not explicitly stated to be official.",
      inputSchema: jsonSchema<SaveLegObservationInput>({
        type: "object",
        properties: {
          observationId: {
            type: "string",
            description: "Existing observation UUID to update when known.",
          },
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
            description: "Route version for that leg. Defaults to 2 unless the user or source explicitly specifies another version.",
          },
          runnerName: {
            type: "string",
            description:
              "Exact existing runner name for the self recorded observation.",
          },
          sourceType: {
            type: "string",
            enum: ["apple_watch", "garmin", "phone", "strava", "manual_runner", "manual_admin", "other"],
            description: "Where the observation came from. Defaults to manual_runner.",
          },
          sourceLabel: {
            type: "string",
            description: "Optional source detail, such as device model, app name, or file name.",
          },
          sourceTags: {
            type: "array",
            description: "Reusable source tags, such as Strava, Apple Watch, screenshot, file name, or activity title.",
            items: {
              type: "string",
            },
          },
          lapTime: {
            type: "string",
            description: "Observed lap time as HH:MM:SS, H:MM:SS, or a clear hours/minutes/seconds phrase.",
          },
          movingTime: {
            type: "string",
            description: "Observed moving time, if the source distinguishes it from elapsed time.",
          },
          elapsedTime: {
            type: "string",
            description: "Observed elapsed time, if the source distinguishes it from moving time.",
          },
          distance: {
            type: ["number", "null"],
            description: "Observed distance in miles. Omit when unknown; null is treated as omitted, not as a value to save.",
          },
          elevationGain: {
            type: ["number", "null"],
            description: "Observed elevation gain in feet. Omit when unknown; null is treated as omitted, not as a value to save.",
          },
          metadata: {
            type: "object",
            description:
              "Optional extra source metadata as key-value pairs. For screenshots, capture as much visible context as possible: app, filename, activity title, date/time, labels, units, route/location, splits/pace/elevation/heart-rate/cadence/calories, device/source, and uncertainty.",
            additionalProperties: true,
          },
          overwriteExisting: {
            type: "boolean",
            description:
              "Set true only when the user explicitly confirms updating one matching existing observation if there is ambiguity.",
          },
        },
        required: ["year", "legNumber", "runnerName"],
        additionalProperties: false,
      }),
      execute: limitToolExecution(async (input) => saveLegObservation(supabase, input, currentUser)),
    }),
    deleteLegObservation: tool({
      description:
        "Delete self recorded runner/device data for a leg. Use only after the user clearly asks to delete self recorded data and the target observation is unambiguous.",
      inputSchema: jsonSchema<DeleteLegObservationInput>({
        type: "object",
        properties: {
          observationId: {
            type: "string",
            description: "Existing self recorded observation UUID to delete.",
          },
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
            description: "Exact runner name for matching a self recorded observation.",
          },
          sourceType: {
            type: "string",
            enum: ["apple_watch", "garmin", "phone", "strava", "manual_runner", "manual_admin", "other"],
            description: "Optional source type filter.",
          },
          sourceLabel: {
            type: "string",
            description: "Optional source label filter.",
          },
          confirm: {
            type: "boolean",
            description: "Set true only when the user explicitly confirmed deletion.",
          },
        },
        additionalProperties: false,
      }),
      execute: limitToolExecution(async (input) => deleteLegObservation(supabase, input)),
    }),
  };
}

async function saveLegObservation(
  supabase: DataClient,
  input: SaveLegObservationInput,
  currentUser: CurrentUserContext
) {
  const year = normalizeInteger(input.year);
  const legNumber = normalizeInteger(input.legNumber);
  const legVersion = normalizeInteger(input.legVersion ?? 2);
  const runnerName = input.runnerName?.trim() ?? "";
  const sourceType = normalizeObservationSourceType(input.sourceType);
  const sourceLabel = input.sourceLabel === undefined ? undefined : normalizeNotes(input.sourceLabel);
  const sourceTags = input.sourceTags === undefined ? undefined : normalizeSourceTags(input.sourceTags);
  const lapTime = normalizeOptionalLapTime(input.lapTime);
  const movingTime = normalizeOptionalLapTime(input.movingTime);
  const elapsedTime = normalizeOptionalLapTime(input.elapsedTime);
  const distance = normalizeOptionalPositiveNumber(input.distance);
  const elevationGain = normalizeOptionalElevationGain(input.elevationGain);
  const metadata = normalizeObservationMetadata(input.metadata);

  const invalidFields = [
    input.lapTime !== undefined && input.lapTime.trim() && lapTime === null && "lap time as HH:MM:SS",
    input.movingTime !== undefined && input.movingTime.trim() && movingTime === null && "moving time as HH:MM:SS",
    input.elapsedTime !== undefined && input.elapsedTime.trim() && elapsedTime === null && "elapsed time as HH:MM:SS",
    input.distance !== undefined && distance === null && "positive distance in miles",
    input.elevationGain !== undefined && elevationGain === null && "non-negative elevation gain in feet",
  ].filter(Boolean);

  if (invalidFields.length > 0) {
    return {
      ok: false,
      action: "ask_for_valid_observation_fields",
      invalidFields,
    };
  }

  if (year === null || legNumber === null || legVersion === null) {
    const missingFields = [
      year === null && "race year",
      legNumber === null && "leg number",
      legVersion === null && "leg version",
    ].filter(Boolean);

    return {
      ok: false,
      action: "ask_for_missing_fields",
      missingFields,
    };
  }

  if (!(await isLegObservationSchemaReady(supabase))) {
    return {
      ok: false,
      action: "schema_migration_required",
      message:
        "The self recorded leg data table/view is not in Supabase yet. Run the latest migration before saving runner/device observations.",
      migration: "supabase/migrations/20260606080000_add_leg_result_observations.sql",
    };
  }

  const hasUpdateIntent =
    input.lapTime !== undefined ||
    input.movingTime !== undefined ||
    input.elapsedTime !== undefined ||
    input.distance !== undefined ||
    input.elevationGain !== undefined ||
    input.sourceTags !== undefined ||
    input.metadata !== undefined ||
    input.sourceLabel !== undefined;
  const hasMaterialData =
    Boolean(lapTime || movingTime || elapsedTime) ||
    distance !== undefined ||
    elevationGain !== undefined;

  if (!hasUpdateIntent) {
    return {
      ok: false,
      action: "ask_for_observation_data",
      message:
        "Ask for at least one measured self recorded field: lap time, moving time, elapsed time, distance, or elevation gain.",
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
        "This race year is not in placements yet. Ask for official placement details or choose an existing year before saving self recorded leg data.",
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

  if (!runnerName) {
    return {
      ok: false,
      action: "ask_for_runner_name",
      message:
        "Ask for the existing runner name before saving self recorded leg data.",
      runnerName: "",
      possibleMatches: [] as RunnerRow[],
    };
  }

  const runner = await resolveRunner(supabase, runnerName);

  if (!runner.ok) {
    return runner;
  }

  const submittedByRunnerId = currentUser.runner?.id ?? null;

  let existingObservation: LegObservationRow | null;

  if (input.observationId) {
    existingObservation = await fetchMaybeRow(
      supabase
        .from("leg_result_observations")
        .select("*")
        .eq("id", input.observationId)
        .maybeSingle()
    );

    if (!existingObservation) {
      return {
        ok: false,
        action: "ask_for_existing_observation",
        message: "No self recorded observation matched that observationId.",
        observationId: input.observationId,
      };
    }
  } else {
    let matchingObservationQuery = supabase
      .from("leg_result_observations")
      .select("*")
      .eq("year", year)
      .eq("leg_number", legNumber)
      .eq("leg_version", legVersion)
      .eq("runner_id", runner.runner.id)
      .eq("source_type", sourceType);

    if (input.sourceLabel !== undefined) {
      const matchingSourceLabel = sourceLabel ?? null;
      matchingObservationQuery =
        matchingSourceLabel === null
          ? matchingObservationQuery.is("source_label", null)
          : matchingObservationQuery.eq("source_label", matchingSourceLabel);
    }

    const matchingObservations = await fetchRows(matchingObservationQuery.limit(5));

    if (matchingObservations.length > 1 && !input.overwriteExisting) {
      return {
        ok: false,
        action: "ask_for_observation_to_update",
        message:
          "More than one self recorded observation matched. Ask which observationId to update, or confirm updating the first match.",
        matches: matchingObservations,
      };
    }

    existingObservation = matchingObservations[0] ?? null;
  }

  if (!existingObservation && !hasMaterialData) {
    return {
      ok: false,
      action: "ask_for_observation_data",
      message:
        "Ask for at least one measured field before creating self recorded leg data: lap time, moving time, elapsed time, distance, or elevation gain.",
    };
  }

  const payload = buildLegObservationPayload({
    year,
    legNumber,
    legVersion,
    runnerId: runner.runner.id,
    sourceType,
    sourceLabel,
    sourceTags,
    lapTime,
    movingTime,
    elapsedTime,
    distance,
    elevationGain,
    metadata,
    input,
  });

  let savedBaseObservation: LegObservationRow;

  if (existingObservation) {
    const updated = await fetchRows(
      supabase
        .from("leg_result_observations")
        .update(payload)
        .eq("id", existingObservation.id)
        .select("*")
    );
    savedBaseObservation = updated[0];
  } else {
    const insertedPayload: LegObservationInsert = {
      year,
      leg_number: legNumber,
      leg_version: legVersion,
      runner_id: runner.runner.id,
      source_type: sourceType,
      source_label: sourceLabel ?? null,
      source_tags: sourceTags ?? [],
      submitted_by_runner_id: submittedByRunnerId,
      ...(lapTime !== undefined ? { lap_time: lapTime } : {}),
      ...(movingTime !== undefined ? { moving_time: movingTime } : {}),
      ...(elapsedTime !== undefined ? { elapsed_time: elapsedTime } : {}),
      ...(distance !== undefined ? { distance } : {}),
      ...(elevationGain !== undefined ? { elevation_gain: elevationGain } : {}),
      ...(metadata !== undefined ? { raw_metadata: metadata as LegObservationInsert["raw_metadata"] } : {}),
    };
    const inserted = await fetchRows(
      supabase
        .from("leg_result_observations")
        .insert(insertedPayload)
        .select("*")
    );
    savedBaseObservation = inserted[0];
  }

  const savedObservation = await fetchMaybeRow<LegObservationWithPaceRow>(
    supabase
      .from("v_leg_result_observations_with_pace")
      .select("*")
      .eq("id", savedBaseObservation.id)
      .maybeSingle()
  );

  return {
    ok: true,
    action: existingObservation ? "updated_leg_observation" : "added_leg_observation",
    officialSupersedes: Boolean(savedObservation?.has_canonical_result),
    observation: savedObservation,
  };
}

async function deleteLegObservation(
  supabase: DataClient,
  input: DeleteLegObservationInput
) {
  if (!(await isLegObservationSchemaReady(supabase))) {
    return {
      ok: false,
      action: "schema_migration_required",
      message:
        "The self recorded leg data table/view is not in Supabase yet. Run the latest migration before deleting runner/device observations.",
      migration: "supabase/migrations/20260606080000_add_leg_result_observations.sql",
    };
  }

  let matches: LegObservationWithPaceRow[];

  if (input.observationId) {
    const observation = await fetchMaybeRow<LegObservationWithPaceRow>(
      supabase
        .from("v_leg_result_observations_with_pace")
        .select("*")
        .eq("id", input.observationId)
        .maybeSingle()
    );

    matches = observation ? [observation] : [];
  } else {
    const year = input.year === undefined ? null : normalizeInteger(input.year);
    const legNumber = input.legNumber === undefined ? null : normalizeInteger(input.legNumber);
    const legVersion = input.legVersion === undefined ? null : normalizeInteger(input.legVersion);
    const runnerName = input.runnerName?.trim() ?? "";

    if (year === null || legNumber === null || legVersion === null || !runnerName) {
      const missingFields = [
        year === null && "race year",
        legNumber === null && "leg number",
        legVersion === null && "leg version",
        !runnerName && "runner name or observationId",
      ].filter(Boolean);

      return {
        ok: false,
        action: "ask_for_missing_delete_fields",
        missingFields,
      };
    }

    const runner = await resolveRunner(supabase, runnerName);

    if (!runner.ok) {
      return runner;
    }

    let query = supabase
      .from("v_leg_result_observations_with_pace")
      .select("*")
      .eq("year", year)
      .eq("leg_number", legNumber)
      .eq("leg_version", legVersion)
      .eq("runner_id", runner.runner.id)
      .order("created_at", { ascending: false });

    if (input.sourceType) {
      query = query.eq("source_type", normalizeObservationSourceType(input.sourceType));
    }

    if (input.sourceLabel !== undefined) {
      const sourceLabel = normalizeNotes(input.sourceLabel);
      query = sourceLabel === null ? query.is("source_label", null) : query.eq("source_label", sourceLabel);
    }

    matches = await fetchRowsOrEmptyWhenMissing(query.limit(10));
  }

  if (matches.length === 0) {
    return {
      ok: false,
      action: "ask_for_existing_observation",
      message: "No self recorded observation matched that delete request.",
      input,
    };
  }

  if (matches.length > 1) {
    return {
      ok: false,
      action: "ask_for_observation_to_delete",
      message: "More than one self recorded observation matched. Ask which observationId to delete.",
      matches,
    };
  }

  const observation = matches[0];

  if (!observation.id) {
    return {
      ok: false,
      action: "ask_for_existing_observation",
      message: "The matched self recorded observation is missing an observationId.",
      observation,
    };
  }

  if (!input.confirm) {
    return {
      ok: false,
      action: "ask_for_delete_confirmation",
      message: "Ask the user to confirm deleting this self recorded observation.",
      observation,
    };
  }

  const { error } = await supabase
    .from("leg_result_observations")
    .delete()
    .eq("id", observation.id);

  if (error) {
    throw new Error(error.message);
  }

  return {
    ok: true,
    action: "deleted_leg_observation",
    observation,
  };
}

async function resolveRunner(
  supabase: DataClient,
  runnerName: string
): Promise<
  | { ok: true; runner: RunnerRow }
  | {
      ok: false;
      action: "ask_for_runner_name";
      message: string;
      runnerName: string;
      possibleMatches: RunnerRow[];
    }
> {
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

  return {
    ok: false,
    action: "ask_for_runner_name",
    message:
      "No exact runner matched. Ask the user to choose an existing runner before saving self recorded data.",
    runnerName,
    possibleMatches,
  };
}

type DataQueryError = {
  code?: string;
  message: string;
};

async function fetchRows<T>(query: PromiseLike<{ data: T[] | null; error: DataQueryError | null }>): Promise<T[]> {
  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function fetchRowsOrEmptyWhenMissing<T>(
  query: PromiseLike<{ data: T[] | null; error: DataQueryError | null }>
): Promise<T[]> {
  const { data, error } = await query;

  if (error) {
    if (isMissingRelationError(error)) {
      return [];
    }

    throw new Error(error.message);
  }

  return data ?? [];
}

async function fetchMaybeRow<T>(
  query: PromiseLike<{ data: T | null; error: DataQueryError | null }>
): Promise<T | null> {
  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

async function isLegObservationSchemaReady(supabase: DataClient): Promise<boolean> {
  try {
    await fetchRows(
      supabase
        .from("leg_result_observations")
        .select("id")
        .limit(1)
    );
    return true;
  } catch (error) {
    if (isMissingRelationError(error)) {
      return false;
    }

    throw error;
  }
}

function isMissingRelationError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }

  const code = stringValue(error.code);
  const message = stringValue(error.message);

  return (
    code === "PGRST205" ||
    code === "42P01" ||
    message.includes("Could not find the table") ||
    message.includes("does not exist")
  );
}

function normalizeInteger(value: number): number | null {
  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }

  return value;
}

const legObservationSourceTypes = new Set<LegObservationSourceType>([
  "apple_watch",
  "garmin",
  "phone",
  "strava",
  "manual_runner",
  "manual_admin",
  "other",
]);

function normalizeObservationSourceType(
  value: LegObservationSourceType | undefined
): LegObservationSourceType {
  return value && legObservationSourceTypes.has(value) ? value : "manual_runner";
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

function normalizeOptionalLapTime(value: string | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!value.trim()) {
    return null;
  }

  return normalizeLapTime(value);
}

function normalizeOptionalPositiveNumber(value: number | null | undefined): number | null | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

function normalizeOptionalElevationGain(value: number | null | undefined): number | null | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.round(value);
}

function normalizeNotes(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeSourceTags(values: string[]): string[] {
  return uniqueStrings(
    values
      .map((value) => value.trim().replace(/\s+/g, " "))
      .filter(Boolean)
  );
}

function normalizeObservationMetadata(
  metadata: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (metadata === undefined) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, normalizeJsonValue(value)])
  );
}

function normalizeJsonValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeJsonValue);
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, nestedValue]) => nestedValue !== undefined)
        .map(([key, nestedValue]) => [key, normalizeJsonValue(nestedValue)])
    );
  }

  return String(value);
}

function buildLegObservationPayload({
  year,
  legNumber,
  legVersion,
  runnerId,
  sourceType,
  sourceLabel,
  sourceTags,
  lapTime,
  movingTime,
  elapsedTime,
  distance,
  elevationGain,
  metadata,
  input,
}: {
  year: number;
  legNumber: number;
  legVersion: number;
  runnerId: string;
  sourceType: LegObservationSourceType;
  sourceLabel: string | null | undefined;
  sourceTags: string[] | undefined;
  lapTime: string | null | undefined;
  movingTime: string | null | undefined;
  elapsedTime: string | null | undefined;
  distance: number | null | undefined;
  elevationGain: number | null | undefined;
  metadata: Record<string, unknown> | undefined;
  input: SaveLegObservationInput;
}): LegObservationUpdate {
  const payload: LegObservationUpdate = {
    year,
    leg_number: legNumber,
    leg_version: legVersion,
    runner_id: runnerId,
    source_type: sourceType,
  };

  if (input.sourceLabel !== undefined) {
    payload.source_label = sourceLabel ?? null;
  }
  if (input.sourceTags !== undefined) {
    payload.source_tags = sourceTags ?? [];
  }
  if (input.lapTime !== undefined) {
    payload.lap_time = lapTime;
  }
  if (input.movingTime !== undefined) {
    payload.moving_time = movingTime;
  }
  if (input.elapsedTime !== undefined) {
    payload.elapsed_time = elapsedTime;
  }
  if (input.distance !== undefined) {
    payload.distance = distance;
  }
  if (input.elevationGain !== undefined) {
    payload.elevation_gain = elevationGain;
  }
  if (metadata !== undefined) {
    payload.raw_metadata = metadata as LegObservationUpdate["raw_metadata"];
  }

  return payload;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
