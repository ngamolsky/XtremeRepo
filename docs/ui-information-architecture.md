# UI information architecture and source rules

## Primary navigation

Primary menu items, in order:

1. Races
2. Legs
3. Runners
4. Photos
5. Search
6. Me

Dashboard, Team, History, and Upload are not primary information-architecture concepts. Keep their old routes working while the app migrates, but do not put them in the primary menu.

## Canonical entity hierarchy

Primary hierarchy:

- Races
  - Race Detail
    - Leg Performance
      - Leg Performance Entry

Cross-indexes:

- Legs index course definitions and link into race-scoped Leg Performances.
- Runners index people and link into race-scoped Leg Performances.
- Photos can attach to Race, Leg, Runner, Leg Performance, or Leg Performance Entry.
- Search groups results by entity category and always shows category/source labels.

A Leg Performance is canonically race-scoped because it only exists when a runner runs a leg in a specific race year. Legs and Runners are alternate indexes into those performances, not the owner of those pages.

## Canonical link categories

All internal entity links should be visibly link-like and should use category-colored pills where practical:

- Race: blue
- Leg: green
- Leg Performance: amber
- Leg Performance Entry: purple
- Runner: rose
- Photo/Search/Me: neutral

A page row that mentions multiple entities should link the visible entity labels directly instead of relying only on a vague trailing Open/Details action.

## Leg version display policy

Leg versioning matters for apples-to-apples comparisons and must remain in URLs, data keys, queries, and comparison logic.

Display policy:

- Hide the version label when the leg uses the current/default course version and there is no ambiguity on the page.
- Show the version label when comparing across versions, linking to a non-current version, rendering breadcrumbs for versioned leg detail pages, or displaying mixed-version data.
- Current/default version is currently v2.
- User-facing labels should prefer `Leg 3` for current/default v2 and `Leg 3 v1` or `Leg 3 v3` for non-current versions.
- Tooltips/aria-labels may include the version even when the visible pill hides it.

## Data precedence and correction rules

Default display precedence:

1. Official
2. Explicit accepted correction
3. Self-reported observation/provisional value
4. Historical spreadsheet/PDF fallback
5. Computed or inferred fallback
6. Missing/unknown

Official data should not be silently edited or overwritten. Correcting official data must be an explicit action that creates a proposed correction or accepted correction record. Until a correction is explicitly accepted, official remains the primary displayed value and the correction is shown as available/proposed context.

## Agent write boundary

The agent may read all app data.

The agent may only write self-reported/provisional data or proposed corrections. It must not mutate official result rows, comments, source imports, or canonical historical records. If a user asks to change official data, the agent should add a self-reported/proposed correction record with source/evidence metadata instead.

## Source badges

Any displayed value that is not pure official should show a source badge. Source kinds should include:

- Official
- Accepted correction
- Proposed correction
- Self-reported
- Historical spreadsheet
- Historical PDF
- Computed
- Inferred
- Missing

Graphs should encode sources consistently: official as solid blue, accepted corrections as solid green, self-reported/provisional as amber dashed, historical source fallbacks as purple dotted, and computed/inferred values as muted gray/dotted.
