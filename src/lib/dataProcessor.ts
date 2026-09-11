import type {
  CategorizedBillingData,
  ServiceData,
  ServiceType,
} from "@/types/billing";

export function getServiceType(item: ServiceData): ServiceType {
  const sku = item.sku.toLowerCase();
  const product = item.product?.toLowerCase() || sku.split("_")[0];
  const unit = item.unitType?.toLowerCase();

  if (product === "actions") {
    if (
      ["gigabyte-hours", "gigabyte-months", "gb-hours", "gb-months"].includes(
        unit ?? "",
      )
    )
      return "actionsStorage";
    if (unit === "minutes") return "actionsMinutes";
    if (sku.includes("storage")) return "actionsStorage";
    if (/^actions_(linux|windows|macos|self_hosted)(_|$)/.test(sku))
      return "actionsMinutes";
    return "other";
  }
  if (
    product === "copilot" ||
    product === "packages" ||
    product === "codespaces"
  )
    return product;
  return "other";
}

/**
 * Memory-efficient data aggregation utilities
 */

export interface ProcessingOptions {
  maxDataPoints?: number; // Limit data points for performance
  chunkSize?: number; // Process data in chunks
}

export class DataProcessor {
  private static readonly DEFAULT_MAX_DATA_POINTS = 1000;
  private static readonly DEFAULT_CHUNK_SIZE = 5000;

  /**
   * Efficiently aggregate data by date with memory optimization
   */
  static aggregateByDate(
    data: ServiceData[],
    options: ProcessingOptions = {},
  ): Record<string, any> {
    const {
      maxDataPoints = this.DEFAULT_MAX_DATA_POINTS,
      chunkSize = this.DEFAULT_CHUNK_SIZE,
    } = options;

    // Sort data by date to enable efficient sampling
    const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date));

    // If data is too large, sample it intelligently
    const sampledData =
      sortedData.length > maxDataPoints
        ? this.sampleData(sortedData, maxDataPoints)
        : sortedData;

    const aggregated: Record<string, any> = {};

    // Process in chunks to avoid blocking the main thread
    for (let i = 0; i < sampledData.length; i += chunkSize) {
      const chunk = sampledData.slice(i, i + chunkSize);

      chunk.forEach((item) => {
        const date = item.date;
        if (!aggregated[date]) {
          aggregated[date] = {
            date,
            cost: 0,
            quantity: 0,
            repositories: new Set<string>(),
            organizations: new Set<string>(),
            skus: new Set<string>(),
          };
        }

        aggregated[date].cost += item.cost;
        aggregated[date].quantity += item.quantity;

        if (item.repository) aggregated[date].repositories.add(item.repository);
        if (item.organization)
          aggregated[date].organizations.add(item.organization);
        aggregated[date].skus.add(item.sku);
      });
    }

    // Convert Sets to counts for memory efficiency
    Object.values(aggregated).forEach((item: any) => {
      item.repositoryCount = item.repositories.size;
      item.organizationCount = item.organizations.size;
      item.skuCount = item.skus.size;
      delete item.repositories;
      delete item.organizations;
      delete item.skus;
    });

    return aggregated;
  }

  /**
   * Intelligently sample large datasets while preserving trends
   */
  private static sampleData(
    data: ServiceData[],
    targetSize: number,
  ): ServiceData[] {
    if (data.length <= targetSize) return data;

    const step = Math.ceil(data.length / targetSize);
    const sampled: ServiceData[] = [];

    for (let i = 0; i < data.length; i += step) {
      sampled.push(data[i]);
    }

    return sampled;
  }

  /**
   * Get top N items by metric with efficient sorting
   */
  static getTopItems<T extends Record<string, any>>(
    items: T[],
    sortKey: keyof T,
    limit: number = 10,
  ): T[] {
    // Use partial sort for better performance with large datasets
    return items
      .sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number))
      .slice(0, limit);
  }

  /**
   * Efficient filtering with early termination
   */
  static filterData(
    data: ServiceData[],
    filters: {
      startDate?: string;
      endDate?: string;
      organization?: string;
      repository?: string;
      costCenter?: string;
    },
  ): ServiceData[] {
    const { startDate, endDate, organization, repository, costCenter } =
      filters;

    return data.filter((item) => {
      // Date filtering (most selective first)
      if (startDate && item.date < startDate) return false;
      if (endDate && item.date > endDate) return false;

      // String filtering with exact matches for performance
      if (
        organization &&
        organization !== "all" &&
        item.organization !== organization
      )
        return false;
      if (repository && repository !== "all" && item.repository !== repository)
        return false;
      if (costCenter && costCenter !== "all" && item.costCenter !== costCenter)
        return false;

      return true;
    });
  }

  /**
   * Memory-efficient unique value extraction
   */
  static getUniqueValues(
    data: ServiceData[],
    field: keyof ServiceData,
  ): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const item of data) {
      const value = item[field] as string;
      if (value && !seen.has(value)) {
        seen.add(value);
        result.push(value);
      }
    }

    return result.sort();
  }

  /**
   * Optimized data categorization
   */
  static categorizeServiceData(data: ServiceData[]): CategorizedBillingData {
    const categories: CategorizedBillingData = {
      actionsMinutes: [],
      actionsStorage: [],
      packages: [],
      copilot: [],
      codespaces: [],
      other: [],
    };

    data.forEach((item) => {
      categories[getServiceType(item)].push(item);
    });

    return categories;
  }

  /**
   * Efficient repository-based aggregation for large datasets
   */
  static aggregateByRepository(
    data: ServiceData[],
    topN: number = 10,
    breakdown: "cost" | "quantity" = "quantity",
  ): {
    topRepos: string[];
    repoTotals: Record<string, { cost: number; quantity: number }>;
    dailyData: Record<string, any>;
  } {
    // First pass: calculate repository totals
    const repoTotals: Record<string, { cost: number; quantity: number }> = {};

    data.forEach((item) => {
      const repo = item.repository || "Unknown";
      if (!repoTotals[repo]) {
        repoTotals[repo] = { cost: 0, quantity: 0 };
      }
      repoTotals[repo].cost += item.cost;
      repoTotals[repo].quantity += item.quantity;
    });

    // Get top repositories
    const topRepos = Object.entries(repoTotals)
      .sort(([, a], [, b]) =>
        breakdown === "cost" ? b.cost - a.cost : b.quantity - a.quantity,
      )
      .slice(0, topN)
      .map(([repo]) => repo);

    // Second pass: aggregate daily data
    const dailyData: Record<string, any> = {};

    data.forEach((item) => {
      const date = item.date;
      const repo = topRepos.includes(item.repository || "Unknown")
        ? item.repository || "Unknown"
        : "Others";

      if (!dailyData[date]) {
        dailyData[date] = { date, total: 0, totalQuantity: 0 };
        topRepos.forEach((r) => {
          dailyData[date][r] = 0;
          dailyData[date][`${r}_quantity`] = 0;
        });
        dailyData[date]["Others"] = 0;
        dailyData[date]["Others_quantity"] = 0;
      }

      dailyData[date][repo] = (dailyData[date][repo] || 0) + item.cost;
      dailyData[date][`${repo}_quantity`] =
        (dailyData[date][`${repo}_quantity`] || 0) + item.quantity;
      dailyData[date].total += item.cost;
      dailyData[date].totalQuantity += item.quantity;
    });

    return { topRepos, repoTotals, dailyData };
  }
}
