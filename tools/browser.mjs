import fs from 'node:fs';

// Use an installed Mac Chrome when available, otherwise Playwright Chromium.
// These checks launch a separate browser for the local game only.
export function browserOptions(options = {}) {
  const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const executablePath = process.env.SNAIL_CHROME_PATH
    || (process.platform === 'darwin' && fs.existsSync(macChrome) ? macChrome : undefined);
  return { headless: true, ...(executablePath ? { executablePath } : {}), ...options };
}
