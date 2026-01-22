const { spawn } = require("child_process");
const os = require("os");

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

const localIp = getLocalIp();
const domain = `${localIp}:5000`;

console.log(`\x1b[32m[Automation]\x1b[0m Local IP detected: ${localIp}`);
console.log(
  `\x1b[32m[Automation]\x1b[0m Setting EXPO_PUBLIC_DOMAIN to ${domain}`,
);

// Start Backend
const server = spawn("npm", ["run", "server:dev"], {
  shell: true,
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "development" },
});

// Start Frontend after a short delay
setTimeout(() => {
  console.log("\x1b[32m[Automation]\x1b[0m Launching Expo on Android...");
  const expo = spawn("npx", ["expo", "start", "--android"], {
    shell: true,
    stdio: "inherit",
    env: {
      ...process.env,
      EXPO_PUBLIC_DOMAIN: domain,
      REACT_NATIVE_PACKAGER_HOSTNAME: localIp,
    },
  });

  expo.on("exit", (code) => {
    server.kill();
    process.exit(code);
  });
}, 3000);

process.on("SIGINT", () => {
  server.kill();
  process.exit();
});
