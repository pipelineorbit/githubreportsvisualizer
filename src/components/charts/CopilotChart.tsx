"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { summarizeCopilotBilling } from "@/lib/copilotBilling";
import type { ServiceData } from "@/types/billing";

const COLORS = ["#38bdf8", "#34d399", "#fbbf24", "#fb7185", "#a3e635"];
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const quantity = new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 });
const axisQuantity = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumSignificantDigits: 3,
});
const tooltipStyle = {
  backgroundColor: "#111827",
  border: "1px solid #374151",
  borderRadius: "8px",
  color: "#f3f4f6",
};

function formatCurrency(amount: number | undefined): string {
  return amount === undefined ? "Not reported" : currency.format(amount);
}

function describeUnit(unitType: string | undefined, sku: string) {
  switch (unitType) {
    case "ai-credits":
      return { name: "AI Usage", total: "AI Credits Used", unit: "AI credits" };
    case "user-months":
      return {
        name: "Seat Subscriptions",
        total: "Billed Seat-Months",
        unit: "seat-months",
      };
    case "requests":
      return { name: "Request Usage", total: "Requests", unit: "requests" };
    default:
      return {
        name: unitType ?? sku,
        total: `Reported Quantity (${unitType ?? sku})`,
        unit: unitType ?? "Not reported",
      };
  }
}

export function CopilotChart({
  data,
  breakdown = "cost",
}: {
  data: ServiceData[];
  breakdown?: "cost" | "quantity";
}) {
  if (data.length === 0) {
    return (
      <p role="status" className="py-12 text-center text-gray-400">
        No Copilot data matches the selected filters.
      </p>
    );
  }

  const summary = summarizeCopilotBilling(data);
  const multiYear = new Set(data.map((item) => item.date.slice(0, 4))).size > 1;
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: multiYear ? "numeric" : undefined,
    timeZone: "UTC",
  });
  const formatDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
  };

  return (
    <div className="min-w-0 space-y-8">
      <dl className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {[
          {
            label: "Net Cost (USD)",
            value: summary.cost,
            color: "text-green-400",
          },
          {
            label: "Gross Amount (USD)",
            value: summary.grossAmount,
            color: "text-gray-100",
          },
          {
            label: "Report Discounts (USD)",
            value: summary.discountAmount,
            color: "text-amber-400",
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
              {formatCurrency(metric.value)}
            </dd>
          </div>
        ))}
      </dl>

      <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {summary.usageGroups.map((group, index) => {
          const label = describeUnit(group.unitType, group.data[0].sku);
          return (
            <div
              key={group.key}
              className="min-w-0 border-l-2 pl-4"
              style={{ borderColor: COLORS[index % COLORS.length] }}
            >
              <dt className="mb-1 break-words text-sm text-gray-300">
                {label.total}
              </dt>
              <dd className="break-words text-xl font-semibold tabular-nums">
                {quantity.format(group.quantity)}
              </dd>
              <dd className="mt-1 text-sm text-gray-400">
                Net cost:{" "}
                <span className="tabular-nums text-gray-200">
                  {formatCurrency(group.cost)}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>

      {breakdown === "cost" ? (
        <section
          aria-labelledby="copilot-cost-heading"
          className="min-w-0 border-t border-gray-800 pt-6"
        >
          <h3 id="copilot-cost-heading" className="mb-4 text-lg font-semibold">
            Daily Net Cost
          </h3>
          {data.every((item) => item.cost === 0) ? (
            <p role="status" className="py-12 text-center text-gray-400">
              No net charges for this selection.
            </p>
          ) : (
            <ResponsiveContainer
              width="100%"
              height={320}
              className="overflow-hidden"
            >
              <BarChart
                data={summary.dailyCosts}
                accessibilityLayer
                stackOffset="sign"
                margin={{ top: 8, right: 8, bottom: 8, left: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#374151"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  stroke="#9ca3af"
                  fontSize={12}
                  minTickGap={24}
                />
                <YAxis
                  tickFormatter={formatCurrency}
                  stroke="#9ca3af"
                  fontSize={12}
                  width={72}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "#f3f4f6" }}
                  labelFormatter={(value) => formatDate(String(value))}
                  formatter={(value) => formatCurrency(Number(value))}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                {summary.usageGroups.map((group, index) => (
                  <Bar
                    key={group.key}
                    dataKey={group.key}
                    name={describeUnit(group.unitType, group.data[0].sku).name}
                    stackId="cost"
                    fill={COLORS[index % COLORS.length]}
                    maxBarSize={44}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-2">
          {summary.usageGroups.map((group, index) => {
            const label = describeUnit(group.unitType, group.data[0].sku);
            return (
              <section
                key={group.key}
                aria-label={`Daily ${label.total}`}
                className="min-w-0 border-t border-gray-800 pt-6"
              >
                <h3 className="mb-4 break-words text-lg font-semibold">
                  Daily {label.total}
                </h3>
                <ResponsiveContainer
                  width="100%"
                  height={280}
                  className="overflow-hidden"
                >
                  <BarChart
                    data={group.dailyData}
                    accessibilityLayer
                    margin={{ top: 8, right: 8, bottom: 8, left: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#374151"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      stroke="#9ca3af"
                      fontSize={12}
                      minTickGap={24}
                    />
                    <YAxis
                      tickFormatter={(value) => axisQuantity.format(value)}
                      stroke="#9ca3af"
                      fontSize={12}
                      width={60}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "#f3f4f6" }}
                      labelFormatter={(value) => formatDate(String(value))}
                      formatter={(value) => [
                        quantity.format(Number(value)),
                        label.unit,
                      ]}
                    />
                    <Bar
                      dataKey="quantity"
                      name={label.unit}
                      fill={COLORS[index % COLORS.length]}
                      maxBarSize={44}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </section>
            );
          })}
        </div>
      )}

      <section
        aria-labelledby="copilot-sku-heading"
        className="min-w-0 border-t border-gray-800 pt-6"
      >
        <h3 id="copilot-sku-heading" className="mb-4 text-lg font-semibold">
          Billing by SKU
        </h3>
        <div
          role="region"
          aria-label="Copilot billing by SKU"
          tabIndex={0}
          className="overflow-x-auto rounded focus-visible:outline-2 focus-visible:outline-sky-400"
        >
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-gray-700 text-gray-400">
              <tr>
                <th scope="col" className="py-3 pr-4 font-medium">
                  SKU
                </th>
                <th scope="col" className="px-3 py-3 text-right font-medium">
                  Quantity
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  Unit
                </th>
                <th scope="col" className="px-3 py-3 text-right font-medium">
                  Gross
                </th>
                <th scope="col" className="px-3 py-3 text-right font-medium">
                  Discounts
                </th>
                <th scope="col" className="py-3 pl-3 text-right font-medium">
                  Net Cost
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.skuBreakdown.map((item) => (
                <tr key={item.key} className="border-b border-gray-800">
                  <th
                    scope="row"
                    className="max-w-64 break-words py-3 pr-4 font-medium text-gray-200"
                  >
                    {item.sku}
                  </th>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {quantity.format(item.quantity)}
                  </td>
                  <td className="px-3 py-3 text-gray-300">
                    {describeUnit(item.unitType, item.sku).unit}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatCurrency(item.grossAmount)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-amber-300">
                    {formatCurrency(item.discountAmount)}
                  </td>
                  <td className="py-3 pl-3 text-right tabular-nums text-green-400">
                    {formatCurrency(item.cost)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="font-semibold">
              <tr>
                <th scope="row" colSpan={3} className="py-3 pr-4">
                  Total (USD)
                </th>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatCurrency(summary.grossAmount)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-amber-300">
                  {formatCurrency(summary.discountAmount)}
                </td>
                <td className="py-3 pl-3 text-right tabular-nums text-green-400">
                  {formatCurrency(summary.cost)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {summary.organizations.length > 1 && (
        <section
          aria-labelledby="copilot-organizations-heading"
          className="border-t border-gray-800 pt-6"
        >
          <h3
            id="copilot-organizations-heading"
            className="mb-4 text-lg font-semibold"
          >
            Net Cost by Organization
          </h3>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-700 text-gray-400">
              <tr>
                <th scope="col" className="py-3 pr-4 font-medium">
                  Organization
                </th>
                <th scope="col" className="py-3 text-right font-medium">
                  Net Cost (USD)
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.organizations.map((item) => (
                <tr
                  key={item.organization}
                  className="border-b border-gray-800"
                >
                  <th
                    scope="row"
                    className="max-w-48 break-words py-3 pr-4 font-medium"
                  >
                    {item.organization}
                  </th>
                  <td className="py-3 text-right tabular-nums text-green-400">
                    {formatCurrency(item.cost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
