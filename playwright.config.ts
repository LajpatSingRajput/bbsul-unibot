import { defineConfig } from "@playwright/test";
import chromium from "@sparticuz/chromium";
const launchOptions = process.env.CHROMIUM_EXECUTABLE
  ? {
      executablePath: process.env.CHROMIUM_EXECUTABLE,
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--no-zygote",
      ],
    }
  : {};
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  use: {
    launchOptions,
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run demo",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
