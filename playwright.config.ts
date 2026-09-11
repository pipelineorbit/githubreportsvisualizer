import { defineConfig } from "@playwright/test";

export default defineConfig({
  testMatch: "test-visualizations.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3117",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run start -- --listen tcp://127.0.0.1:3117",
    url: "http://127.0.0.1:3117",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
