#!/usr/bin/env bash
set -euo pipefail
node /opt/pi-config/prepare-sandbox.cjs /usr/local/bin/agent-sandbox-entrypoint /run/shared-pi-entrypoint
exec /run/shared-pi-entrypoint
