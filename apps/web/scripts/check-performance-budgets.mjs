import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BUDGETS = {
  maxMainJsKB: 380,
  maxMainCssKB: 180,
  maxTotalJsKB: 900,
  maxTotalCssKB: 260,
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

const sizeOf = (name) => statSync(join(assetsDir, name)).size;
const totalJs = jsFiles.reduce((sum, file) => sum + sizeOf(file), 0);
const totalCss = cssFiles.reduce((sum, file) => sum + sizeOf(file), 0);

const mainJs = jsFiles.find((name) => name.startsWith('index-'));
const mainCss = cssFiles.find((name) => name.startsWith('index-'));

if (!mainJs) fail('Main JS bundle (index-*.js) not found in dist/assets.');
if (!mainCss) fail('Main CSS bundle (index-*.css) not found in dist/assets.');

const mainJsKB = toKB(sizeOf(mainJs));
const mainCssKB = toKB(sizeOf(mainCss));
const totalJsKB = toKB(totalJs);
const totalCssKB = toKB(totalCss);

const checks = [
  {
    label: 'Main JS bundle',
    actual: mainJsKB,
    budget: BUDGETS.maxMainJsKB,
    unit: 'KB',
  },
  {
    label: 'Main CSS bundle',
    actual: mainCssKB,
    budget: BUDGETS.maxMainCssKB,
    unit: 'KB',
  },
  {
    label: 'Total JS bundles',
    actual: totalJsKB,
    budget: BUDGETS.maxTotalJsKB,
    unit: 'KB',
  },
  {
    label: 'Total CSS bundles',
    actual: totalCssKB,
    budget: BUDGETS.maxTotalCssKB,
    unit: 'KB',
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
