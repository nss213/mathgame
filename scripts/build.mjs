// Copies the site into _site/ and stamps every asset URL with a version so
// browsers can't mix files from an old deploy with a new one.
//
//   node scripts/build.mjs [version]     (defaults to the git commit SHA)

import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const OUT = '_site';
const version = (process.argv[2] || process.env.GITHUB_SHA || execSync('git rev-parse HEAD').toString()).trim().slice(0, 12);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const f of ['index.html', 'manifest.webmanifest', 'icon.svg', 'sw.js', 'css', 'js']) {
  cpSync(f, join(OUT, f), { recursive: true });
}

function rewrite(file, fn) {
  const path = join(OUT, file);
  const before = readFileSync(path, 'utf8');
  const after = fn(before);
  if (after === before) throw new Error(`build: nothing stamped in ${file}`);
  writeFileSync(path, after);
}

const v = `?v=${version}`;

rewrite('index.html', (s) => s.replace(/(href|src)="((?:css|js)\/[^"?]+)"/g, `$1="$2${v}"`));

for (const f of readdirSync(join(OUT, 'js'))) {
  if (!f.endsWith('.js')) continue;
  const path = join(OUT, 'js', f);
  const s = readFileSync(path, 'utf8');
  writeFileSync(path, s.replace(/(from\s+'\.\/[^'?]+\.js)'/g, `$1${v}'`));
}

rewrite('sw.js', (s) => s.replace("const CACHE = 'free-the-x-dev';", `const CACHE = 'free-the-x-${version}';`));

console.log(`Built ${OUT}/ with version ${version}`);
