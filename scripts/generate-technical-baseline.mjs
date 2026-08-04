import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const NOT_EXECUTED = 'NOT_EXECUTED';
export const SCHEMA_VERSION = '1.0.0';
export const CRITICAL_PAGES = [
  'admin-premium-student-record', 'admin-premium-weekly-feedbacks', 'admin-premium-workspace',
  'portal-checkin', 'portal-login', 'portal-plano-alimentar', 'portal-premium-home',
  'portal-premium-weekly-feedback', 'portal-progressao'
];
const ALLOWED_CHANGE_PREFIXES = ['package.json', 'scripts/', 'tests/', 'docs/'];
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_VALUE = /bearer\s+[a-z0-9._~-]+/gi;
const CREDENTIAL = /(?:authorization|access_token|secret|(?:api[_-]?)?token)\s*[:=]\s*[^\r\n,;}]+/gi;

const posix = value => value.split(path.sep).join('/').replace(/^\.\//, '');
const sortedObject = value => {
  if (Array.isArray(value)) return value.map(sortedObject);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortedObject(value[key])]));
  return value;
};
export const sanitize = value => {
  if (typeof value === 'string') return value.replace(EMAIL, '[REDACTED]').replace(BEARER_VALUE, '[REDACTED]').replace(CREDENTIAL, '[REDACTED]');
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitize(item)]));
  return value;
};

function walk(root, relative = '') {
  const absolute = path.join(root, relative);
  if (!existsSync(absolute)) return [];
  const output = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!relative && ['.git', 'node_modules', 'artifacts'].includes(entry.name)) continue;
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) output.push(...walk(root, child));
    else if (entry.isFile()) output.push(posix(child));
  }
  return output;
}
const bytes = (root, file) => existsSync(path.join(root, file)) ? statSync(path.join(root, file)).size : NOT_EXECUTED;
const totalBytes = (root, files) => files.reduce((sum, file) => sum + statSync(path.join(root, file)).size, 0);
const read = (root, file) => readFileSync(path.join(root, file), 'utf8');
const countMatches = (text, expression) => [...text.matchAll(expression)].length;
const command = (runner, executable, args, root) => {
  try {
    const stdout = runner(executable, args, { cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH, HOME: process.env.HOME, CI: '1', NO_COLOR: '1' }, maxBuffer: 64 * 1024 * 1024 });
    return { status: 'PASSED', stdout: String(stdout) };
  } catch (error) {
    return { status: 'FAILED', exitCode: Number.isInteger(error?.status) ? error.status : 1, stdout: String(error?.stdout ?? '') };
  }
};
function testResult(result) {
  const get = label => Number(result.stdout.match(new RegExp(`# ${label} (\\d+)`))?.[1] ?? NaN);
  const duration = Number(result.stdout.match(/# duration_ms ([\d.]+)/)?.[1] ?? NaN);
  const values = { executed: get('tests'), passed: get('pass'), failed: get('fail'), skipped: get('skipped'), durationMs: duration };
  for (const key of Object.keys(values)) if (!Number.isFinite(values[key])) values[key] = NOT_EXECUTED;
  return { status: result.status, ...values };
}
function publicComparison(root, files) {
  return files.filter(file => !file.startsWith('public/') && files.includes(`public/${file}`)).map(file => {
    const left = readFileSync(path.join(root, file));
    const right = readFileSync(path.join(root, 'public', file));
    return { path: file, publicPath: `public/${file}`, observation: left.equals(right) ? 'DUPLICATE' : 'DIVERGENT' };
  }).sort((a, b) => a.path.localeCompare(b.path));
}
function sourceOccurrences(root, files, expression) {
  return files.map(file => ({ path: file, occurrences: countMatches(read(root, file), expression) })).filter(item => item.occurrences > 0).sort((a, b) => a.path.localeCompare(b.path));
}
function apiCallsIn(source) {
  const direct = [...source.matchAll(/(?:fetch\s*\(|axios(?:\.[a-z]+)?\s*\()\s*[`'"]([^`'"]*\/api\/[^`'"]*)/gi)]
    .map(match => match[1].replace(/\$\{[^}]+\}/g, '{dynamic}'));
  const wrapped = [...source.matchAll(/\bapi\s*\(\s*([`'"])([\s\S]*?)\1/g)]
    .map(match => match[2].replace(/\$\{[^}]+\}/g, '{dynamic}'))
    .filter(route => route.startsWith('/api/') || route.startsWith('/portal/'))
    .map(route => route.startsWith('/portal/') ? `/api${route}` : route);
  return [...direct, ...wrapped];
}
function localScriptPath(root, htmlFile, source) {
  const withoutSuffix = source.split(/[?#]/, 1)[0].trim();
  if (!withoutSuffix || /^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(withoutSuffix) || /^(?:data|blob):/i.test(withoutSuffix)) return { kind: 'REMOTE_OR_EMBEDDED' };
  let decoded;
  try { decoded = decodeURIComponent(withoutSuffix).replaceAll('\\', '/'); }
  catch { return { kind: 'UNRESOLVED', source: withoutSuffix, reason: 'INVALID_PATH' }; }
  const publicRoot = path.resolve(root, 'public');
  const htmlDirectory = path.dirname(path.resolve(root, htmlFile));
  const target = decoded.startsWith('/') ? path.resolve(publicRoot, `.${decoded}`) : path.resolve(htmlDirectory, decoded);
  const relative = path.relative(publicRoot, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return { kind: 'UNRESOLVED', source: withoutSuffix, reason: 'OUTSIDE_PUBLIC' };
  const repositoryPath = posix(path.relative(root, target));
  try {
    if (!existsSync(target) || !statSync(target).isFile()) return { kind: 'UNRESOLVED', source: repositoryPath, reason: 'NOT_FOUND' };
  } catch { return { kind: 'UNRESOLVED', source: repositoryPath, reason: 'READ_FAILED' }; }
  return { kind: 'LOCAL', path: repositoryPath };
}
function pageInventory(root, page) {
  const candidates = [`public/${page}.html`, `${page}.html`];
  const file = candidates.find(candidate => existsSync(path.join(root, candidate)));
  if (!file) return { page, status: NOT_EXECUTED, path: NOT_EXECUTED, apiCalls: NOT_EXECUTED, sourcesScanned: [], unresolvedSources: [] };
  let html;
  try { html = read(root, file); }
  catch { return { page, status: NOT_EXECUTED, path: file, apiCalls: NOT_EXECUTED, sourcesScanned: [], unresolvedSources: [] }; }
  const sourcesScanned = [file];
  const unresolvedSources = [];
  const sourceTexts = [html];
  const scriptSources = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*(?:["']([^"']+)["']|([^\s>]+))/gi)].map(match => match[1] ?? match[2]);
  for (const source of [...new Set(scriptSources)].sort()) {
    const resolved = localScriptPath(root, file, source);
    if (resolved.kind === 'LOCAL') {
      if (!sourcesScanned.includes(resolved.path)) {
        sourcesScanned.push(resolved.path);
        try { sourceTexts.push(read(root, resolved.path)); }
        catch { sourcesScanned.pop(); unresolvedSources.push({ source: resolved.path, reason: 'READ_FAILED' }); }
      }
    } else if (resolved.kind === 'UNRESOLVED') unresolvedSources.push({ source: resolved.source, reason: resolved.reason });
  }
  const uniqueUnresolved = [...new Map(unresolvedSources.map(item => [`${item.source}\0${item.reason}`, item])).values()].sort((a, b) => a.source.localeCompare(b.source) || a.reason.localeCompare(b.reason));
  return {
    page, path: file, status: uniqueUnresolved.length ? 'PARTIAL' : 'OBSERVED',
    apiCalls: [...new Set(sourceTexts.flatMap(apiCallsIn))].sort(),
    sourcesScanned: sourcesScanned.sort(), unresolvedSources: uniqueUnresolved
  };
}
function homeResources(root) {
  const file = existsSync(path.join(root, 'public/portal-premium-home.html')) ? 'public/portal-premium-home.html' : 'portal-premium-home.html';
  if (!existsSync(path.join(root, file))) return { status: NOT_EXECUTED, scripts: NOT_EXECUTED, styles: NOT_EXECUTED };
  const html = read(root, file);
  return {
    status: 'OBSERVED',
    scripts: [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)/gi)].map(match => match[1]).sort(),
    styles: [...html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)/gi), ...html.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']stylesheet["']/gi)].map(match => match[1]).sort()
  };
}
function serviceWorker(root) {
  const file = 'public/sw.js';
  if (!existsSync(path.join(root, file))) return { status: NOT_EXECUTED, path: NOT_EXECUTED, cacheName: NOT_EXECUTED, precache: NOT_EXECUTED, unresolvedEntries: [] };
  const text = read(root, file);
  const cacheName = text.match(/(?:CACHE_NAME|CACHE_VERSION|CACHE)\s*=\s*['"]([^'"]+)/)?.[1] ?? NOT_EXECUTED;
  const block = text.match(/(?:PRECACHE_URLS|STATIC_ASSETS|ASSETS_TO_CACHE|urlsToCache)\s*=\s*\[([\s\S]*?)\]/i)?.[1];
  if (block === undefined) return { status: 'PARTIAL', path: file, cacheName, precache: NOT_EXECUTED, unresolvedEntries: [{ index: NOT_EXECUTED, reason: 'PRECACHE_NOT_FOUND' }] };
  const constants = new Map([...text.matchAll(/\b(?:const|let|var)\s+([A-Z_$][\w$]*)\s*=\s*(['"])(.*?)\2\s*;/g)].map(match => [match[1], match[3]]));
  const entries = block.split(',').map(entry => entry.replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, '').trim()).filter(Boolean);
  const precache = [];
  const unresolvedEntries = [];
  entries.forEach((entry, index) => {
    const literal = entry.match(/^(['"])(.*?)\1$/);
    if (literal) precache.push(literal[2]);
    else if (/^[A-Z_$][\w$]*$/.test(entry) && constants.has(entry)) precache.push(constants.get(entry));
    else unresolvedEntries.push({ index, reason: 'UNRESOLVED_EXPRESSION' });
  });
  return { status: unresolvedEntries.length ? 'PARTIAL' : 'OBSERVED', path: file, cacheName, precache: [...new Set(precache)].sort(), unresolvedEntries };
}

export function collectBaseline({ root, runner = execFileSync, now = () => new Date() } = {}) {
  if (!root) throw new Error('Repository root is required');
  const files = walk(root);
  const publicFiles = files.filter(file => file.startsWith('public/'));
  const workerFiles = files.filter(file => file.startsWith('workers/') && /\.[cm]?js$/.test(file));
  const git = (args) => String(runner('git', args, { cwd: root, encoding: 'utf8' })).trim();
  let sha = NOT_EXECUTED, worktree = NOT_EXECUTED, changed = [];
  try { sha = git(['rev-parse', 'HEAD']); changed = git(['status', '--porcelain', '--untracked-files=all']).split('\n').filter(Boolean).map(line => posix(line.slice(3))).filter(file => !file.startsWith('artifacts/baseline/')).sort(); worktree = changed.length ? 'MODIFIED' : 'CLEAN'; } catch {}
  const tests = command(runner, process.execPath, ['--test'], root);
  const runtime = command(runner, 'npm', ['run', 'check:project-lm-runtime'], root);
  const typeSizes = Object.fromEntries(['html', 'css', 'js'].map(extension => [extension, totalBytes(root, publicFiles.filter(file => file.toLowerCase().endsWith(`.${extension}`)))]));
  const largestAssets = publicFiles.map(file => ({ path: file, bytes: bytes(root, file) })).sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path)).slice(0, 10);
  const workerText = workerFiles.map(file => read(root, file)).join('\n');
  const report = {
    schemaVersion: SCHEMA_VERSION, generatedAt: now().toISOString(),
    source: { sha, worktree, nodeVersion: process.version, platform: process.platform },
    repository: { totalFiles: files.length, workerApiBytes: bytes(root, 'workers/api.js'), publicBytes: totalBytes(root, publicFiles), publicBytesByType: typeSizes, largestPublicAssets: largestAssets },
    observations: {
      approximateWorkerRoutes: countMatches(workerText, /(?:pathname|url\.pathname)\s*(?:===|==|\.startsWith\s*\(|\.match\s*\()/g),
      migrations: files.filter(file => file.startsWith('migrations/') && file.endsWith('.sql')).length,
      testFiles: files.filter(file => file.startsWith('tests/') && /\.test\.mjs$/.test(file)).length,
      rootPublicComparisons: publicComparison(root, files),
      selectStarInWorkers: sourceOccurrences(root, workerFiles, /\bSELECT\s+\*\b/gi),
      ensureSchemaRuntimeReferences: sourceOccurrences(root, workerFiles, /\bensureSchema\b/g),
      serviceWorker: serviceWorker(root), criticalPages: CRITICAL_PAGES.map(page => pageInventory(root, page)), premiumHomeResources: homeResources(root),
      changedOutsideAllowedAreas: changed.filter(file => !ALLOWED_CHANGE_PREFIXES.some(prefix => prefix.endsWith('/') ? file.startsWith(prefix) : file === prefix))
    },
    verdicts: { testSuite: testResult(tests), projectLmRuntimeCheck: { status: runtime.status }, requiredCommands: tests.status === 'PASSED' && runtime.status === 'PASSED' ? 'PASSED' : 'FAILED' }
  };
  return sortedObject(sanitize(report));
}

export function renderMarkdown(report) {
  const v = value => value === NOT_EXECUTED ? NOT_EXECUTED : String(value);
  return `# Portal LM — Technical Baseline\n\nGenerated at: ${report.generatedAt}\n\n## Source\n\n- Schema: ${report.schemaVersion}\n- SHA: ${report.source.sha}\n- Worktree: ${report.source.worktree}\n- Node: ${report.source.nodeVersion}\n- Platform: ${report.source.platform}\n\n## Observations\n\n- Repository files: ${v(report.repository.totalFiles)}\n- workers/api.js: ${v(report.repository.workerApiBytes)} bytes\n- public/: ${v(report.repository.publicBytes)} bytes\n- Worker routes (approximate): ${v(report.observations.approximateWorkerRoutes)}\n- Migrations: ${v(report.observations.migrations)}\n- Test files: ${v(report.observations.testFiles)}\n- Critical pages inventoried: ${report.observations.criticalPages.length}\n- Root/public comparisons: ${report.observations.rootPublicComparisons.length}\n\n## Verdicts\n\n- Required commands: **${report.verdicts.requiredCommands}**\n- Test suite: **${report.verdicts.testSuite.status}** (${v(report.verdicts.testSuite.executed)} run; ${v(report.verdicts.testSuite.passed)} passed; ${v(report.verdicts.testSuite.failed)} failed; ${v(report.verdicts.testSuite.skipped)} skipped; ${v(report.verdicts.testSuite.durationMs)} ms)\n- Project LM runtime check: **${report.verdicts.projectLmRuntimeCheck.status}**\n\n> Observations are inventory data; verdicts are command outcomes. Missing measurements are reported as ${NOT_EXECUTED}.\n`;
}

export function writeBaseline({ root, outputDir = path.join(root, 'artifacts', 'baseline'), ...options }) {
  const expected = path.resolve(root, 'artifacts', 'baseline');
  if (path.resolve(outputDir) !== expected) throw new Error('Output must be artifacts/baseline');
  const report = collectBaseline({ root, ...options });
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, 'baseline-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(path.join(outputDir, 'baseline-report.md'), renderMarkdown(report));
  return report;
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const report = writeBaseline({ root });
  process.stdout.write(`${JSON.stringify({ output: 'artifacts/baseline', status: report.verdicts.requiredCommands }, null, 2)}\n`);
  if (report.verdicts.requiredCommands !== 'PASSED') process.exitCode = 1;
}
