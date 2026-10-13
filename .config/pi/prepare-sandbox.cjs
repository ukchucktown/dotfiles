const fs = require("node:fs");
const file = process.argv[2] || "/usr/local/bin/agent-sandbox-entrypoint";
let source = fs.readFileSync(file, "utf8");
source = source.replace(
  /gosu agent install -D -m 0644 \/etc\/agent-shell\/pi-renderer\.ts \\\n\s*"\$\{agent_home\}\/\.pi\/agent\/extensions\/agent-sandbox-renderer\.ts"\n/g,
  "",
);
if (source.includes("/etc/agent-shell/pi-renderer.ts"))
  throw new Error(
    "Unrecognized legacy renderer bootstrap; refusing to create a conflicting startup",
  );
source = source.replace(/--target(?:=|\s+)pi\b/g, "");
const apply =
  'gosu agent node /opt/pi-config/manage.cjs profile --config-dir /opt/pi-config --profile-dir "${agent_home}/.pi/agent" --pi-root /opt/agent-tools/node_modules/@earendil-works/pi-coding-agent';
if (!source.includes("/opt/pi-config/manage.cjs")) {
  const anchor = 'gosu agent env HOME="${agent_home}" initialize-claude';
  if (!source.includes(anchor))
    throw new Error(
      "Unrecognized sandbox bootstrap; shared Pi setup was not inserted",
    );
  source = source.replace(anchor, anchor + "\n\n" + apply);
}
const output = process.argv[3] || file;
fs.writeFileSync(output, source, { mode: 0o755 });
fs.chmodSync(output, 0o755);
