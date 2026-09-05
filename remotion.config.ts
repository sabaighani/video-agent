import {Config} from '@remotion/cli/config';
import fs from 'node:fs';

// Downloading Remotion's own headless Chrome can fail with a 403
// ("not available in your location") depending on your network's region,
// since it comes from Google Cloud Storage. Windows almost always already
// has Microsoft Edge installed, which is Chromium under the hood and works
// just as well for rendering — so we point Remotion at it automatically
// when we can find it.
const candidatePaths = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const found = candidatePaths.find((p) => {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
});

if (found && !process.env.FORCE_REMOTION_OWN_BROWSER) {
  Config.setBrowserExecutable(found);
}

// If none of the above paths match your install, find your browser's real
// path (Windows: right-click its Start Menu shortcut -> Properties ->
// Target) and add it to candidatePaths above, or pass
// --browser-executable="C:\path\to\msedge.exe" directly on the render command.
