"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BillingTable, ExportButtons } from "@/components/ui/BillingTable";
import {
  groupBilling,
  rankedDailyData,
  rankWithOther,
  summarizeBilling,
} from "@/lib/billingAnalytics";
import type { BillingDimension, BillingMetric } from "@/lib/billingAnalytics";
import {
  displayQuantity,
  formatChartDate,
  formatCompactNumber,
  formatCurrency,
  formatNumber,
  spansMultipleYears,
  usageUnitLabel,
} from "@/lib/utils";
import type { ServiceData } from "@/types/billing";

export const CHART_COLORS = [
  "#38bdf8",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#a3e635",
  "#c4b5fd",
  "#94a3b8",
];
export const CHART_TOOLTIP = {
  backgroundColor: "#111827",
  border: "1px solid #374151",
  borderRadius: "8px",
  color: "#f3f4f6",
};

export function UnitServiceChart({
  data,
  title,
  breakdown = "cost",
  storageUnit = "gb-hours",
  initialDimension = "sku",
}: {
  data: ServiceData[];
  title: string;
  breakdown?: BillingMetric;
  storageUnit?: "gb-hours" | "gb-months";
  initialDimension?: BillingDimension;
}) {
  const [dimension, setDimension] =
    useState<BillingDimension>(initialDimension);
  const summary = summarizeBilling(data);
  const dimensions: { value: BillingDimension; label: string }[] = [
    { value: "sku", label: "SKU" },
    { value: "repository", label: "Repository" },
    { value: "organization", label: "Organization" },
    { value: "costCenter", label: "Cost Center" },
  ];
  const name =
    dimensions.find((entry) => entry.value === dimension)?.label ?? "SKU";
  const grouped = groupBilling(data, dimension, dimension === "sku");
  const sections =
    breakdown === "cost"
      ? [{ key: "cost", data, unitType: undefined, label: "Net Cost" }]
      : summary.usageGroups.map((group) => ({
          ...group,
          label: group.unitType
            ? usageUnitLabel(group.unitType, storageUnit)
            : `${group.data[0].sku} (unit not reported)`,
        }));
  const multiYear = spansMultipleYears(data.map((item) => item.date));

  if (!data.length)
    return (
      <p role="status" className="py-12 text-center text-gray-400">
        No data matches the selected filters.
      </p>
    );

  return (
    <div className="min-w-0 space-y-8">
      <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {[
          ["Net Cost (USD)", summary.cost],
          ["Gross Amount (USD)", summary.grossAmount],
          ["Report Discounts (USD)", summary.discountAmount],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 border-b border-gray-700 pb-4">
            <dt className="mb-2 text-sm text-gray-400">{label}</dt>
            <dd className="break-words text-2xl font-semibold tabular-nums text-green-400">
              {formatCurrency(value as number | undefined)}
            </dd>
          </div>
        ))}
      </dl>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {summary.usageGroups.map((group, index) => (
          <div
            key={group.key}
            className="min-w-0 border-l-2 pl-4"
            style={{ borderColor: CHART_COLORS[index % CHART_COLORS.length] }}
          >
            <dt className="break-words text-sm text-gray-400">
              {group.unitType
                ? usageUnitLabel(group.unitType, storageUnit)
                : `${group.data[0].sku} (unit not reported)`}
            </dt>
            <dd className="break-words text-xl font-semibold tabular-nums">
              {formatNumber(
                displayQuantity(group.quantity, group.unitType, storageUnit),
              )}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <fieldset className="min-w-0">
          <legend className="mb-2 text-sm text-gray-400">Group By</legend>
          <div
            className="flex flex-wrap gap-1"
            role="group"
            aria-label={`${title} grouping`}
          >
            {dimensions.map((option) => (
              <button
                type="button"
                key={option.value}
                aria-pressed={dimension === option.value}
                onClick={() => setDimension(option.value)}
                className={`min-h-9 rounded px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-sky-400 ${dimension === option.value ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
        <ExportButtons
          data={data}
          groups={grouped}
          dimension={dimension}
          prefix={title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
        />
      </div>
      {sections.map((section) => {
        const groups = groupBilling(
          section.data,
          dimension,
          dimension === "sku",
        );
        const ranked = rankWithOther(groups, breakdown);
        const timeline = rankedDailyData(ranked, breakdown);
        const display = (value: number) =>
          breakdown === "cost"
            ? value
            : displayQuantity(value, section.unitType, storageUnit);
        const format = (value: number) =>
          breakdown === "cost"
            ? formatCurrency(value)
            : formatNumber(display(value));
        const points = timeline.points.map((point) => ({
          ...point,
          ...Object.fromEntries(
            timeline.series.map((series) => [
              series.key,
              display(Number(point[series.key])),
            ]),
          ),
        }));
        const bars = ranked.map((group, index) => ({
          name: group.label,
          index: index + 1,
          value: display(group[breakdown] ?? 0),
        }));
        return (
          <section
            key={section.key}
            aria-label={`${title} ${section.label}`}
            className="min-w-0 space-y-5 border-t border-gray-800 pt-6"
          >
            <h3 className="break-words text-lg font-semibold">
              {section.label} by {name}
            </h3>
            {section.data.every((item) => item[breakdown] === 0) ? (
              <p role="status" className="py-8 text-center text-gray-400">
                {breakdown === "cost"
                  ? "No net charges for this selection."
                  : "No reported usage for this selection."}
              </p>
            ) : (
              <div className="grid min-w-0 gap-6 xl:grid-cols-2">
                <div className="min-w-0">
                  <h4 className="mb-3 text-sm font-medium text-gray-300">
                    Daily {section.label}
                  </h4>
                  <ResponsiveContainer
                    width="100%"
                    height={300}
                    className="overflow-hidden"
                  >
                    <BarChart
                      data={points}
                      accessibilityLayer
                      stackOffset="sign"
                      margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#374151"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) =>
                          formatChartDate(value, multiYear)
                        }
                        stroke="#9ca3af"
                        fontSize={12}
                        minTickGap={24}
                      />
                      <YAxis
                        tickFormatter={
                          breakdown === "cost"
                            ? formatCurrency
                            : formatCompactNumber
                        }
                        stroke="#9ca3af"
                        fontSize={12}
                        width={64}
                      />
                      <Tooltip
                        contentStyle={CHART_TOOLTIP}
                        labelFormatter={(value) =>
                          formatChartDate(String(value), multiYear)
                        }
                        formatter={(value) =>
                          breakdown === "cost"
                            ? formatCurrency(Number(value))
                            : formatNumber(Number(value))
                        }
                      />
                      <Legend
                        content={() => (
                          <ul className="mt-2 flex max-h-16 flex-wrap gap-x-4 gap-y-1 overflow-y-auto text-xs text-gray-300">
                            {timeline.series.map((series, index) => (
                              <li
                                key={series.key}
                                className="flex min-w-0 max-w-full items-center gap-1"
                              >
                                <span
                                  className="h-2 w-2 shrink-0"
                                  style={{
                                    backgroundColor:
                                      CHART_COLORS[index % CHART_COLORS.length],
                                  }}
                                />
                                <span className="truncate" title={series.label}>
                                  {series.label}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      />
                      {timeline.series.map((series, index) => (
                        <Bar
                          key={series.key}
                          dataKey={series.key}
                          name={series.label}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                          stackId="usage"
                          maxBarSize={44}
                          isAnimationActive={false}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="min-w-0">
                  <h4 className="mb-3 text-sm font-medium text-gray-300">
                    Ranked {name}s
                  </h4>
                  <ResponsiveContainer
                    width="100%"
                    height={Math.max(120, ranked.length * 36)}
                    className="overflow-hidden"
                  >
                    <BarChart
                      data={bars}
                      layout="vertical"
                      accessibilityLayer
                      margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid stroke="#374151" horizontal={false} />
                      <XAxis
                        type="number"
                        tickFormatter={
                          breakdown === "cost"
                            ? formatCurrency
                            : formatCompactNumber
                        }
                        stroke="#9ca3af"
                        fontSize={12}
                      />
                      <YAxis
                        dataKey="index"
                        type="category"
                        width={24}
                        stroke="#9ca3af"
                        fontSize={12}
                      />
                      <Tooltip
                        contentStyle={CHART_TOOLTIP}
                        labelFormatter={(_, payload) =>
                          payload[0]?.payload.name ?? ""
                        }
                        formatter={(value) => [
                          breakdown === "cost"
                            ? formatCurrency(Number(value))
                            : formatNumber(Number(value)),
                          section.label,
                        ]}
                      />
                      <Bar
                        dataKey="value"
                        maxBarSize={20}
                        isAnimationActive={false}
                      >
                        {bars.map((bar, index) => (
                          <Cell
                            key={bar.index}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <ol className="mt-2 space-y-1 text-sm">
                    {ranked.map((group, index) => (
                      <li
                        key={group.key}
                        className="flex min-w-0 items-start gap-2"
                      >
                        <span className="w-4 shrink-0 text-gray-500">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 break-words text-gray-300">
                          {group.label}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {format(group[breakdown] ?? 0)}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
            <BillingTable
              groups={groups}
              label={`${title} ${section.label} by ${name}`}
              nameLabel={name}
              metric={breakdown}
              storageUnit={storageUnit}
            />
          </section>
        );
      })}
    </div>
  );
}
