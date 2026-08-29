import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const applicationDirectory = resolve(scriptDirectory, '..');
const sourceDirectory = resolve(applicationDirectory, 'dist');
const outputDirectory = resolve(applicationDirectory, '..', '..', 'dist');

try {
  await stat(sourceDirectory);
} catch {
  throw new Error(`Expected Vite output at ${sourceDirectory}, but it was not created.`);
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await cp(sourceDirectory, outputDirectory, { recursive: true });

console.log(`Mirrored Vite output to ${outputDirectory}`);
