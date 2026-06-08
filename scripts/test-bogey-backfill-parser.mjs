import assert from "node:assert/strict";
import {
  extractSplitTimes,
  selectOurTeamLinks,
} from "./supabase/backfill-bogey-events.mjs";

const totalFirst = extractSplitTimes(
  "20 37 The Xtreme Falcons Mixed Open 11:53:41.0 1:26:38.3 2:17:15.4 1:38:37.7 1:38:36.8 1:57:20.8 1:25:24.1 1:29:47.9"
);
assert.equal(totalFirst.totalTimeText, "11:53:41.0");
assert.equal(totalFirst.splits.length, 7);
assert.equal(totalFirst.splits[0].splitTimeText, "1:26:38.3");
assert.equal(totalFirst.splits[6].splitTimeText, "1:29:47.9");

const totalLast = extractSplitTimes(
  "57 | 2 | The Extreme Falcons | Men's Open | 1:22:58 | 2:26:39 | 1:35:03 | 1:40:13 | 1:26:44 | 1:26:45 | 2:04:04 | 12:02:26 | 10"
);
assert.equal(totalLast.totalTimeText, "12:02:26");
assert.deepEqual(
  totalLast.splits.map((split) => split.splitTimeText),
  ["1:22:58", "2:26:39", "1:35:03", "1:40:13", "1:26:44", "1:26:45", "2:04:04"]
);

const links = selectOurTeamLinks([
  { id: "division", year: 2025, is_our_team: true, overall_place: 37, splitCount: 7 },
  { id: "overall", year: 2025, is_our_team: true, overall_place: 20, splitCount: 7 },
  { id: "incomplete", year: 2024, is_our_team: true, overall_place: 16, splitCount: 5 },
  { id: "complete", year: 2024, is_our_team: true, overall_place: 99, splitCount: 7 },
]);
assert.equal(links.length, 2);
assert.equal(links.find((link) => link.year === 2025).historical_team_result_id, "overall");
assert.equal(links.find((link) => link.year === 2024).historical_team_result_id, "complete");

console.log("bogey backfill parser tests passed");
