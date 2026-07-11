import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const SOURCE_ROOT = 'src/projeto-lm';
export const PUBLIC_ROOT = 'public/assets/js/project-lm-runtime';
export const ENTRYPOINTS = [
  'services/generateStudentNutritionPlan.js',
  'services/generateStudentWorkoutPlan.js',
  'ui/studentPlanRenderers.js',
  'adapters/studentProfileAdapter.js',
  'adapters/continuityCheckinAdapter.js',
  'adapters/consistencyAdapter.js',
];

const JS_HEADER = '// AUTO-GENERATED FROM src/projeto-lm — DO NOT EDIT DIRECTLY\n';
const staticImportRe = /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
const dynamicImportRe = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

export function toPosix(p) { return p.split(path.sep).join('/'); }
export function isRelativeSpecifier(specifier) { return specifier.startsWith('./') || specifier.startsWith('../'); }

export async function pathExists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

export function assertInside(rootAbs, candidateAbs, label) {
  const relative = path.relative(rootAbs, candidateAbs);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} escapes ${toPosix(path.relative(process.cwd(), rootAbs))}: ${toPosix(path.relative(process.cwd(), candidateAbs))}`);
  }
}

export function parseRelativeImports(source) {
  const imports = [];
  for (const re of [staticImportRe, dynamicImportRe]) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(source)) !== null) {
      if (isRelativeSpecifier(match[1])) imports.push(match[1]);
    }
  }
  return imports;
}

async function resolveDependency(fromAbs, specifier) {
  const base = path.resolve(path.dirname(fromAbs), specifier);
  const candidates = path.extname(base) ? [base] : [`${base}.js`, `${base}.json`, path.join(base, 'index.js')];
  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }
  throw new Error(`Missing dependency ${specifier} imported by ${toPosix(path.relative(process.cwd(), fromAbs))}`);
}

export async function collectRuntimeGraph({ sourceRoot = SOURCE_ROOT, entrypoints = ENTRYPOINTS } = {}) {
  const cwd = process.cwd();
  const sourceRootAbs = path.resolve(cwd, sourceRoot);
  const seen = new Set();
  const ordered = [];
  const queue = [];

  for (const entry of entrypoints) {
    const entryAbs = path.resolve(sourceRootAbs, entry);
    assertInside(sourceRootAbs, entryAbs, `Entrypoint ${entry}`);
    if (!(await pathExists(entryAbs))) throw new Error(`Missing entrypoint: ${toPosix(path.relative(cwd, entryAbs))}`);
    queue.push(entryAbs);
  }

  while (queue.length) {
    const current = queue.shift();
    const key = toPosix(path.relative(sourceRootAbs, current));
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(current);

    if (path.extname(current) !== '.js') continue;
    const source = await fs.readFile(current, 'utf8');
    for (const specifier of parseRelativeImports(source)) {
      const dependencyAbs = await resolveDependency(current, specifier);
      assertInside(sourceRootAbs, dependencyAbs, `Import ${specifier} from ${key}`);
      const ext = path.extname(dependencyAbs);
      if (!['.js', '.json'].includes(ext)) throw new Error(`Unsupported runtime dependency: ${toPosix(path.relative(cwd, dependencyAbs))}`);
      queue.push(dependencyAbs);
    }
  }

  return ordered.map((absolute) => ({ absolute, relative: toPosix(path.relative(sourceRootAbs, absolute)) }));
}

export async function buildRuntime({ destinationRoot = PUBLIC_ROOT, clean = true, generatedAt = new Date().toISOString() } = {}) {
  const cwd = process.cwd();
  const sourceRootAbs = path.resolve(cwd, SOURCE_ROOT);
  const destinationRootAbs = path.resolve(cwd, destinationRoot);
  const files = await collectRuntimeGraph();
  const manifestFiles = [];
  let totalBytes = 0;

  if (clean) await fs.rm(destinationRootAbs, { recursive: true, force: true });
  await fs.mkdir(destinationRootAbs, { recursive: true });

  for (const file of files) {
    const sourceAbs = file.absolute;
    const publicAbs = path.resolve(destinationRootAbs, file.relative);
    assertInside(destinationRootAbs, publicAbs, `Public output ${file.relative}`);
    await fs.mkdir(path.dirname(publicAbs), { recursive: true });

    const raw = await fs.readFile(sourceAbs);
    const ext = path.extname(sourceAbs);
    const output = ext === '.js' ? Buffer.from(`${JS_HEADER}${raw.toString('utf8')}`) : raw;
    await fs.writeFile(publicAbs, output);
    totalBytes += output.byteLength;
    manifestFiles.push({
      source: toPosix(path.relative(cwd, sourceAbs)),
      public: toPosix(path.relative(cwd, publicAbs)),
      sha256: crypto.createHash('sha256').update(raw).digest('hex'),
    });
  }

  const manifest = { generated_at: generatedAt, source_root: SOURCE_ROOT, public_root: destinationRoot, entrypoints: ENTRYPOINTS, files: manifestFiles };
  await fs.writeFile(path.join(destinationRootAbs, 'runtime-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  totalBytes += Buffer.byteLength(`${JSON.stringify(manifest, null, 2)}\n`);
  await validateRuntime(destinationRoot);
  return { filesCopied: files.length, totalBytes, entrypoints: ENTRYPOINTS, files: manifestFiles };
}

export async function validateRuntime(runtimeRoot = PUBLIC_ROOT) {
  const cwd = process.cwd();
  const rootAbs = path.resolve(cwd, runtimeRoot);
  const manifestPath = path.join(rootAbs, 'runtime-manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  for (const file of manifest.files) {
    const publicAbs = path.resolve(cwd, file.public);
    assertInside(rootAbs, publicAbs, `Manifest public path ${file.public}`);
    if (!(await pathExists(publicAbs))) throw new Error(`Manifest file missing: ${file.public}`);
    const publicRaw = await fs.readFile(publicAbs, 'utf8');
    if (path.extname(publicAbs) === '.js') {
      for (const specifier of parseRelativeImports(publicRaw)) {
        const dependencyAbs = await resolveDependency(publicAbs, specifier);
        assertInside(rootAbs, dependencyAbs, `Public import ${specifier} from ${file.public}`);
      }
      if (/['"](?:\.\.\/)+src\/projeto-lm|['"]\/src\//.test(publicRaw)) throw new Error(`Invalid src import in ${file.public}`);
    }
  }
  return manifest;
}

export async function listFilesRecursive(root) {
  const rootAbs = path.resolve(process.cwd(), root);
  const result = [];
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(abs);
      else result.push(toPosix(path.relative(rootAbs, abs)));
    }
  }
  if (await pathExists(rootAbs)) await walk(rootAbs);
  return result.sort();
}
