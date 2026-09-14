"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
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

function DailyServiceTrend({
  data,
  dimension,
  metric,
  heading,
  unitType,
  storageUnit,
  multiYear,
  colors,
}: {
  data: ServiceData[];
  dimension: BillingDimension;
  metric: BillingMetric;
  heading: string;
  unitType?: string;
  storageUnit: "gb-hours" | "gb-months";
  multiYear: boolean;
  colors: Record<string, string>;
}) {
  const ranked = rankWithOther(
    groupBilling(data, dimension, dimension === "sku"),
    metric,
  );
  const timeline = rankedDailyData(ranked, metric);
  const points = timeline.points.map((point) => {
    const values = timeline.series.map(
      (series) =>
        [
          series.key,
          metric === "cost"
            ? Number(point[series.key])
            : displayQuantity(Number(point[series.key]), unitType, storageUnit),
        ] as const,
    );
    return {
      date: point.date,
      ...Object.fromEntries(values),
      total: values.reduce((total, [, value]) => total + value, 0),
    };
  });
  const formatValue = metric === "cost" ? formatCurrency : formatNumber;

  return (
    <section aria-label={heading} className="min-w-0 space-y-3">
      <h3 className="break-words text-base font-semibold">{heading}</h3>
      <ResponsiveContainer
        width="100%"
        height={300}
        className="overflow-hidden"
      >
        <ComposedChart
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
            tickFormatter={(value) => formatChartDate(value, multiYear)}
            stroke="#9ca3af"
            fontSize={12}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={
              metric === "cost" ? formatCurrency : formatCompactNumber
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
            formatter={(value) => formatValue(Number(value))}
          />
          {timeline.series.map((series, index) => (
            <Bar
              key={series.key}
              dataKey={series.key}
              name={series.label}
              fill={colors[ranked[index].key]}
              stackId="daily"
              maxBarSize={44}
              isAnimationActive={false}
            />
          ))}
          <Line
            dataKey="total"
            name={
              metric === "cost"
                ? "Total Net Cost"
                : `Total ${usageUnitLabel(unitType, storageUnit)}`
            }
            type="linear"
            stroke="#e5e7eb"
            strokeWidth={2}
            dot={{ r: 2 }}
            isAnimationActive={false}
            legendType="none"
          />
        </ComposedChart>
      </ResponsiveContainer>
      <ul
        aria-label={`${heading} legend`}
        className="flex max-h-20 flex-wrap gap-x-4 gap-y-1 overflow-y-auto text-xs text-gray-300"
      >
        {timeline.series.map((series, index) => (
          <li
            key={series.key}
            className="flex min-w-0 max-w-full items-center gap-1"
          >
            <span
              className="h-2 w-2 shrink-0"
              style={{ backgroundColor: colors[ranked[index].key] }}
            />
            <span className="truncate" title={series.label}>
              {series.label}
            </span>
          </li>
        ))}
        <li className="flex items-center gap-1">
          <span className="h-0.5 w-3 bg-gray-200" />
          Total
        </li>
      </ul>
    </section>
  );
}

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
  const [requestedDimension, setDimension] =
    useState<BillingDimension>(initialDimension);
  const summary = summarizeBilling(data);
  const dimensions: { value: BillingDimension; label: string }[] = [
    { value: "sku", label: "SKU" },
    { value: "repository", label: "Repository" },
    { value: "organization", label: "Organization" },
    { value: "costCenter", label: "Cost Center" },
  ];
  if (data.some((item) => item.workflowPath))
    dimensions.push({ value: "workflowPath", label: "Workflow" });
  if (data.some((item) => item.username))
    dimensions.push({ value: "username", label: "User" });
  if (data.some((item) => item.model))
    dimensions.push({ value: "model", label: "Model" });
  const dimension = dimensions.some(
    (option) => option.value === requestedDimension,
  )
    ? requestedDimension
    : initialDimension;
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
  const dailyDimensions = [{ value: dimension, label: name }];
  if (
    dimension !== "organization" &&
    new Set(data.map((item) => item.organization || "")).size > 1
  ) {
    dailyDimensions.push({ value: "organization", label: "Organization" });
  }

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
      <section
        aria-label="Daily Cost and Usage"
        className="space-y-5 border-t border-gray-800 pt-6"
      >
        <h2 className="text-lg font-semibold">Daily Cost and Usage</h2>
        {dailyDimensions.map((dailyDimension) => {
          const colors = Object.fromEntries(
            groupBilling(
              data,
              dailyDimension.value,
              dailyDimension.value === "sku",
            )
              .map((group) => group.key)
              .sort()
              .map((key, index) => [
                key,
                CHART_COLORS[index % (CHART_COLORS.length - 1)],
              ]),
          );
          colors.remainder = CHART_COLORS[CHART_COLORS.length - 1];
          return (
            <div
              key={dailyDimension.value}
              className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2"
            >
              <DailyServiceTrend
                data={data}
                dimension={dailyDimension.value}
                metric="cost"
                heading={`Daily Net Cost by ${dailyDimension.label}`}
                storageUnit={storageUnit}
                multiYear={multiYear}
                colors={colors}
              />
              {summary.usageGroups.map((group) => (
                <DailyServiceTrend
                  key={group.key}
                  data={group.data}
                  dimension={dailyDimension.value}
                  metric="quantity"
                  heading={`Daily Usage (${group.unitType ? usageUnitLabel(group.unitType, storageUnit) : `${group.data[0].sku}; unit not reported`}) by ${dailyDimension.label}`}
                  unitType={group.unitType}
                  storageUnit={storageUnit}
                  multiYear={multiYear}
                  colors={colors}
                />
              ))}
            </div>
          );
        })}
      </section>
      {sections.map((section) => {
        const groups = groupBilling(
          section.data,
          dimension,
          dimension === "sku",
        );
        const ranked = rankWithOther(groups, breakdown);
        const display = (value: number) =>
          breakdown === "cost"
            ? value
            : displayQuantity(value, section.unitType, storageUnit);
        const format = (value: number) =>
          breakdown === "cost"
            ? formatCurrency(value)
            : formatNumber(display(value));
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
              <div className="min-w-0">
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
