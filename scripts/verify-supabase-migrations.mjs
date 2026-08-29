import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const directory = resolve(process.cwd(), 'supabase/migrations');
const migrations = readdirSync(directory)
  .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/i.test(name))
  .sort();

if (migrations.length === 0) throw new Error('No Supabase migrations were found.');

const versions = migrations.map((name) => Number.parseInt(name.slice(0, 3), 10));
const expected = Array.from({ length: versions.length }, (_, index) => index + 1);

if (versions.some((version, index) => version !== expected[index])) {
  throw new Error(`Supabase migration versions must be unique and contiguous from 001. Found: ${migrations.join(', ')}`);
}

console.log(`Supabase migration sequence verified: ${migrations.length} migrations (001–${String(versions.at(-1)).padStart(3, '0')}).`);
