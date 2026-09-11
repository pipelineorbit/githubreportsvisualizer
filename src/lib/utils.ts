import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatChartDate(value: string, includeYear = false) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: includeYear ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(date);
}

export function spansMultipleYears(dates: string[]) {
  return new Set(dates.map((date) => date.slice(0, 4))).size > 1;
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 });
const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumSignificantDigits: 3,
});

export function formatCurrency(value: number | undefined) {
  return value === undefined ? "Not reported" : currency.format(value);
}

export function formatNumber(value: number | undefined) {
  return value === undefined ? "Not reported" : number.format(value);
}

export function formatCompactNumber(value: number) {
  return compact.format(value);
}

export function usageUnitLabel(
  unit: string | undefined,
  storageUnit = "gb-hours",
) {
  if (unit === "gigabyte-hours")
    return storageUnit === "gb-months" ? "GB-months (730h)" : "GB-hours";
  if (unit === "gigabyte-months") return "GB-months";
  if (unit === "user-months") return "seat-months";
  if (unit === "ai-credits") return "AI credits";
  return unit ?? "Not reported";
}

export function displayQuantity(
  value: number,
  unit: string | undefined,
  storageUnit = "gb-hours",
) {
  return unit === "gigabyte-hours" && storageUnit === "gb-months"
    ? value / 730
    : value;
}
