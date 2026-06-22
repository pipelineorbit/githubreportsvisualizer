"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { ServiceData } from "@/types/billing";

interface ActionsDetailedBreakdownProps {
  data: ServiceData[];
  breakdown?: "cost" | "quantity";
  /**
   * `"full"` shows daily stacked charts, pie shares, and detailed tables (use
   * for a single-repo view). `"compact"` shows only summary cards and top-N
   * shares — useful when broader per-repo charts are already on the page.
   */
  mode?: "full" | "compact";
}

const COLORS = [
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#d946ef",
  "#64748b",
];

const TOP_N = 10;

function spansMultipleYears(dates: string[]): boolean {
  if (dates.length === 0) return false;
  const years = new Set(dates.map((d) => new Date(d).getFullYear()));
  return years.size > 1;
}

function formatDateForChart(isoDate: string, includeYear: boolean): string {
  const d = new Date(isoDate);
  const options: Intl.DateTimeFormatOptions = includeYear
    ? { month: "short", day: "numeric", year: "2-digit" }
    : { month: "short", day: "numeric" };
  return d.toLocaleDateString("en-US", options);
}

/**
 * Shorten a workflow file path for chart labels.
 * `.github/workflows/foo-bar.yml` → `foo-bar.yml`
 */
function shortWorkflow(path: string): string {
  if (!path) return "Unknown";
  const segments = path.split("/");
  return segments[segments.length - 1] || path;
}

type Totals = { cost: number; quantity: number };

function aggregate<T extends string>(
  data: ServiceData[],
  keyFn: (item: ServiceData) => T | undefined,
): Record<string, Totals> {
  const acc: Record<string, Totals> = {};
  for (const item of data) {
    const key = keyFn(item);
    if (!key) continue;
    if (!acc[key]) acc[key] = { cost: 0, quantity: 0 };
    acc[key].cost += item.cost;
    acc[key].quantity += item.quantity;
  }
  return acc;
}

function topEntries(
  totals: Record<string, Totals>,
  metric: "cost" | "quantity",
  n: number,
): string[] {
  return Object.entries(totals)
    .sort(([, a], [, b]) =>
      metric === "cost" ? b.cost - a.cost : b.quantity - a.quantity,
    )
    .slice(0, n)
    .map(([k]) => k);
}

export function ActionsDetailedBreakdown({
  data,
  breakdown = "quantity",
  mode = "full",
}: ActionsDetailedBreakdownProps) {
  const compact = mode === "compact";
  const hasWorkflows = useMemo(() => data.some((d) => d.workflowPath), [data]);
  const hasUsers = useMemo(() => data.some((d) => d.username), [data]);

  const repository = useMemo(() => {
    const repos = Array.from(
      new Set(data.map((d) => d.repository).filter(Boolean)),
    );
    return repos.length === 1 ? (repos[0] as string) : null;
  }, [data]);

  const workflowTotals = useMemo(
    () => aggregate(data, (i) => i.workflowPath || undefined),
    [data],
  );
  const userTotals = useMemo(
    () => aggregate(data, (i) => i.username || undefined),
    [data],
  );

  const topWorkflows = useMemo(
    () => topEntries(workflowTotals, breakdown, TOP_N),
    [workflowTotals, breakdown],
  );
  const topUsers = useMemo(
    () => topEntries(userTotals, breakdown, TOP_N),
    [userTotals, breakdown],
  );

  const totalCost = useMemo(() => data.reduce((s, i) => s + i.cost, 0), [data]);
  const totalQuantity = useMemo(
    () => data.reduce((s, i) => s + i.quantity, 0),
    [data],
  );

  const uniqueWorkflows = useMemo(
    () => Object.keys(workflowTotals).length,
    [workflowTotals],
  );
  const uniqueUsers = useMemo(
    () => Object.keys(userTotals).length,
    [userTotals],
  );

  const isCost = breakdown === "cost";
  const valueFormatter = (v: number) =>
    isCost ? `$${v.toFixed(2)}` : `${v.toLocaleString()} min`;
  const breakdownLabel = isCost ? "Cost" : "Minutes";
  const metricKey: keyof Totals = isCost ? "cost" : "quantity";

  // Daily series stacked by top workflows / users (others bucketed)
  const dailyWorkflowSeries = useMemo(
    () =>
      buildDailySeries(
        data,
        (i) => i.workflowPath || "Unknown",
        topWorkflows,
        metricKey,
      ),
    [data, topWorkflows, metricKey],
  );
  const dailyUserSeries = useMemo(
    () =>
      buildDailySeries(
        data,
        (i) => i.username || "Unknown",
        topUsers,
        metricKey,
      ),
    [data, topUsers, metricKey],
  );

  // Pie data: top N + Others
  const workflowPieData = useMemo(
    () => buildPieData(workflowTotals, topWorkflows, metricKey),
    [workflowTotals, topWorkflows, metricKey],
  );
  const userPieData = useMemo(
    () => buildPieData(userTotals, topUsers, metricKey),
    [userTotals, topUsers, metricKey],
  );

  if (!hasWorkflows && !hasUsers) return null;

  const heading = compact
    ? "Contributor & Workflow Insights"
    : repository
      ? `Detailed Actions Breakdown — ${repository}`
      : "Detailed Actions Breakdown";

  const subheading = compact
    ? "Aggregate per-user and per-workflow shares across all repositories. Filter to a specific repository to see daily trends and full breakdowns."
    : repository
      ? `Per-workflow and per-user analysis for ${repository}.`
      : "Per-workflow and per-user analysis derived from the detailed usage report.";

  return (
    <div className="space-y-6 mt-8">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-bold">{heading}</h2>
        <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
          Detailed report detected
        </span>
      </div>
      <p className="text-sm text-gray-400 -mt-4">{subheading}</p>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Cost"
          value={`$${totalCost.toFixed(2)}`}
          color="text-green-400"
        />
        <SummaryCard
          label="Total Minutes"
          value={`${totalQuantity.toLocaleString()} min`}
          color="text-blue-400"
        />
        {hasWorkflows && (
          <SummaryCard
            label="Workflows"
            value={uniqueWorkflows.toLocaleString()}
            color="text-purple-400"
          />
        )}
        {hasUsers && (
          <SummaryCard
            label="Contributors"
            value={uniqueUsers.toLocaleString()}
            color="text-orange-400"
          />
        )}
      </div>

      {compact ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {hasWorkflows && (
            <CompactRankSection
              title="Top Workflows"
              subtitle="Workflow files with the highest Actions usage"
              breakdownLabel={breakdownLabel}
              valueFormatter={valueFormatter}
              metricKey={metricKey}
              topKeys={topWorkflows}
              totals={workflowTotals}
              labelFor={shortWorkflow}
              total={isCost ? totalCost : totalQuantity}
              formatCost={(v) => `$${v.toFixed(2)}`}
              formatQuantity={(v) => `${v.toLocaleString()} min`}
            />
          )}
          {hasUsers && (
            <CompactRankSection
              title="Top Contributors"
              subtitle="Users triggering the most Actions usage"
              breakdownLabel={breakdownLabel}
              valueFormatter={valueFormatter}
              metricKey={metricKey}
              topKeys={topUsers}
              totals={userTotals}
              labelFor={(u) => u || "Unknown"}
              total={isCost ? totalCost : totalQuantity}
              formatCost={(v) => `$${v.toFixed(2)}`}
              formatQuantity={(v) => `${v.toLocaleString()} min`}
            />
          )}
        </div>
      ) : (
        <>
          {hasWorkflows && (
            <BreakdownSection
              title="Workflows"
              subtitle="GitHub Actions usage grouped by workflow file"
              breakdownLabel={breakdownLabel}
              valueFormatter={valueFormatter}
              metricKey={metricKey}
              topKeys={topWorkflows}
              totals={workflowTotals}
              pieData={workflowPieData}
              dailySeries={dailyWorkflowSeries}
              labelFor={shortWorkflow}
              total={isCost ? totalCost : totalQuantity}
              formatCost={(v) => `$${v.toFixed(2)}`}
              formatQuantity={(v) => `${v.toLocaleString()} min`}
            />
          )}

          {hasUsers && (
            <BreakdownSection
              title="Contributors"
              subtitle="GitHub Actions usage grouped by triggering user"
              breakdownLabel={breakdownLabel}
              valueFormatter={valueFormatter}
              metricKey={metricKey}
              topKeys={topUsers}
              totals={userTotals}
              pieData={userPieData}
              dailySeries={dailyUserSeries}
              labelFor={(u) => u || "Unknown"}
              total={isCost ? totalCost : totalQuantity}
              formatCost={(v) => `$${v.toFixed(2)}`}
              formatQuantity={(v) => `${v.toLocaleString()} min`}
            />
          )}
        </>
      )}
    </div>
  );
}

interface CompactRankSectionProps {
  title: string;
  subtitle: string;
  breakdownLabel: string;
  valueFormatter: (v: number) => string;
  metricKey: keyof Totals;
  topKeys: string[];
  totals: Record<string, Totals>;
  labelFor: (raw: string) => string;
  total: number;
  formatCost: (v: number) => string;
  formatQuantity: (v: number) => string;
}

function CompactRankSection({
  title,
  subtitle,
  breakdownLabel,
  valueFormatter,
  metricKey,
  topKeys,
  totals,
  labelFor,
  total,
  formatCost,
  formatQuantity,
}: CompactRankSectionProps) {
  const rows = topKeys.map((k) => ({
    key: k,
    label: labelFor(k),
    cost: totals[k]?.cost ?? 0,
    quantity: totals[k]?.quantity ?? 0,
    pct: total > 0 ? ((totals[k]?.[metricKey] ?? 0) / total) * 100 : 0,
  }));

  if (rows.length === 0) return null;

  return (
    <div className="bg-gray-800/30 rounded-lg p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-gray-400">{subtitle}</p>
      </div>
      <ResponsiveContainer
        width="100%"
        height={Math.max(220, rows.length * 30)}
      >
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 5, right: 16, left: 8, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            type="number"
            stroke="#9ca3af"
            fontSize={11}
            tickFormatter={valueFormatter}
          />
          <YAxis
            type="category"
            dataKey="label"
            stroke="#9ca3af"
            fontSize={11}
            width={160}
            interval={0}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "8px",
            }}
            formatter={(value: number) => [
              valueFormatter(value),
              breakdownLabel,
            ]}
            labelFormatter={(_, payload) =>
              (payload?.[0]?.payload as { key?: string })?.key ?? ""
            }
          />
          <Bar dataKey={metricKey} fill={COLORS[1]} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 space-y-1.5 max-h-48 overflow-y-auto">
        {rows.map((r, i) => (
          <div
            key={r.key}
            className="flex items-center text-sm gap-3"
            title={r.key}
          >
            <span className="text-gray-500 w-5 text-right">{i + 1}.</span>
            <span className="text-gray-200 flex-1 truncate">{r.label}</span>
            <span className="text-gray-400 text-xs w-14 text-right">
              {r.pct.toFixed(1)}%
            </span>
            <span className="text-white font-medium w-28 text-right">
              {valueFormatter(metricKey === "cost" ? r.cost : r.quantity)}
            </span>
            <span className="text-gray-500 text-xs w-24 text-right">
              {metricKey === "cost"
                ? formatQuantity(r.quantity)
                : formatCost(r.cost)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface BreakdownSectionProps {
  title: string;
  subtitle: string;
  breakdownLabel: string;
  valueFormatter: (v: number) => string;
  metricKey: keyof Totals;
  topKeys: string[];
  totals: Record<string, Totals>;
  pieData: { name: string; cost: number; quantity: number }[];
  dailySeries: { rows: Record<string, any>[]; keys: string[] };
  labelFor: (raw: string) => string;
  total: number;
  formatCost: (v: number) => string;
  formatQuantity: (v: number) => string;
}

function BreakdownSection({
  title,
  subtitle,
  breakdownLabel,
  valueFormatter,
  metricKey,
  topKeys,
  totals,
  pieData,
  dailySeries,
  labelFor,
  total,
  formatCost,
  formatQuantity,
}: BreakdownSectionProps) {
  const keys = dailySeries.keys;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Top {title}</h3>
        <p className="text-sm text-gray-400">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stacked daily area */}
        <div className="lg:col-span-2 bg-gray-800/30 rounded-lg p-6">
          <h4 className="text-md font-semibold mb-4">
            Daily {breakdownLabel} by {title}
          </h4>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={dailySeries.rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
              <YAxis
                stroke="#9ca3af"
                fontSize={12}
                tickFormatter={valueFormatter}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                }}
                formatter={(value: number, name: string) => [
                  valueFormatter(value),
                  labelFor(name),
                ]}
                labelStyle={{ color: "#d1d5db" }}
              />
              {keys.map((k, i) => (
                <Area
                  key={k}
                  type="monotone"
                  dataKey={k}
                  name={k}
                  stackId="1"
                  stroke={COLORS[i % COLORS.length]}
                  fill={COLORS[i % COLORS.length]}
                  fillOpacity={0.75}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie breakdown */}
        <div className="bg-gray-800/30 rounded-lg p-6">
          <h4 className="text-md font-semibold mb-4">{breakdownLabel} Share</h4>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={2}
                dataKey={metricKey}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                }}
                formatter={(value: number, name: string) => [
                  valueFormatter(value),
                  labelFor(name as string),
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
            {pieData.map((entry, i) => (
              <div key={entry.name} className="flex items-center text-sm">
                <div
                  className="w-3 h-3 rounded mr-2 shrink-0"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span
                  className="text-gray-300 flex-1 truncate"
                  title={entry.name}
                >
                  {labelFor(entry.name)}
                </span>
                <span className="text-white font-medium">
                  {valueFormatter(entry[metricKey])}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top N bar chart */}
      <div className="bg-gray-800/30 rounded-lg p-6">
        <h4 className="text-md font-semibold mb-4">
          Top {Math.min(TOP_N, topKeys.length)} {title} by {breakdownLabel}
        </h4>
        <ResponsiveContainer
          width="100%"
          height={Math.max(220, topKeys.length * 32)}
        >
          <BarChart
            data={topKeys.map((k) => ({
              name: labelFor(k),
              fullName: k,
              cost: totals[k]?.cost ?? 0,
              quantity: totals[k]?.quantity ?? 0,
            }))}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              type="number"
              stroke="#9ca3af"
              fontSize={12}
              tickFormatter={valueFormatter}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="#9ca3af"
              fontSize={12}
              width={180}
              interval={0}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
              }}
              formatter={(value: number) => [
                valueFormatter(value),
                breakdownLabel,
              ]}
              labelFormatter={(_, payload) =>
                (payload?.[0]?.payload as any)?.fullName ?? ""
              }
            />
            <Legend wrapperStyle={{ color: "#d1d5db" }} />
            <Bar
              dataKey={metricKey}
              name={breakdownLabel}
              fill={COLORS[1]}
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed table */}
      <div className="bg-gray-800/30 rounded-lg p-6">
        <h4 className="text-md font-semibold mb-4">{title} Usage Summary</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-gray-300">{title}</th>
                <th className="text-right py-3 px-4 text-gray-300">Cost</th>
                <th className="text-right py-3 px-4 text-gray-300">Minutes</th>
                <th className="text-right py-3 px-4 text-gray-300">
                  % of Total
                </th>
              </tr>
            </thead>
            <tbody>
              {pieData.map((entry, i) => {
                const pct = total > 0 ? (entry[metricKey] / total) * 100 : 0;
                return (
                  <tr
                    key={entry.name}
                    className="border-b border-gray-800 hover:bg-gray-800/50"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center min-w-0">
                        <div
                          className="w-3 h-3 rounded mr-3 shrink-0"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                        <span
                          className="text-white truncate"
                          title={entry.name}
                        >
                          {labelFor(entry.name)}
                        </span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 text-white font-medium">
                      {formatCost(entry.cost)}
                    </td>
                    <td className="text-right py-3 px-4 text-gray-300">
                      {formatQuantity(entry.quantity)}
                    </td>
                    <td className="text-right py-3 px-4 text-gray-300">
                      {pct.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-4">
      <h3 className="text-sm text-gray-400 mb-1">{label}</h3>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function buildDailySeries(
  data: ServiceData[],
  keyFn: (item: ServiceData) => string,
  topKeys: string[],
  metricKey: keyof Totals,
): { rows: Record<string, any>[]; keys: string[] } {
  const topSet = new Set(topKeys);
  const daily: Record<string, Record<string, number | string>> = {};
  let hasOthers = false;

  for (const item of data) {
    const rawKey = keyFn(item);
    const bucket = topSet.has(rawKey) ? rawKey : "Others";
    if (bucket === "Others") hasOthers = true;
    const date = item.date;
    if (!daily[date]) {
      daily[date] = { date };
      for (const k of topKeys) daily[date][k] = 0;
      daily[date]["Others"] = 0;
    }
    const cur = (daily[date][bucket] as number) || 0;
    daily[date][bucket] =
      cur + (metricKey === "cost" ? item.cost : item.quantity);
  }

  const rawDates = Object.keys(daily);
  const multiYear = spansMultipleYears(rawDates);

  const rows = Object.values(daily)
    .sort((a, b) => (a.date as string).localeCompare(b.date as string))
    .map((row) => ({
      ...row,
      date: formatDateForChart(row.date as string, multiYear),
    }));

  const keys = hasOthers ? [...topKeys, "Others"] : [...topKeys];
  return { rows, keys };
}

function buildPieData(
  totals: Record<string, Totals>,
  topKeys: string[],
  metricKey: keyof Totals,
): { name: string; cost: number; quantity: number }[] {
  const top = topKeys.map((k) => ({
    name: k,
    cost: totals[k]?.cost ?? 0,
    quantity: totals[k]?.quantity ?? 0,
  }));
  const topSet = new Set(topKeys);
  const others = Object.entries(totals).filter(([k]) => !topSet.has(k));
  if (others.length === 0) return top;
  const othersAgg = others.reduce(
    (acc, [, v]) => ({
      cost: acc.cost + v.cost,
      quantity: acc.quantity + v.quantity,
    }),
    { cost: 0, quantity: 0 },
  );
  // Only include "Others" if it has a meaningful value for the metric
  if (othersAgg[metricKey] <= 0) return top;
  return [...top, { name: "Others", ...othersAgg }];
}
