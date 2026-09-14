# GitHub Reports Visualizer

Visualize GitHub billing reports with interactive charts and filters. Upload your CSV billing data and explore Actions, storage, Packages, Codespaces, Copilot, and unclassified charges.

**Privacy first**: All data processing happens in your browser. Nothing is uploaded to any server.

## Features

- Reconcile imported, accepted, and rejected records and their monetary totals
- View all-service gross amounts, discounts, and net spend
- Explore daily spend, cumulative totals, and day-to-day changes with SKU drill-down
- Compare services, organizations, cost centers, and products
- Filter all views by dates, organization, repository, cost center, service, SKU, and available user/model fields
- Keep different usage units separate in charts, rankings, and totals
- Rank by cost or usage, retain an Other remainder, and sort/search/page through complete tables
- Export filtered rows, complete summaries, and import issues as CSV
- Inspect Copilot user/model/token details when those fields are supplied
- All processing happens client-side - your data stays private

## Import and Reconciliation

Required columns are `date`, `product`, `sku`, `quantity`, and `net_amount`.
Headers are case-insensitive; common camelCase and underscore aliases are
accepted. Optional columns include `unit_type`, `applied_cost_per_quantity`,
`gross_amount`, `discount_amount`, `organization`, `repository`,
`cost_center_name`, `username`, and `workflow_path`.

Quoted commas, escaped quotes, embedded newlines, BOMs, scientific notation,
and ISO or US-style dates are supported. Invalid dates, incomplete rows, invalid
numbers, and malformed quoting are reported as rejected records. Missing
optional amounts remain unknown rather than becoming zero. Amount mismatches
are retained with a warning; report net amounts remain authoritative.

Actions custom-image and cache storage are retained. Unmatched products and
SKUs go to **Other** instead of disappearing. The Import Audit covers the entire
file, while financial charts and exports use the currently filtered accepted
records. CSV record numbers include the header and refer to logical CSV records,
not physical lines when fields contain newlines.

Exports retain unknown source columns and full numeric precision. Text that
could be interpreted as a spreadsheet formula is escaped; numeric refunds stay
numeric. Missing amounts export as blank fields. Summary exports include every
group, independent of table pagination, and omit invalid mixed-unit quantities.

## Trends and Usage

Each service shows daily net cost and daily usage together, with a separate
usage chart for each unit. Zero-charge days remain visible even when usage is
fully discounted. The cost/usage selector changes rankings and tables without
hiding the complementary daily charts.

Daily charts can be grouped by repository, SKU, organization, or cost center.
Organization comparisons also appear automatically for multi-organization
selections. Detailed reports additionally enable workflow, user, and model
grouping when those fields are present, without requiring a repository filter.

Chart dates use UTC and include years for multi-year selections. Daily changes
are calculated only against an available preceding calendar day; missing dates
are not invented as zero usage. Select a chart date or daily table entry to see
its SKU contributions and export that selection.

The optional monthly run-rate is a linear estimate from the selected reported
days, not an invoice forecast. It is available only for one contiguous calendar
month with no import rejections or financial warnings. Partial calendar coverage
is marked, and the latest reported day may itself be incomplete.

Quantities with different units are never added together. Converting storage
GB-hours to GB-months uses an explicitly labeled 730-hour approximation and does
not convert transfer gigabytes, core-hours, credits, or other measures.

## Copilot Billing

The report defaults to net cost in USD. Copilot separates AI usage from seat
subscriptions, and quantity charts keep each reported unit separate:

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

For detailed reports with the required billing columns, these additional fields
enable the corresponding detail views and filters:

| Field           | Accepted aliases                                 | Meaning                                  |
| --------------- | ------------------------------------------------ | ---------------------------------------- |
| `username`      | `user_login`, `user`                             | User attribution supplied by the report  |
| `model`         | `model_name`, `model_id`                         | Model attribution supplied by the report |
| `input_tokens`  | `prompt_tokens`, `input_token_count`             | Reported input tokens                    |
| `output_tokens` | `completion_tokens`, `output_token_count`        | Reported output tokens                   |
| `cached_tokens` | `cached_input_tokens`, `cache_read_input_tokens` | Reported cached tokens                   |
| `total_tokens`  |                                                  | Reported total tokens                    |

Token values must be nonnegative integers. Cached tokens are not added to input
tokens or used to invent a total: they may already be included in input usage.
Missing detail fields remain unknown, and unattributed costs stay visible.
Summary-only reports do not produce inferred user, model, or token statistics.

See GitHub's documentation on [Copilot licenses](https://docs.github.com/en/billing/concepts/product-billing/github-copilot-licenses)
and [usage-based billing for organizations and enterprises](https://docs.github.com/en/copilot/concepts/billing/organizations-and-enterprises/usage-based-billing).

## Running Locally

### Prerequisites

- Node.js 20.9 or higher; Node.js 22 is recommended

### Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/wechuli/githubreportsvisualizer.git
   cd githubreportsvisualizer
   ```

2. Install dependencies:

   ```bash
   npm ci
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Usage

1. Upload your GitHub billing CSV file
2. Review the import audit and all-service financial overview
3. Apply report-wide filters and navigate service tabs
4. Select cost or usage, a grouping dimension, and optional storage conversion
5. Inspect daily spikes or comparisons, then export filtered rows or summaries

## Deployment

The default build produces a static site in `out`, as required by GitHub Pages.
Preview the production export locally with:

```bash
npm run build
npm start -- --listen 3000
```

Docker selects `NEXT_OUTPUT=standalone` at build time and packages the generated
server, public assets, and static assets. Build-time dependencies and regression
tests run in the builder stage; the final image runs as a non-root user.

```bash
docker build -t githubreportsvisualizer .
docker run --rm -p 3000:3000 githubreportsvisualizer
```

For a standalone build outside Docker, run
`NEXT_OUTPUT=standalone npm run build`. Manual packaging must also copy `public`
and `.next/static` into the corresponding standalone directories, as done in
the Dockerfile.

## Development Checks

```bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The unit suite covers CSV validation, reconciliation, unit separation, complete
rankings, UTC dates, partial periods, token metadata, refunds, and safe exports.
The browser suite builds the static site and tests downloads, navigation,
filtering, optional details, tables, zero-charge states, and desktop/mobile
layouts. It uses an isolated static server on port 3117; screenshots and failure
traces are written to the ignored `test-results` directory.

Pull-request CI runs unit tests and both build modes on Node.js 20 and 22,
Chromium browser tests, and a container startup smoke test. Pages deployment
runs regression tests before building; Docker deployment runs them inside the
image build. Local Docker validation requires a running Docker daemon.
