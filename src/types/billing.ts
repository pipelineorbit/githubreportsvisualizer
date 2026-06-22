export interface BillingData {
  month: string;
  actions: number;
  packages: number;
  storage: number;
  total?: number;
}

export interface ServiceData {
  date: string;
  cost: number;
  quantity: number;
  sku: string;
  organization?: string;
  repository?: string;
  costCenter?: string;
  username?: string;
  workflowPath?: string;
}

export interface CategorizedBillingData {
  actionsMinutes: ServiceData[];
  actionsStorage: ServiceData[];
  packages: ServiceData[];
  copilot: ServiceData[];
  codespaces: ServiceData[];
}

export interface GitHubBillingReport {
  organization: string;
  period: {
    start: string;
    end: string;
  };
  data: BillingData[];
  categorizedData?: CategorizedBillingData;
}

export interface FileUploadResult {
  success: boolean;
  data?: GitHubBillingReport;
  error?: string;
}
