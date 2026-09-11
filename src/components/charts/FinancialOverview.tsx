"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CheckCircle2, Download, TriangleAlert, X } from "lucide-react";
import {
  BillingTable,
  downloadCSV,
  ExportButtons,
  SortableTable,
} from "@/components/ui/BillingTable";
import type { TableColumn } from "@/components/ui/BillingTable";
import {
  getBillingTimeline,
  groupBilling,
  rankWithOther,
  summarizeAmounts,
} from "@/lib/billingAnalytics";
import type { BillingDimension } from "@/lib/billingAnalytics";
import { serializeIssues } from "@/lib/fileParser";
import {
  formatChartDate,
  formatCurrency,
  formatNumber,
  spansMultipleYears,
} from "@/lib/utils";
import type { ImportDiagnostics, ServiceData } from "@/types/billing";
import {
  CHART_COLORS,
  CHART_TOOLTIP,
} from "@/components/charts/UnitServiceChart";

function ImportAudit({ diagnostics }: { diagnostics: ImportDiagnostics }) {
  const issues = [
    ...diagnostics.rejectedRows.map((issue) => ({
      ...issue,
      key: `rejected-${issue.record}`,
      status: "Rejected",
    })),
    ...diagnostics.warnings.map((issue) => ({
      ...issue,
      key: `warning-${issue.record}`,
      status: "Warning",
    })),
  ];
  const reconciled = !issues.length;
  const totals = [
    {
      key: "source",
      label: "Source",
      rows: diagnostics.totalRows,
      ...diagnostics.sourceTotals,
    },
    {
      key: "accepted",
      label: "Accepted",
      rows: diagnostics.acceptedRows,
      ...diagnostics.acceptedTotals,
    },
    {
      key: "rejected",
      label: "Rejected",
      rows: diagnostics.rejectedRows.length,
      ...diagnostics.rejectedTotals,
    },
  ];
  return (
    <section
      aria-label="Import reconciliation"
      className="space-y-4 border-b border-gray-800 pb-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3
          className={`inline-flex items-center gap-2 text-base font-semibold ${reconciled ? "text-green-400" : "text-amber-300"}`}
        >
          {reconciled ? (
            <CheckCircle2 size={18} aria-hidden="true" />
          ) : (
            <TriangleAlert size={18} aria-hidden="true" />
          )}
          {reconciled ? "Import Reconciled" : "Import Needs Review"}
        </h3>
        <span className="text-sm text-gray-400">
          Entire file: {formatNumber(diagnostics.totalRows)} records
        </span>
      </div>
      <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
        {[
          ["Accepted", diagnostics.acceptedRows],
          ["Rejected", diagnostics.rejectedRows.length],
          ["Other / Unclassified", diagnostics.otherRows],
          ["Amount Warnings", diagnostics.warnings.length],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center gap-2">
            <dt className="text-gray-400">{label}</dt>
            <dd className="font-medium tabular-nums">
              {formatNumber(Number(value))}
            </dd>
          </div>
        ))}
      </dl>
      <details className="group">
        <summary className="cursor-pointer rounded py-2 text-sm text-sky-300 hover:text-sky-200 focus-visible:outline-2 focus-visible:outline-sky-400">
          Import Audit
        </summary>
        <div className="space-y-5 py-3">
          <SortableTable
            rows={totals}
            label="Import monetary reconciliation"
            initialSort="label"
            initialDirection="asc"
            columns={[
              { key: "label", label: "Scope", value: (row) => row.label },
              {
                key: "rows",
                label: "Records",
                value: (row) => row.rows,
                numeric: true,
              },
              {
                key: "grossAmount",
                label: "Gross (USD)",
                value: (row) => row.grossAmount,
                render: (row) => formatCurrency(row.grossAmount),
                numeric: true,
              },
              {
                key: "discountAmount",
                label: "Discounts (USD)",
                value: (row) => row.discountAmount,
                render: (row) => formatCurrency(row.discountAmount),
                numeric: true,
              },
              {
                key: "cost",
                label: "Net (USD)",
                value: (row) => row.cost,
                render: (row) => formatCurrency(row.cost),
                numeric: true,
              },
            ]}
          />
          {issues.length > 0 && (
            <>
              <button
                type="button"
                onClick={() =>
                  downloadCSV(
                    serializeIssues(issues),
                    "billing-import-issues.csv",
                  )
                }
                className="inline-flex min-h-9 items-center gap-2 rounded border border-gray-600 px-3 py-2 text-sm hover:border-sky-400 focus-visible:outline-2 focus-visible:outline-sky-400"
              >
                <Download size={16} aria-hidden="true" />
                Export Import Issues
              </button>
              <SortableTable
                rows={issues}
                label="Import issues"
                initialSort="record"
                initialDirection="asc"
                columns={[
                  {
                    key: "record",
                    label: "CSV Record",
                    value: (row) => row.record,
                    numeric: true,
                  },
                  {
                    key: "status",
                    label: "Status",
                    value: (row) => row.status,
                  },
                  {
                    key: "reason",
                    label: "Reason",
                    value: (row) => row.reason,
                  },
                  { key: "sku", label: "SKU", value: (row) => row.values.sku },
                  {
                    key: "net",
                    label: "Source Net Amount",
                    value: (row) => row.values.net_amount,
                    numeric: true,
                  },
                ]}
              />
            </>
          )}
        </div>
      </details>
    </section>
  );
}

export function FinancialOverview({
  data,
  diagnostics,
}: {
  data: ServiceData[];
  diagnostics?: ImportDiagnostics;
}) {
  const [mode, setMode] = useState<"cost" | "cumulative" | "change">("cost");
  const [dimension, setDimension] = useState<BillingDimension>("service");
  const [selectedDate, setSelectedDate] = useState<string>();
  const [showEstimate, setShowEstimate] = useState(false);
  const timeline = getBillingTimeline(data);
  const totals = summarizeAmounts(data);
  const hasSelectedDate = timeline.daily.some(
    (day) => day.date === selectedDate,
  );
  const activeDate = hasSelectedDate ? selectedDate : undefined;
  const selectedRows = activeDate
    ? data.filter((item) => item.date === activeDate)
    : data;
  const selectedSkus = groupBilling(selectedRows, "sku", true);
  const comparison = groupBilling(data, dimension);
  const ranked = rankWithOther(comparison, "cost");
  const multiYear = spansMultipleYears(data.map((item) => item.date));
  const formatDate = (value: string) => formatChartDate(value, multiYear);
  const modes = [
    { value: "cost", label: "Daily Spend" },
    { value: "cumulative", label: "Cumulative" },
    { value: "change", label: "Daily Change" },
  ] as const;
  const dimensions = [
    { value: "service", label: "Service" },
    { value: "organization", label: "Organization" },
    { value: "costCenter", label: "Cost Center" },
    { value: "product", label: "Product" },
  ] as const;
  const comparisonName =
    dimensions.find((option) => option.value === dimension)?.label ?? "Service";
  const dailyColumns: TableColumn<(typeof timeline.daily)[number]>[] = [
    {
      key: "date",
      label: "Date (UTC)",
      value: (day) => day.date,
      render: (day) => formatDate(day.date),
    },
    {
      key: "cost",
      label: "Net Cost (USD)",
      value: (day) => day.cost,
      render: (day) => formatCurrency(day.cost),
      numeric: true,
    },
    {
      key: "change",
      label: "Daily Change (USD)",
      value: (day) => day.change,
      render: (day) =>
        day.change === undefined ? "No prior day" : formatCurrency(day.change),
      numeric: true,
    },
    {
      key: "cumulative",
      label: "Cumulative (USD)",
      value: (day) => day.cumulative,
      render: (day) => formatCurrency(day.cumulative),
      numeric: true,
    },
  ];
  const estimateAvailable =
    timeline.monthlyEstimate !== undefined &&
    !diagnostics?.rejectedRows.length &&
    !diagnostics?.warnings.length;

  return (
    <div className="min-w-0 space-y-8">
      {diagnostics && <ImportAudit diagnostics={diagnostics} />}
      {!data.length ? (
        <p role="status" className="py-12 text-center text-gray-400">
          No accepted records match this selection.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Financial Overview</h2>
              <p className="mt-1 text-sm text-gray-400">
                {formatChartDate(timeline.start!, true)} to{" "}
                {formatChartDate(timeline.end!, true)} | USD
              </p>
            </div>
            <ExportButtons
              data={data}
              groups={groupBilling(data, "sku", true)}
              prefix="billing-filtered"
            />
          </div>
          <dl className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              {
                label: "Net Spend",
                amount: totals.cost,
                color: "text-green-400",
              },
              {
                label: "Gross Amount",
                amount: totals.grossAmount,
                color: "text-gray-100",
              },
              {
                label: "Report Discounts",
                amount: totals.discountAmount,
                color: "text-amber-300",
              },
            ].map((metric) => (
              <div
                key={metric.label}
                className="min-w-0 border-b border-gray-700 pb-4"
              >
                <dt className="mb-2 text-sm text-gray-400">{metric.label}</dt>
                <dd
                  className={`break-words text-2xl font-semibold tabular-nums ${metric.color}`}
                >
                  {formatCurrency(metric.amount)}
                </dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            <span
              className={
                timeline.partialPeriod ? "text-amber-300" : "text-gray-300"
              }
            >
              {timeline.partialPeriod
                ? "Partial Calendar Coverage"
                : "Full Calendar Coverage"}
            </span>
            <span className="text-gray-400">
              {timeline.daily.length} reported dates
              {timeline.missingDays
                ? ` | ${timeline.missingDays} missing dates`
                : ""}
            </span>
            <label className="inline-flex items-center gap-2 text-gray-300">
              <input
                type="checkbox"
                checked={showEstimate}
                disabled={!estimateAvailable}
                onChange={(event) => setShowEstimate(event.target.checked)}
                className="accent-sky-400"
              />
              Monthly Run-Rate Estimate
            </label>
          </div>
          {showEstimate && estimateAvailable && (
            <p
              role="status"
              className="border-l-2 border-amber-400 pl-4 text-sm text-gray-300"
            >
              <strong className="tabular-nums text-amber-300">
                {formatCurrency(timeline.monthlyEstimate)}
              </strong>{" "}
              projected from {timeline.spanDays} reported days. Not an invoice
              forecast; the latest reported day may be incomplete.
            </p>
          )}
          <section aria-label="Spending trend" className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h3 className="text-lg font-semibold">Spending Trend</h3>
              <div
                role="group"
                aria-label="Spending trend mode"
                className="flex flex-wrap gap-1"
              >
                {modes.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    aria-pressed={mode === option.value}
                    onClick={() => setMode(option.value)}
                    className={`min-h-9 rounded px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-sky-400 ${mode === option.value ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer
              width="100%"
              height={320}
              className="overflow-hidden"
            >
              {mode === "cumulative" ? (
                <LineChart
                  data={timeline.daily}
                  accessibilityLayer
                  onClick={(state) => {
                    if (state?.activeLabel)
                      setSelectedDate(String(state.activeLabel));
                  }}
                  margin={{ top: 8, right: 12, bottom: 8, left: 0 }}
                >
                  <CartesianGrid stroke="#374151" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    minTickGap={28}
                    fontSize={12}
                    stroke="#9ca3af"
                  />
                  <YAxis
                    tickFormatter={formatCurrency}
                    width={72}
                    fontSize={12}
                    stroke="#9ca3af"
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP}
                    labelFormatter={(value) => formatDate(String(value))}
                    formatter={(value) => [
                      formatCurrency(Number(value)),
                      "Cumulative Spend",
                    ]}
                  />
                  <Line
                    dataKey="cumulative"
                    type="linear"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              ) : (
                <BarChart
                  data={timeline.daily}
                  accessibilityLayer
                  onClick={(state) => {
                    if (state?.activeLabel)
                      setSelectedDate(String(state.activeLabel));
                  }}
                  margin={{ top: 8, right: 12, bottom: 8, left: 0 }}
                >
                  <CartesianGrid stroke="#374151" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    minTickGap={28}
                    fontSize={12}
                    stroke="#9ca3af"
                  />
                  <YAxis
                    tickFormatter={formatCurrency}
                    width={72}
                    fontSize={12}
                    stroke="#9ca3af"
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP}
                    labelFormatter={(value) => formatDate(String(value))}
                    formatter={(value) => [
                      formatCurrency(Number(value)),
                      mode === "cost" ? "Net Spend" : "Daily Change",
                    ]}
                  />
                  <Bar
                    dataKey={mode}
                    fill={mode === "cost" ? "#34d399" : "#fbbf24"}
                    maxBarSize={44}
                    isAnimationActive={false}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
            <SortableTable
              rows={timeline.daily}
              columns={dailyColumns}
              label="Daily spending"
              initialSort="cost"
              onSelect={(day) => setSelectedDate(day.date)}
            />
          </section>
          <section
            aria-label="SKU drill-down"
            className="min-w-0 space-y-4 border-t border-gray-800 pt-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">
                {activeDate
                  ? `SKUs on ${formatChartDate(activeDate, true)}`
                  : "SKU Contributions"}
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                {activeDate && (
                  <button
                    type="button"
                    aria-label="Clear selected date"
                    title="Clear selected date"
                    onClick={() => setSelectedDate(undefined)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded border border-gray-600 hover:border-sky-400 focus-visible:outline-2 focus-visible:outline-sky-400"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                )}
                <ExportButtons
                  data={selectedRows}
                  groups={selectedSkus}
                  prefix={activeDate ? `billing-${activeDate}` : "billing-skus"}
                />
              </div>
            </div>
            <BillingTable groups={selectedSkus} label="SKU contributions" />
          </section>
          <section
            aria-label="Spending comparisons"
            className="min-w-0 space-y-4 border-t border-gray-800 pt-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">
                Net Spend by {comparisonName}
              </h3>
              <div
                role="group"
                aria-label="Comparison dimension"
                className="flex flex-wrap gap-1"
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
            </div>
            <ResponsiveContainer
              width="100%"
              height={Math.max(120, ranked.length * 36)}
              className="overflow-hidden"
            >
              <BarChart
                data={ranked.map((group, index) => ({
                  ...group,
                  index: index + 1,
                }))}
                layout="vertical"
                accessibilityLayer
                margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
              >
                <CartesianGrid stroke="#374151" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={formatCurrency}
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
                    payload[0]?.payload.label ?? ""
                  }
                  formatter={(value) => [
                    formatCurrency(Number(value)),
                    "Net Spend",
                  ]}
                />
                <Bar dataKey="cost" isAnimationActive={false} maxBarSize={24}>
                  {ranked.map((group, index) => (
                    <Cell
                      key={group.key}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <ol className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-300">
              {ranked.map((group, index) => (
                <li key={group.key} className="min-w-0 break-words">
                  {index + 1}. {group.label}
                </li>
              ))}
            </ol>
            <ExportButtons
              groups={comparison}
              dimension={dimension}
              prefix="billing-comparison"
            />
            <BillingTable
              key={dimension}
              groups={comparison}
              label={`${comparisonName} comparison`}
              nameLabel={comparisonName}
            />
          </section>
        </>
      )}
    </div>
  );
}
