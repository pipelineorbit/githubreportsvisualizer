import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import Papa from "papaparse";

function row(overrides: Record<string, string | number> = {}) {
  return {
    date: "2026-09-01",
    product: "copilot",
    sku: "copilot_ai_credit",
    quantity: 100,
    unit_type: "ai-credits",
    gross_amount: 1,
    discount_amount: 0,
    net_amount: 1,
    organization: "alpha",
    repository: "",
    cost_center_name: "Engineering, Shared",
    username: "",
    model: "",
    input_tokens: "",
    output_tokens: "",
    cached_tokens: "",
    total_tokens: "",
    ...overrides,
  };
}

async function upload(page: Page, rows: ReturnType<typeof row>[]) {
  await page.goto("/");
  await page.getByLabel("Upload billing CSV").setInputFiles({
    name: "report.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(Papa.unparse(rows)),
  });
  await expect(
    page.getByRole("tab", { name: "Overview", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
}

test("reconciles all services, supports trends and exports the selected date", async ({
  page,
}) => {
  await upload(page, [
    row({ discount_amount: 0.4, net_amount: 0.6 }),
    row({ date: "2026-09-02", quantity: 300, gross_amount: 3, net_amount: 3 }),
    row({
      sku: "copilot_for_business",
      unit_type: "user-months",
      quantity: 1,
      gross_amount: 19,
      net_amount: 19,
    }),
    row({
      date: "2026-09-02",
      product: "actions",
      sku: "actions_custom_image_storage",
      unit_type: "gigabyte-hours",
      quantity: 1800,
      gross_amount: 0.17,
      net_amount: 0.17,
      organization: "beta",
    }),
    row({
      date: "2026-09-02",
      product: "future",
      sku: "future_meter",
      unit_type: "widgets",
      quantity: 5,
      gross_amount: 1,
      net_amount: 1,
    }),
  ]);
  await expect(
    page.getByRole("heading", { name: "Import Reconciled", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("definition").filter({ hasText: /^\$23\.77$/ }),
  ).toBeVisible();
  await page
    .getByRole("group", { name: "Spending trend mode" })
    .getByRole("button", { name: "Cumulative", exact: true })
    .click();
  await expect(page.locator(".recharts-line-curve")).toBeVisible();
  await page.getByRole("button", { name: "Daily Change", exact: true }).click();
  await page
    .getByRole("region", { name: "Daily spending", exact: true })
    .getByRole("button", { name: "Sep 2", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "SKUs on Sep 2, 2026", exact: true }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("region", { name: "SKU drill-down", exact: true })
    .getByRole("button", { name: "Export Rows", exact: true })
    .click();
  const download = await downloadPromise;
  const exported = Papa.parse<Record<string, string>>(
    await readFile((await download.path())!, "utf8"),
    { header: true },
  ).data;
  expect(download.suggestedFilename()).toBe("billing-2026-09-02-rows.csv");
  expect(exported).toHaveLength(3);
  expect(exported.every((record) => record.date === "2026-09-02")).toBe(true);
  expect(exported[0].cost_center_name).toBe("Engineering, Shared");
  await page
    .getByRole("group", { name: "Comparison dimension" })
    .getByRole("button", { name: "Cost Center", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Cost Center comparison", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Actions Storage", exact: true }).click();
  await page
    .getByRole("group", { name: "Actions Storage grouping" })
    .getByRole("button", { name: "SKU", exact: true })
    .click();
  await expect(
    page.getByRole("rowheader", {
      name: "actions_custom_image_storage",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Other", exact: true }).click();
  await expect(
    page.getByRole("rowheader", { name: "future_meter", exact: true }),
  ).toBeVisible();
});

test("keeps Codespaces and Packages units separate and converts only storage", async ({
  page,
}) => {
  await upload(page, [
    row({
      product: "codespaces",
      sku: "codespaces_compute",
      unit_type: "core-hours",
      quantity: 2,
    }),
    row({
      product: "codespaces",
      sku: "codespaces_storage",
      unit_type: "gigabyte-hours",
      quantity: 730,
    }),
    row({
      product: "packages",
      sku: "packages_storage",
      unit_type: "gigabyte-hours",
      quantity: 1460,
    }),
    row({
      product: "packages",
      sku: "packages_transfer",
      unit_type: "gigabytes",
      quantity: 10,
    }),
  ]);
  await page
    .getByRole("group", { name: "Breakdown By" })
    .getByRole("button", { name: "Usage Volume" })
    .click();
  await page.getByRole("tab", { name: "Codespaces", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Daily Net Cost by SKU", exact: true })
      .getByRole("application"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", {
        name: "Daily Usage (core-hours) by SKU",
        exact: true,
      })
      .getByRole("application"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", {
        name: "Daily Usage (GB-hours) by SKU",
        exact: true,
      })
      .getByRole("application"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "core-hours by SKU", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "GB-hours by SKU", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Storage Unit", { exact: true })
    .selectOption("gb-months");
  await expect(
    page.getByRole("row", { name: /codespaces_storage 1 GB-months/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /codespaces_compute 2 core-hours/ }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Packages", exact: true }).click();
  await expect(
    page.getByRole("row", { name: /packages_storage 2 GB-months/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /packages_transfer 10 gigabytes/ }),
  ).toBeVisible();
});

test("shows complete sortable rankings with an Other remainder and pagination", async ({
  page,
}) => {
  await upload(
    page,
    Array.from({ length: 30 }, (_, index) =>
      row({
        product: "actions",
        sku: `actions_linux_${index}`,
        unit_type: "minutes",
        quantity: 100 - index,
        gross_amount: index + 1,
        net_amount: index + 1,
      }),
    ),
  );
  await page.getByRole("tab", { name: "Actions Minutes", exact: true }).click();
  await page
    .getByRole("group", { name: "Actions Minutes grouping" })
    .getByRole("button", { name: "SKU", exact: true })
    .click();
  const costTable = page.getByRole("region", {
    name: "Actions Minutes Net Cost by SKU",
    exact: true,
  });
  await expect(costTable.getByRole("rowheader").first()).toHaveText(
    "actions_linux_29",
  );
  await expect(
    page.getByText("Other (24)", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("group", { name: "Breakdown By" })
    .getByRole("button", { name: "Usage Volume" })
    .click();
  const table = page.getByRole("region", {
    name: "Actions Minutes minutes by SKU",
    exact: true,
  });
  await expect(table.getByRole("rowheader").first()).toHaveText(
    "actions_linux_0",
  );
  await expect(table.getByRole("rowheader")).toHaveCount(25);
  await page
    .getByRole("button", { name: "Next Actions Minutes minutes by SKU page" })
    .click();
  await expect(table.getByRole("rowheader")).toHaveCount(5);
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export Summary", exact: true })
    .click();
  const download = await downloadPromise;
  const records = Papa.parse<Record<string, string>>(
    await readFile((await download.path())!, "utf8"),
    { header: true },
  ).data;
  expect(records).toHaveLength(30);
  expect(
    records.reduce((sum, record) => sum + Number(record.net_amount), 0),
  ).toBe(465);
  const search = page.getByLabel("Search Actions Minutes minutes by SKU", {
    exact: true,
  });
  await search.fill("actions_linux_0");
  await page.getByLabel("SKU", { exact: true }).selectOption("actions_linux_1");
  await expect(search).toBeVisible();
  await search.fill("");
  await expect(table.getByRole("rowheader")).toHaveText("actions_linux_1");
});

test("exposes rejection reasons and reconciles unknown or rejected-only reports", async ({
  page,
}) => {
  await upload(page, [
    row(),
    row({ quantity: "invalid", net_amount: 2, gross_amount: 2 }),
    row({ product: "future", sku: "new_sku" }),
  ]);
  await expect(
    page.getByRole("heading", { name: "Import Needs Review", exact: true }),
  ).toBeVisible();
  await page.getByText("Import Audit", { exact: true }).click();
  await expect(
    page.getByRole("cell", {
      name: "quantity must be a finite number",
      exact: true,
    }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export Import Issues", exact: true })
    .click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "billing-import-issues.csv",
  );
  await page.getByLabel("Service", { exact: true }).selectOption("other");
  await page.getByRole("tab", { name: "Other", exact: true }).click();
  await expect(
    page.getByRole("rowheader", { name: "new_sku", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Service", { exact: true }).selectOption("copilot");
  await expect(
    page.getByRole("tab", { name: "Overview", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await upload(page, [row({ date: "2026-02-30" })]);
  await expect(
    page.getByRole("heading", { name: "Import Needs Review", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No accepted records match this selection.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("supports detailed Copilot data and keyboard tab navigation", async ({
  page,
}) => {
  await upload(page, [
    row({
      username: "alice",
      model: "model-a",
      input_tokens: 10,
      output_tokens: 3,
      cached_tokens: 4,
      total_tokens: 13,
    }),
    row({
      username: "bob",
      model: "model-b",
      input_tokens: 20,
      output_tokens: 5,
      cached_tokens: 6,
      total_tokens: 25,
    }),
    row({
      sku: "copilot_for_business",
      unit_type: "user-months",
      quantity: 0.03,
    }),
  ]);
  await page.getByRole("tab", { name: "Overview", exact: true }).focus();
  await page.keyboard.press("End");
  await expect(
    page.getByRole("tab", { name: "Copilot", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("heading", { name: "Reported Tokens", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Copilot users", exact: true })
      .getByRole("rowheader", { name: "alice", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Copilot models", exact: true })
      .getByRole("rowheader", { name: "model-b", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Model", { exact: true }).selectOption("model-a");
  await expect(
    page
      .getByRole("region", { name: "Copilot users", exact: true })
      .getByRole("rowheader"),
  ).toHaveCount(1);
  await page.getByLabel("Start date", { exact: true }).fill("2026-09-02");
  await expect(
    page.getByText("Start date must be on or before end date.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reset Filters", exact: true })
    .click();
  await expect(page.getByLabel("Start date", { exact: true })).toHaveValue(
    "2026-09-01",
  );
  await expect(
    page
      .getByRole("region", { name: "Copilot users", exact: true })
      .getByRole("rowheader"),
  ).toHaveCount(3);
});

test("keeps daily cost and usage visible together across modes and filters", async ({
  page,
}, testInfo) => {
  await upload(page, [
    row({
      product: "actions",
      sku: "actions_linux",
      unit_type: "minutes",
      quantity: 60,
      gross_amount: 0.36,
      discount_amount: 0.36,
      net_amount: 0,
      repository: "build",
      organization: "alpha",
    }),
    row({
      date: "2026-09-02",
      product: "actions",
      sku: "actions_linux",
      unit_type: "minutes",
      quantity: 120,
      gross_amount: 0.72,
      discount_amount: 0.72,
      net_amount: 0,
      repository: "test",
      organization: "beta",
    }),
  ]);
  await page.getByRole("tab", { name: "Actions Minutes", exact: true }).click();
  const cost = page.getByRole("region", {
    name: "Daily Net Cost by Repository",
    exact: true,
  });
  const usage = page.getByRole("region", {
    name: "Daily Usage (minutes) by Repository",
    exact: true,
  });
  await expect(cost.getByRole("application")).toBeVisible();
  await expect(usage.getByRole("application")).toBeVisible();
  await expect(
    usage.locator(".recharts-bar-rectangle path").first(),
  ).toBeVisible();
  await expect(cost.locator(".recharts-line-dot").first()).toBeVisible();
  await expect(cost.locator(".recharts-line-curve")).toHaveAttribute(
    "d",
    /^M.+L/,
  );
  await expect(cost.getByText("Sep 1", { exact: true })).toBeVisible();
  await expect(cost.getByText("Sep 2", { exact: true })).toBeVisible();
  const costColor = await cost
    .getByRole("listitem")
    .filter({ hasText: /^build$/ })
    .locator("span")
    .first()
    .getAttribute("style");
  const usageColor = await usage
    .getByRole("listitem")
    .filter({ hasText: /^build$/ })
    .locator("span")
    .first()
    .getAttribute("style");
  expect(costColor).toBe(usageColor);
  await expect(
    page
      .getByRole("region", {
        name: "Daily Net Cost by Organization",
        exact: true,
      })
      .getByRole("application"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", {
        name: "Daily Usage (minutes) by Organization",
        exact: true,
      })
      .getByRole("application"),
  ).toBeVisible();
  await page
    .getByRole("region", { name: "Daily Cost and Usage", exact: true })
    .screenshot({ path: testInfo.outputPath("daily-actions-desktop.png") });
  await page
    .getByRole("group", { name: "Breakdown By", exact: true })
    .getByRole("button", { name: "Usage Volume", exact: true })
    .click();
  await expect(cost.getByRole("application")).toBeVisible();
  await expect(usage.getByRole("application")).toBeVisible();
  await page
    .getByRole("group", { name: "Actions Minutes grouping", exact: true })
    .getByRole("button", { name: "Organization", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", {
        name: "Daily Net Cost by Organization",
        exact: true,
      })
      .getByRole("application"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", {
        name: "Daily Usage (minutes) by Organization",
        exact: true,
      })
      .getByRole("application"),
  ).toBeVisible();
  await page.getByLabel("Organization", { exact: true }).selectOption("alpha");
  await expect(
    page
      .getByRole("region", {
        name: "Daily Net Cost by Organization",
        exact: true,
      })
      .getByText("beta", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("region", {
        name: "Daily Usage (minutes) by Organization",
        exact: true,
      })
      .getByText("alpha", { exact: true }),
  ).toBeVisible();
});

test("shows detailed workflow and user daily trends without a repository filter", async ({
  page,
}) => {
  await upload(page, [
    row({
      product: "actions",
      sku: "actions_linux",
      unit_type: "minutes",
      quantity: 30,
      repository: "build",
      username: "alice",
      workflow_path: ".github/workflows/build.yml",
    }),
    row({
      date: "2026-09-02",
      product: "actions",
      sku: "actions_linux",
      unit_type: "minutes",
      quantity: 90,
      repository: "test",
      username: "bob",
      workflow_path: ".github/workflows/test.yml",
    }),
  ]);
  await page.getByRole("tab", { name: "Actions Minutes", exact: true }).click();
  await expect(page.getByLabel("Repository", { exact: true })).toHaveValue("");
  const grouping = page.getByRole("group", {
    name: "Actions Minutes grouping",
    exact: true,
  });
  await grouping.getByRole("button", { name: "Workflow", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Daily Net Cost by Workflow", exact: true })
      .getByRole("application"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", {
        name: "Daily Usage (minutes) by Workflow",
        exact: true,
      })
      .getByText(".github/workflows/build.yml", { exact: true }),
  ).toBeVisible();
  await grouping.getByRole("button", { name: "User", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Daily Net Cost by User", exact: true })
      .getByText("alice", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", {
        name: "Daily Usage (minutes) by User",
        exact: true,
      })
      .getByText("bob", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Repository", { exact: true }).selectOption("test");
  await expect(
    page
      .getByRole("region", {
        name: "Daily Usage (minutes) by User",
        exact: true,
      })
      .getByText("alice", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("region", {
        name: "Daily Usage (minutes) by User",
        exact: true,
      })
      .getByText("bob", { exact: true }),
  ).toBeVisible();
});

test("retains fully discounted usage with an explicit zero-charge state", async ({
  page,
}) => {
  await upload(page, [row({ discount_amount: 1, net_amount: 0 })]);
  await page.getByRole("tab", { name: "Copilot", exact: true }).click();
  await expect(
    page.getByText("No net charges for this selection.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /copilot_ai_credit 100 AI credits/ }),
  ).toBeVisible();
  await page
    .getByRole("group", { name: "Breakdown By" })
    .getByRole("button", { name: "Usage Volume" })
    .click();
  await expect(
    page.getByRole("heading", { name: "AI credits by SKU", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", {
        name: "Daily Usage (AI credits) by SKU",
        exact: true,
      })
      .locator(".recharts-bar-rectangle path")
      .first(),
  ).toBeVisible();
});

test("renders nonblank responsive charts and keyboard-scrollable tables", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await upload(page, [
    row(),
    row({ date: "2026-09-02", quantity: 500, gross_amount: 5, net_amount: 5 }),
    row({
      sku: "copilot_for_business",
      unit_type: "user-months",
      quantity: 0.033333333,
    }),
  ]);
  await page.screenshot({
    path: testInfo.outputPath("overview-desktop.png"),
    fullPage: true,
  });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    await page.getByRole("tab", { name: "Copilot", exact: true }).click();
    await expect(
      page
        .getByRole("region", { name: "Daily Net Cost by SKU", exact: true })
        .getByRole("application"),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", {
          name: "Daily Usage (AI credits) by SKU",
          exact: true,
        })
        .getByRole("application"),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", {
          name: "Daily Usage (seat-months) by SKU",
          exact: true,
        })
        .getByRole("application"),
    ).toBeVisible();
    await page
      .getByRole("group", { name: "Breakdown By" })
      .getByRole("button", { name: "Usage Volume" })
      .click();
    await expect(
      page.getByRole("heading", { name: "seat-months by SKU", exact: true }),
    ).toBeVisible();
    await expect
      .poll(() => page.locator(".recharts-bar-rectangle").count())
      .toBeGreaterThan(0);
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    const metricsFit = await page
      .locator("dl dd")
      .evaluateAll((elements) =>
        elements.every(
          (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
      );
    expect(metricsFit).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`copilot-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("tab", { name: "Overview", exact: true }).click();
  }
  const table = page.getByRole("region", {
    name: "SKU contributions",
    exact: true,
  });
  await table.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => table.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
