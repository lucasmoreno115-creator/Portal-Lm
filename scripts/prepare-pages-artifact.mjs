import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const publicDir = path.join(repoRoot, 'public');
const artifactDir = path.join(repoRoot, 'github-pages-artifact');

const rootPublicFileExtensions = new Set(['.html', '.css', '.js', '.ico']);
const rootPublicFiles = ['CNAME', '_redirects'];
const rootPublicDirectories = ['assets'];
const forbiddenArtifactEntries = ['public', 'src', 'tests', 'workers', '.github'];
const requiredArtifactFiles = [
  'index.html',
  'portal-login.html',
  'portal.html',
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
    await cp(source, destination, { recursive: true, dereference: true, force: true });
  }
}

async function copyRootPublicFiles() {
  const entries = await readdir(repoRoot, { withFileTypes: true });
  const copied = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const shouldCopy = rootPublicFileExtensions.has(path.extname(entry.name)) || rootPublicFiles.includes(entry.name);
    if (!shouldCopy) {
      continue;
    }

    await cp(path.join(repoRoot, entry.name), path.join(artifactDir, entry.name), { force: true });
    copied.push(entry.name);
  }

  for (const directory of rootPublicDirectories) {
    const source = path.join(repoRoot, directory);
    if (!existsSync(source)) {
      continue;
    }

    await cp(source, path.join(artifactDir, directory), { recursive: true, dereference: true, force: true });
    copied.push(`${directory}/`);
  }

  copied.sort();
  console.log(`Copied root public entries: ${copied.join(', ')}`);
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

  // Restore legacy Portal/Admin public entrypoints that still live at the repo
  // root without publishing source, tests, migrations, workers or configuration.
  await copyRootPublicFiles();
  await rewriteArtifactOnlyLegacyPublicRoutes();

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
