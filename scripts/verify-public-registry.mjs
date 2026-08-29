import { readFileSync } from 'node:fs';
const projectUrl = new URL('../', import.meta.url);
const read = (name) => readFileSync(new URL(name, projectUrl), 'utf8');
const fail = (message) => {
  console.error(`Public-registry verification failed: ${message}`);
  process.exit(1);
};

const npmrc = read('.npmrc');
if (!/^registry=https:\/\/registry\.npmjs\.org\/?$/m.test(npmrc)) {
  fail('.npmrc must set registry=https://registry.npmjs.org/.');
}

if (/^\s*(?:@[^:]+:registry|[^\s=]*(?:_auth|_authToken|always-auth))\s*=/mi.test(npmrc)) {
  fail('.npmrc must not contain scoped registries or registry credentials.');
}

const lockfile = JSON.parse(read('package-lock.json'));
const nonPublicPackages = Object.entries(lockfile.packages ?? [])
  .flatMap(([path, entry]) => {
    if (!entry?.resolved) return [];
    if (entry.link) return [];

    try {
      const url = new URL(entry.resolved);
      const host = url.hostname;
      return host === 'registry.npmjs.org' ? [] : [{ path, host }];
    } catch {
      return [{ path, host: 'invalid URL' }];
    }
  });

if (nonPublicPackages.length > 0) {
  const affected = nonPublicPackages
    .slice(0, 10)
    .map(({ path, host }) => `${path || '(root)'} (${host})`)
    .join(', ');
  fail(`package-lock.json contains packages outside registry.npmjs.org: ${affected}`);
}

console.log('Public-registry verification passed.');
