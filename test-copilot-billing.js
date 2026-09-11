const assert = require("node:assert/strict");
const { test } = require("node:test");
const { parseCSV } = require("./src/lib/fileParser.ts");
const { summarizeCopilotBilling } = require("./src/lib/copilotBilling.ts");

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
