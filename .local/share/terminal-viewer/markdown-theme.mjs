import { closeSync, openSync, writeSync } from 'node:fs';
import { ReadStream } from 'node:tty';

const override = process.env.MD_THEME || 'auto';
if (!['auto', 'light', 'dark'].includes(override)) {
  console.error('md: MD_THEME must be auto, light, or dark');
  process.exit(2);
}

// Match terminal-browser's brightness threshold so transparent pages agree
// with its interpretation of the terminal background.
function themeForRgb(rgb) {
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 < 128
    ? 'dark' : 'light';
}

function environmentTheme() {
  const background = process.env.COLORFGBG?.split(';').at(-1);
  if (!background || !/^\d+$/.test(background)) return 'dark';
  const index = Number(background);
  if (index > 255) return 'dark';
  if (index < 16) {
    // ANSI colors are customizable; these are the conventional defaults.
    const level = index < 8 ? 128 : 255;
    if (index === 7) return 'light';
    if (index === 8) return 'dark';
    return themeForRgb([index & 1, index & 2, index & 4].map(bit => bit ? level : 0));
  }
  if (index >= 232) return themeForRgb(Array(3).fill(8 + (index - 232) * 10));
  const cube = index - 16;
  const levels = [0, 95, 135, 175, 215, 255];
  return themeForRgb([Math.floor(cube / 36), Math.floor(cube / 6) % 6, cube % 6].map(i => levels[i]));
}

async function terminalTheme() {
  let terminal;
  let descriptor;
  try {
    descriptor = openSync('/dev/tty', 'r+');
    terminal = new ReadStream(descriptor);
    terminal.setRawMode(true);
  } catch {
    if (terminal) terminal.destroy();
    else if (descriptor !== undefined) closeSync(descriptor);
    return environmentTheme();
  }
  return new Promise(resolve => {
    let response = '';
    let finished = false;
    const finish = (theme) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      for (const [signal, handler] of signals) process.removeListener(signal, handler);
      terminal.setRawMode(false);
      terminal.destroy();
      resolve(theme);
    };
    // Some terminals do not answer OSC 11. Never stall opening a document.
    const timer = setTimeout(() => finish(environmentTheme()), 250);
    const signals = ['SIGHUP', 'SIGINT', 'SIGTERM'].map((signal, index) => {
      const handler = () => {
        process.exitCode = [129, 130, 143][index];
        finish(environmentTheme());
      };
      process.once(signal, handler);
      return [signal, handler];
    });
    terminal.on('error', () => finish(environmentTheme()));
    terminal.on('end', () => finish(environmentTheme()));
    terminal.on('data', chunk => {
      response += chunk.toString();
      const match = response.match(/\x1b\]11;rgb:([\da-f]{1,4})\/([\da-f]{1,4})\/([\da-f]{1,4})(?:\x07|\x1b\\)/i);
      if (match) {
        finish(themeForRgb(match.slice(1).map(value =>
          parseInt(value, 16) / (16 ** value.length - 1) * 255)));
      } else if (response.includes('\x03')) {
        finish(environmentTheme());
        process.exitCode = 130;
      }
    });
    try {
      writeSync(descriptor, '\x1b]11;?\x07');
    } catch {
      finish(environmentTheme());
    }
  });
}

console.log(override === 'auto' ? await terminalTheme() : override);
