import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_TYPES } from '../workers/event-types.js';

const rootDir = process.cwd();
const fallbackView = {
  icon: '🕒',
  title: 'Atividade registrada',
  description: 'Um evento operacional foi registrado no sistema.',
  category: 'outros',
};

function isFallbackView(view) {
  return view?.icon === fallbackView.icon
    && view?.title === fallbackView.title
    && view?.description === fallbackView.description
    && view?.category === fallbackView.category;
}

function extractFunctionSource(source, functionName) {
  const declaration = `function ${functionName}`;
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `${functionName} não foi encontrada na fonte real.`);

  const bodyStart = source.indexOf('{', start);
  assert.notEqual(bodyStart, -1, `${functionName} não possui corpo válido.`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      return source.slice(start, index + 1);
    }
  }

  assert.fail(`${functionName} não possui fechamento válido.`);
}

async function loadTimelineEventViewFromHtml(file) {
  const html = await readFile(path.join(rootDir, file), 'utf8');
  const functionSource = extractFunctionSource(html, 'getTimelineEventView');
  const context = vm.createContext({});
  vm.runInContext(`${functionSource}; globalThis.getTimelineEventView = getTimelineEventView;`, context);
  return context.getTimelineEventView;
}

const visualMapSources = [
  ['Student 360', 'admin-student.html'],
  ['Command Center', 'admin-command-center.html'],
];

test('EVENT_TYPES possui apenas valores string válidos e únicos', () => {
  const entries = Object.entries(EVENT_TYPES);
  assert.ok(entries.length > 0, 'EVENT_TYPES não pode estar vazio.');

  const invalidEntries = entries.filter(([, value]) => typeof value !== 'string' || !value.trim());
  assert.deepEqual(invalidEntries, []);

  const values = entries.map(([, value]) => value);
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  assert.deepEqual(duplicates, []);
});

test('reactivation_contact_sent está coberto pelos mapas visuais reais', async () => {
  for (const [label, file] of visualMapSources) {
    const getTimelineEventView = await loadTimelineEventViewFromHtml(file);
    const view = getTimelineEventView({ type: 'reactivation_contact_sent' });

    assert.equal(isFallbackView(view), false, `${label} retornou fallback para reactivation_contact_sent.`);
    assert.equal(view.title, 'Contato de reativação enviado');
  }
});

test('todo EVENT_TYPES persistido possui mapeamento visual sem fallback genérico', async () => {
  for (const [label, file] of visualMapSources) {
    const getTimelineEventView = await loadTimelineEventViewFromHtml(file);

    for (const eventType of Object.values(EVENT_TYPES)) {
      const upperView = getTimelineEventView({ type: eventType });
      const lowerView = getTimelineEventView({ type: eventType.toLowerCase() });

      assert.equal(isFallbackView(upperView), false, `${label} retornou fallback para ${eventType}.`);
      assert.equal(isFallbackView(lowerView), false, `${label} retornou fallback para ${eventType.toLowerCase()}.`);
    }
  }
});
