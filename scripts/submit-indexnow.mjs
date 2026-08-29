import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const DEFAULT_ENDPOINT = 'https://api.indexnow.org/indexnow';
const DEFAULT_HOST = 'tasks.ai-aarti.com';
const DEFAULT_KEY_FILE = 'apps/web/public/0288d4bc2b2d4a028697045ad8a9c595.txt';

function usage() {
  console.log(`Usage:
  node scripts/submit-indexnow.mjs --url https://tasks.ai-aarti.com/
  node scripts/submit-indexnow.mjs --url URL_1 --url URL_2 --dry-run

Options:
  --url URL             URL to submit; repeat for multiple URLs
  --host HOST           IndexNow host (default: ${DEFAULT_HOST})
  --key VALUE           IndexNow key (or INDEXNOW_KEY)
  --key-file PATH       File containing the key (default: ${DEFAULT_KEY_FILE})
  --key-location URL    Public URL where the key file is hosted
  --endpoint URL        IndexNow endpoint (default: ${DEFAULT_ENDPOINT})
  --dry-run             Print the request without sending it
  --help                Show this help
`);
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function optionValues(args, name) {
  return args.flatMap((value, index) => value === name && args[index + 1] ? [args[index + 1]] : []);
}

function assertHttpUrl(value, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute http(s) URL: ${value}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`${label} must use http or https: ${value}`);
  return parsed;
}

const args = process.argv.slice(2);
if (args.includes('--help')) {
  usage();
  process.exit(0);
}

try {
  const urls = optionValues(args, '--url');
  const configuredUrls = process.env.INDEXNOW_URLS?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
  const submittedUrls = [...urls, ...configuredUrls];
  if (submittedUrls.length === 0) throw new Error('Provide at least one --url or INDEXNOW_URLS value.');
  if (submittedUrls.length > 10_000) throw new Error('IndexNow accepts at most 10,000 URLs per request.');

  const host = optionValue(args, '--host') ?? process.env.INDEXNOW_HOST ?? DEFAULT_HOST;
  const hostUrl = assertHttpUrl(`https://${host}`, '--host');
  const parsedUrls = submittedUrls.map((value) => assertHttpUrl(value, '--url'));
  if (parsedUrls.some((url) => url.hostname !== hostUrl.hostname)) {
    throw new Error(`Every URL must use the IndexNow host ${hostUrl.hostname}.`);
  }

  const keyFile = resolve(optionValue(args, '--key-file') ?? process.env.INDEXNOW_KEY_FILE ?? DEFAULT_KEY_FILE);
  const key = (optionValue(args, '--key') ?? process.env.INDEXNOW_KEY ?? await readFile(keyFile, 'utf8')).trim();
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) throw new Error('IndexNow key must contain 8-128 letters, numbers, or hyphens.');

  const keyLocation = optionValue(args, '--key-location') ?? process.env.INDEXNOW_KEY_LOCATION ?? `https://${host}/${key}.txt`;
  assertHttpUrl(keyLocation, '--key-location');
  const endpoint = optionValue(args, '--endpoint') ?? process.env.INDEXNOW_ENDPOINT ?? DEFAULT_ENDPOINT;
  assertHttpUrl(endpoint, '--endpoint');
  const payload = { host: hostUrl.hostname, key, keyLocation, urlList: parsedUrls.map((url) => url.href) };

  if (args.includes('--dry-run')) {
    console.log(JSON.stringify({ endpoint, payload }, null, 2));
    process.exit(0);
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`IndexNow returned HTTP ${response.status}: ${await response.text()}`);
  console.log(`Submitted ${payload.urlList.length} URL${payload.urlList.length === 1 ? '' : 's'} to ${endpoint}.`);
} catch (error) {
  console.error(`IndexNow submission failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}