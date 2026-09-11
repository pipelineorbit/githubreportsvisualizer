const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  parseCSV,
  serializeRows,
  serializeSummary,
  serializeIssues,
} = require("./src/lib/fileParser.ts");
const Papa = require("papaparse");
const { summarizeCopilotBilling } = require("./src/lib/copilotBilling.ts");
const {
  summarizeBilling,
  groupBilling,
  rankWithOther,
  rankedDailyData,
  getBillingTimeline,
  summarizeCopilotDetails,
} = require("./src/lib/billingAnalytics.ts");
const { formatChartDate, spansMultipleYears } = require("./src/lib/utils.ts");

const header =
  '"date","product","sku","quantity","unit_type","applied_cost_per_quantity","gross_amount","discount_amount","net_amount","organization","repository","cost_center_name"';

function parseCopilotRows(...rows) {
  return parseCSV([header, ...rows].join("\n")).categorizedData.copilot;
}

test("preserves AI-credit and seat-month billing metadata", () => {
  const [credits, subscription] = parseCopilotRows(
    '"2026-09-02","copilot","copilot_ai_credit","868.70365","ai-credits","0.01","8.6870365","6.42518375","2.26185275","example-org","","engineering"',
    '"2026-09-02","copilot","copilot_for_business","0.033333333","user-months","19","0.633333327","0","0.633333327","example-org","","engineering"',
  );

  assert.equal(credits.unitType, "ai-credits");
  assert.equal(credits.quantity, 868.70365);
  assert.equal(credits.appliedCostPerQuantity, 0.01);
  assert.equal(credits.grossAmount, 8.6870365);
  assert.equal(credits.discountAmount, 6.42518375);
  assert.equal(credits.cost, 2.26185275);
  assert.equal(subscription.unitType, "user-months");
  assert.equal(subscription.quantity, 0.033333333);
  assert.equal(subscription.appliedCostPerQuantity, 19);
  assert.equal(subscription.grossAmount, 0.633333327);
  assert.equal(subscription.discountAmount, 0);
  assert.equal(subscription.cost, 0.633333327);
});

test("preserves zero charges and scientific-notation amounts", () => {
  const [credits] = parseCopilotRows(
    '"2026-09-01","copilot","copilot_ai_credit","6.72E-06","ai-credits","0.01","6.72E-08","6.72E-08","0","example-org","",""',
  );

  assert.equal(credits.quantity, 0.00000672);
  assert.equal(credits.grossAmount, 0.0000000672);
  assert.equal(credits.discountAmount, 0.0000000672);
  assert.equal(credits.cost, 0);
});

test("keeps unavailable metadata distinct from reported zeroes", () => {
  const { categorizedData } = parseCSV(
    "date,product,sku,quantity,net_amount\n2025-08-01,copilot,copilot_for_business,0.032258064,0.612903216",
  );
  const [subscription] = categorizedData.copilot;

  assert.equal(subscription.cost, 0.612903216);
  assert.equal(subscription.unitType, undefined);
  assert.equal(subscription.grossAmount, undefined);
  assert.equal(subscription.discountAmount, undefined);
  assert.equal(subscription.appliedCostPerQuantity, undefined);
});

test("reconciles the September report without adding credits to seat-months", () => {
  const rows = parseCopilotRows(
    '"2026-09-01","copilot","copilot_ai_credit","1724.236745","ai-credits","0.01","17.24236745","17.24236745","0","example-org","",""',
    '"2026-09-02","copilot","copilot_ai_credit","868.70365","ai-credits","0.01","8.6870365","6.42518375","2.26185275","example-org","",""',
    '"2026-09-06","copilot","copilot_ai_credit","1047.26785","ai-credits","0.01","10.4726785","0","10.4726785","example-org","",""',
    '"2026-09-08","copilot","copilot_ai_credit","4778.0909","ai-credits","0.01","47.780909","0","47.780909","example-org","",""',
    '"2026-09-09","copilot","copilot_ai_credit","1631.06465","ai-credits","0.01","16.3106465","0","16.3106465","example-org","",""',
    '"2026-09-10","copilot","copilot_ai_credit","20742.36975","ai-credits","0.01","207.4236975","0","207.4236975","example-org","",""',
    ...Array.from(
      { length: 10 },
      (_, index) =>
        `"2026-09-${String(index + 1).padStart(2, "0")}","copilot","copilot_for_business","0.033333333","user-months","19","0.633333327","0","0.633333327","example-org","",""`,
    ),
  );
  const summary = summarizeCopilotBilling(rows);
  const [credits, subscriptions] = summary.usageGroups;

  assert.equal(summary.usageGroups.length, 2);
  assert.equal(credits.unitType, "ai-credits");
  assert.ok(Math.abs(credits.quantity - 30791.733545) < 1e-9);
  assert.ok(Math.abs(credits.cost - 284.24978425) < 1e-9);
  assert.equal(subscriptions.unitType, "user-months");
  assert.ok(Math.abs(subscriptions.quantity - 0.33333333) < 1e-9);
  assert.ok(Math.abs(subscriptions.cost - 6.33333327) < 1e-9);
  assert.ok(Math.abs(summary.cost - 290.58311752) < 1e-9);
  assert.ok(Math.abs(summary.grossAmount - 314.25066872) < 1e-9);
  assert.ok(Math.abs(summary.discountAmount - 23.6675512) < 1e-9);
  assert.ok(
    Math.abs(summary.grossAmount - summary.discountAmount - summary.cost) <
      1e-9,
  );
  assert.equal(summary.quantity, undefined);
  assert.equal(summary.dailyCosts.length, 10);
  assert.equal(summary.dailyCosts[2].date, "2026-09-03");
  assert.equal(summary.dailyCosts[2][credits.key], 0);
  assert.equal(summary.skuBreakdown.length, 2);
});

test("supports seat-only legacy reports without inferring a user count or discounts", () => {
  const summary = summarizeCopilotBilling([
    {
      date: "2025-08-01",
      sku: "copilot_for_business",
      quantity: 0.032258064,
      cost: 0.612903216,
    },
  ]);

  assert.equal(summary.usageGroups[0].unitType, "user-months");
  assert.equal(summary.usageGroups[0].quantity, 0.032258064);
  assert.equal(summary.grossAmount, undefined);
  assert.equal(summary.discountAmount, undefined);
});

test("uses reported units over SKU fallbacks and keeps requests separate", () => {
  const summary = summarizeCopilotBilling([
    {
      date: "2026-09-01",
      sku: "copilot_ai_credit",
      unitType: "ai-credits",
      quantity: 100,
      cost: 1,
    },
    {
      date: "2026-09-01",
      sku: "copilot_ai_credit",
      unitType: "requests",
      quantity: 5,
      cost: 0.2,
    },
    {
      date: "2026-09-01",
      sku: "copilot_premium_requests",
      quantity: 2,
      cost: 0.08,
    },
  ]);

  assert.deepEqual(
    summary.usageGroups.map((group) => [group.unitType, group.quantity]),
    [
      ["ai-credits", 100],
      ["requests", 7],
    ],
  );
  assert.equal(summary.skuBreakdown.length, 3);
});

test("does not combine unknown units across SKUs or invent missing financial totals", () => {
  const summary = summarizeCopilotBilling([
    {
      date: "2026-09-01",
      sku: "copilot_future_a",
      quantity: 12,
      cost: 2,
      grossAmount: 3,
      discountAmount: 1,
    },
    { date: "2026-09-01", sku: "copilot_future_b", quantity: 3, cost: 4 },
  ]);

  assert.equal(summary.usageGroups.length, 2);
  assert.ok(summary.usageGroups.every((group) => group.unitType === undefined));
  assert.equal(summary.cost, 6);
  assert.equal(summary.grossAmount, undefined);
  assert.equal(summary.discountAmount, undefined);
});

test("preserves fully discounted usage and negative adjustments", () => {
  const summary = summarizeCopilotBilling([
    {
      date: "2026-09-02",
      sku: "copilot_ai_credit",
      quantity: -10,
      cost: -0.1,
      grossAmount: -0.1,
      discountAmount: 0,
    },
    {
      date: "2026-09-01",
      sku: "copilot_ai_credit",
      quantity: 100,
      cost: 0,
      grossAmount: 1,
      discountAmount: 1,
    },
  ]);

  assert.equal(summary.cost, -0.1);
  assert.equal(summary.usageGroups[0].quantity, 90);
  assert.equal(summary.usageGroups[0].dailyData[0].quantity, 100);
  assert.equal(summary.usageGroups[0].dailyData[1].quantity, -10);
  assert.deepEqual(
    summary.dailyCosts.map((day) => day.date),
    ["2026-09-01", "2026-09-02"],
  );
});

test("recomputes totals and organization costs from the filtered rows only", () => {
  const rows = [
    {
      date: "2026-09-01",
      sku: "copilot_ai_credit",
      quantity: 100,
      cost: 1,
      organization: "alpha",
    },
    {
      date: "2026-09-02",
      sku: "copilot_ai_credit",
      quantity: 200,
      cost: 2,
      organization: "beta",
    },
  ];
  const summary = summarizeCopilotBilling(
    rows.filter((item) => item.organization === "beta"),
  );

  assert.equal(summary.cost, 2);
  assert.equal(summary.usageGroups[0].quantity, 200);
  assert.deepEqual(summary.organizations, [{ organization: "beta", cost: 2 }]);
  assert.deepEqual(
    summary.dailyCosts.map((day) => day.date),
    ["2026-09-02"],
  );
});

test("imports quoted commas, escaped quotes, and embedded newlines", () => {
  const result = parseCSV(
    'date,product,sku,quantity,net_amount,cost_center_name\r\n2026-09-01,copilot,copilot_ai_credit,100,1,"Engineering, ""Shared""\nPlatform"\r\n',
  );

  assert.equal(
    result.categorizedData.copilot[0].costCenter,
    'Engineering, "Shared"\nPlatform',
  );
  assert.equal(result.diagnostics.totalRows, 1);
  assert.equal(result.diagnostics.acceptedRows, 1);
});

test("retains custom-image storage and unmatched products and SKUs", () => {
  const result = parseCSV(
    [
      "date,product,sku,quantity,unit_type,net_amount",
      "2026-09-01,actions,actions_custom_image_storage,1800,gigabyte-hours,0.17",
      "2026-09-01,actions,actions_cache_storage,10,gigabyte-hours,0.02",
      "2026-09-01,actions,actions_future_meter,4,widgets,1",
      "2026-09-01,new_product,new_sku,1,items,2",
    ].join("\n"),
  );

  assert.equal(result.categorizedData.actionsStorage.length, 2);
  assert.equal(result.categorizedData.other.length, 2);
  assert.equal(result.records.length, 4);
  assert.equal(result.diagnostics.otherRows, 2);
  assert.equal(result.diagnostics.rejectedRows.length, 0);
  assert.ok(Math.abs(result.diagnostics.acceptedTotals.cost - 3.19) < 1e-9);
  assert.ok(Math.abs(result.diagnostics.sourceTotals.cost - 3.19) < 1e-9);
});

test("rejects invalid numbers and impossible dates without losing their known charges", () => {
  const result = parseCSV(
    [
      "date,product,sku,quantity,net_amount",
      "2026-09-01,copilot,copilot_ai_credit,100,1",
      "2026-09-02,copilot,copilot_ai_credit,2minutes,3",
      "2026-02-30,copilot,copilot_ai_credit,100,4",
    ].join("\n"),
  );

  assert.equal(result.records.length, 1);
  assert.equal(result.diagnostics.totalRows, 3);
  assert.equal(result.diagnostics.acceptedRows, 1);
  assert.equal(result.diagnostics.rejectedRows.length, 2);
  assert.match(result.diagnostics.rejectedRows[0].reason, /quantity/i);
  assert.match(result.diagnostics.rejectedRows[1].reason, /date/i);
  assert.equal(result.diagnostics.sourceTotals.cost, 8);
  assert.equal(result.diagnostics.acceptedTotals.cost, 1);
  assert.equal(result.diagnostics.rejectedTotals.cost, 7);
});

test("validates required headers and does not confuse quantity with unit price", () => {
  assert.throws(
    () =>
      parseCSV(
        "date,product,sku,quantity\n2026-09-01,copilot,copilot_ai_credit,100",
      ),
    /net_amount/i,
  );
  const result = parseCSV(
    "date,product,sku,applied_cost_per_quantity,quantity,net_amount\n2026-09-01,copilot,copilot_ai_credit,0.01,100,1",
  );

  assert.equal(result.categorizedData.copilot[0].quantity, 100);
  assert.equal(result.categorizedData.copilot[0].appliedCostPerQuantity, 0.01);
});

test("separates Codespaces and Packages units while combining money", () => {
  const rows = [
    {
      date: "2026-09-01",
      sku: "codespaces_compute",
      unitType: "core-hours",
      quantity: 2,
      cost: 1,
    },
    {
      date: "2026-09-01",
      sku: "codespaces_storage",
      unitType: "gigabyte-hours",
      quantity: 100,
      cost: 2,
    },
  ];
  const summary = summarizeBilling(rows);
  assert.equal(summary.cost, 3);
  assert.equal(summary.quantity, undefined);
  assert.deepEqual(
    summary.usageGroups.map((group) => group.quantity),
    [2, 100],
  );
  const [organization] = groupBilling(rows, "organization");
  assert.equal(organization.quantity, undefined);
  assert.equal(organization.mixedUnits, true);
  assert.throws(
    () => rankWithOther(groupBilling(rows, "sku"), "quantity"),
    /single usage unit/,
  );
});

test("ranks by the active metric and reconciles the complete Other remainder", () => {
  const rows = Array.from({ length: 9 }, (_, index) => ({
    date: "2026-09-01",
    sku: `actions_linux_${index}`,
    unitType: "minutes",
    cost: index + 1,
    quantity: 100 - index,
  }));
  const groups = groupBilling(rows, "sku");
  const originalOrder = groups.map((group) => group.key);
  const byCost = rankWithOther(groups, "cost");
  const byQuantity = rankWithOther(groups, "quantity");
  assert.equal(byCost.length, 7);
  assert.equal(byCost[0].label, "actions_linux_8");
  assert.equal(byQuantity[0].label, "actions_linux_0");
  assert.equal(byCost[6].label, "Other (3)");
  assert.equal(
    byCost.reduce((total, group) => total + group.cost, 0),
    45,
  );
  assert.equal(
    byQuantity.reduce((total, group) => total + group.quantity, 0),
    rows.reduce((total, row) => total + row.quantity, 0),
  );
  assert.deepEqual(
    groups.map((group) => group.key),
    originalOrder,
  );
  const trend = rankedDailyData(byCost, "cost");
  assert.equal(
    trend.series.reduce(
      (total, series) => total + trend.points[0][series.key],
      0,
    ),
    45,
  );
});

test("preserves refunds in cumulative spend and does not invent daily changes across gaps", () => {
  const timeline = getBillingTimeline([
    { date: "2026-09-03", sku: "example", quantity: 1, cost: 7 },
    { date: "2026-09-01", sku: "example", quantity: 1, cost: 10 },
    { date: "2026-09-04", sku: "example", quantity: -1, cost: -2 },
  ]);
  assert.deepEqual(
    timeline.daily.map((day) => day.cumulative),
    [10, 17, 15],
  );
  assert.deepEqual(
    timeline.daily.map((day) => day.change),
    [undefined, undefined, -9],
  );
  assert.equal(timeline.missingDays, 1);
  assert.equal(timeline.monthlyEstimate, undefined);
  assert.equal(timeline.partialPeriod, true);
});

test("labels partial calendar periods and bounds monthly estimates to one contiguous month", () => {
  const rows = [
    { date: "2026-09-01", sku: "example", quantity: 1, cost: 1 },
    { date: "2026-09-02", sku: "example", quantity: 1, cost: 3 },
  ];
  const timeline = getBillingTimeline(rows);
  assert.equal(timeline.partialPeriod, true);
  assert.equal(timeline.monthlyEstimate, 60);
  assert.equal(timeline.averageReportedDay, 2);
  assert.equal(
    getBillingTimeline([...rows, { ...rows[0], date: "2026-10-01" }])
      .monthlyEstimate,
    undefined,
  );
});

test("formats chart dates in UTC regardless of the viewer time zone", () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ["America/Los_Angeles", "Asia/Tokyo", "UTC"]) {
      process.env.TZ = zone;
      assert.equal(formatChartDate("2026-09-01"), "Sep 1");
      assert.equal(formatChartDate("2026-01-01", true), "Jan 1, 2026");
      assert.equal(spansMultipleYears(["2026-01-01", "2026-12-31"]), false);
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("preserves detailed user/model/token fields without double-counting cached tokens", () => {
  const parsed = parseCSV(
    "date,product,sku,quantity,unit_type,net_amount,user_login,model_name,input_tokens,output_tokens,cached_input_tokens,total_tokens\n2026-09-01,copilot,copilot_ai_credit,100,ai-credits,1,alice,model-a,10,3,4,13",
  );
  const details = summarizeCopilotDetails(parsed.records);
  assert.equal(details.hasUsers, true);
  assert.equal(details.hasModels, true);
  assert.equal(details.byUser[0].label, "alice");
  assert.equal(details.byModel[0].label, "model-a");
  assert.equal(details.tokens.totalTokens, 13);
  assert.equal(details.tokens.cachedTokens, 4);
  assert.equal(
    summarizeCopilotDetails([
      { date: "2026-09-01", sku: "copilot_ai_credit", quantity: 10, cost: 0.1 },
    ]).tokenRows,
    0,
  );
});

test("exports filtered rows with quoted metadata and numeric refunds intact", () => {
  const parsed = parseCSV(
    'date,product,sku,quantity,net_amount,cost_center_name,custom_field\n2026-09-01,copilot,copilot_ai_credit,100,1,"Engineering, Shared",kept\n2026-09-02,copilot,copilot_ai_credit,-20,-0.2,"Engineering, Shared",refund',
  );
  const exported = serializeRows(parsed.records.filter((row) => row.cost < 0));
  const roundTrip = parseCSV(exported);
  assert.equal(roundTrip.records.length, 1);
  assert.equal(roundTrip.records[0].quantity, -20);
  assert.equal(roundTrip.records[0].cost, -0.2);
  assert.equal(roundTrip.records[0].grossAmount, undefined);
  assert.equal(roundTrip.records[0].costCenter, "Engineering, Shared");
  assert.equal(roundTrip.records[0].source.custom_field, "refund");
});

test("protects CSV text from spreadsheet formulas without changing negative numbers", () => {
  const rows = [
    {
      date: "2026-09-01",
      product: "copilot",
      sku: "copilot_ai_credit",
      quantity: -20,
      cost: -0.2,
      costCenter: "=1+1",
    },
  ];
  const exported = Papa.parse(serializeRows(rows), { header: true }).data[0];
  assert.equal(exported.cost_center_name, "'=1+1");
  assert.equal(exported.net_amount, "-0.2");
  assert.equal(exported.quantity, "-20");
});

test("exports complete reconciled summaries and explicit rejected-record reasons", () => {
  const parsed = parseCSV(
    "date,product,sku,quantity,unit_type,net_amount\n2026-09-01,codespaces,compute,2,core-hours,1\n2026-09-01,codespaces,storage,10,gigabyte-hours,2\n2026-09-01,codespaces,compute,bad,core-hours,3",
  );
  const summary = Papa.parse(
    serializeSummary(
      groupBilling(parsed.records, "organization"),
      "organization",
    ),
    { header: true },
  ).data;
  assert.equal(summary[0].net_amount, "3");
  assert.equal(summary[0].quantity, "");
  assert.equal(summary[0].unit_type, "mixed");
  const rejected = Papa.parse(
    serializeIssues(parsed.diagnostics.rejectedRows),
    { header: true },
  ).data;
  assert.equal(rejected[0].net_amount, "3");
  assert.match(rejected[0].rejection_reason, /quantity/);
  assert.equal(rejected[0].source_record, "4");
});

test("reports missing or invalid amounts and duplicate headers explicitly", () => {
  assert.throws(
    () =>
      parseCSV(
        "date,product,sku,quantity,Quantity,net_amount\n2026-09-01,copilot,example,1,1,1",
      ),
    /unique/,
  );
  const result = parseCSV(
    "date,product,sku,quantity,net_amount,gross_amount\n2026-09-01,copilot,example,1,1e309,1\n2026-09-02,copilot,example,1,2,invalid",
  );
  assert.equal(result.diagnostics.rejectedRows.length, 2);
  assert.equal(result.diagnostics.sourceTotals.cost, undefined);
  assert.equal(result.diagnostics.acceptedTotals.cost, 0);
});
