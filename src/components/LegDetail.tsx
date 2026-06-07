import { Link, useParams } from "@tanstack/react-router";
import { Award, BarChart, ChevronDown, Clock, ExternalLink, Map, Users } from "lucide-react";
import React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useRelayData } from "../hooks/useRelayData";
import { formatFeet, formatMiles, formatPace } from "../lib/utils";
import Breadcrumbs from "./Breadcrumbs";
import CommentsSection from "./CommentsSection";
import { StatCard } from "./StatCard";

const chartAxisColor = "var(--chart-axis)";
const chartGridColor = "var(--chart-grid)";
const chartTooltipStyle = {
  backgroundColor: "var(--chart-tooltip-bg)",
  border: "1px solid var(--chart-tooltip-border)",
  borderRadius: "8px",
  color: "var(--chart-tooltip-text)",
  boxShadow: "var(--chart-tooltip-shadow)",
};

const fallbackMapEmbedUrls: Record<number, string> = {
  1: "https://snippets.mapmycdn.com/routes/view/embedded/1451785543?width=600&height=600&elevation=true&info=true&line_color=E60f0bdb&rgbhex=DB0B0E&distance_markers=1&unit_type=imperial&map_mode=ROADMAP&last_updated=2017-04-11T20:36:04-07:00",
  2: "https://snippets.mapmycdn.com/routes/view/embedded/1435280143?width=600&height=600&elevation=true&info=true&line_color=E60f0bdb&rgbhex=DB0B0E&distance_markers=0&unit_type=imperial&map_mode=ROADMAP&last_updated=2017-04-11T21:02:08-07:00",
  3: "https://snippets.mapmycdn.com/routes/view/embedded/1435329766?width=600&height=500&elevation=true&info=true&line_color=E60f0bdb&rgbhex=DB0B0E&distance_markers=0&unit_type=imperial&map_mode=ROADMAP&last_updated=2017-04-11T21:07:24-07:00",
  4: "https://snippets.mapmycdn.com/routes/view/embedded/1435378663?width=600&height=400&elevation=true&info=true&line_color=E60f0bdb&rgbhex=DB0B0E&distance_markers=1&unit_type=imperial&map_mode=ROADMAP&last_updated=2017-04-12T18:12:09-07:00",
  5: "https://snippets.mapmycdn.com/routes/view/embedded/1435415431?width=600&height=500&elevation=true&info=true&line_color=E60f0bdb&rgbhex=DB0B0E&distance_markers=1&unit_type=imperial&map_mode=ROADMAP&last_updated=2017-04-12T18:14:57-07:00",
  6: "https://snippets.mapmycdn.com/routes/view/embedded/1435421707?width=600&height=400&elevation=true&info=true&line_color=E60f0bdb&rgbhex=DB0B0E&distance_markers=1&unit_type=imperial&map_mode=ROADMAP&last_updated=2017-04-12T18:17:18-07:00",
  7: "https://snippets.mapmycdn.com/routes/view/embedded/1056520991?width=600&height=400&elevation=true&info=true&line_color=E60f0bdb&rgbhex=DB0B0E&distance_markers=1&unit_type=imperial&map_mode=ROADMAP&last_updated=2017-04-12T18:21:01-07:00",
};

const getFallbackCourseUrl = (legNumber: number, version: number) =>
  version === 2 && legNumber >= 1 && legNumber <= 7
    ? `https://laketahoerelay.com/leg${legNumber}/`
    : undefined;

const getFallbackMapEmbedUrl = (legNumber: number, version: number) =>
  version === 2 ? fallbackMapEmbedUrls[legNumber] : undefined;

function getLegHistoricalAverageMinutes(
  legStat: { runs: number | null; total_time: number | null } | null | undefined
) {
  if (!legStat?.total_time || !legStat.runs) {
    return null;
  }

  const averageMinutes = legStat.total_time / legStat.runs;
  return Number.isFinite(averageMinutes) && averageMinutes > 0 ? averageMinutes : null;
}

function formatDurationFromMinutes(minutes: number | null | undefined) {
  if (!minutes || !Number.isFinite(minutes)) {
    return "N/A";
  }

  const totalSeconds = Math.round(minutes * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const remainingSeconds = totalSeconds % 3600;
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${mins}:${String(secs).padStart(2, "0")}`;
}

const LegDetail: React.FC = () => {
  const { legNumber, version } = useParams({
    from: "/legs/$legNumber/$version",
  });
  const [isLegDataOpen, setIsLegDataOpen] = React.useState(false);
  const {
    data: { legDefinitions, legVersionStats, results },
    loading,
    error,
  } = useRelayData();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-800 mb-2">
          Connection Error
        </h3>
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  const selectedLegNumber = Number(legNumber);
  const selectedVersion = Number(version);

  // Filter results for this specific leg and version
  const legStat = legVersionStats.find(
    (l) =>
      l.leg_number === selectedLegNumber && l.leg_version === selectedVersion
  );

  const legDefinition = legDefinitions.find(
    (leg) =>
      leg.number === selectedLegNumber && leg.version === selectedVersion
  );

  const legData = results.filter(
    (result) =>
      result.leg_number === selectedLegNumber &&
      result.leg_version === selectedVersion
  );

  if (!legStat && !legDefinition) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No data found
        </h3>
        <p className="text-gray-600">
          No results found for Leg {legNumber} Version {version}
        </p>
      </div>
    );
  }

  const displayDistance =
    legStat?.distance ??
    legDefinition?.distance;
  const displayElevation =
    legStat?.elevation_gain ??
    legDefinition?.elevation_gain;
  const formattedElevation = formatFeet(displayElevation);
  const historicalAverageMinutes = getLegHistoricalAverageMinutes(legStat);

  // Prepare data for the performance chart
  const performanceData = legData
    .map((result) => ({
      year: result.year,
      runner: result.runner_name,
      pace: result.pace,
      time: result.time_in_minutes,
    }))
    .sort((a, b) => (a.year || 0) - (b.year || 0));

  const bestPaceRunners =
    (legStat?.best_pace_runner_years as { runner: string; year: number }[]) ||
    [];
  const bestPaceAttribution =
    bestPaceRunners.length > 0
      ? `by ${bestPaceRunners.map((r) => r.runner).join(", ")} in ${bestPaceRunners
          .map((r) => r.year)
          .join(", ")}`
      : undefined;
  const officialCourseUrl =
    legDefinition?.official_course_url ||
    getFallbackCourseUrl(selectedLegNumber, selectedVersion);
  const mapEmbedUrl =
    legDefinition?.map_embed_url ||
    getFallbackMapEmbedUrl(selectedLegNumber, selectedVersion);

  return (
    <div className="space-y-8 animate-fade-in">
      <Breadcrumbs
        current={`Leg ${selectedLegNumber} v${selectedVersion}`}
        items={[{ label: "Legs", to: "/legs" }]}
      />
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Leg {legNumber} Details
        </h1>
        <p className="text-lg text-gray-600">
          Version {version} • {formatMiles(displayDistance)} •{" "}
          {formattedElevation === "N/A" ? formattedElevation : `+${formattedElevation} elevation`}
        </p>
      </div>

      {(officialCourseUrl || mapEmbedUrl) && (
        <section className="card overflow-hidden">
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setIsLegDataOpen((current) => !current)}
              className="inline-flex items-center gap-2 text-left text-lg font-semibold text-gray-900 hover:text-primary-700"
              aria-expanded={isLegDataOpen}
            >
              <ChevronDown
                className={`h-5 w-5 transition-transform ${isLegDataOpen ? "" : "-rotate-90"}`}
                aria-hidden="true"
              />
              <span>Leg Data</span>
            </button>
            <div className="flex flex-wrap items-center gap-3">
              {officialCourseUrl && (
                <a
                  href={officialCourseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary-700 hover:text-primary-800"
                >
                  Official course page
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              )}
              {mapEmbedUrl && (
                <a
                  href={mapEmbedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary-700 hover:text-primary-800"
                >
                  Open map
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>

          {isLegDataOpen && mapEmbedUrl && (
            <div className="mx-5 mb-5 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-slate-800 dark:bg-slate-950">
              <iframe
                title={`Leg ${selectedLegNumber} official route map`}
                src={mapEmbedUrl}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="fullscreen"
                allowFullScreen
                className="h-[600px] w-full border-0 sm:h-[700px] lg:h-[800px]"
              />
            </div>
          )}
        </section>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard
          detail={bestPaceAttribution}
          icon={<Award className="w-6 h-6 text-yellow-600" />}
          label="Best Pace"
          value={legStat?.best_pace ? formatPace(legStat.best_pace) : "N/A"}
        />
        <StatCard
          icon={<BarChart className="w-6 h-6 text-blue-600" />}
          label="Average Pace"
          value={legStat?.average_pace ? formatPace(legStat.average_pace) : "N/A"}
        />
        <StatCard
          icon={<Clock className="w-6 h-6 text-purple-600" />}
          label="Historical Average"
          value={formatDurationFromMinutes(historicalAverageMinutes)}
        />
        <StatCard
          icon={<Map className="w-6 h-6 text-green-600" />}
          label="Total Runs"
          value={legStat?.runs?.toString() || "0"}
        />
        <StatCard
          icon={<Users className="w-6 h-6 text-indigo-600" />}
          label="Unique Runners"
          value={legStat?.unique_runners?.toString() || "0"}
        />
      </div>

      {/* Performance Chart */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Official Performance
        </h3>
        {performanceData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart
              data={performanceData}
              margin={{ top: 12, right: 24, left: 30, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
              <XAxis
                dataKey="year"
                stroke={chartAxisColor}
                tick={{ fill: chartAxisColor }}
                tickLine={{ stroke: chartAxisColor }}
              />
              <YAxis
                width={76}
                tickMargin={8}
                stroke={chartAxisColor}
                tick={{ fill: chartAxisColor }}
                tickLine={{ stroke: chartAxisColor }}
                reversed
                tickFormatter={(tick) => formatPace(tick)}
              />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(value, name, props) => {
                  const numericValue = typeof value === "number" ? value : Number(value);

                  if (name === "pace") {
                    return [
                      formatPace(Number.isFinite(numericValue) ? numericValue : 0),
                      `Pace (${props.payload.runner})`,
                    ];
                  }

                  return [value, name];
                }}
              />
              <Line
                type="monotone"
                dataKey="pace"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{
                  stroke: "#3b82f6",
                  strokeWidth: 2,
                  r: 4,
                  fill: "var(--chart-dot-fill)",
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-gray-600">No official results yet.</p>
        )}
      </div>

      {/* Results Table */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Official Results
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Year
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Runner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pace
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {legData.length > 0 ? (
                legData
                .sort((a, b) => (b.year || 0) - (a.year || 0))
                .map((result, idx) => (
                  <tr
                    key={`${result.year}-${result.runner_name}`}
                    className={
                      idx % 2 === 0
                        ? "bg-white"
                        : "bg-gray-50 hover:bg-gray-100"
                    }
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {result.year ? (
                        <Link
                          to="/races/$year"
                          params={{ year: String(result.year) }}
                          className="text-primary-700 hover:text-primary-800"
                        >
                          {result.year}
                        </Link>
                      ) : (
                        "N/A"
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 hover:text-primary-600">
                      <Link
                        to="/runners/$runnerName"
                        params={{ runnerName: result.runner_name || "" }}
                      >
                        {result.runner_name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {result.lap_time || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatPace(result.pace || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {result.runner_name ? (
                        <Link
                          to="/runs/$runnerName/$year/$legNumber/$version"
                          params={{
                            runnerName: result.runner_name,
                            year: String(result.year),
                            legNumber: String(result.leg_number),
                            version: String(result.leg_version),
                          }}
                          className="text-primary-700 hover:text-primary-800"
                        >
                          Open
                        </Link>
                      ) : (
                        "N/A"
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-sm text-gray-600">
                    No official results yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CommentsSection
        targetType="leg"
        legNumber={selectedLegNumber}
        legVersion={selectedVersion}
        title="Leg Comments"
      />
    </div>
  );
};

export default LegDetail;
