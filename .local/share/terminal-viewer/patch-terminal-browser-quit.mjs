#!/usr/bin/env node

import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const bundlePath = join(
  homedir(),
  '.local/share/terminal-browser/app/browser/dist/main.js',
);
const marker = 'terminal-viewer q capture';
const sessionNeedle = `    if (event.kind !== "release") {
      if (event.mods.ctrl && (event.key === "q" || event.key === "c")) {`;
const sessionReplacement = `    if (event.kind !== "release") {
      if (this.partition === "terminal-viewer" && isPlainKey(event, "q")) {
        this.shutdown();
        return;
      }
      if (event.mods.ctrl && (event.key === "q" || event.key === "c")) {`;
const captureMethodNeedle = `    setKeyCapture(keys) {
      bridge.push(APP_VIEW, { op: "setKeyCapture", keys });
      bridge.flush();
    },`;
const captureMethodReplacement = `    setKeyCapture(keys) {
      const captured = options.alwaysCaptureKeys ? [...new Set([...keys, ...options.alwaysCaptureKeys])] : keys;
      bridge.push(APP_VIEW, { op: "setKeyCapture", keys: captured });
      bridge.flush();
    },`;
const captureOptionNeedle = `      clearColor: this.presentation ? [0, 0, 0, 0] : void 0,
      keyEventTypes: true,`;
const captureOptionReplacement = `      clearColor: this.presentation ? [0, 0, 0, 0] : void 0,
      alwaysCaptureKeys: this.partition === "terminal-viewer" ? ["q"] : [], // ${marker}
      keyEventTypes: true,`;
const initialCaptureNeedle = `    if (!this.root.sharedTextures) {
      throw new Error("terminal-browser requires the patched Electron with shared texture support");
    }
    this.popupSurface = this.root.createSurface();`;
const initialCaptureReplacement = `    if (!this.root.sharedTextures) {
      throw new Error("terminal-browser requires the patched Electron with shared texture support");
    }
    if (this.partition === "terminal-viewer") this.root.setKeyCapture(["q"]);
    this.popupSurface = this.root.createSurface();`;

if (!existsSync(bundlePath)) {
  fail(`terminal-browser bundle not found: ${bundlePath}`);
}

let bundle = readFileSync(bundlePath, 'utf8');
if (bundle.includes(marker)) {
  process.exit(0);
}

bundle = replaceOnce(bundle, sessionNeedle, sessionReplacement);
bundle = replaceOnce(bundle, captureMethodNeedle, captureMethodReplacement);
bundle = replaceOnce(bundle, captureOptionNeedle, captureOptionReplacement);
const patchedBundle = replaceOnce(
  bundle,
  initialCaptureNeedle,
  initialCaptureReplacement,
);
const temporaryPath = `${bundlePath}.terminal-viewer-${process.pid}.tmp`;
const mode = statSync(bundlePath).mode;

writeFileSync(temporaryPath, patchedBundle, { mode });
renameSync(temporaryPath, bundlePath);

function fail(message) {
  console.error(`terminal-viewer: ${message}`);
  process.exit(1);
}

function replaceOnce(source, expected, replacement) {
  const first = source.indexOf(expected);
  if (first === -1 || source.indexOf(expected, first + expected.length) !== -1) {
    fail(
      `terminal-browser changed near ${JSON.stringify(expected.slice(0, 60))}; ` +
        'the q-key compatibility patch needs updating',
    );
  }
  return source.replace(expected, replacement);
}
