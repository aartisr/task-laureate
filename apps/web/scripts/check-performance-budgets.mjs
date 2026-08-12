import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGETS = {
  // Delivery budgets use gzip because that is what browsers actually download.
  // The Puck editor and analytics are intentionally lazy-loaded, so total
  // shipped artifacts remain bounded without inflating the critical path.
  maxMainJsGzipKB: 90,
  maxMainCssGzipKB: 60,
  maxTotalJsGzipKB: 700,
  maxTotalCssGzipKB: 80,
  maxLargestLazyJsGzipKB: 240,
  maxLargestLazyCssGzipKB: 18,
  maxAssetCount: 140,
};

function toKB(bytes) {
  return Number((bytes / 1024).toFixed(2));
}

function fail(message) {
  console.error(`\n[perf-budgets] FAIL: ${message}`);
  process.exit(1);
}

const assetsDir = join(process.cwd(), 'dist', 'assets');
if (!existsSync(assetsDir)) {
  fail(`Build assets directory not found: ${assetsDir}. Run npm run build first.`);
}

const files = readdirSync(assetsDir);
const jsFiles = files.filter((f) => f.endsWith('.js'));
const cssFiles = files.filter((f) => f.endsWith('.css'));

if (files.length === 0) {
  fail('No build assets found in dist/assets.');
}

const gzipSizeOf = (name) => gzipSync(readFileSync(join(assetsDir, name))).byteLength;

const mainJs = jsFiles.find((name) => name.startsWith('index-'));
const mainCss = cssFiles.find((name) => name.startsWith('index-'));

if (!mainJs) fail('Main JS bundle (index-*.js) not found in dist/assets.');
if (!mainCss) fail('Main CSS bundle (index-*.css) not found in dist/assets.');

const mainJsGzipKB = toKB(gzipSizeOf(mainJs));
const mainCssGzipKB = toKB(gzipSizeOf(mainCss));
const totalJsGzipKB = toKB(jsFiles.reduce((sum, file) => sum + gzipSizeOf(file), 0));
const totalCssGzipKB = toKB(cssFiles.reduce((sum, file) => sum + gzipSizeOf(file), 0));
const largestLazyJsGzipKB = toKB(Math.max(...jsFiles.filter((file) => file !== mainJs).map(gzipSizeOf)));
const largestLazyCssGzipKB = toKB(Math.max(...cssFiles.filter((file) => file !== mainCss).map(gzipSizeOf)));

const checks = [
  {
    label: 'Main JS bundle (gzip)',
    actual: mainJsGzipKB,
    budget: BUDGETS.maxMainJsGzipKB,
    unit: 'KB gzip',
  },
  {
    label: 'Main CSS bundle (gzip)',
    actual: mainCssGzipKB,
    budget: BUDGETS.maxMainCssGzipKB,
    unit: 'KB gzip',
  },
  {
    label: 'Total JS bundles (gzip)',
    actual: totalJsGzipKB,
    budget: BUDGETS.maxTotalJsGzipKB,
    unit: 'KB gzip',
  },
  {
    label: 'Total CSS bundles (gzip)',
    actual: totalCssGzipKB,
    budget: BUDGETS.maxTotalCssGzipKB,
    unit: 'KB gzip',
  },
  {
    label: 'Largest lazy JS bundle (gzip)',
    actual: largestLazyJsGzipKB,
    budget: BUDGETS.maxLargestLazyJsGzipKB,
    unit: 'KB gzip',
  },
  {
    label: 'Largest lazy CSS bundle (gzip)',
    actual: largestLazyCssGzipKB,
    budget: BUDGETS.maxLargestLazyCssGzipKB,
    unit: 'KB gzip',
  },
  {
    label: 'Asset count',
    actual: files.length,
    budget: BUDGETS.maxAssetCount,
    unit: 'files',
  },
];

console.log('\n[perf-budgets] Build artifact budget report');
for (const check of checks) {
  const status = check.actual <= check.budget ? 'PASS' : 'FAIL';
  console.log(`- ${status} ${check.label}: ${check.actual}${check.unit} (budget ${check.budget}${check.unit})`);
}

const failing = checks.filter((check) => check.actual > check.budget);
if (failing.length > 0) {
  fail(`${failing.length} budget threshold(s) exceeded. See report above.`);
}

console.log('\n[perf-budgets] PASS: all performance budgets are within threshold.');
