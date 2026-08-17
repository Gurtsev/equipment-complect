import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const ENTRY_LIMIT_BYTES = 300 * 1024;
const manifestPath = path.resolve('dist/.vite/manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const entry = Object.values(manifest).find((item) => item.isEntry);

if (!entry?.file) {
  throw new Error(`Entry chunk not found in ${manifestPath}`);
}

const entryPath = path.resolve('dist', entry.file);
const gzipBytes = gzipSync(await readFile(entryPath)).byteLength;
const gzipKilobytes = gzipBytes / 1024;
const limitKilobytes = ENTRY_LIMIT_BYTES / 1024;

if (gzipBytes > ENTRY_LIMIT_BYTES) {
  throw new Error(
    `Entry bundle is ${gzipKilobytes.toFixed(1)} KiB gzip; limit is ${limitKilobytes} KiB`,
  );
}

console.log(
  `Entry bundle: ${gzipKilobytes.toFixed(1)} KiB gzip (limit ${limitKilobytes} KiB)`,
);
