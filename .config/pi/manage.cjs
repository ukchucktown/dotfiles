#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { applyProfile, packageSpecs, writeIfChanged } = require("./profile.cjs");
const sourceDir = __dirname;
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 180000,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `${command} failed (${result.status})${result.stderr ? ": " + result.stderr.trim() : ""}`,
    );
  return (result.stdout || "").trim();
}
function options(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith("--"))
      throw new Error(`Unexpected argument: ${args[i]}`);
    const key = args[i].slice(2);
    if (
      ![
        "sandbox",
        "check-only",
        "version",
        "config-dir",
        "profile-dir",
        "pi-root",
        "package-root",
      ].includes(key)
    )
      throw new Error(`Unknown option: ${args[i]}`);
    if (["sandbox", "check-only"].includes(key)) {
      result[key] = true;
      continue;
    }
    if (!args[i + 1] || args[i + 1].startsWith("--"))
      throw new Error(`Missing value for ${args[i]}`);
    result[key] = args[++i];
  }
  return result;
}
function piRoot() {
  const executable = run("which", ["pi"]);
  let directory = path.dirname(fs.realpathSync(executable));
  while (directory !== path.dirname(directory)) {
    const file = path.join(directory, "package.json");
    if (
      fs.existsSync(file) &&
      JSON.parse(fs.readFileSync(file, "utf8")).name ===
        "@earendil-works/pi-coding-agent"
    )
      return directory;
    directory = path.dirname(directory);
  }
  throw new Error("Cannot locate the Pi installation");
}
function version(root) {
  return JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
    .version;
}
function checkedVersion(configDir) {
  return fs.readFileSync(path.join(configDir, "pi-version"), "utf8").trim();
}
function exactVersion(value) {
  if (value === "latest")
    value = run("npm", ["view", "@earendil-works/pi-coding-agent", "version"]);
  if (!/^\d+\.\d+\.\d+$/.test(value))
    throw new Error("Pi version must be an exact stable release or latest");
  return value;
}
function installPackages(configDir, prefix) {
  fs.mkdirSync(prefix, { recursive: true });
  run(
    "npm",
    [
      "install",
      "--prefix",
      prefix,
      "--legacy-peer-deps",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--save-exact",
      ...packageSpecs(configDir).map((p) => p.spec),
    ],
    { stdio: "inherit" },
  );
}
function packagesPresent(configDir, root) {
  return packageSpecs(configDir).every(({ name, version }) => {
    try {
      return (
        JSON.parse(
          fs.readFileSync(path.join(root, name, "package.json"), "utf8"),
        ).version === version
      );
    } catch {
      return false;
    }
  });
}
function profile(configDir, profileDir, root, packageRoot) {
  if (version(root) !== checkedVersion(configDir))
    throw new Error(
      `Pi ${version(root)} has not passed this setup's compatibility check (verified: ${checkedVersion(configDir)}). Use pi-update.`,
    );
  packageRoot =
    packageRoot ||
    (packagesPresent(configDir, "/opt/pi-packages/node_modules")
      ? "/opt/pi-packages/node_modules"
      : path.join(profileDir, "npm/node_modules"));
  if (!packagesPresent(configDir, packageRoot)) {
    if (packageRoot.endsWith("/node_modules"))
      installPackages(configDir, path.dirname(packageRoot));
    else throw new Error("Package root must end in node_modules");
  }
  return applyProfile({ configDir, profileDir, piRoot: root, packageRoot });
}
function checkRenderer(configDir, root) {
  run("node", [path.join(configDir, "checks/renderer-check.mjs")], {
    stdio: "inherit",
    env: {
      ...process.env,
      TERM: "xterm-256color",
      FORCE_COLOR: "1",
      NO_COLOR: "",
      PI_PACKAGE_ROOT: root,
      PI_OFFLINE: "1",
    },
  });
}
function checkProfile(configDir, root, profileDir) {
  run("node", [path.join(configDir, "checks/profile-check.mjs")], {
    stdio: "inherit",
    env: {
      ...process.env,
      PI_PACKAGE_ROOT: root,
      PI_CODING_AGENT_DIR: profileDir,
      PI_OFFLINE: "1",
    },
  });
}
function candidate(configDir, target, sandbox) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "shared-pi-check-"));
  let image;
  try {
    const prefix = path.join(scratch, "pi");
    run(
      "npm",
      [
        "install",
        "--prefix",
        prefix,
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--save-exact",
        `@earendil-works/pi-coding-agent@${target}`,
      ],
      { stdio: "inherit" },
    );
    const root = path.join(
      prefix,
      "node_modules/@earendil-works/pi-coding-agent",
    );
    console.log(
      `Checking renderer against Pi ${target} on ${process.platform}...`,
    );
    checkRenderer(configDir, root);
    const packagePrefix = path.join(scratch, "packages");
    installPackages(configDir, packagePrefix);
    const profileDir = path.join(scratch, "profile");
    applyProfile({
      configDir,
      profileDir,
      piRoot: root,
      packageRoot: path.join(packagePrefix, "node_modules"),
    });
    checkProfile(configDir, root, profileDir);
    if (sandbox) {
      const base = run("docker", [
        "inspect",
        "agent-sandbox",
        "--format",
        "{{.Image}}",
      ]);
      const baseTag = "agent-sandbox:shared-pi-base";
      run("docker", ["image", "tag", base, baseTag]);
      image = `agent-sandbox:shared-pi-check-${target}`;
      run(
        "docker",
        [
          "build",
          "--pull=false",
          "--build-arg",
          `BASE_IMAGE=${baseTag}`,
          "--build-arg",
          `PI_VERSION=${target}`,
          "--file",
          path.join(configDir, "Dockerfile"),
          "--tag",
          image,
          configDir,
        ],
        { stdio: "inherit" },
      );
      const mount = `type=bind,source=${configDir},target=/opt/pi-config,readonly`;
      console.log(`Checking renderer against Pi ${target} on Linux...`);
      run(
        "docker",
        [
          "run",
          "--rm",
          "--network",
          "none",
          "--user",
          "agent",
          "--mount",
          mount,
          "--env",
          "TERM=xterm-256color",
          "--env",
          "FORCE_COLOR=1",
          "--env",
          "PI_PACKAGE_ROOT=/opt/agent-tools/node_modules/@earendil-works/pi-coding-agent",
          "--entrypoint",
          "node",
          image,
          "/opt/pi-config/checks/renderer-check.mjs",
        ],
        { stdio: "inherit" },
      );
      // The candidate uses only a temporary profile; no user credentials or home volume are mounted.
      const shell =
        "node /opt/pi-config/manage.cjs profile --config-dir /opt/pi-config --profile-dir /tmp/pi-profile --pi-root /opt/agent-tools/node_modules/@earendil-works/pi-coding-agent --package-root /opt/pi-packages/node_modules && PI_PACKAGE_ROOT=/opt/agent-tools/node_modules/@earendil-works/pi-coding-agent PI_CODING_AGENT_DIR=/tmp/pi-profile PI_OFFLINE=1 node /opt/pi-config/checks/profile-check.mjs";
      // A staged pin lets the candidate's bootstrap validate its own version without changing the working pin.
      const staged = path.join(scratch, "config");
      fs.cpSync(configDir, staged, { recursive: true });
      fs.writeFileSync(path.join(staged, "pi-version"), target + "\n");
      run(
        "docker",
        [
          "run",
          "--rm",
          "--network",
          "none",
          "--user",
          "agent",
          "--mount",
          `type=bind,source=${staged},target=/opt/pi-config,readonly`,
          "--entrypoint",
          "sh",
          image,
          "-c",
          shell,
        ],
        { stdio: "inherit" },
      );
      const startup = `shared-pi-startup-${process.pid}`;
      try {
        run("docker", [
          "run",
          "--detach",
          "--name",
          startup,
          "--network",
          "none",
          "--mount",
          `type=bind,source=${staged},target=/opt/pi-config,readonly`,
          "--entrypoint",
          "/usr/bin/tini",
          image,
          "--",
          "/opt/pi-config/sandbox-entrypoint.sh",
        ]);
        run("docker", [
          "exec",
          startup,
          "bash",
          "-c",
          "for attempt in {1..100}; do if nc -z 127.0.0.1 22; then /usr/sbin/sshd -t && exit 0; fi; sleep 0.1; done; exit 1",
        ]);
        run(
          "docker",
          [
            "exec",
            "--user",
            "agent",
            "--env",
            "PI_PACKAGE_ROOT=/opt/agent-tools/node_modules/@earendil-works/pi-coding-agent",
            "--env",
            "PI_CODING_AGENT_DIR=/home/agent/.pi/agent",
            "--env",
            "PI_OFFLINE=1",
            startup,
            "node",
            "/opt/pi-config/checks/profile-check.mjs",
          ],
          { stdio: "inherit" },
        );
        console.log("PASS: candidate sandbox startup and SSH.");
      } finally {
        spawnSync("docker", ["rm", "--force", startup], { stdio: "ignore" });
      }
    }
    return { image, target };
  } catch (error) {
    if (image) spawnSync("docker", ["image", "rm", image], { stdio: "ignore" });
    throw new Error(
      `Compatibility check failed; working installations and version pins were not changed. ${error.message}`,
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}
const assets = [
  "extensions",
  "themes",
  "checks",
  "settings.json.example",
  "pi-version",
  "profile.cjs",
  "manage.cjs",
  "prepare-sandbox.cjs",
  "sandbox-entrypoint.sh",
  "Dockerfile",
  ".dockerignore",
];
function deploy(configDir) {
  fs.mkdirSync(configDir, { recursive: true });
  if (path.resolve(configDir) !== path.resolve(sourceDir))
    for (const name of assets)
      fs.cpSync(path.join(sourceDir, name), path.join(configDir, name), {
        recursive: true,
      });
  const bin = path.join(os.homedir(), ".local/bin");
  fs.mkdirSync(bin, { recursive: true });
  const updater = path.join(bin, "pi-update");
  fs.writeFileSync(
    updater,
    `#!/bin/sh\nexec node '${path.join(configDir, "manage.cjs").replace(/'/g, "'\\''")}' update "$@"\n`,
    { mode: 0o755 },
  );
  fs.chmodSync(updater, 0o755);
}
function configureSandbox(configDir, target, image) {
  const directory = path.join(
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"),
    "agent-sandbox",
  );
  const file = path.join(directory, "compose.mounts.yaml");
  const config = JSON.parse(fs.readFileSync(file, "utf8"));
  const envFile = path.join(directory, "agent-sandbox.env");
  const current = fs.readFileSync(envFile, "utf8");
  const pin = `PI_CLI_VERSION=${target}`;
  const nextEnvironment = /^PI_CLI_VERSION=.*$/m.test(current)
    ? current.replace(/^PI_CLI_VERSION=.*$/m, pin)
    : `${current}${current && !current.endsWith("\n") ? "\n" : ""}${pin}\n`;
  const service = config.services.sandbox;
  service.volumes = service.volumes.filter(
    (v) => v.target !== "/opt/pi-config",
  );
  service.volumes.push({
    type: "bind",
    source: fs.realpathSync(configDir),
    target: "/opt/pi-config",
    read_only: true,
    bind: { create_host_path: false },
  });
  service.entrypoint = [
    "/usr/bin/tini",
    "--",
    "/opt/pi-config/sandbox-entrypoint.sh",
  ];
  writeIfChanged(file, JSON.stringify(config, null, 2) + "\n");
  writeIfChanged(envFile, nextEnvironment);
  run("docker", ["image", "tag", image, "agent-sandbox:local"]);
  const project = run("docker", [
    "inspect",
    "agent-sandbox",
    "--format",
    '{{index .Config.Labels "com.docker.compose.project.working_dir"}}',
  ]);
  run(path.join(project, "sandbox"), ["up"], {
    cwd: project,
    stdio: "inherit",
  });
  run("docker", [
    "exec",
    "agent-sandbox",
    "bash",
    "-c",
    "for attempt in {1..100}; do if nc -z 127.0.0.1 22; then /usr/sbin/sshd -t && exit 0; fi; sleep 0.1; done; exit 1",
  ]);
  const actual = run("docker", [
    "exec",
    "--user",
    "agent",
    "agent-sandbox",
    "pi",
    "--version",
  ]);
  if (actual !== target)
    throw new Error(`Sandbox Pi version mismatch: ${actual}`);
}
function acquireLock(configDir) {
  const hash = require("node:crypto")
    .createHash("sha256")
    .update(path.resolve(configDir))
    .digest("hex")
    .slice(0, 20);
  const directory = path.join(
    os.tmpdir(),
    `shared-pi-lock-${process.getuid?.() ?? "user"}-${hash}`,
  );
  try {
    fs.mkdirSync(directory, { mode: 0o700 });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const file = path.join(directory, "pid");
    const pid = fs.existsSync(file)
      ? Number(fs.readFileSync(file, "utf8"))
      : NaN;
    if (!Number.isInteger(pid) || pid <= 0)
      throw new Error(`An update lock needs inspection: ${directory}`);
    try {
      process.kill(pid, 0);
      throw new Error(`Another Pi setup/update is active (pid ${pid}).`);
    } catch (problem) {
      if (problem.code !== "ESRCH") throw problem;
    }
    fs.rmSync(directory, { recursive: true });
    fs.mkdirSync(directory, { mode: 0o700 });
  }
  fs.writeFileSync(path.join(directory, "pid"), String(process.pid));
  return () => fs.rmSync(directory, { recursive: true, force: true });
}
function main() {
  const command = process.argv[2] || "help";
  const opts = options(process.argv.slice(3));
  const configDir = path.resolve(
    opts["config-dir"] ||
      path.join(
        process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"),
        "pi",
      ),
  );
  const profileDir = path.resolve(
    opts["profile-dir"] ||
      process.env.PI_CODING_AGENT_DIR ||
      path.join(os.homedir(), ".pi/agent"),
  );
  if (command === "profile") {
    profile(
      configDir,
      profileDir,
      opts["pi-root"] || piRoot(),
      opts["package-root"],
    );
    return;
  }
  if (!["apply", "check", "update"].includes(command)) {
    console.log(
      "Usage: setup-pi apply [--sandbox] | setup-pi check --version VERSION [--sandbox] | pi-update [--version VERSION]\nUpdates test native and configured sandbox installations before application.",
    );
    return;
  }
  const deploymentFile = path.join(configDir, "deployment.json");
  const deployment = fs.existsSync(deploymentFile)
    ? JSON.parse(fs.readFileSync(deploymentFile, "utf8"))
    : {};
  const sandbox = opts.sandbox || deployment.sandbox === true;
  const target = exactVersion(
    opts.version ||
      (command === "update" ? "latest" : checkedVersion(sourceDir)),
  );
  const unlock = acquireLock(configDir);
  try {
    const result = candidate(sourceDir, target, sandbox);
    if (command === "check" || opts["check-only"]) {
      console.log(
        `PASS: shared Pi renderer/setup checks passed for ${target}. Nothing was applied.`,
      );
      if (result.image) run("docker", ["image", "rm", result.image]);
      return;
    }
    if (version(piRoot()) !== target)
      run(
        "npm",
        [
          "install",
          "--global",
          "--ignore-scripts",
          "--no-audit",
          "--no-fund",
          `@earendil-works/pi-coding-agent@${target}`,
        ],
        { stdio: "inherit" },
      );
    deploy(configDir);
    writeIfChanged(path.join(configDir, "pi-version"), target + "\n");
    profile(configDir, profileDir, piRoot());
    if (sandbox) configureSandbox(configDir, target, result.image);
    const sourceConfigDir = deployment.sourceConfigDir || sourceDir;
    writeIfChanged(
      deploymentFile,
      JSON.stringify({ sandbox, version: target, sourceConfigDir }, null, 2) +
        "\n",
    );
    if (command === "update") {
      writeIfChanged(path.join(sourceDir, "pi-version"), target + "\n");
      const sourcePin = path.join(sourceConfigDir, "pi-version");
      if (
        fs.existsSync(sourcePin) &&
        [deployment.version, target].includes(
          fs.readFileSync(sourcePin, "utf8").trim(),
        )
      )
        writeIfChanged(sourcePin, target + "\n");
    }
    console.log(
      `Applied shared Pi ${target}${sandbox ? " locally and in Agent Sandbox" : ""}.`,
    );
  } finally {
    unlock();
  }
}
module.exports = { candidate, profile, deploy, configureSandbox, acquireLock };
if (require.main === module)
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
