import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const rootDir = process.cwd();

const criticalFiles = [
  'admin.html',
  'admin-command-center.html',
  'admin-student.html',
  'admin-students.html',
  'admin-login.html',
  'portal-login.html',
  'portal.html',
  'portal-checkin.html',
  'portal-plano-alimentar.html',
  'portal-progressao.html',
  'projeto-lm-onboarding.html',
  'projeto-lm-planejamento.html',
  'projeto-lm-biblioteca.html',
  'projeto-lm-conquistas.html',
  'workers/api.js',
  'workers/student360.js',
  'workers/command-center.js',
  'workers/event-types.js',
  'workers/timeline-engine.js',
];

const htmlFiles = criticalFiles.filter((file) => file.endsWith('.html'));

function rootPath(file) {
  return path.join(rootDir, file);
}

function isExternalReference(value) {
  return /^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(value)
    || /^(?:mailto|tel|javascript|data):/i.test(value)
    || value.startsWith('#');
}

function normalizeReference(value) {
  return value.trim().split('#')[0].split('?')[0];
}

function resolveInternalReference(fromFile, value) {
  const normalized = normalizeReference(value);

  if (!normalized || isExternalReference(normalized)) {
    return null;
  }

  if (normalized.startsWith('/')) {
    return path.join(rootDir, normalized.slice(1));
  }

  return path.resolve(rootDir, path.dirname(fromFile), normalized);
}

function collectAttributeValues(html, tagName, attributeName) {
  const values = [];
  const tagPattern = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  const attrPattern = new RegExp(`\\b${attributeName}\\s*=\\s*(["'])(.*?)\\1`, 'i');

  for (const tag of html.matchAll(tagPattern)) {
    const attr = tag[0].match(attrPattern);
    if (attr?.[2]) {
      values.push(attr[2]);
    }
  }

  return values;
}

function collectStylesheetHrefs(html) {
  const values = [];
  const linkPattern = /<link\b[^>]*>/gi;
  const hrefPattern = /\bhref\s*=\s*(["'])(.*?)\1/i;
  const relPattern = /\brel\s*=\s*(["'])(.*?)\1/i;

  for (const link of html.matchAll(linkPattern)) {
    const href = link[0].match(hrefPattern);
    const rel = link[0].match(relPattern);
    const relValues = rel?.[2]?.toLowerCase().split(/\s+/) ?? [];

    if (href?.[2] && relValues.includes('stylesheet')) {
      values.push(href[2]);
    }
  }

  return values;
}

async function readHtml(file) {
  return readFile(rootPath(file), 'utf8');
}

test('critical Portal LM files exist', () => {
  const missingFiles = criticalFiles.filter((file) => !existsSync(rootPath(file)));
  assert.deepEqual(missingFiles, []);
});

test('HTML script references point to existing files', async () => {
  const missingReferences = [];

  for (const file of htmlFiles) {
    const html = await readHtml(file);
    for (const src of collectAttributeValues(html, 'script', 'src')) {
      const resolvedPath = resolveInternalReference(file, src);
      if (resolvedPath && !existsSync(resolvedPath)) {
        missingReferences.push(`${file} -> ${src}`);
      }
    }
  }

  assert.deepEqual(missingReferences, []);
});

test('HTML stylesheet references point to existing files', async () => {
  const missingReferences = [];

  for (const file of htmlFiles) {
    const html = await readHtml(file);
    for (const href of collectStylesheetHrefs(html)) {
      const resolvedPath = resolveInternalReference(file, href);
      if (resolvedPath && !existsSync(resolvedPath)) {
        missingReferences.push(`${file} -> ${href}`);
      }
    }
  }

  assert.deepEqual(missingReferences, []);
});

test('internal .html links point to existing files', async () => {
  const missingReferences = [];

  for (const file of htmlFiles) {
    const html = await readHtml(file);
    for (const href of collectAttributeValues(html, 'a', 'href')) {
      const normalized = normalizeReference(href);
      if (!normalized.endsWith('.html')) {
        continue;
      }

      const resolvedPath = resolveInternalReference(file, href);
      if (resolvedPath && !existsSync(resolvedPath)) {
        missingReferences.push(`${file} -> ${href}`);
      }
    }
  }

  assert.deepEqual(missingReferences, []);
});

test('package.json keeps the node test script', async () => {
  const packageJson = JSON.parse(await readFile(rootPath('package.json'), 'utf8'));
  assert.equal(packageJson.scripts?.test, 'node --test');
});
