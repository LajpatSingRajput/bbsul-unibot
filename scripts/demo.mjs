import { spawn } from "node:child_process";
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "0.0.0.0"],
  { stdio: "inherit", env: { ...process.env, DEMO_MODE: "true" } },
);
child.on("exit", (code) => process.exit(code || 0));
