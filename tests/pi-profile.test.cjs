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
