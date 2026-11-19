import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "reliability.spec.ts",
  timeout: 60000,
  workers: 1,
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
  use: {
    ...(process.env.PLAYWRIGHT_CHROME ? { channel: "chrome" } : {}),
    baseURL: "http://localhost:3217",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run demo",
    url: "http://localhost:3217",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      PORT: "3217",
      FIREBASE_PROJECT_ID: "",
      APP_ORIGIN: "http://localhost:3217",
      GEMINI_API_KEY: "",
      OPENROUTER_API_KEY: "",
    },
  },
});
