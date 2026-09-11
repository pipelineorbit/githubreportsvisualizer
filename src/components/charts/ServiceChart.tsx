"use client";

import type { ServiceData } from "@/types/billing";
import { CopilotChart } from "@/components/charts/CopilotChart";
import { UnitServiceChart } from "@/components/charts/UnitServiceChart";

interface ServiceChartProps {
  data: ServiceData[];
  title: string;
  serviceType:
    | "actionsMinutes"
    | "actionsStorage"
    | "packages"
    | "copilot"
    | "codespaces"
    | "other";
  useSkuAnalysis?: boolean; // Override to use SKU-based analysis instead of repository-based
  breakdown?: "cost" | "quantity"; // Whether to breakdown by cost or quantity
  hasMultipleOrganizations?: boolean; // Whether to show organization breakdown charts
  storageUnit?: "gb-hours" | "gb-months"; // Unit for displaying storage data
}

export function ServiceChart({
  data,
  title,
  serviceType,
  useSkuAnalysis = false,
  breakdown = "quantity",
  storageUnit = "gb-hours",
}: ServiceChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <p className="text-lg font-medium">No data available</p>
          <p className="text-sm">
            No {title.toLowerCase()} usage found in your billing report
          </p>
        </div>
      </div>
    );
  }

  if (serviceType === "copilot") {
    return <CopilotChart data={data} breakdown={breakdown} />;
  }

  return (
    <UnitServiceChart
      data={data}
      title={title}
      breakdown={breakdown}
      storageUnit={storageUnit}
      initialDimension={
        !useSkuAnalysis && serviceType.startsWith("actions")
          ? "repository"
          : "sku"
      }
    />
  );
}
