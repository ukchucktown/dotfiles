const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { applyProfile, packageSpecs } = require("../.config/pi/profile.cjs");
const configDir = path.resolve(__dirname, "../.config/pi");
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pi-profile-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const profileDir = path.join(root, "profile"),
    piRoot = path.join(root, "pi"),
    packageRoot = path.join(root, "node_modules");
  fs.mkdirSync(path.join(profileDir, "extensions"), { recursive: true });
  fs.mkdirSync(path.join(profileDir, "themes"));
  fs.mkdirSync(path.join(piRoot, "examples/extensions/plan-mode"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(piRoot, "examples/extensions/plan-mode/index.ts"),
    "",
  );
  for (const { name, version } of packageSpecs(configDir)) {
    fs.mkdirSync(path.join(packageRoot, name), { recursive: true });
    fs.writeFileSync(
      path.join(packageRoot, name, "package.json"),
      JSON.stringify({ name, version }),
    );
  }
  return { configDir, profileDir, piRoot, packageRoot };
}
test("shared setup is idempotent and preserves credentials, history, and unrelated preferences", (t) => {
  const f = fixture(t),
    file = path.join(f.profileDir, "settings.json");
  const old = {
    customPreference: { enabled: false },
    lastChangelogVersion: "fixture",
    packages: ["npm:other-package@3.0.0", "npm:pi-web-access@0.1.0"],
    extensions: ["/fixture/extra.ts"],
    themes: ["/fixture/other.json"],
  };
  fs.writeFileSync(file, JSON.stringify(old));
  fs.writeFileSync(path.join(f.profileDir, "auth.json"), "private-fixture");
  fs.mkdirSync(path.join(f.profileDir, "sessions"));
  fs.writeFileSync(
    path.join(f.profileDir, "sessions/fixture.jsonl"),
    "history-fixture",
  );
  for (const name of [
    "moshi-hooks.ts",
    "superset-hooks.ts",
    "agent-sandbox-renderer.ts",
    "extra.ts",
  ])
    fs.writeFileSync(path.join(f.profileDir, "extensions", name), "fixture");
  fs.writeFileSync(
    path.join(f.profileDir, "themes/agent-sandbox.json"),
    "old-theme",
  );
  const first = applyProfile(f),
    contents = fs.readFileSync(file, "utf8"),
    mtime = fs.statSync(file).mtimeMs;
  assert.deepEqual(first.customPreference, old.customPreference);
  assert.equal(first.lastChangelogVersion, "fixture");
  assert.ok(first.packages.includes(old.packages[0]));
  assert.ok(first.extensions.includes("/fixture/extra.ts"));
  assert.ok(first.themes.includes("/fixture/other.json"));
  assert.equal(
    fs.readFileSync(path.join(f.profileDir, "auth.json"), "utf8"),
    "private-fixture",
  );
  assert.equal(
    fs.readFileSync(path.join(f.profileDir, "sessions/fixture.jsonl"), "utf8"),
    "history-fixture",
  );
  for (const name of [
    "moshi-hooks.ts",
    "superset-hooks.ts",
    "agent-sandbox-renderer.ts",
  ])
    assert.ok(!fs.existsSync(path.join(f.profileDir, "extensions", name)));
  assert.ok(fs.existsSync(path.join(f.profileDir, "extensions/extra.ts")));
  assert.ok(
    !fs.existsSync(path.join(f.profileDir, "themes/agent-sandbox.json")),
  );
  applyProfile(f);
  assert.equal(fs.readFileSync(file, "utf8"), contents);
  assert.equal(fs.statSync(file).mtimeMs, mtime);
});
test("invalid existing settings cause no deletion or replacement", (t) => {
  const f = fixture(t),
    file = path.join(f.profileDir, "settings.json"),
    hook = path.join(f.profileDir, "extensions/moshi-hooks.ts");
  fs.writeFileSync(file, "invalid-json");
  fs.writeFileSync(hook, "keep");
  assert.throws(() => applyProfile(f));
  assert.equal(fs.readFileSync(file, "utf8"), "invalid-json");
  assert.equal(fs.readFileSync(hook, "utf8"), "keep");
});
test("sandbox bootstrap disables only Pi hooks and refreshes the shared setup on every start", (t) => {
  const f = fixture(t),
    file = path.join(f.profileDir, "entrypoint");
  fs.writeFileSync(
    file,
    '#!/bin/bash\ngosu agent env HOME="${agent_home}" initialize-claude\n\n' +
      'gosu agent install -D -m 0644 /etc/agent-shell/pi-renderer.ts \\\n  "${agent_home}/.pi/agent/extensions/agent-sandbox-renderer.ts"\n' +
      "moshi-hook install --target codex --target claude --target pi\n",
  );
  const { spawnSync } = require("node:child_process");
  const script = path.join(configDir, "prepare-sandbox.cjs");
  assert.equal(spawnSync("node", [script, file]).status, 0);
  const first = fs.readFileSync(file, "utf8");
  assert.ok(first.includes("/opt/pi-config/manage.cjs profile"));
  assert.ok(first.includes("--target codex --target claude"));
  assert.ok(!first.includes("--target pi"));
  assert.ok(!first.includes("/etc/agent-shell/pi-renderer.ts"));
  assert.equal(spawnSync("node", [script, file]).status, 0);
  assert.equal(fs.readFileSync(file, "utf8"), first);
});
test("a concurrent setup/update cannot acquire the same deployment lock", () => {
  const { acquireLock } = require("../.config/pi/manage.cjs");
  const release = acquireLock("/fixture/shared-pi-config");
  try {
    assert.throws(
      () => acquireLock("/fixture/shared-pi-config"),
      /Another Pi setup\/update is active/,
    );
  } finally {
    release();
  }
  acquireLock("/fixture/shared-pi-config")();
});
test("unknown update options fail before any candidate or deployment action", () => {
  const { spawnSync } = require("node:child_process");
  const result = spawnSync(
    "node",
    [path.join(configDir, "manage.cjs"), "update", "--check", "latest"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown option: --check/);
  assert.equal(result.stdout, "");
});

function sandboxFixture(t, environment) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pi-sandbox-config-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const configHome = path.join(root, "config"),
    sandboxDir = path.join(configHome, "agent-sandbox"),
    bin = path.join(root, "bin"),
    project = path.join(root, "project"),
    log = path.join(root, "commands.jsonl"),
    target = fs.readFileSync(path.join(configDir, "pi-version"), "utf8").trim();
  for (const directory of [sandboxDir, bin, project])
    fs.mkdirSync(directory, { recursive: true });
  const mounts = path.join(sandboxDir, "compose.mounts.yaml"),
    envFile = path.join(sandboxDir, "agent-sandbox.env");
  const originalMounts = JSON.stringify({
    services: {
      sandbox: {
        ports: ["49222:22"],
        volumes: [
          { type: "bind", source: "/fixture/project", target: "/workspace" },
          { type: "bind", source: "/fixture/old-pi", target: "/opt/pi-config" },
        ],
      },
    },
  });
  fs.writeFileSync(mounts, originalMounts);
  if (environment !== undefined) fs.writeFileSync(envFile, environment);
  fs.writeFileSync(
    path.join(bin, "docker"),
    '#!/usr/bin/env node\nconst fs = require("node:fs");\n' +
      'const args = process.argv.slice(2);\n' +
      'fs.appendFileSync(process.env.FIXTURE_LOG, JSON.stringify(args) + "\\n");\n' +
      'if (args[0] === "inspect") console.log(process.env.FIXTURE_PROJECT);\n' +
      'if (args[0] === "exec" && args.at(-2) === "pi" && args.at(-1) === "--version") console.log(process.env.FIXTURE_TARGET);\n',
    { mode: 0o755 },
  );
  fs.writeFileSync(
    path.join(project, "sandbox"),
    '#!/usr/bin/env node\nrequire("node:fs").appendFileSync(process.env.FIXTURE_LOG, JSON.stringify(["sandbox", ...process.argv.slice(2)]) + "\\n");\n',
    { mode: 0o755 },
  );
  const invoke = () => {
    const { spawnSync } = require("node:child_process");
    return spawnSync(
      process.execPath,
      [
        "-e",
        'require(process.argv[1]).configureSandbox(process.argv[2], process.argv[3], "fixture-image")',
        path.join(configDir, "manage.cjs"),
        configDir,
        target,
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          XDG_CONFIG_HOME: configHome,
          PATH: bin + path.delimiter + process.env.PATH,
          FIXTURE_LOG: log,
          FIXTURE_PROJECT: project,
          FIXTURE_TARGET: target,
        },
      },
    );
  };
  return { mounts, envFile, originalMounts, target, log, invoke };
}

test("sandbox setup adds a Pi pin to an environment copied from the tracked template", (t) => {
  const template = fs.readFileSync(
    path.resolve(__dirname, "../.config/agent-sandbox/agent-sandbox.env.example"),
    "utf8",
  );
  const f = sandboxFixture(t, template);
  const result = f.invoke();
  assert.equal(result.status, 0, result.stderr);
  const updated = fs.readFileSync(f.envFile, "utf8");
  assert.ok(updated.includes(`PI_CLI_VERSION=${f.target}\n`));
  assert.equal(updated.replace(/^PI_CLI_VERSION=.*\n/m, ""), template);
  const service = JSON.parse(fs.readFileSync(f.mounts, "utf8")).services.sandbox;
  assert.deepEqual(service.ports, ["49222:22"]);
  assert.equal(service.volumes.filter((v) => v.target === "/opt/pi-config").length, 1);
  assert.equal(service.volumes.find((v) => v.target === "/opt/pi-config").read_only, true);
  const commands = fs.readFileSync(f.log, "utf8").trim().split("\n").map(JSON.parse);
  assert.ok(commands.some((args) => args[0] === "sandbox" && args[1] === "up"));
  assert.ok(commands.some((args) => args[0] === "exec" && args.at(-1) === "--version"));
  assert.equal(f.invoke().status, 0);
  assert.equal(fs.readFileSync(f.envFile, "utf8"), updated, "Repeat setup does not duplicate the pin");
});

test("sandbox setup handles a missing final newline and replaces an existing Pi pin", (t) => {
  for (const current of ["", "CUSTOM=keep", "CUSTOM=keep\nPI_CLI_VERSION=0.0.0\n# keep this comment\n"]) {
    const f = sandboxFixture(t, current);
    const result = f.invoke();
    assert.equal(result.status, 0, result.stderr);
    const updated = fs.readFileSync(f.envFile, "utf8");
    assert.equal((updated.match(/^PI_CLI_VERSION=/gm) || []).length, 1);
    assert.match(updated, new RegExp(`^PI_CLI_VERSION=${f.target.replaceAll(".", "\\.")}$`, "m"));
    if (current.includes("CUSTOM=keep")) assert.match(updated, /^CUSTOM=keep$/m);
    if (current.includes("# keep this comment")) assert.ok(updated.includes("# keep this comment"));
  }
});

test("an unreadable sandbox environment leaves mounts unchanged before deployment", (t) => {
  const f = sandboxFixture(t);
  const result = f.invoke();
  assert.notEqual(result.status, 0);
  assert.equal(fs.readFileSync(f.mounts, "utf8"), f.originalMounts);
  assert.ok(!fs.existsSync(f.log), "No Docker or sandbox command ran");
});
