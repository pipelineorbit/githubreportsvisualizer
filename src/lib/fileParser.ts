import Papa from "papaparse";
import { DataProcessor, getServiceType } from "@/lib/dataProcessor";
import type { BillingGroup } from "@/lib/billingAnalytics";
import type {
  BillingData,
  GitHubBillingReport,
  FileUploadResult,
  CategorizedBillingData,
  ServiceData,
  FinancialTotals,
  ImportDiagnostics,
  ImportIssue,
} from "@/types/billing";

/**
 * Normalize a date string to ISO format (YYYY-MM-DD) so downstream
 * sorting and month-key extraction (substring(0,7)) work uniformly.
 * Accepts already-ISO dates and US-style M/D/YY or M/D/YYYY.
 */
function normalizeDate(raw: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  let normalized = trimmed;
  if (/^\d{4}-\d{2}-\d{2}(?:$|T|\s)/.test(trimmed))
    normalized = trimmed.slice(0, 10);
  const match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2}|\d{4})$/);
  if (match) {
    const month = match[1].padStart(2, "0");
    const day = match[2].padStart(2, "0");
    let year = match[3];
    if (year.length === 2) year = `20${year}`;
    normalized = `${year}-${month}-${day}`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return undefined;
  const date = new Date(`${normalized}T00:00:00Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === normalized
    ? normalized
    : undefined;
}

const HEADER_ALIASES: Record<string, string> = {
  date: "date",
  usagedate: "date",
  product: "product",
  sku: "sku",
  quantity: "quantity",
  unittype: "unit_type",
  appliedcostperquantity: "applied_cost_per_quantity",
  grossamount: "gross_amount",
  discountamount: "discount_amount",
  netamount: "net_amount",
  organization: "organization",
  repository: "repository",
  costcenter: "cost_center_name",
  costcentername: "cost_center_name",
  username: "username",
  userlogin: "username",
  user: "username",
  workflowpath: "workflow_path",
  workflow: "workflow_path",
  model: "model",
  modelname: "model",
  modelid: "model",
  inputtokens: "input_tokens",
  prompttokens: "input_tokens",
  inputtokencount: "input_tokens",
  outputtokens: "output_tokens",
  completiontokens: "output_tokens",
  outputtokencount: "output_tokens",
  cachedtokens: "cached_tokens",
  cachedinputtokens: "cached_tokens",
  cachereadinputtokens: "cached_tokens",
  totaltokens: "total_tokens",
};

function parseNumber(value: string | undefined): number | undefined {
  const text = value?.trim();
  if (!text || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text))
    return undefined;
  const amount = Number(text);
  return Number.isFinite(amount) ? amount : undefined;
}

function sumRawAmounts(rows: Record<string, string>[]): FinancialTotals {
  const total = (field: string) => {
    let amount = 0;
    for (const row of rows) {
      const value = parseNumber(row[field]);
      if (value === undefined) return undefined;
      amount += value;
    }
    return amount;
  };
  return {
    cost: total("net_amount"),
    grossAmount: total("gross_amount"),
    discountAmount: total("discount_amount"),
  };
}

export function parseCSV(csvContent: string): {
  data: BillingData[];
  categorizedData: CategorizedBillingData;
  records: ServiceData[];
  diagnostics: ImportDiagnostics;
} {
  const parsed = Papa.parse<string[]>(csvContent, { skipEmptyLines: "greedy" });
  if (parsed.data.length < 2) {
    throw new Error("CSV file appears to be empty or invalid");
  }
  const headers = parsed.data[0].map((header) => {
    const normalized = header
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    return Object.hasOwn(HEADER_ALIASES, normalized)
      ? HEADER_ALIASES[normalized]
      : header.trim();
  });
  if (
    new Set(headers).size !== headers.length ||
    headers.some((header) => !header)
  ) {
    throw new Error("CSV headers must be nonempty and unique.");
  }
  const missing = ["date", "product", "sku", "quantity", "net_amount"].filter(
    (field) => !headers.includes(field),
  );
  if (missing.length)
    throw new Error(`Missing required CSV columns: ${missing.join(", ")}`);
  if (parsed.errors.some((error) => error.row === 0))
    throw new Error("Invalid CSV header quoting.");

  const sourceRows: Record<string, string>[] = [];
  const records: ServiceData[] = [];
  const rejectedRows: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const optionalFields = [
    ["applied_cost_per_quantity", "appliedCostPerQuantity"],
    ["gross_amount", "grossAmount"],
    ["discount_amount", "discountAmount"],
    ["input_tokens", "inputTokens"],
    ["output_tokens", "outputTokens"],
    ["cached_tokens", "cachedTokens"],
    ["total_tokens", "totalTokens"],
  ] as const;

  parsed.data.slice(1).forEach((values, index) => {
    const source = Object.fromEntries(
      headers.map((header, column) => [header, values[column] ?? ""]),
    );
    sourceRows.push(source);
    const reasons = parsed.errors
      .filter((error) => error.row === index + 1)
      .map((error) => error.message);
    if (values.length !== headers.length)
      reasons.push(
        `Expected ${headers.length} fields; received ${values.length}`,
      );
    const date = normalizeDate(source.date);
    if (!date) reasons.push("date must be a valid calendar date");
    if (!source.product.trim()) reasons.push("product is required");
    if (!source.sku.trim()) reasons.push("sku is required");
    const cost = parseNumber(source.net_amount);
    const quantity = parseNumber(source.quantity);
    if (cost === undefined) reasons.push("net_amount must be a finite number");
    if (quantity === undefined)
      reasons.push("quantity must be a finite number");
    const numbers: Partial<Record<(typeof optionalFields)[number][1], number>> =
      {};
    for (const [column, field] of optionalFields) {
      if (!source[column]?.trim()) continue;
      const value = parseNumber(source[column]);
      if (
        value === undefined ||
        (column.endsWith("_tokens") &&
          (!Number.isSafeInteger(value) || value < 0))
      ) {
        reasons.push(
          `${column} must be ${column.endsWith("_tokens") ? "a nonnegative integer" : "a finite number"}`,
        );
      } else {
        numbers[field] = value;
      }
    }
    if (reasons.length) {
      rejectedRows.push({
        record: index + 2,
        reason: reasons.join("; "),
        values: source,
      });
      return;
    }
    if (
      numbers.grossAmount !== undefined &&
      numbers.discountAmount !== undefined &&
      Math.abs(numbers.grossAmount - numbers.discountAmount - cost!) > 0.000001
    ) {
      warnings.push({
        record: index + 2,
        reason: "Gross amount minus discounts differs from net amount",
        values: source,
      });
    }
    records.push({
      date: date!,
      quantity: quantity!,
      cost: cost!,
      ...numbers,
      product: source.product.trim().toLowerCase(),
      sku: source.sku.trim(),
      unitType: source.unit_type?.trim() || undefined,
      organization: source.organization?.trim() || "",
      repository: source.repository?.trim() || "",
      costCenter: source.cost_center_name?.trim() || "",
      username: source.username?.trim() || "",
      workflowPath: source.workflow_path?.trim() || "",
      model: source.model?.trim() || "",
      sourceRow: index + 2,
      source,
    });
  });

  const categorizedData = DataProcessor.categorizeServiceData(records);
  const monthlyData = new Map<string, BillingData>();
  for (const item of records) {
    const month = item.date.slice(0, 7);
    const bucket = monthlyData.get(month) ?? {
      month,
      actions: 0,
      packages: 0,
      storage: 0,
      copilot: 0,
      codespaces: 0,
      other: 0,
      total: 0,
    };
    const category = getServiceType(item);
    const field =
      category === "actionsMinutes"
        ? "actions"
        : category === "actionsStorage"
          ? "storage"
          : category;
    bucket[field] = (bucket[field] ?? 0) + item.cost;
    bucket.total! += item.cost;
    monthlyData.set(month, bucket);
  }

  return {
    data: Array.from(monthlyData.values()).sort((first, second) =>
      first.month.localeCompare(second.month),
    ),
    categorizedData,
    records,
    diagnostics: {
      totalRows: sourceRows.length,
      acceptedRows: records.length,
      otherRows: categorizedData.other.length,
      rejectedRows,
      warnings,
      sourceTotals: sumRawAmounts(sourceRows),
      acceptedTotals: sumRawAmounts(records.map((item) => item.source!)),
      rejectedTotals: sumRawAmounts(rejectedRows.map((item) => item.values)),
    },
  };
}

export function serializeRows(records: ServiceData[]): string {
  return Papa.unparse(
    records.map((item) => ({
      ...item.source,
      date: item.date,
      product:
        item.product ??
        (getServiceType(item).startsWith("actions")
          ? "actions"
          : getServiceType(item)),
      sku: item.sku,
      quantity: item.quantity,
      unit_type: item.unitType ?? "",
      applied_cost_per_quantity: item.appliedCostPerQuantity ?? "",
      gross_amount: item.grossAmount ?? "",
      discount_amount: item.discountAmount ?? "",
      net_amount: item.cost,
      organization: item.organization ?? "",
      repository: item.repository ?? "",
      cost_center_name: item.costCenter ?? "",
      username: item.username ?? "",
      workflow_path: item.workflowPath ?? "",
      model: item.model ?? "",
      input_tokens: item.inputTokens ?? "",
      output_tokens: item.outputTokens ?? "",
      cached_tokens: item.cachedTokens ?? "",
      total_tokens: item.totalTokens ?? "",
    })),
    { escapeFormulae: true },
  );
}

export function serializeSummary(
  groups: BillingGroup[],
  dimension = "sku",
): string {
  return Papa.unparse(
    groups.map((group) => ({
      dimension,
      group: group.label,
      unit_type: group.mixedUnits ? "mixed" : (group.unitType ?? ""),
      quantity: group.quantity ?? "",
      gross_amount: group.grossAmount ?? "",
      discount_amount: group.discountAmount ?? "",
      net_amount: group.cost,
      record_count: group.rowCount,
      input_tokens: group.inputTokens ?? "",
      output_tokens: group.outputTokens ?? "",
      cached_tokens: group.cachedTokens ?? "",
      total_tokens: group.totalTokens ?? "",
    })),
    { escapeFormulae: true },
  );
}

export function serializeIssues(issues: ImportIssue[]): string {
  const numericFields = new Set([
    "quantity",
    "net_amount",
    "gross_amount",
    "discount_amount",
    "applied_cost_per_quantity",
    "input_tokens",
    "output_tokens",
    "cached_tokens",
    "total_tokens",
  ]);
  return Papa.unparse(
    issues.map((issue) => ({
      ...Object.fromEntries(
        Object.entries(issue.values).map(([field, value]) => [
          field,
          numericFields.has(field) ? (parseNumber(value) ?? value) : value,
        ]),
      ),
      source_record: issue.record,
      rejection_reason: issue.reason,
    })),
    { escapeFormulae: true },
  );
}

export async function processFile(file: File): Promise<FileUploadResult> {
  try {
    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    if (fileExtension !== "csv") {
      return {
        success: false,
        error: "Invalid file format. Please upload a CSV file.",
      };
    }

    const content = await file.text();
    const { data, categorizedData, records, diagnostics } = parseCSV(content);

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
        records,
        diagnostics,
        fileName: file.name,
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
