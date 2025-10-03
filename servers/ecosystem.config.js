require("dotenv").config();
const { execSync } = require("child_process");

const interpreter = execSync("which bun").toString().trim();

module.exports = {
  apps: [
    {
      interpreter,
      instances: 1,
      name: "trpc",
      exec_mode: "fork",
      increment_var: "PORT",
      script: "trpc/src/index.ts",
      env: {
        PORT: 8000,
      },
    },
    {
      interpreter,
      instances: 1,
      exec_mode: "fork",
      name: "worker.jobs",
      cron_restart: "*/2 * * * *",
      script: "worker/src/jobs/index.ts",
    },
  ],
};
