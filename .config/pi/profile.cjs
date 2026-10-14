const fs = require("node:fs");
const path = require("node:path");
const managedNames = ["pi-web-access", "pi-subagents", "pi-tool-display"];
const legacyFiles = [
  "moshi-hooks.ts",
  "superset-hooks.ts",
  "agent-sandbox-renderer.ts",
];
function packageSpecs(configDir) {
  const settings = JSON.parse(
    fs.readFileSync(path.join(configDir, "settings.json.example"), "utf8"),
  );
  return settings.packages.map((source) => {
    const match = /^npm:((?:@[^/]+\/)?[^@]+)@(\d+\.\d+\.\d+)$/.exec(source);
    if (!match)
      throw new Error(`A shared package needs an exact version: ${source}`);
    return {
      name: match[1],
      version: match[2],
      spec: `${match[1]}@${match[2]}`,
    };
  });
}
function sourceOf(entry) {
  return typeof entry === "string" ? entry : entry?.source;
}
function isManaged(entry) {
  const source = sourceOf(entry) || "";
  return (
    managedNames.some(
      (name) =>
        path.basename(source).split("@")[0] === name ||
        source.startsWith(`npm:${name}@`),
    ) || /examples\/extensions\/plan-mode\/index\.ts$/.test(source)
  );
}
function isLegacyExtension(value) {
  return (
    typeof value === "string" && legacyFiles.includes(path.basename(value))
  );
}
function writeIfChanged(file, contents) {
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === contents) return;
  const temporary = `${file}.shared-pi-${process.pid}`;
  fs.writeFileSync(temporary, contents, { mode: 0o600 });
  fs.renameSync(temporary, file);
}
function removeFile(file) {
  if (!fs.existsSync(file) && !fs.lstatSync(file, { throwIfNoEntry: false }))
    return;
  if (fs.lstatSync(file).isDirectory())
    throw new Error(`Refusing to remove a directory: ${file}`);
  fs.unlinkSync(file);
}
function applyProfile({ configDir, profileDir, piRoot, packageRoot }) {
  const template = JSON.parse(
    fs.readFileSync(path.join(configDir, "settings.json.example"), "utf8"),
  );
  const settingsFile = path.join(profileDir, "settings.json");
  const current = fs.existsSync(settingsFile)
    ? JSON.parse(fs.readFileSync(settingsFile, "utf8"))
    : {};
  if (!current || typeof current !== "object" || Array.isArray(current))
    throw new Error("Pi settings must be an object");
  for (const key of ["packages", "extensions", "themes"]) {
    if (current[key] !== undefined && !Array.isArray(current[key]))
      throw new Error(`Pi ${key} must be an array`);
  }
  const renderer = path.join(configDir, "extensions/renderer.ts");
  const theme = path.join(configDir, "themes/agent-sandbox.json");
  const plan = path.join(piRoot, "examples/extensions/plan-mode/index.ts");
  for (const file of [renderer, theme, plan])
    if (!fs.existsSync(file))
      throw new Error(`Required Pi resource is absent: ${file}`);
  const specs = packageSpecs(configDir);
  const packages = specs.map(({ name, version }) => {
    const directory = path.join(packageRoot, name);
    const installed = JSON.parse(
      fs.readFileSync(path.join(directory, "package.json"), "utf8"),
    );
    if (installed.version !== version)
      throw new Error(
        `Expected ${name} ${version}, found ${installed.version}`,
      );
    return directory;
  });
  const oldPackages = (current.packages || []).filter(
    (entry) => !isManaged(entry),
  );
  const extensions = (current.extensions || []).filter(
    (value) =>
      !isLegacyExtension(value) &&
      !/examples\/extensions\/plan-mode\/index\.ts$/.test(value) &&
      !/\/pi\/extensions\/renderer\.ts$/.test(value),
  );
  const themes = (current.themes || []).filter(
    (value) => !/\/pi\/themes\/agent-sandbox\.json$/.test(value),
  );
  const { packages: ignored, ...defaults } = template;
  const next = {
    ...current,
    ...defaults,
    packages: [...oldPackages, ...packages],
    extensions: [...new Set([...extensions, renderer, plan])],
    themes: [...new Set([...themes, theme])],
  };
  fs.mkdirSync(profileDir, { recursive: true });
  writeIfChanged(settingsFile, JSON.stringify(next, null, 2) + "\n");
  for (const name of legacyFiles)
    removeFile(path.join(profileDir, "extensions", name));
  removeFile(path.join(profileDir, "themes/agent-sandbox.json"));
  return next;
}
module.exports = { applyProfile, packageSpecs, writeIfChanged };
