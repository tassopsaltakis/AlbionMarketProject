import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('dist-pages');
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/,
  /["'](?:oauth_token|refresh_token|client_secret)["']\s*:\s*["'][^"']{16,}["']/,
];
let checked = 0;
async function inspect(folder) {
  for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      await inspect(file);
      continue;
    }
    if (!/\.(js|json|html|css|map)$/.test(file)) continue;
    checked++;
    const contents = await fs.readFile(file, 'utf8');
    if (patterns.some((pattern) => pattern.test(contents)))
      throw new Error(
        'Possible private credential in public artifact: ' +
          path.relative(root, file),
      );
  }
}
await inspect(root);
console.log(
  `Checked ${checked} public artifacts for recognizable private credentials.`,
);
