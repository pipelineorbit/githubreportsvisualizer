import { useState, useEffect, useMemo, useId } from "react";
import { RotateCcw } from "lucide-react";
import type { ServiceData, ServiceType } from "@/types/billing";
import { getServiceType } from "@/lib/dataProcessor";
import { getUsageUnitType, SERVICE_LABELS } from "@/lib/billingAnalytics";

interface DataFiltersProps {
  data: ServiceData[];
  onFiltersChange: (filteredData: ServiceData[]) => void;
  onBreakdownChange?: (breakdown: "cost" | "quantity") => void;
  initialBreakdown?: "cost" | "quantity";
  onStorageUnitChange?: (unit: "gb-hours" | "gb-months") => void;
  serviceType?: ServiceType | "overview";
}

interface FilterState {
  dateRange: {
    start: string;
    end: string;
  };
  organization: string;
  costCenter: string;
  repository: string;
  service: string;
  sku: string;
  username: string;
  model: string;
  breakdown: "cost" | "quantity";
  storageUnit: "gb-hours" | "gb-months";
}

export function DataFilters({
  data,
  onFiltersChange,
  onBreakdownChange,
  initialBreakdown,
  onStorageUnitChange,
  serviceType,
}: DataFiltersProps) {
  const filterId = useId();
  const defaultBreakdown =
    serviceType === "copilot" || serviceType === "overview"
      ? "cost"
      : "quantity";
  const dates = data.map((item) => item.date).sort();
  const minDate = dates[0] || "";
  const maxDate = dates[dates.length - 1] || "";
  const [filters, setFilters] = useState<FilterState>({
    dateRange: { start: minDate, end: maxDate },
    organization: "",
    costCenter: "",
    repository: "",
    service: "",
    sku: "",
    username: "",
    model: "",
    breakdown: initialBreakdown ?? defaultBreakdown,
    storageUnit: "gb-hours",
  });

  // Get unique values for dropdowns
  const organizations = Array.from(
    new Set(data.map((item) => item.organization).filter(Boolean)),
  ).sort();
  const costCenters = Array.from(
    new Set(data.map((item) => item.costCenter).filter(Boolean)),
  ).sort();

  // Filter repositories based on selected organization
  const repositories = useMemo(() => {
    if (!filters.organization) {
      // If no organization selected, show ALL repositories
      return Array.from(
        new Set(data.map((item) => item.repository).filter(Boolean)),
      ).sort();
    }
    // Only show repositories from the selected organization
    return Array.from(
      new Set(
        data
          .filter((item) =>
            filters.organization === "__unattributed__"
              ? !item.organization
              : item.organization === filters.organization,
          )
          .map((item) => item.repository)
          .filter(Boolean),
      ),
    ).sort();
  }, [data, filters.organization]);

  const matches = (actual: string | undefined, selected: string) =>
    !selected ||
    (selected === "__unattributed__" ? !actual : actual === selected);

  // Calculate filtered data
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // Date range filter
      if (filters.dateRange.start && item.date < filters.dateRange.start)
        return false;
      if (filters.dateRange.end && item.date > filters.dateRange.end)
        return false;

      // Organization filter
      if (!matches(item.organization, filters.organization)) return false;

      // Cost center filter
      if (!matches(item.costCenter, filters.costCenter)) return false;

      // Repository filter
      if (!matches(item.repository, filters.repository)) return false;

      if (filters.service && getServiceType(item) !== filters.service)
        return false;
      if (filters.sku && item.sku !== filters.sku) return false;
      if (
        !matches(item.username, filters.username) ||
        !matches(item.model, filters.model)
      )
        return false;

      return true;
    });
  }, [
    data,
    filters.dateRange,
    filters.organization,
    filters.costCenter,
    filters.repository,
    filters.service,
    filters.sku,
    filters.username,
    filters.model,
  ]);

  // Apply filters whenever filteredData changes
  useEffect(() => {
    onFiltersChange(filteredData);
  }, [filteredData, onFiltersChange]);

  // Notify parent of breakdown changes
  useEffect(() => {
    if (onBreakdownChange) {
      onBreakdownChange(filters.breakdown);
    }
  }, [filters.breakdown, onBreakdownChange]);

  // Notify parent of storage unit changes
  useEffect(() => {
    if (onStorageUnitChange) {
      onStorageUnitChange(filters.storageUnit);
    }
  }, [filters.storageUnit, onStorageUnitChange]);

  const handleFilterChange = (
    key: string,
    value: string | { start: string; end: string },
  ) => {
    setFilters((prev) => {
      // Reset repository when organization changes
      if (key === "organization" && typeof value === "string") {
        return {
          ...prev,
          organization: value,
          repository: "", // Clear repository selection when org changes
        };
      }
      if (key === "service" && typeof value === "string")
        return { ...prev, service: value, sku: "" };
      return {
        ...prev,
        [key]: value,
      };
    });
  };

  const resetFilters = () => {
    setFilters({
      dateRange: { start: minDate, end: maxDate },
      organization: "",
      costCenter: "",
      repository: "",
      service: "",
      sku: "",
      username: "",
      model: "",
      breakdown: defaultBreakdown,
      storageUnit: "gb-hours",
    });
  };

  const hasActiveFilters =
    filters.organization ||
    filters.costCenter ||
    filters.repository ||
    filters.service ||
    filters.sku ||
    filters.username ||
    filters.model ||
    filters.breakdown !== defaultBreakdown ||
    filters.storageUnit !== "gb-hours" ||
    filters.dateRange.start !== minDate ||
    filters.dateRange.end !== maxDate;

  // Show breakdown selector for relevant service types
  const showBreakdownSelector = Boolean(onBreakdownChange);

  // Show storage unit selector for storage-related services
  const showStorageUnitSelector =
    Boolean(onStorageUnitChange) &&
    data.some((item) => getUsageUnitType(item) === "gigabyte-hours");

  // Calculate grid columns based on visible filters
  const gridCols = "lg:grid-cols-4";

  return (
    <section
      aria-label="Report filters"
      className="border-y border-gray-800 py-5 mb-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="inline-flex min-h-9 items-center gap-2 rounded text-sm text-blue-400 hover:text-blue-300 focus-visible:outline-2 focus-visible:outline-sky-400 transition-colors"
          >
            <RotateCcw size={14} aria-hidden="true" />
            Reset Filters
          </button>
        )}
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${gridCols} gap-4`}>
        {/* Date Range */}
        <div className="space-y-2">
          <p className="text-sm text-gray-400">Date Range</p>
          <div className="space-y-2">
            <input
              type="date"
              aria-label="Start date"
              value={filters.dateRange.start}
              min={minDate}
              max={maxDate}
              onChange={(e) =>
                handleFilterChange("dateRange", {
                  ...filters.dateRange,
                  start: e.target.value,
                })
              }
              className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="date"
              aria-label="End date"
              value={filters.dateRange.end}
              min={minDate}
              max={maxDate}
              onChange={(e) =>
                handleFilterChange("dateRange", {
                  ...filters.dateRange,
                  end: e.target.value,
                })
              }
              className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Organization */}
        <div className="space-y-2">
          <label
            htmlFor={`${filterId}-organization`}
            className="text-sm text-gray-400"
          >
            Organization
          </label>
          <select
            id={`${filterId}-organization`}
            value={filters.organization}
            onChange={(e) => handleFilterChange("organization", e.target.value)}
            className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Organizations</option>
            {data.some((item) => !item.organization) && (
              <option value="__unattributed__">Unattributed</option>
            )}
            {organizations.map((org) => (
              <option key={org} value={org}>
                {org}
              </option>
            ))}
          </select>
        </div>

        {/* Cost Center */}
        <div className="space-y-2">
          <label
            htmlFor={`${filterId}-cost-center`}
            className="text-sm text-gray-400"
          >
            Cost Center
          </label>
          <select
            id={`${filterId}-cost-center`}
            value={filters.costCenter}
            onChange={(e) => handleFilterChange("costCenter", e.target.value)}
            className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Cost Centers</option>
            {data.some((item) => !item.costCenter) && (
              <option value="__unattributed__">Unattributed</option>
            )}
            {costCenters.map((cc) => (
              <option key={cc} value={cc}>
                {cc}
              </option>
            ))}
          </select>
        </div>

        {/* Repository */}
        <div className="space-y-2">
          <label
            htmlFor={`${filterId}-repository`}
            className="text-sm text-gray-400"
          >
            Repository
          </label>
          <select
            id={`${filterId}-repository`}
            value={filters.repository}
            onChange={(e) => handleFilterChange("repository", e.target.value)}
            className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">
              {filters.organization
                ? `All Repositories in ${filters.organization}`
                : "All Repositories"}
            </option>
            {data.some((item) => !item.repository) && (
              <option value="__unattributed__">Unattributed</option>
            )}
            {repositories.map((repo) => (
              <option key={repo} value={repo}>
                {repo}
              </option>
            ))}
          </select>
        </div>

        {/* Breakdown Selector */}
        {serviceType === "overview" && (
          <div className="space-y-2">
            <label
              htmlFor={`${filterId}-service`}
              className="text-sm text-gray-400"
            >
              Service
            </label>
            <select
              id={`${filterId}-service`}
              value={filters.service}
              onChange={(event) =>
                handleFilterChange("service", event.target.value)
              }
              className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-sky-400"
            >
              <option value="">All Services</option>
              {Array.from(new Set(data.map(getServiceType))).map((service) => (
                <option key={service} value={service}>
                  {SERVICE_LABELS[service]}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-2">
          <label htmlFor={`${filterId}-sku`} className="text-sm text-gray-400">
            SKU
          </label>
          <select
            id={`${filterId}-sku`}
            value={filters.sku}
            onChange={(event) => handleFilterChange("sku", event.target.value)}
            className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            <option value="">All SKUs</option>
            {Array.from(
              new Set(
                data
                  .filter(
                    (item) =>
                      !filters.service ||
                      getServiceType(item) === filters.service,
                  )
                  .map((item) => item.sku),
              ),
            )
              .sort()
              .map((sku) => (
                <option key={sku} value={sku}>
                  {sku}
                </option>
              ))}
          </select>
        </div>
        {(["username", "model"] as const)
          .filter((field) => data.some((item) => item[field]))
          .map((field) => (
            <div key={field} className="space-y-2">
              <label
                htmlFor={`${filterId}-${field}`}
                className="text-sm text-gray-400"
              >
                {field === "username" ? "User" : "Model"}
              </label>
              <select
                id={`${filterId}-${field}`}
                value={filters[field]}
                onChange={(event) =>
                  handleFilterChange(field, event.target.value)
                }
                className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-sky-400"
              >
                <option value="">
                  {field === "username" ? "All Users" : "All Models"}
                </option>
                {data.some((item) => !item[field]) && (
                  <option value="__unattributed__">Unattributed</option>
                )}
                {Array.from(
                  new Set(data.map((item) => item[field]).filter(Boolean)),
                )
                  .sort()
                  .map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
              </select>
            </div>
          ))}
        {showBreakdownSelector && (
          <div className="space-y-2">
            <p className="text-sm text-gray-400">Breakdown By</p>
            <div
              role="group"
              aria-label="Breakdown By"
              className="flex min-h-10 rounded-md border border-gray-600 p-1"
            >
              {(["cost", "quantity"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={filters.breakdown === mode}
                  onClick={() => handleFilterChange("breakdown", mode)}
                  className={`min-w-0 flex-1 rounded px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-sky-400 ${filters.breakdown === mode ? "bg-gray-600 text-white" : "text-gray-400 hover:text-white"}`}
                >
                  {mode === "cost" ? "Cost ($)" : "Usage Volume"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Storage Unit Selector */}
        {showStorageUnitSelector && (
          <div className="space-y-2">
            <label
              htmlFor={`${filterId}-storage-unit`}
              className="text-sm text-gray-400"
            >
              Storage Unit
            </label>
            <select
              id={`${filterId}-storage-unit`}
              value={filters.storageUnit}
              onChange={(e) =>
                handleFilterChange(
                  "storageUnit",
                  e.target.value as "gb-hours" | "gb-months",
                )
              }
              className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="gb-hours">GB-Hours</option>
              <option value="gb-months">GB-Months (730h)</option>
            </select>
          </div>
        )}
      </div>
      {filters.dateRange.start &&
        filters.dateRange.end &&
        filters.dateRange.start > filters.dateRange.end && (
          <p role="alert" className="mt-3 text-sm text-amber-300">
            Start date must be on or before end date.
          </p>
        )}
      <p role="status" className="mt-3 text-sm text-gray-500">
        {filteredData.length.toLocaleString()} of {data.length.toLocaleString()}{" "}
        accepted records
      </p>
    </section>
  );
}
