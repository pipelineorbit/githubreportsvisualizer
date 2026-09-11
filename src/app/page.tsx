"use client";

import { useState } from "react";
import { Navigation } from "@/components/ui/Navigation";
import { FileUpload } from "@/components/ui/FileUpload";
import { ServiceChart } from "@/components/charts/ServiceChart";
import { ActionsDetailedBreakdown } from "@/components/charts/ActionsDetailedBreakdown";
import { Tabs } from "@/components/ui/Tabs";
import { DataFilters } from "@/components/ui/DataFilters";
import { FinancialOverview } from "@/components/charts/FinancialOverview";
import { DataProcessor } from "@/lib/dataProcessor";
import { SERVICE_LABELS } from "@/lib/billingAnalytics";
import { Upload } from "lucide-react";
import type {
  GitHubBillingReport,
  ServiceData,
  ServiceType,
} from "@/types/billing";

export default function Home() {
  const [report, setReport] = useState<GitHubBillingReport | null>(null);
  const [filteredRows, setFilteredRows] = useState<ServiceData[]>([]);
  const [breakdown, setBreakdown] = useState<"cost" | "quantity">("cost");
  const [storageUnit, setStorageUnit] = useState<"gb-hours" | "gb-months">(
    "gb-hours",
  );
  const [uploadVersion, setUploadVersion] = useState(0);

  const handleDataLoaded = (loaded: GitHubBillingReport) => {
    const records =
      loaded.records ?? Object.values(loaded.categorizedData ?? {}).flat();
    setReport({ ...loaded, records });
    setFilteredRows(records);
    setBreakdown("cost");
    setStorageUnit("gb-hours");
    setUploadVersion((version) => version + 1);
  };

  const categories = DataProcessor.categorizeServiceData(filteredRows);
  const tabs = report
    ? [
        {
          id: "overview",
          label: "Overview",
          content: (
            <FinancialOverview
              data={filteredRows}
              diagnostics={report.diagnostics}
            />
          ),
        },
        ...(Object.keys(SERVICE_LABELS) as ServiceType[])
          .filter((service) => categories[service].length > 0)
          .map((service) => ({
            id: service,
            label: SERVICE_LABELS[service],
            content: (
              <div className="min-w-0 space-y-8">
                <h2 className="text-xl font-semibold">
                  {SERVICE_LABELS[service]}
                </h2>
                <ServiceChart
                  data={categories[service]}
                  title={SERVICE_LABELS[service]}
                  serviceType={service}
                  breakdown={breakdown}
                  storageUnit={storageUnit}
                />
                {service === "actionsMinutes" &&
                  categories[service].some(
                    (item) => item.workflowPath || item.username,
                  ) && (
                    <ActionsDetailedBreakdown
                      data={categories[service]}
                      breakdown={breakdown}
                      mode={
                        new Set(
                          categories[service]
                            .map((item) => item.repository)
                            .filter(Boolean),
                        ).size === 1
                          ? "full"
                          : "compact"
                      }
                    />
                  )}
              </div>
            ),
          })),
      ]
    : [];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <a
        href="#billing-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-gray-900 focus:p-3 focus:text-sky-300"
      >
        Skip to billing content
      </a>
      <Navigation />
      <main
        id="billing-content"
        className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
      >
        {!report ? (
          <section className="mx-auto max-w-3xl py-8 sm:py-12">
            <h1 className="mb-8 text-3xl font-semibold">
              GitHub Billing Reports
            </h1>
            <FileUpload onDataLoaded={handleDataLoaded} />
          </section>
        ) : (
          <>
            <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold">
                  GitHub Billing Reports
                </h1>
                <p className="mt-1 break-all text-sm text-gray-400">
                  {report.fileName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReport(null);
                  setFilteredRows([]);
                }}
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:border-sky-400 hover:text-white focus-visible:outline-2 focus-visible:outline-sky-400"
              >
                <Upload size={16} aria-hidden="true" />
                Upload New File
              </button>
            </header>
            <DataFilters
              key={uploadVersion}
              data={report.records ?? []}
              onFiltersChange={setFilteredRows}
              onBreakdownChange={setBreakdown}
              onStorageUnitChange={setStorageUnit}
              initialBreakdown="cost"
              serviceType="overview"
            />
            <Tabs key={uploadVersion} tabs={tabs} defaultTab="overview" />
          </>
        )}
      </main>
    </div>
  );
}
