import { getServiceType } from "@/lib/dataProcessor";
import type { ServiceData, ServiceType } from "@/types/billing";

export const SERVICE_LABELS: Record<ServiceType, string> = {
  actionsMinutes: "Actions Minutes",
  actionsStorage: "Actions Storage",
  packages: "Packages",
  copilot: "Copilot",
  codespaces: "Codespaces",
  other: "Other",
};

export type BillingDimension =
  | "service"
  | "product"
  | "sku"
  | "organization"
  | "costCenter"
  | "repository"
  | "username"
  | "model";
export type BillingMetric = "cost" | "quantity";
export type TokenField =
  "inputTokens" | "outputTokens" | "cachedTokens" | "totalTokens";
export const TOKEN_FIELDS: TokenField[] = [
  "inputTokens",
  "outputTokens",
  "cachedTokens",
  "totalTokens",
];

export interface BillingGroup {
  key: string;
  label: string;
  cost: number;
  grossAmount?: number;
  discountAmount?: number;
  quantity?: number;
  unitType?: string;
  mixedUnits: boolean;
  rowCount: number;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  totalTokens?: number;
  data: ServiceData[];
}

export function getUsageUnitType(item: ServiceData): string | undefined {
  const reported = item.unitType?.trim().toLowerCase();
  if (reported) {
    if (reported === "gb-hours") return "gigabyte-hours";
    if (reported === "gb-months") return "gigabyte-months";
    if (reported === "ai credits") return "ai-credits";
    return reported;
  }
  const sku = item.sku.toLowerCase();
  if (sku === "copilot_ai_credit") return "ai-credits";
  if (sku === "copilot_for_business" || sku === "copilot_for_enterprise")
    return "user-months";
  if (sku === "copilot_premium_request" || sku === "copilot_premium_requests")
    return "requests";
  if (/^actions_(linux|windows|macos|self_hosted)(_|$)/.test(sku))
    return "minutes";
  if (
    [
      "actions_storage",
      "actions_custom_image_storage",
      "actions_cache_storage",
      "packages_storage",
    ].includes(sku)
  )
    return "gigabyte-hours";
  return undefined;
}

function unitKey(item: ServiceData) {
  const unit = getUsageUnitType(item);
  return JSON.stringify([
    unit ?? null,
    unit ? null : (item.product ?? null),
    unit ? null : item.sku,
  ]);
}

export function sumReported(
  data: ServiceData[],
  field: "grossAmount" | "discountAmount" | TokenField,
) {
  return data.every((item) => item[field] !== undefined)
    ? data.reduce((total, item) => total + item[field]!, 0)
    : undefined;
}

export function summarizeAmounts(data: ServiceData[]) {
  return {
    cost: data.reduce((total, item) => total + item.cost, 0),
    grossAmount: sumReported(data, "grossAmount"),
    discountAmount: sumReported(data, "discountAmount"),
  };
}

function summarizeGroup(
  key: string,
  label: string,
  data: ServiceData[],
): BillingGroup {
  const mixedUnits = new Set(data.map(unitKey)).size > 1;
  return {
    key,
    label,
    data,
    ...summarizeAmounts(data),
    mixedUnits,
    unitType:
      mixedUnits || !data.length ? undefined : getUsageUnitType(data[0]),
    quantity: mixedUnits
      ? undefined
      : data.reduce((total, item) => total + item.quantity, 0),
    rowCount: data.length,
    inputTokens: sumReported(data, "inputTokens"),
    outputTokens: sumReported(data, "outputTokens"),
    cachedTokens: sumReported(data, "cachedTokens"),
    totalTokens: sumReported(data, "totalTokens"),
  };
}

export function groupBilling(
  data: ServiceData[],
  dimension: BillingDimension,
  splitUnits = false,
): BillingGroup[] {
  const groups = new Map<string, { label: string; data: ServiceData[] }>();
  for (const item of data) {
    const value =
      dimension === "service"
        ? SERVICE_LABELS[getServiceType(item)]
        : item[dimension];
    const key = JSON.stringify([
      !value,
      value ?? null,
      splitUnits ? unitKey(item) : null,
    ]);
    const group = groups.get(key) ?? {
      label: value || "Unattributed",
      data: [],
    };
    group.data.push(item);
    groups.set(key, group);
  }
  return Array.from(groups, ([key, group]) =>
    summarizeGroup(key, group.label, group.data),
  ).sort(
    (first, second) =>
      second.cost - first.cost || first.label.localeCompare(second.label),
  );
}

export function rankWithOther(
  groups: BillingGroup[],
  metric: BillingMetric,
  limit = 6,
): BillingGroup[] {
  if (
    metric === "quantity" &&
    new Set(groups.flatMap((group) => group.data.map(unitKey))).size > 1
  ) {
    throw new Error("Quantity rankings require a single usage unit.");
  }
  const sorted = [...groups].sort(
    (first, second) =>
      (second[metric] ?? 0) - (first[metric] ?? 0) ||
      first.label.localeCompare(second.label),
  );
  const top = sorted.slice(0, limit);
  const tail = sorted.slice(limit);
  if (tail.length)
    top.push(
      summarizeGroup(
        "remainder",
        `Other (${tail.length})`,
        tail.flatMap((group) => group.data),
      ),
    );
  return top;
}

export function rankedDailyData(groups: BillingGroup[], metric: BillingMetric) {
  const series = groups.map((group, index) => ({
    key: `series${index}`,
    label: group.label,
  }));
  const dates = new Map<
    string,
    { date: string; [key: string]: number | string }
  >();
  groups.forEach((group, index) => {
    for (const item of group.data) {
      const day = dates.get(item.date) ?? {
        date: item.date,
        ...Object.fromEntries(series.map((entry) => [entry.key, 0])),
      };
      const key = series[index].key;
      day[key] = Number(day[key]) + item[metric];
      dates.set(item.date, day);
    }
  });
  return {
    series,
    points: Array.from(dates.values()).sort((first, second) =>
      first.date.localeCompare(second.date),
    ),
  };
}

export function summarizeBilling(data: ServiceData[]) {
  const groupedRows = new Map<
    string,
    { unitType: string | undefined; data: ServiceData[] }
  >();
  const organizationCosts = new Map<string, number>();
  for (const item of data) {
    const key = unitKey(item);
    const group = groupedRows.get(key) ?? {
      unitType: getUsageUnitType(item),
      data: [],
    };
    group.data.push(item);
    groupedRows.set(key, group);
    const organization = item.organization || "Unattributed";
    organizationCosts.set(
      organization,
      (organizationCosts.get(organization) ?? 0) + item.cost,
    );
  }
  const unitOrder = ["ai-credits", "user-months", "requests"];
  const unitRank = (unitType: string | undefined) => {
    const index = unitOrder.indexOf(unitType ?? "");
    return index < 0 ? unitOrder.length : index;
  };
  const usageGroups = Array.from(groupedRows.values())
    .sort(
      (first, second) =>
        unitRank(first.unitType) - unitRank(second.unitType) ||
        (first.unitType ?? first.data[0].sku).localeCompare(
          second.unitType ?? second.data[0].sku,
        ),
    )
    .map((group, index) => {
      const daily = new Map<
        string,
        { date: string; quantity: number; cost: number }
      >();
      for (const item of group.data) {
        const day = daily.get(item.date) ?? {
          date: item.date,
          quantity: 0,
          cost: 0,
        };
        day.quantity += item.quantity;
        day.cost += item.cost;
        daily.set(item.date, day);
      }
      return {
        ...group,
        ...summarizeAmounts(group.data),
        key: `unit${index}`,
        quantity: group.data.reduce((total, item) => total + item.quantity, 0),
        dailyData: Array.from(daily.values()).sort((first, second) =>
          first.date.localeCompare(second.date),
        ),
      };
    });
  const dailyCosts = new Map<
    string,
    { date: string; [key: string]: string | number }
  >();
  for (const group of usageGroups) {
    for (const day of group.dailyData) {
      const point = dailyCosts.get(day.date) ?? {
        ...Object.fromEntries(usageGroups.map((entry) => [entry.key, 0])),
        date: day.date,
      };
      point[group.key] = day.cost;
      dailyCosts.set(day.date, point);
    }
  }
  return {
    ...summarizeAmounts(data),
    usageGroups,
    dailyCosts: Array.from(dailyCosts.values()).sort((first, second) =>
      first.date.localeCompare(second.date),
    ),
    skuBreakdown: groupBilling(data, "sku", true).map((group) => ({
      ...group,
      sku: group.label,
      quantity: group.quantity!,
    })),
    organizations: Array.from(organizationCosts, ([organization, cost]) => ({
      organization,
      cost,
    })).sort((first, second) => second.cost - first.cost),
  };
}

export function getBillingTimeline(data: ServiceData[]) {
  const dates = new Map<string, ServiceData[]>();
  for (const item of data) {
    const group = dates.get(item.date) ?? [];
    group.push(item);
    dates.set(item.date, group);
  }
  let cumulative = 0;
  let previous: { date: string; cost: number } | undefined;
  const daily = Array.from(dates)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([date, records]) => {
      const totals = summarizeAmounts(records);
      cumulative += totals.cost;
      const consecutive =
        previous && Date.parse(date) - Date.parse(previous.date) === 86400000;
      const change = consecutive ? totals.cost - previous!.cost : undefined;
      previous = { date, cost: totals.cost };
      return {
        key: date,
        label: date,
        date,
        ...totals,
        cumulative,
        change,
        rowCount: records.length,
        data: records,
      };
    });
  const start = daily[0]?.date;
  const end = daily[daily.length - 1]?.date;
  const spanDays =
    start && end
      ? Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1
      : 0;
  const missingDays = spanDays - daily.length;
  const singleMonth = Boolean(
    start && end && start.slice(0, 7) === end.slice(0, 7),
  );
  const daysInMonth = end
    ? new Date(
        Date.UTC(Number(end.slice(0, 4)), Number(end.slice(5, 7)), 0),
      ).getUTCDate()
    : 0;
  const partialPeriod = Boolean(
    start &&
    end &&
    (start.slice(8) !== "01" ||
      Number(end.slice(8)) !== daysInMonth ||
      missingDays > 0),
  );
  return {
    daily,
    start,
    end,
    spanDays,
    missingDays,
    singleMonth,
    partialPeriod,
    averageReportedDay: daily.length ? cumulative / daily.length : undefined,
    monthlyEstimate:
      singleMonth && missingDays === 0 && spanDays > 0
        ? (cumulative / spanDays) * daysInMonth
        : undefined,
  };
}

export function summarizeCopilotDetails(data: ServiceData[]) {
  const tokenRows = data.filter((item) =>
    TOKEN_FIELDS.some((field) => item[field] !== undefined),
  );
  return {
    hasUsers: data.some((item) => Boolean(item.username)),
    hasModels: data.some((item) => Boolean(item.model)),
    tokenRows: tokenRows.length,
    byUser: groupBilling(data, "username"),
    byModel: groupBilling(data, "model"),
    tokens: Object.fromEntries(
      TOKEN_FIELDS.map((field) => [
        field,
        tokenRows.length ? sumReported(tokenRows, field) : undefined,
      ]),
    ) as Record<TokenField, number | undefined>,
  };
}
