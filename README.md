# GitHub Reports Visualizer

Visualize GitHub billing reports with interactive charts and filters. Upload your CSV billing data and explore usage across Actions minutes, storage, packages, and Copilot.

**Privacy first**: All data processing happens in your browser. Nothing is uploaded to any server.

## Features

- Filter by date range, organization, repository, and cost center
- Toggle between cost ($) and usage volume views
- Switch storage units between GB-hours and GB-months
- View breakdowns by repository and organization
- Reconcile Copilot gross amounts, report discounts, and net charges by SKU
- View Copilot AI credits and billed seat-months as separate usage measures
- All processing happens client-side - your data stays private

## Copilot Billing

The Copilot tab defaults to net cost in USD, separating AI usage from seat
subscriptions. Quantity charts keep each reported unit separate:

- `ai-credits` measures AI usage, not requests, tokens, or users. GitHub currently
  values one AI credit at $0.01 USD.
- `user-months` measures prorated seat billing. A partial month's quantity is not
  a count of distinct users or assigned seats.
- Legacy request-based usage and other reported units are shown independently.

Charges come from the report's `net_amount`, not a hardcoded plan price.
`gross_amount` and `discount_amount` are retained when available; missing values
are shown as "Not reported", not zero. Report discounts are not assumed to be
only included plan usage. The summarized report does not establish the remaining
pooled allowance, active user count, or model/token breakdown.

See GitHub's documentation on [Copilot licenses](https://docs.github.com/en/billing/concepts/product-billing/github-copilot-licenses)
and [usage-based billing for organizations and enterprises](https://docs.github.com/en/copilot/concepts/billing/organizations-and-enterprises/usage-based-billing).

## Running Locally

### Prerequisites

- Node.js 20 or higher

### Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/wechuli/githubreportsvisualizer.git
   cd githubreportsvisualizer
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Usage

1. Upload your GitHub billing CSV file
2. Navigate between service tabs (Actions, Storage, Packages, Copilot)
3. Use filters to drill down by date, organization, or repository
4. Toggle between cost and usage views
5. For storage services, switch between GB-hours and GB-months

## Development Checks

```bash
npm test
npm run build
```

The regression suite covers Copilot unit separation, gross/discount/net
reconciliation, legacy reports, missing billing metadata, zero charges,
adjustments, and filtered totals.
