import test from 'node:test';
import assert from 'node:assert/strict';
import { getProjectLmCurrentMission } from '../workers/api.js';

function createDbMock({ expectedUserId, rejectedEmail }) {
  const bindings = [];
  return {
    bindings,
    prepare(sql) {
      return {
        bind(value) {
          bindings.push({ sql, value });
          return {
            async first() {
              if (sql.includes('FROM project_lm_profiles')) {
                assert.equal(value, expectedUserId);
                assert.notEqual(value, rejectedEmail);
                return {
                  name: 'Aluno',
                  goal: 'Continuar',
                  objective: 'Continuar',
                  sex: 'male',
                  weight_kg: 90,
                  height_cm: 180,
                  nutrition_plan_code: 'male_90',
                  initial_plan_code: 'male_90',
                  created_at: '2026-06-08T00:00:00.000Z',
                  updated_at: '2026-06-08T00:00:00.000Z'
                };
              }

              if (sql.includes('FROM project_lm_weekly_missions')) {
                assert.equal(value, 3);
                return {
                  week_number: 3,
                  title: 'Semana 3',
                  description: 'Descrição da semana 3',
                  main_mission: 'Missão da semana 3',
                  success_criteria: 'Critério da semana 3'
                };
              }

              throw new Error(`Unexpected query: ${sql}`);
            }
          };
        }
      };
    }
  };
}

test('getProjectLmCurrentMission uses user_id to load profile and calculate the current week', async () => {
  const db = createDbMock({ expectedUserId: 123, rejectedEmail: 'aluno@example.com' });

  const mission = await getProjectLmCurrentMission(db, 123);

  assert.equal(mission.week, 3);
  assert.equal(mission.title, 'Semana 3');
  assert.deepEqual(db.bindings.map((binding) => binding.value), [123, 3]);
});
