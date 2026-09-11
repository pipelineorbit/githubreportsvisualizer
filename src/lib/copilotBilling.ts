import type { ServiceData } from "@/types/billing";

export function getCopilotUnitType(item: ServiceData): string | undefined {
  const reportedUnit = item.unitType?.trim().toLowerCase();
  if (reportedUnit) return reportedUnit;

  switch (item.sku.toLowerCase()) {
    case "copilot_ai_credit":
      return "ai-credits";
    case "copilot_for_business":
    case "copilot_for_enterprise":
      return "user-months";
    case "copilot_premium_request":
    case "copilot_premium_requests":
      return "requests";
    default:
      return undefined;
  }
}

function summarizeAmounts(data: ServiceData[]) {
  const sumReportedAmount = (field: "grossAmount" | "discountAmount") =>
    data.every((item) => item[field] !== undefined)
      ? data.reduce((total, item) => total + item[field]!, 0)
      : undefined;

  return {
    cost: data.reduce((total, item) => total + item.cost, 0),
    grossAmount: sumReportedAmount("grossAmount"),
    discountAmount: sumReportedAmount("discountAmount"),
  };
}

export function summarizeCopilotBilling(data: ServiceData[]) {
  const groupedRows = new Map<
    string,
    { unitType: string | undefined; data: ServiceData[] }
  >();
  const skuRows = new Map<string, ServiceData[]>();
  const organizationCosts = new Map<string, number>();

  for (const item of data) {
    const unitType = getCopilotUnitType(item);
    const groupKey = JSON.stringify([
      unitType ?? null,
      unitType ? null : item.sku,
    ]);
    const group = groupedRows.get(groupKey) ?? { unitType, data: [] };
    group.data.push(item);
    groupedRows.set(groupKey, group);

    const skuKey = JSON.stringify([item.sku, unitType ?? null]);
    const skuGroup = skuRows.get(skuKey) ?? [];
    skuGroup.push(item);
    skuRows.set(skuKey, skuGroup);

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
      const dailyRows = new Map<
        string,
        { date: string; quantity: number; cost: number }
      >();

      for (const item of group.data) {
        const day = dailyRows.get(item.date) ?? {
          date: item.date,
          quantity: 0,
          cost: 0,
        };
        day.quantity += item.quantity;
        day.cost += item.cost;
        dailyRows.set(item.date, day);
      }

      return {
        ...group,
        ...summarizeAmounts(group.data),
        key: `unit${index}`,
        quantity: group.data.reduce((total, item) => total + item.quantity, 0),
        dailyData: Array.from(dailyRows.values()).sort((first, second) =>
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
    skuBreakdown: Array.from(skuRows.entries())
      .map(([key, items]) => ({
        key,
        sku: items[0].sku,
        unitType: getCopilotUnitType(items[0]),
        quantity: items.reduce((total, item) => total + item.quantity, 0),
        ...summarizeAmounts(items),
      }))
      .sort(
        (first, second) =>
          second.cost - first.cost || first.sku.localeCompare(second.sku),
      ),
    organizations: Array.from(organizationCosts, ([organization, cost]) => ({
      organization,
      cost,
    })).sort((first, second) => second.cost - first.cost),
  };
}
