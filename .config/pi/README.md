# Shared Pi setup

This directory contains the shared Pi renderer, theme, preferences, package pins, and compatibility checks. The setup manager deploys these assets to the real user configuration directory. Stow excludes this directory because the setup manager owns deployment.

The Mac and Agent Sandbox use the same installed assets. The sandbox mounts them read-only at `/opt/pi-config`. Each installation retains its own authentication, sessions, caches, and generated state in its Pi profile.

## Apply the setup

1. Start Docker Desktop.
2. Run the setup command from the dotfiles checkout:

   ```sh
   scripts/setup-pi apply --sandbox
   ```

3. Restart any open Pi sessions.

The command checks the candidate on the Mac and in Linux before deployment. It installs the shared package versions and configures the sandbox mount and entrypoint. The sandbox restarts during application.

The setup removes Pi's Superset and Moshi hook extensions and the previous sandbox renderer. It preserves other agent integrations and unrelated Pi preferences. GitHub Copilot authentication remains specific to each profile. If a profile lacks a Copilot login, use Pi's `/login` command in that profile.

## Update Pi

Use the installed update command:

```sh
pi-update
```

The command resolves the latest stable release and installs a candidate in a temporary directory. It tests native tool context, rendering, mouse and keyboard controls, scroll anchoring, the footer, reload, cleanup, theme validation, and shared package loading. A configured sandbox also receives Linux renderer tests and a startup check in a temporary container. The tests do not make model requests or mount the working home volume.

If a check fails, the command stops before it applies the update. The working installations and version pins remain unchanged. Successful updates advance the installed version pin and the source pin when the original checkout remains available with a matching prior pin.

To check a release without application, run:

```sh
pi-update --version 1.2.0 --check-only
```

Direct npm updates and Pi's own updater bypass this command. The manager currently supports the existing npm installation on the Mac and the Docker Agent Sandbox installation. Package loading checks do not replace live provider or add-on workflow tests.

## Renderer implementation

Tool presentation uses Pi's public `registerToolRenderer()` API. The renderer does not replace tools or alter tool results and stored messages. The footer and working indicator use public UI methods.

The menus use the shared theme's teal selection background and dark prompt surface. Slash suggestions show command names beside their descriptions. Native command pickers place their search field below the choices. The renderer retains Pi's original filters, callbacks, shortcuts, and cancellation behavior.

The compatibility module preserves features that Pi does not expose through public APIs: measured thought headings, command-menu placement, native picker layout, prompt appearance, anchored expansion, the hidden scroll popup, and the working indicator's placement in the footer. The module contains all internal-method patches and restores them during reload and shutdown.

The compatibility tests exercise these behaviors against each candidate. Pi changes can still require an update to the compatibility module or its tests. A failed check blocks deployment instead of silently removing a feature.
