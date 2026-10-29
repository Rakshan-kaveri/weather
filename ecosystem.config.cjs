// PM2 process file: keeps the website and the background worker running and restarts them on reboot.
//   pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
module.exports = {
  apps: [
    {
      name: "skycast-web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: __dirname,
      env: { NODE_ENV: "production" },
      max_memory_restart: "600M",
    },
    {
      name: "skycast-worker",
      script: "node_modules/tsx/dist/cli.mjs",
      args: "worker/index.ts",
      cwd: __dirname,
      env: { NODE_ENV: "production" },
      max_memory_restart: "300M",
    },
  ],
};
