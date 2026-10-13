ARG BASE_IMAGE=agent-sandbox:local
FROM ${BASE_IMAGE}
ARG PI_VERSION
USER root
RUN install -d -o agent -g agent /opt/pi-packages
COPY settings.json.example /tmp/shared-pi-settings.json
USER agent
RUN npm install --prefix /opt/agent-tools --ignore-scripts --no-audit --no-fund --save-exact "@earendil-works/pi-coding-agent@${PI_VERSION:?PI_VERSION is required}" \
    && node -e 'const s=require("/tmp/shared-pi-settings.json");const r=require("child_process").spawnSync("npm",["install","--prefix","/opt/pi-packages","--legacy-peer-deps","--ignore-scripts","--no-audit","--no-fund","--save-exact",...s.packages.map(p=>p.replace(/^npm:/,""))],{stdio:"inherit"});process.exit(r.status??1);'
USER root
COPY prepare-sandbox.cjs /usr/local/lib/shared-pi/prepare-sandbox.cjs
RUN node /usr/local/lib/shared-pi/prepare-sandbox.cjs \
    && rm /tmp/shared-pi-settings.json
