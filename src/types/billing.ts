export interface BillingData {
  month: string;
  actions: number;
  packages: number;
  storage: number;
  copilot?: number;
  codespaces?: number;
  other?: number;
  total?: number;
}

export interface ServiceData {
  date: string;
  cost: number;
  quantity: number;
  unitType?: string;
  appliedCostPerQuantity?: number;
  grossAmount?: number;
  discountAmount?: number;
  sku: string;
  product?: string;
  sourceRow?: number;
  source?: Record<string, string>;
  organization?: string;
  repository?: string;
  costCenter?: string;
  username?: string;
  workflowPath?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  totalTokens?: number;
}

export interface CategorizedBillingData {
  actionsMinutes: ServiceData[];
  actionsStorage: ServiceData[];
  packages: ServiceData[];
  copilot: ServiceData[];
  codespaces: ServiceData[];
  other: ServiceData[];
}

export type ServiceType = keyof CategorizedBillingData;

export interface FinancialTotals {
  cost: number | undefined;
  grossAmount: number | undefined;
  discountAmount: number | undefined;
}

export interface ImportIssue {
  record: number;
  reason: string;
  values: Record<string, string>;
}

export interface ImportDiagnostics {
  totalRows: number;
  acceptedRows: number;
  otherRows: number;
  rejectedRows: ImportIssue[];
  warnings: ImportIssue[];
  sourceTotals: FinancialTotals;
  acceptedTotals: FinancialTotals;
  rejectedTotals: FinancialTotals;
}

export interface GitHubBillingReport {
  organization: string;
  period: {
    start: string;
    end: string;
  };
  data: BillingData[];
  categorizedData?: CategorizedBillingData;
  records?: ServiceData[];
  diagnostics?: ImportDiagnostics;
  fileName?: string;
}

export interface FileUploadResult {
  success: boolean;
  data?: GitHubBillingReport;
  error?: string;
}
