"use client";

import { useState, useCallback } from "react";
import { Navigation } from "@/components/ui/Navigation";
import { FileUpload } from "@/components/ui/FileUpload";
import { BillingChart } from "@/components/charts/BillingChart";
import { ServiceChart } from "@/components/charts/ServiceChart";
import { ActionsDetailedBreakdown } from "@/components/charts/ActionsDetailedBreakdown";
import { Tabs } from "@/components/ui/Tabs";
import { DataFilters } from "@/components/ui/DataFilters";
import {
  GitHubBillingReport,
  BillingData,
  CategorizedBillingData,
  ServiceData,
} from "@/types/billing";

const sampleBillingData: BillingData[] = [
  { month: "Jan", actions: 120, packages: 80, storage: 40 },
  { month: "Feb", actions: 150, packages: 90, storage: 45 },
  { month: "Mar", actions: 180, packages: 110, storage: 50 },
  { month: "Apr", actions: 220, packages: 130, storage: 55 },
  { month: "May", actions: 190, packages: 120, storage: 48 },
  { month: "Jun", actions: 250, packages: 140, storage: 60 },
];

export default function Home() {
  const [billingData, setBillingData] =
    useState<BillingData[]>(sampleBillingData);
  const [categorizedData, setCategorizedData] =
    useState<CategorizedBillingData | null>(null);
  const [filteredData, setFilteredData] =
    useState<CategorizedBillingData | null>(null);
  const [hasUploadedData, setHasUploadedData] = useState(false);
  const [breakdown, setBreakdown] = useState<
    Record<string, "cost" | "quantity">
  >({
    actionsMinutes: "quantity",
    actionsStorage: "quantity",
    packages: "quantity",
    copilot: "quantity",
    codespaces: "quantity",
  });
  const [storageUnit, setStorageUnit] = useState<
    Record<string, "gb-hours" | "gb-months">
  >({
    actionsStorage: "gb-hours",
    packages: "gb-hours",
  });

  const handleDataLoaded = (report: GitHubBillingReport) => {
    setBillingData(report.data);
    setCategorizedData(report.categorizedData || null);
    setFilteredData(report.categorizedData || null);
    setHasUploadedData(true);
  };

  const handleFiltersChange = useCallback(
    (
      serviceType: keyof CategorizedBillingData,
      filteredServiceData: ServiceData[],
    ) => {
      setFilteredData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          [serviceType]: filteredServiceData,
        };
      });
    },
    [],
  );

  const handleBreakdownChange = useCallback(
    (serviceType: string, newBreakdown: "cost" | "quantity") => {
      setBreakdown((prev) => ({
        ...prev,
        [serviceType]: newBreakdown,
      }));
    },
    [],
  );

  const handleStorageUnitChange = useCallback(
    (serviceType: string, newUnit: "gb-hours" | "gb-months") => {
      setStorageUnit((prev) => ({
        ...prev,
        [serviceType]: newUnit,
      }));
    },
    [],
  );

  // Memoized breakdown change handlers to prevent re-renders
  const handleActionsMinutesBreakdownChange = useCallback(
    (newBreakdown: "cost" | "quantity") => {
      handleBreakdownChange("actionsMinutes", newBreakdown);
    },
    [handleBreakdownChange],
  );

  const handleActionsStorageBreakdownChange = useCallback(
    (newBreakdown: "cost" | "quantity") => {
      handleBreakdownChange("actionsStorage", newBreakdown);
    },
    [handleBreakdownChange],
  );

  const handlePackagesBreakdownChange = useCallback(
    (newBreakdown: "cost" | "quantity") => {
      handleBreakdownChange("packages", newBreakdown);
    },
    [handleBreakdownChange],
  );

  const handleActionsStorageUnitChange = useCallback(
    (newUnit: "gb-hours" | "gb-months") => {
      handleStorageUnitChange("actionsStorage", newUnit);
    },
    [handleStorageUnitChange],
  );

  const handlePackagesUnitChange = useCallback(
    (newUnit: "gb-hours" | "gb-months") => {
      handleStorageUnitChange("packages", newUnit);
    },
    [handleStorageUnitChange],
  );

  // Create tabs based on available data
  const createTabs = () => {
    if (!categorizedData || !filteredData) {
      return [
        {
          id: "overview",
          label: "Sample Overview",
          content: (
            <BillingChart
              data={billingData}
              title="Sample GitHub Billing Visualization"
            />
          ),
        },
      ];
    }

    return [
      {
        id: "actionsMinutes",
        label: "Actions Minutes",
        content: (
          <div>
            <DataFilters
              data={categorizedData.actionsMinutes}
              onFiltersChange={(filtered) =>
                handleFiltersChange("actionsMinutes", filtered)
              }
              onBreakdownChange={handleActionsMinutesBreakdownChange}
              serviceType="actionsMinutes"
            />
            <ServiceChart
              data={filteredData.actionsMinutes}
              title="GitHub Actions Minutes"
              serviceType="actionsMinutes"
              breakdown={breakdown.actionsMinutes}
              useSkuAnalysis={(() => {
                // Use SKU analysis when all organizations are shown (no organization filter applied)
                const originalOrgs = new Set(
                  categorizedData.actionsMinutes
                    .map((item) => item.organization)
                    .filter(Boolean),
                );
                const filteredOrgs = new Set(
                  filteredData.actionsMinutes
                    .map((item) => item.organization)
                    .filter(Boolean),
                );
                return (
                  originalOrgs.size === filteredOrgs.size &&
                  originalOrgs.size > 1
                );
              })()}
            />
            {(categorizedData.actionsMinutes.some(
              (d) => d.workflowPath || d.username,
            ) ||
              filteredData.actionsMinutes.some(
                (d) => d.workflowPath || d.username,
              )) && (
              <ActionsDetailedBreakdown
                data={filteredData.actionsMinutes}
                breakdown={breakdown.actionsMinutes}
                mode={
                  new Set(
                    filteredData.actionsMinutes
                      .map((d) => d.repository)
                      .filter(Boolean),
                  ).size === 1
                    ? "full"
                    : "compact"
                }
              />
            )}
          </div>
        ),
      },
      {
        id: "actionsStorage",
        label: "Actions Storage",
        content: (
          <div>
            <DataFilters
              data={categorizedData.actionsStorage}
              onFiltersChange={(filtered) =>
                handleFiltersChange("actionsStorage", filtered)
              }
              onBreakdownChange={handleActionsStorageBreakdownChange}
              onStorageUnitChange={handleActionsStorageUnitChange}
              serviceType="actionsStorage"
            />
            <ServiceChart
              data={filteredData.actionsStorage}
              title="GitHub Actions Storage"
              serviceType="actionsStorage"
              breakdown={breakdown.actionsStorage}
              storageUnit={storageUnit.actionsStorage}
            />
          </div>
        ),
      },
      {
        id: "packages",
        label: "Packages",
        content: (
          <div>
            <DataFilters
              data={categorizedData.packages}
              onFiltersChange={(filtered) =>
                handleFiltersChange("packages", filtered)
              }
              onBreakdownChange={handlePackagesBreakdownChange}
              onStorageUnitChange={handlePackagesUnitChange}
              serviceType="packages"
            />
            <ServiceChart
              data={filteredData.packages}
              title="GitHub Packages"
              serviceType="packages"
              breakdown={breakdown.packages}
              storageUnit={storageUnit.packages}
            />
          </div>
        ),
      },
      {
        id: "copilot",
        label: "Copilot",
        content: (
          <div>
            <DataFilters
              data={categorizedData.copilot}
              onFiltersChange={(filtered) =>
                handleFiltersChange("copilot", filtered)
              }
              serviceType="copilot"
            />
            <ServiceChart
              data={filteredData.copilot}
              title="GitHub Copilot"
              serviceType="copilot"
            />
          </div>
        ),
      },
      {
        id: "codespaces",
        label: "Codespaces",
        content: (
          <div>
            <DataFilters
              data={categorizedData.codespaces}
              onFiltersChange={(filtered) =>
                handleFiltersChange("codespaces", filtered)
              }
              serviceType="codespaces"
            />
            <ServiceChart
              data={filteredData.codespaces}
              title="GitHub Codespaces"
              serviceType="codespaces"
            />
          </div>
        ),
      },
    ].filter((tab) => {
      // Only show tabs with data
      switch (tab.id) {
        case "actionsMinutes":
          return categorizedData.actionsMinutes.length > 0;
        case "actionsStorage":
          return categorizedData.actionsStorage.length > 0;
        case "packages":
          return categorizedData.packages.length > 0;
        case "copilot":
          return categorizedData.copilot.length > 0;
        case "codespaces":
          return categorizedData.codespaces.length > 0;
        default:
          return true;
      }
    });
  };

  const tabs = createTabs();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navigation />

      {/* Main Content */}
      <section className="relative py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {!hasUploadedData ? (
            /* Landing Content - Only shown when no data is uploaded */
            <div className="text-center">
              <h1 className="text-5xl md:text-7xl font-bold mb-8 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                Understand Your
                <br />
                <span className="bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
                  GitHub Costs
                </span>
              </h1>

              <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
                Upload your GitHub billing report to visualize spending patterns
                and optimize costs across all services.
                <br />
                <span className="text-sm text-gray-500 mt-2 block">
                  Your data is processed locally and not stored on our servers.
                </span>
              </p>

              {/* File Upload */}
              <div className="mb-16">
                <FileUpload onDataLoaded={handleDataLoaded} />
              </div>
            </div>
          ) : (
            /* Analysis Content - Shown after upload */
            <div>
              {/* Back Button */}
              <div className="mb-8">
                <button
                  onClick={() => {
                    setHasUploadedData(false);
                    setCategorizedData(null);
                    setFilteredData(null);
                    setBillingData(sampleBillingData);
                  }}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800/50 border border-gray-600 rounded-lg hover:bg-gray-700/50 hover:border-gray-500 transition-colors"
                >
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                  Upload New File
                </button>
              </div>

              {/* Full Width Visualization */}
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-2">Service Breakdown</h2>
                  <p className="text-gray-400">
                    Detailed cost and usage analysis by GitHub service
                  </p>
                </div>
                <Tabs tabs={tabs} defaultTab="actionsMinutes" />
              </div>
            </div>
          )}
        </div>

        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-green-500/10 rounded-full blur-3xl"></div>
          <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
        </div>
      </section>
    </div>
  );
}
