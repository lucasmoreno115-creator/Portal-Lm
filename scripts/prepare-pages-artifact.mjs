import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const publicDir = path.join(repoRoot, 'public');
const artifactDir = path.join(repoRoot, 'github-pages-artifact');

const requiredEntries = [
  'assets',
  'css',
  'js',
  'projeto-lm',
  'index.html',
  'assets/exercise-library/rosca-direta-barra.gif',
];

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

  // The repository root index is the canonical Pages entry point. Keep this as a
  // publishing concern so runtime sources and asset paths remain untouched.
  await cp(path.join(repoRoot, 'index.html'), path.join(artifactDir, 'index.html'), { force: true });

  // Expose css/ and js/ at the artifact root for the Pages artifact contract,
  // while retaining assets/css and assets/js for existing application paths.
  await cp(path.join(publicDir, 'assets', 'css'), path.join(artifactDir, 'css'), { recursive: true, dereference: true, force: true });
  await cp(path.join(publicDir, 'assets', 'js'), path.join(artifactDir, 'js'), { recursive: true, dereference: true, force: true });

  if (existsSync(path.join(artifactDir, 'public'))) {
    throw new Error('Invalid Pages artifact: public/ must not exist at the artifact root.');
  }

  await Promise.all([
    assertDirectory('assets'),
    assertDirectory('css'),
    assertDirectory('js'),
    assertDirectory('projeto-lm'),
    assertFile('index.html'),
    assertFile('assets/exercise-library/rosca-direta-barra.gif'),
  ]);

  console.log('GitHub Pages artifact root validated: assets/, css/, js/, projeto-lm/, index.html');
  console.log('Confirmed: assets/exercise-library/rosca-direta-barra.gif exists at artifact root.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
