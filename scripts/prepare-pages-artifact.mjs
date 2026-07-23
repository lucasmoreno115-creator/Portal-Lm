import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const repoRoot = process.cwd();
const publicDir = path.join(repoRoot, 'public');
const artifactDir = path.join(repoRoot, 'github-pages-artifact');

const rootPublicFiles = ['CNAME', '_redirects'];
const legacyRootFiles = [
  'index.html',
  'admin-alerts.html',
  'admin-anamneses.html',
  'admin-auth.js',
  'admin-checkins.html',
  'admin-command-center.html',
  'admin-followup.html',
  'admin-login.html',
  'admin-nutrition-plan.html',
  'admin-student.html',
  'admin-students.html',
  'admin-weekly-plan.html',
  'admin.html',
  'anamnese-premium.html',
  'portal-biblioteca.html',
  'portal-checkin.html',
  'portal-login.html',
  'portal-plano-alimentar.html',
  'portal-progressao.html',
  'portal-shared.js',
  'portal.css',
  'portal.html',
  'portal-premium-home.html',
  'portal-premium-onboarding.html',
  'project-lm-planning.js',
  'project-lm-profile.html',
  'project-lm-profile.js',
  'project-lm.css',
  'projeto-lm-biblioteca.html',
  'projeto-lm-conquistas.html',
  'projeto-lm-consistencia.html',
  'projeto-lm-conteudo.html',
  'projeto-lm-dia-dificil.html',
  'projeto-lm-estatisticas.html',
  'projeto-lm-jornada.html',
  'projeto-lm-onboarding.html',
  'projeto-lm-planejamento.html',
  'projeto-lm-plano-inicial.html',
];
const legacyRootDirectories = ['assets'];
const criticalPublicFiles = [
  'project-lm-2.html',
  'assets/js/project-lm-2-entry.js',
  'assets/js/project-lm-2-app.js',
  'assets/js/project-lm-engine-services.js',
  'assets/js/project-lm-runtime/runtime-manifest.json',
  'assets/css/project-lm-2.css',
];
const forbiddenArtifactEntries = ['public', 'src', 'tests', 'workers', '.github'];
const requiredArtifactFiles = [
  'index.html',
  'portal-login.html',
  'portal.html',
  'portal-premium-home.html',
  'portal-premium-onboarding.html',
  'assets/exercise-library/rosca-direta-barra.gif',
];
const requiredArtifactDirectories = ['assets', 'css', 'js', 'projeto-lm'];
const routeReferencePattern = /["'=(]\s*([^"'()\s<>]+\.html(?:[?#][^"'()\s<>]*)?)/g;

async function assertDirectory(relativePath) {
  const stats = await stat(path.join(artifactDir, relativePath));
  if (!stats.isDirectory()) {
    throw new Error(`Expected ${relativePath}/ to be a directory in the Pages artifact root.`);
  }
}

async function assertFile(relativePath) {
  const stats = await stat(path.join(artifactDir, relativePath));
  if (!stats.isFile()) {
    throw new Error(`Expected ${relativePath} to be a file in the Pages artifact root.`);
  }
}

async function copyIfExists(source, destination) {
  if (existsSync(source)) {
    await cp(source, destination, { recursive: true, dereference: true, force: false });
  }
}

async function sha256(filePath) {
  const content = await readFile(filePath);
  return createHash('sha256').update(content).digest('hex');
}

async function fileSize(filePath) {
  return (await stat(filePath)).size;
}

async function captureCriticalChecksums() {
  const checksums = new Map();
  for (const relativePath of criticalPublicFiles) {
    const source = path.join(publicDir, relativePath);
    const destination = path.join(artifactDir, relativePath);
    if (!existsSync(source) || !existsSync(destination)) {
      throw new Error(`Critical public file missing before legacy copy: ${relativePath}`);
    }
    checksums.set(relativePath, await sha256(destination));
  }
  return checksums;
}

async function assertCriticalChecksumsUnchanged(before) {
  const preserved = [];
  for (const [relativePath, expected] of before.entries()) {
    const destination = path.join(artifactDir, relativePath);
    const actual = await sha256(destination);
    if (actual !== expected) {
      throw new Error(`Critical public file was modified while copying legacy files: ${relativePath}`);
    }
    preserved.push(`${relativePath}:${actual}`);
  }
  console.log(`Preserved critical public checksums: ${preserved.join(', ')}`);
}

async function collectFiles(directory, prefix = '') {
  if (!existsSync(directory)) return [];
  const discovered = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      discovered.push(...await collectFiles(absolutePath, relativePath));
    } else if (entry.isFile()) {
      discovered.push(relativePath);
    }
  }
  return discovered;
}

async function reportRootPublicCollisions() {
  const candidates = [...rootPublicFiles, ...legacyRootFiles];
  for (const directory of legacyRootDirectories) {
    const files = await collectFiles(path.join(repoRoot, directory), directory);
    candidates.push(...files);
  }

  const collisions = [];
  for (const relativePath of [...new Set(candidates)].sort()) {
    const publicPath = path.join(publicDir, relativePath);
    const rootPath = path.join(repoRoot, relativePath);
    if (!existsSync(publicPath) || !existsSync(rootPath)) continue;
    collisions.push({
      relativePath,
      publicSha: await sha256(publicPath),
      rootSha: await sha256(rootPath),
      publicSize: await fileSize(publicPath),
      rootSize: await fileSize(rootPath),
    });
  }

  if (collisions.length === 0) {
    console.log('Root/public collisions found: none. Public files win by default.');
    return;
  }

  console.log('Root/public collisions found (public wins; legacy root copy is skipped):');
  for (const collision of collisions) {
    console.log(`- ${collision.relativePath}`);
    console.log(`  public: public/${collision.relativePath} size=${collision.publicSize} sha256=${collision.publicSha}`);
    console.log(`  root: ${collision.relativePath} size=${collision.rootSize} sha256=${collision.rootSha}`);
    console.log('  previous winner: root copy could overwrite public when force:true was used');
    console.log('  runtime impact: preserving public avoids replacing official Project LM/runtime assets with legacy or incomplete files');
  }
}

async function copyRootPublicFiles() {
  const copied = [];
  const skipped = [];

  for (const file of [...rootPublicFiles, ...legacyRootFiles]) {
    const source = path.join(repoRoot, file);
    const destination = path.join(artifactDir, file);
    if (!existsSync(source)) {
      continue;
    }

    if (existsSync(destination)) {
      skipped.push(file);
      continue;
    }

    await cp(source, destination, { force: false });
    copied.push(file);
  }

  for (const directory of legacyRootDirectories) {
    const files = await collectFiles(path.join(repoRoot, directory), directory);
    for (const file of files) {
      const source = path.join(repoRoot, file);
      const destination = path.join(artifactDir, file);
      if (existsSync(destination)) {
        skipped.push(file);
        continue;
      }

      await mkdir(path.dirname(destination), { recursive: true });
      await cp(source, destination, { force: false });
      copied.push(file);
    }
  }

  copied.sort();
  skipped.sort();
  console.log(`Legacy root whitelist: ${legacyRootFiles.join(', ')}`);
  console.log(`Copied root public entries: ${copied.join(', ') || 'none'}`);
  console.log(`Skipped root public entries already provided by public/: ${skipped.join(', ') || 'none'}`);
}


async function rewriteArtifactOnlyLegacyPublicRoutes() {
  const legacyProfileScript = path.join(artifactDir, 'project-lm-profile.js');
  if (!existsSync(legacyProfileScript)) {
    return;
  }

  const content = await readFile(legacyProfileScript, 'utf8');
  const rewritten = content.replaceAll('public/project-lm-v5.html', 'project-lm-v5.html');
  await writeFile(legacyProfileScript, rewritten);
}

async function listTextFiles(directory) {
  const discovered = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      discovered.push(...await listTextFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && ['.html', '.js'].includes(path.extname(entry.name))) {
      discovered.push(absolutePath);
    }
  }

  return discovered;
}

function normalizeRouteReference(reference, sourceFile) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(reference) || reference.startsWith('//')) {
    return null;
  }

  const cleanedReference = reference.replace(/^[`'\"]+/, '');
  const withoutFragment = cleanedReference.split('#')[0].split('?')[0];
  if (!withoutFragment.endsWith('.html')) {
    return null;
  }

  const sourceRelativeDirectory = path.dirname(path.relative(artifactDir, sourceFile));
  const isScript = path.extname(sourceFile) === '.js';
  const routePath = withoutFragment.startsWith('/')
    ? withoutFragment.slice(1)
    : isScript && !withoutFragment.startsWith('.')
      ? path.normalize(withoutFragment)
      : path.normalize(path.join(sourceRelativeDirectory, withoutFragment));

  if (routePath.startsWith('..') || path.isAbsolute(routePath)) {
    return null;
  }

  return routePath.replaceAll(path.sep, '/');
}

async function collectExpectedPublicRoutes() {
  const routes = new Set(requiredArtifactFiles.filter((file) => file.endsWith('.html')));
  const files = await listTextFiles(artifactDir);

  for (const file of files) {
    const content = await readFile(file, 'utf8');
    for (const match of content.matchAll(routeReferencePattern)) {
      const route = normalizeRouteReference(match[1], file);
      if (route) {
        routes.add(route);
      }
    }
  }

  return [...routes].sort();
}

async function assertExpectedRoutesExist(routes) {
  const missing = [];
  for (const route of routes) {
    if (!existsSync(path.join(artifactDir, route))) {
      missing.push(route);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing public route(s) in Pages artifact: ${missing.join(', ')}`);
  }
}

async function assertForbiddenEntriesAbsent() {
  const published = forbiddenArtifactEntries.filter((entry) => existsSync(path.join(artifactDir, entry)));
  if (published.length > 0) {
    throw new Error(`Invalid Pages artifact: private or source entries must not be published: ${published.join(', ')}`);
  }
}

async function main() {
  if (!existsSync(publicDir)) {
    throw new Error('Missing public/ directory; cannot prepare GitHub Pages artifact.');
  }

  await rm(artifactDir, { recursive: true, force: true });
  await mkdir(artifactDir, { recursive: true });

  // Copy the contents of public/ into the artifact root. The public directory
  // itself must not be preserved, otherwise Pages serves /public/assets/... and
  // absolute runtime paths such as /assets/exercise-library/*.gif return 404.
  await cp(publicDir, artifactDir, { recursive: true, dereference: true, force: true });
  await reportRootPublicCollisions();
  const criticalChecksums = await captureCriticalChecksums();

  // Restore legacy Portal/Admin public entrypoints that still live at the repo
  // root without publishing source, tests, migrations, workers or configuration.
  await copyRootPublicFiles();
  await rewriteArtifactOnlyLegacyPublicRoutes();
  await assertCriticalChecksumsUnchanged(criticalChecksums);

  // Expose css/ and js/ at the artifact root for the Pages artifact contract,
  // while retaining assets/css and assets/js for existing application paths.
  await copyIfExists(path.join(publicDir, 'assets', 'css'), path.join(artifactDir, 'css'));
  await copyIfExists(path.join(publicDir, 'assets', 'js'), path.join(artifactDir, 'js'));

  await assertForbiddenEntriesAbsent();

  await Promise.all([
    ...requiredArtifactDirectories.map(assertDirectory),
    ...requiredArtifactFiles.map(assertFile),
  ]);

  const expectedRoutes = await collectExpectedPublicRoutes();
  await assertExpectedRoutesExist(expectedRoutes);

  console.log(`Validated public HTML routes: ${expectedRoutes.join(', ')}`);
  console.log('GitHub Pages artifact root validated: assets/, css/, js/, projeto-lm/, index.html, portal-login.html, portal.html');
  console.log('Confirmed: assets/exercise-library/rosca-direta-barra.gif exists at artifact root.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
