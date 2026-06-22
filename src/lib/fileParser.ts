import {
  BillingData,
  GitHubBillingReport,
  FileUploadResult,
  CategorizedBillingData,
  ServiceData,
} from "@/types/billing";

/**
 * Normalize a date string to ISO format (YYYY-MM-DD) so downstream
 * sorting and month-key extraction (substring(0,7)) work uniformly.
 * Accepts already-ISO dates and US-style M/D/YY or M/D/YYYY.
 */
function normalizeDate(raw: string): string {
  if (!raw) return raw;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const m = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const month = m[1].padStart(2, "0");
    const day = m[2].padStart(2, "0");
    let year = m[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }
  return trimmed;
}

export function parseCSV(csvContent: string): {
  data: BillingData[];
  categorizedData: CategorizedBillingData;
} {
  const lines = csvContent.trim().split("\n");

  if (lines.length < 2) {
    throw new Error("CSV file appears to be empty or invalid");
  }

  // Parse header
  const header = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());

  // Find column indices (flexible matching)
  const dateIndex = header.findIndex((h) => h.toLowerCase().includes("date"));
  const productIndex = header.findIndex((h) =>
    h.toLowerCase().includes("product"),
  );
  const skuIndex = header.findIndex((h) => h.toLowerCase().includes("sku"));
  const quantityIndex = header.findIndex((h) =>
    h.toLowerCase().includes("quantity"),
  );
  const netAmountIndex = header.findIndex((h) =>
    h.toLowerCase().includes("net_amount"),
  );
  const organizationIndex = header.findIndex((h) =>
    h.toLowerCase().includes("organization"),
  );
  const repositoryIndex = header.findIndex((h) =>
    h.toLowerCase().includes("repository"),
  );
  const costCenterIndex = header.findIndex(
    (h) =>
      h.toLowerCase().includes("cost_center") ||
      h.toLowerCase().includes("costcenter"),
  );
  const usernameIndex = header.findIndex((h) => {
    const k = h.toLowerCase();
    return k === "username" || k === "user_login" || k === "user";
  });
  const workflowPathIndex = header.findIndex((h) => {
    const k = h.toLowerCase().replace(/[^a-z]/g, "");
    return k === "workflowpath" || k === "workflow";
  });

  const categorizedData: CategorizedBillingData = {
    actionsMinutes: [],
    actionsStorage: [],
    packages: [],
    copilot: [],
    codespaces: [],
  };

  // Parse data rows
  lines.slice(1).forEach((line, index) => {
    try {
      const values = line.split(",").map((v) => v.replace(/"/g, "").trim());

      if (values.length < header.length) return; // Skip incomplete rows

      const date = normalizeDate(values[dateIndex]);
      const product = values[productIndex];
      const sku = values[skuIndex];
      const quantity = parseFloat(values[quantityIndex]) || 0;
      const netAmount = parseFloat(values[netAmountIndex]) || 0;
      const organization = values[organizationIndex] || "";
      const repository = values[repositoryIndex] || "";
      const costCenter = values[costCenterIndex] || "";
      const username = usernameIndex >= 0 ? values[usernameIndex] || "" : "";
      const workflowPath =
        workflowPathIndex >= 0 ? values[workflowPathIndex] || "" : "";

      if (!date || !product || !sku) return; // Skip rows with missing essential data

      const serviceData: ServiceData = {
        date,
        cost: netAmount,
        quantity,
        sku,
        organization,
        repository,
        costCenter,
        username,
        workflowPath,
      };

      const normalizedSku = sku.toLowerCase();

      // Categorize by product and sku
      switch (product.toLowerCase()) {
        case "actions":
          if (normalizedSku === "actions_storage") {
            categorizedData.actionsStorage.push(serviceData);
          } else if (
            normalizedSku.includes("linux") ||
            normalizedSku.includes("windows") ||
            normalizedSku.includes("macos") ||
            normalizedSku.includes("self_hosted")
          ) {
            categorizedData.actionsMinutes.push(serviceData);
          }
          break;
        case "packages":
          categorizedData.packages.push(serviceData);
          break;
        case "copilot":
          categorizedData.copilot.push(serviceData);
          break;
        case "codespaces":
          categorizedData.codespaces.push(serviceData);
          break;
      }
    } catch (error) {
      console.warn(`Error parsing row ${index + 2}:`, error);
    }
  });

  // Create summary data for backward compatibility
  const monthlyData = new Map<
    string,
    { actions: number; packages: number; storage: number }
  >();

  // Aggregate by month
  Object.values(categorizedData)
    .flat()
    .forEach((item) => {
      const monthKey = item.date.substring(0, 7); // YYYY-MM format
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { actions: 0, packages: 0, storage: 0 });
      }

      const monthData = monthlyData.get(monthKey)!;

      // Categorize costs for the summary
      if (categorizedData.actionsMinutes.includes(item)) {
        monthData.actions += item.cost;
      } else if (categorizedData.packages.includes(item)) {
        monthData.packages += item.cost;
      } else if (categorizedData.actionsStorage.includes(item)) {
        monthData.storage += item.cost;
      }
    });

  const data = Array.from(monthlyData.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, values]) => ({
      month: new Date(month + "-01").toLocaleDateString("en-US", {
        month: "short",
      }),
      ...values,
      total: values.actions + values.packages + values.storage,
    }));

  return { data, categorizedData };
}

export async function processFile(file: File): Promise<FileUploadResult> {
  try {
    const content = await file.text();
    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    if (fileExtension !== "csv") {
      return {
        success: false,
        error: "Invalid file format. Please upload a CSV file.",
      };
    }

    const { data, categorizedData } = parseCSV(content);

    if (data.length === 0) {
      return {
        success: false,
        error: "No billing data found in the CSV file.",
      };
    }

    // Determine date range from categorized data
    const allDates = Object.values(categorizedData)
      .flat()
      .map((item) => item.date)
      .sort();
    const startDate = allDates[0] || "";
    const endDate = allDates[allDates.length - 1] || "";

    // Get primary organization
    const organizations = Object.values(categorizedData)
      .flat()
      .map((item) => item.organization)
      .filter((org) => org)
      .reduce(
        (acc, org) => {
          acc[org] = (acc[org] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

    const primaryOrganization =
      Object.keys(organizations).sort(
        (a, b) => organizations[b] - organizations[a],
      )[0] || "Unknown";

    return {
      success: true,
      data: {
        organization: primaryOrganization,
        period: {
          start: startDate,
          end: endDate,
        },
        data,
        categorizedData,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to process CSV file.",
    };
  }
}
