"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import type {
  BillingGroup,
  BillingMetric,
  TokenField,
} from "@/lib/billingAnalytics";
import { serializeRows, serializeSummary } from "@/lib/fileParser";
import {
  displayQuantity,
  formatCurrency,
  formatNumber,
  usageUnitLabel,
} from "@/lib/utils";
import type { ServiceData } from "@/types/billing";

export function downloadCSV(contents: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob(["\ufeff", contents], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportButtons({
  data,
  groups,
  dimension = "sku",
  prefix = "billing",
}: {
  data?: ServiceData[];
  groups?: BillingGroup[];
  dimension?: string;
  prefix?: string;
}) {
  const buttonClass =
    "inline-flex min-h-9 items-center justify-center gap-2 rounded border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:border-sky-400 hover:text-white focus-visible:outline-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {data && (
        <button
          type="button"
          className={buttonClass}
          disabled={!data.length}
          onClick={() => downloadCSV(serializeRows(data), `${prefix}-rows.csv`)}
        >
          <Download size={16} aria-hidden="true" />
          Export Rows
        </button>
      )}
      {groups && (
        <button
          type="button"
          className={buttonClass}
          disabled={!groups.length}
          onClick={() =>
            downloadCSV(
              serializeSummary(groups, dimension),
              `${prefix}-${dimension}-summary.csv`,
            )
          }
        >
          <Download size={16} aria-hidden="true" />
          Export Summary
        </button>
      )}
    </div>
  );
}

export interface TableColumn<Row> {
  key: string;
  label: string;
  value: (row: Row) => string | number | undefined;
  render?: (row: Row) => ReactNode;
  numeric?: boolean;
}

export function SortableTable<Row extends { key: string }>({
  rows,
  columns,
  label,
  initialSort = "cost",
  initialDirection = "desc",
  onSelect,
}: {
  rows: Row[];
  columns: TableColumn<Row>[];
  label: string;
  initialSort?: string;
  initialDirection?: "asc" | "desc";
  onSelect?: (row: Row) => void;
}) {
  const searchId = useId();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({
    key: initialSort,
    direction: initialDirection,
  });
  const [page, setPage] = useState(0);
  const needle = search.trim().toLowerCase();
  const matching = rows.filter(
    (row) =>
      !needle ||
      columns.some((column) =>
        String(column.value(row) ?? "")
          .toLowerCase()
          .includes(needle),
      ),
  );
  const sortColumn =
    columns.find((column) => column.key === sort.key) ?? columns[0];
  const sorted = [...matching].sort((first, second) => {
    const firstValue = sortColumn.value(first);
    const secondValue = sortColumn.value(second);
    if (firstValue === undefined) return secondValue === undefined ? 0 : 1;
    if (secondValue === undefined) return -1;
    const compared =
      typeof firstValue === "number" && typeof secondValue === "number"
        ? firstValue - secondValue
        : String(firstValue).localeCompare(String(secondValue));
    return (
      (sort.direction === "asc" ? compared : -compared) ||
      first.key.localeCompare(second.key)
    );
  });
  const pageCount = Math.max(1, Math.ceil(sorted.length / 25));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = sorted.slice(currentPage * 25, currentPage * 25 + 25);
  const paginationClass =
    "inline-flex h-9 w-9 items-center justify-center rounded border border-gray-600 text-gray-200 hover:border-sky-400 focus-visible:outline-2 focus-visible:outline-sky-400 disabled:opacity-40";

  return (
    <div className="min-w-0 space-y-3">
      {(rows.length > 25 || search) && (
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor={searchId} className="text-sm text-gray-400">
            Search {label}
          </label>
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            className="min-w-0 rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-sky-400"
          />
        </div>
      )}
      <div
        role="region"
        aria-label={label}
        tabIndex={0}
        className="max-w-full overflow-x-auto overscroll-x-contain rounded focus-visible:outline-2 focus-visible:outline-sky-400"
      >
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{label}</caption>
          <thead className="border-b border-gray-700 text-gray-400">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    column.key === sort.key
                      ? sort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className={`px-3 py-3 font-medium first:pl-0 last:pr-0 ${column.numeric ? "text-right" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSort({
                        key: column.key,
                        direction:
                          sort.key === column.key && sort.direction === "desc"
                            ? "asc"
                            : "desc",
                      });
                      setPage(0);
                    }}
                    className={`inline-flex min-h-8 items-center gap-1 whitespace-nowrap rounded hover:text-white focus-visible:outline-2 focus-visible:outline-sky-400 ${column.numeric ? "justify-end" : ""}`}
                  >
                    {column.label}
                    {column.key !== sort.key ? (
                      <ArrowUpDown size={13} aria-hidden="true" />
                    ) : sort.direction === "asc" ? (
                      <ArrowUp size={13} aria-hidden="true" />
                    ) : (
                      <ArrowDown size={13} aria-hidden="true" />
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.key}
                className="border-b border-gray-800 hover:bg-gray-900/60"
              >
                {columns.map((column, index) => {
                  const contents = column.render
                    ? column.render(row)
                    : (column.value(row) ?? "Not reported");
                  const className = `px-3 py-3 align-top first:pl-0 last:pr-0 ${column.numeric ? "whitespace-nowrap text-right tabular-nums" : "min-w-32 max-w-72 break-words"}`;
                  return index === 0 ? (
                    <th
                      key={column.key}
                      scope="row"
                      className={`${className} font-medium text-gray-200`}
                    >
                      {onSelect ? (
                        <button
                          type="button"
                          onClick={() => onSelect(row)}
                          className="rounded text-left text-sky-300 underline decoration-sky-800 underline-offset-4 hover:text-sky-200 focus-visible:outline-2 focus-visible:outline-sky-400"
                        >
                          {contents}
                        </button>
                      ) : (
                        contents
                      )}
                    </th>
                  ) : (
                    <td key={column.key} className={className}>
                      {contents}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && (
          <p role="status" className="py-8 text-center text-gray-400">
            No matching records.
          </p>
        )}
      </div>
      {rows.length > 25 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-400">
          <span aria-live="polite">
            {formatNumber(sorted.length)} records | Page {currentPage + 1} of{" "}
            {pageCount}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label={`Previous ${label} page`}
              title="Previous page"
              className={paginationClass}
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={`Next ${label} page`}
              title="Next page"
              className={paginationClass}
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function BillingTable({
  groups,
  label,
  nameLabel = "SKU",
  metric = "cost",
  storageUnit = "gb-hours",
  onSelect,
  tokens = false,
}: {
  groups: BillingGroup[];
  label: string;
  nameLabel?: string;
  metric?: BillingMetric;
  storageUnit?: "gb-hours" | "gb-months";
  onSelect?: (group: BillingGroup) => void;
  tokens?: boolean;
}) {
  const columns: TableColumn<BillingGroup>[] = [
    { key: "label", label: nameLabel, value: (group) => group.label },
    {
      key: "quantity",
      label: "Quantity",
      value: (group) =>
        group.quantity === undefined
          ? undefined
          : displayQuantity(group.quantity, group.unitType, storageUnit),
      render: (group) =>
        group.mixedUnits
          ? "Mixed units"
          : formatNumber(
              displayQuantity(group.quantity ?? 0, group.unitType, storageUnit),
            ),
      numeric: true,
    },
    {
      key: "unit",
      label: "Unit",
      value: (group) =>
        group.mixedUnits
          ? "Mixed"
          : usageUnitLabel(group.unitType, storageUnit),
    },
    {
      key: "grossAmount",
      label: "Gross (USD)",
      value: (group) => group.grossAmount,
      render: (group) => formatCurrency(group.grossAmount),
      numeric: true,
    },
    {
      key: "discountAmount",
      label: "Discounts (USD)",
      value: (group) => group.discountAmount,
      render: (group) => formatCurrency(group.discountAmount),
      numeric: true,
    },
    {
      key: "cost",
      label: "Net Cost (USD)",
      value: (group) => group.cost,
      render: (group) => (
        <span className="text-green-400">{formatCurrency(group.cost)}</span>
      ),
      numeric: true,
    },
  ];
  if (tokens) {
    const tokenColumns: [TokenField, string][] = [
      ["inputTokens", "Input Tokens"],
      ["outputTokens", "Output Tokens"],
      ["cachedTokens", "Cached Tokens"],
      ["totalTokens", "Reported Total Tokens"],
    ];
    for (const [field, name] of tokenColumns)
      if (groups.some((group) => group[field] !== undefined))
        columns.push({
          key: field,
          label: name,
          value: (group) => group[field],
          render: (group) => formatNumber(group[field]),
          numeric: true,
        });
  }
  return (
    <SortableTable
      key={metric}
      rows={groups}
      columns={columns}
      label={label}
      initialSort={metric}
      onSelect={onSelect}
    />
  );
}
