const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
test(
  "a broken compatibility patch blocks an update before deployment",
  {
    skip:
      process.env.RUN_PI_GATE_TEST !== "1" &&
      "Set RUN_PI_GATE_TEST=1 to exercise a real candidate install",
    timeout: 180000,
  },
  (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "pi-failed-gate-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const config = path.join(root, "config");
    fs.cpSync(path.resolve(__dirname, "../.config/pi"), config, {
      recursive: true,
    });
    const compat = path.join(config, "extensions/compat.ts");
    fs.writeFileSync(
      compat,
      fs
        .readFileSync(compat, "utf8")
        .replace('"updateContent"', '"missingPiCompatibilityMethod"'),
    );
    const pin = fs.readFileSync(path.join(config, "pi-version"), "utf8");
    const before = spawnSync("pi", ["--version"], { encoding: "utf8" }).stdout;
    const deployed = path.join(root, "deployed"),
      profile = path.join(root, "profile");
    const result = spawnSync(
      "node",
      [
        path.join(config, "manage.cjs"),
        "update",
        "--version",
        pin.trim(),
        "--config-dir",
        deployed,
        "--profile-dir",
        profile,
      ],
      { encoding: "utf8", timeout: 150000 },
    );
    assert.ifError(result.error);
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Compatibility check failed; working installations and version pins were not changed/,
    );
    assert.equal(
      spawnSync("pi", ["--version"], { encoding: "utf8" }).stdout,
      before,
    );
    assert.equal(fs.readFileSync(path.join(config, "pi-version"), "utf8"), pin);
    assert.ok(!fs.existsSync(deployed));
    assert.ok(!fs.existsSync(profile));
  },
);
