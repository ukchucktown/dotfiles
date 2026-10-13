import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
const root = process.env.PI_PACKAGE_ROOT;
const profile = process.env.PI_CODING_AGENT_DIR;
assert.ok(root && profile, "Pi package and profile paths are required");
const { DefaultResourceLoader } = await import(
  pathToFileURL(path.join(root, "dist/index.js")).href
);
const loader = new DefaultResourceLoader({
  cwd: "/tmp",
  agentDir: profile,
  noContextFiles: true,
  noSkills: true,
  noPromptTemplates: true,
});
await loader.reload();
const result = loader.getExtensions();
assert.deepEqual(
  result.errors,
  [],
  "All shared packages and extensions must load",
);
const files = result.extensions.map((e) => e.resolvedPath);
assert.equal(
  files.filter((p) => p.endsWith("/extensions/renderer.ts")).length,
  1,
  "One shared renderer loads",
);
assert.ok(
  files.some((p) => p.endsWith("/plan-mode/index.ts")),
  "Plan mode loads",
);
assert.ok(
  files.some((p) => p.includes("pi-web-access")),
  "Web access loads",
);
assert.ok(
  files.some((p) => p.includes("pi-subagents")),
  "Subagents load",
);
assert.ok(
  files.every(
    (p) => !/(moshi-hooks|superset-hooks|agent-sandbox-renderer)\.ts$/.test(p),
  ),
  "Legacy hooks and renderer do not load",
);
const themeApi = await import(
  pathToFileURL(path.join(root, "dist/modes/interactive/theme/theme.js")).href
);
const schemaApi = await import(
  pathToFileURL(path.join(root, "dist/modes/interactive/theme/theme-schema.js"))
    .href
);
themeApi.setThemeJsonValidator(schemaApi.validateThemeJson);
const settings = JSON.parse(
  fs.readFileSync(path.join(profile, "settings.json"), "utf8"),
);
const themePath = settings.themes.find((p) =>
  p.endsWith("/themes/agent-sandbox.json"),
);
assert.ok(themePath);
assert.equal(themeApi.loadThemeFromPath(themePath).name, "agent-sandbox");
console.log(
  "PASS: shared renderer, theme resources, plan mode, web access, and subagents load without hooks.",
);
