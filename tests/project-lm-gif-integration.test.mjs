import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';
import { generateStudentWorkoutPlan } from '../src/projeto-lm/services/generateStudentWorkoutPlan.js';
import { renderWorkoutPlan } from '../src/projeto-lm/ui/studentPlanRenderers.js';
import exercises from '../src/projeto-lm/engines/training/exercises.json' with { type: 'json' };
import workoutLibrary from '../src/projeto-lm/engines/training/workout_library.json' with { type: 'json' };

function contentType(filePath) {
  return ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.gif': 'image/gif', '.css': 'text/css' })[extname(filePath)] || 'application/octet-stream';
}

async function withPublicServer(callback) {
  const publicRoot = normalize(join(process.cwd(), 'public'));
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const pathname = url.pathname === '/projeto-lm' ? '/project-lm-2.html' : url.pathname;
      const filePath = normalize(join(publicRoot, pathname));
      if (!filePath.startsWith(publicRoot)) throw new Error('invalid path');
      const body = await readFile(filePath);
      res.writeHead(200, { 'content-type': contentType(filePath) });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('Exercise GIF integration is preserved from library to renderer and public asset', async () => {
  const lowerA = workoutLibrary.workouts.female_program.lower_a;
  assert.equal(lowerA.exercises[0].id, 'leg_press');

  const libraryExercise = exercises.find((exercise) => exercise.id === lowerA.exercises[0].id);
  assert.equal(libraryExercise?.gif, '/assets/exercise-library/leg-press-45.gif');

  const plan = generateStudentWorkoutPlan({ profile: 'GYM_FEMALE', day: 'lower_a' });
  assert.equal(plan.exercises[0].gif, '/assets/exercise-library/leg-press-45.gif');
  assert.equal(plan.exercises[0].video, '');

  const html = renderWorkoutPlan(plan);
  assert.match(html, /<img src="\/assets\/exercise-library\/leg-press-45\.gif"/);

  await withPublicServer(async (origin) => {
    const asset = await fetch(`${origin}${plan.exercises[0].gif}`);
    assert.equal(asset.status, 200);
    assert.equal(asset.headers.get('content-type'), 'image/gif');

    const services = await fetch(`${origin}/assets/js/project-lm-engine-services.js`).then((response) => response.text());
    assert.match(services, /\.\/project-lm-runtime\/services\/generateStudentWorkoutPlan\.js/);
    assert.doesNotMatch(services, /src\/projeto-lm/);
  });
});

test('Public Projeto LM engine services module loads and sends exercise.gif to renderer', async () => {
  global.window = {
    location: { hostname: 'localhost' },
    dispatchEvent(event) { this.lastEvent = event.type; }
  };
  global.CustomEvent = class CustomEvent { constructor(type) { this.type = type; } };

  await import(`${pathToFileURL(process.cwd() + '/public/assets/js/project-lm-engine-services.js').href}?gif-integration=${Date.now()}`);

  const plan = window.ProjectLmEngineServices.getStudentWorkoutPlan({ sex: 'female', weight: 70 }, { day: 'lower_a' });
  assert.equal(plan.exercises[0].gif, '/assets/exercise-library/leg-press-45.gif');
  const rendered = window.ProjectLmEngineServices.renderWorkoutPlan(plan);
  assert.match(rendered, /<img src="\/assets\/exercise-library\/leg-press-45\.gif"/);
  assert.equal(window.lastEvent, 'project-lm-engine-services-ready');

  delete global.window;
  delete global.CustomEvent;
});
