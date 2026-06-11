import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const raceDetail = read("src/components/RaceDetailView.tsx");
const runInstanceDetail = read("src/components/RunInstanceDetail.tsx");
const legResultDetail = read("src/components/LegResultDetail.tsx");
const worker = read("src/worker/index.ts");
const schema = read("supabase/schemas/05_results.sql");

const allowedSelfReportedSourceOptions = /const sourceTypeOptions = \[\s*"apple_watch",\s*"garmin",\s*"other",?\s*\]/;
const allowedToolEnum = /enum: \["apple_watch", "garmin", "other"\]/;

assert.match(
  raceDetail,
  /entry\.kind === "official"\s*\? "Official"\s*:\s*"Self Reported"/,
  "race detail self-reported source pill should say only Self Reported"
);
assert.doesNotMatch(
  raceDetail,
  /Self Recorded\$\{[\s\S]*formatSourceType\(entry\.sourceType\)/,
  "race detail should not include source type or source label details in the self-reported pill"
);

assert.match(
  runInstanceDetail,
  allowedSelfReportedSourceOptions,
  "add self-reported data form should restrict recording device to Apple Watch, Garmin, or Other"
);
assert.doesNotMatch(
  runInstanceDetail,
  /"phone"|"strava"|"manual_runner"|"manual_admin"/,
  "add self-reported data form should not treat apps/manual entry as recording-device source types"
);
assert.match(
  runInstanceDetail,
  /Field label="Recording Device"/,
  "add self-reported data form should label source type as Recording Device"
);
assert.match(
  runInstanceDetail,
  /Field label="Other Device"/,
  "add self-reported data form should collect other recording-device text separately"
);

assert.match(
  legResultDetail,
  allowedSelfReportedSourceOptions,
  "edit self-reported result form should restrict recording device to Apple Watch, Garmin, or Other"
);
assert.doesNotMatch(
  legResultDetail,
  /"phone"|"strava"|"manual_runner"|"manual_admin"/,
  "edit self-reported result form should not treat apps/manual entry as recording-device source types"
);
assert.match(
  legResultDetail,
  /Field label="Recording Device"/,
  "edit self-reported result form should label source type as Recording Device"
);
assert.match(
  legResultDetail,
  /Field label="Other Device"/,
  "edit self-reported result form should collect other recording-device text separately"
);

assert.match(
  worker,
  /type LegObservationSourceType =\s*\| "apple_watch"\s*\| "garmin"\s*\| "other";/,
  "agent tool sourceType should model recording device only"
);
assert.match(worker, allowedToolEnum, "saveLegObservation tool enum should expose only normalized recording devices");
assert.doesNotMatch(
  worker,
  /enum: \[[^\]]*("phone"|"strava"|"manual_runner"|"manual_admin")/,
  "agent tool enum should not expose apps/manual values as source types"
);
assert.match(
  worker,
  /suggestedAppName[\s\S]*Strava[\s\S]*Apple Fitness[\s\S]*Garmin App/,
  "agent screenshot guidance should put app guesses in metadata with suggested app names"
);

assert.match(
  schema,
  /leg_result_observations_source_type_check[\s\S]*ARRAY\['apple_watch'::"text", 'garmin'::"text", 'other'::"text"\]/,
  "self-reported observation schema should constrain source_type to normalized recording devices"
);

console.log("self-reported source normalization tests passed");
