"use client";

import type { ServiceData } from "@/types/billing";
import { UnitServiceChart } from "@/components/charts/UnitServiceChart";
import { BillingTable, ExportButtons } from "@/components/ui/BillingTable";
import { summarizeCopilotDetails } from "@/lib/billingAnalytics";
import { formatNumber } from "@/lib/utils";

export function CopilotChart({
  data,
  breakdown = "cost",
}: {
  data: ServiceData[];
  breakdown?: "cost" | "quantity";
}) {
  const details = summarizeCopilotDetails(data);
  const tokenLabels = {
    inputTokens: "Input Tokens",
    outputTokens: "Output Tokens",
    cachedTokens: "Cached Tokens",
    totalTokens: "Reported Total Tokens",
  } as const;
  return (
    <div className="min-w-0 space-y-8">
      <UnitServiceChart data={data} title="Copilot" breakdown={breakdown} />
      {details.tokenRows > 0 && (
        <section
          aria-label="Copilot reported tokens"
          className="space-y-4 border-t border-gray-800 pt-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">Reported Tokens</h3>
            <span className="text-sm text-gray-400">
              {details.tokenRows} of {data.length} rows contain token fields
            </span>
          </div>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(tokenLabels).map(([field, label]) => (
              <div key={field} className="min-w-0">
                <dt className="text-sm text-gray-400">{label}</dt>
                <dd className="break-words text-xl font-semibold tabular-nums">
                  {formatNumber(
                    details.tokens[field as keyof typeof tokenLabels],
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {details.hasUsers && (
        <section
          aria-label="Copilot user breakdown"
          className="min-w-0 space-y-4 border-t border-gray-800 pt-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">Billing by User</h3>
            <ExportButtons
              groups={details.byUser}
              dimension="username"
              prefix="copilot"
            />
          </div>
          <BillingTable
            groups={details.byUser}
            label="Copilot users"
            nameLabel="User"
            tokens
          />
        </section>
      )}
      {details.hasModels && (
        <section
          aria-label="Copilot model breakdown"
          className="min-w-0 space-y-4 border-t border-gray-800 pt-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">Billing by Model</h3>
            <ExportButtons
              groups={details.byModel}
              dimension="model"
              prefix="copilot"
            />
          </div>
          <BillingTable
            groups={details.byModel}
            label="Copilot models"
            nameLabel="Model"
            tokens
          />
        </section>
      )}
      {!details.hasUsers && !details.hasModels && !details.tokenRows && (
        <p className="text-sm text-gray-500">
          User, model, and token details: not reported.
        </p>
      )}
    </div>
  );
}
