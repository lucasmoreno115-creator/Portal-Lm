import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

export const RC1_PREMIUM_MIGRATIONS = Object.freeze([
  'migrations/0004_nutrition_plans.sql',
  'migrations/0005_premium_anamnesis.sql',
  'migrations/0006_activity_timeline.sql',
  'migrations/0007_student_access_plan.sql',
  'migrations/0025_create_premium_students.sql',
  'migrations/0026_add_student_id_to_premium_tables.sql',
  'migrations/0027_create_premium_followup_entries.sql',
  'migrations/0028_create_premium_pending_items.sql',
  'migrations/0029_add_weekly_feedback_operational_fields.sql',
  'migrations/0030_create_premium_feedback_reminders.sql',
  'migrations/0031_add_nutrition_plan_lifecycle.sql',
  'migrations/0032_finalize_nutrition_plan_lifecycle.sql',
  'migrations/0033_add_professional_workspace_indexes.sql',
]);

function resultFromRun(result = {}) { return { success: true, changes: Number(result.changes ?? 0), meta: { changes: Number(result.changes ?? 0) } }; }

export function createD1SqliteAdapter(sqlite) {
  return {
    prepare(sql) {
      const state = { params: [] };
      return {
        bind(...params) { state.params = params; return this; },
        async all() { return { results: sqlite.prepare(sql).all(...state.params) }; },
        async first() { return sqlite.prepare(sql).get(...state.params) ?? null; },
        async run() { return resultFromRun(sqlite.prepare(sql).run(...state.params)); },
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    sqlite,
  };
}

export function applyBaseSchema(sqlite) {
  sqlite.exec(`
    PRAGMA foreign_keys = OFF;
    CREATE TABLE IF NOT EXISTS student_access (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT NOT NULL,
      whatsapp TEXT,
      status TEXT DEFAULT 'active',
      plan_type TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS student_checkins (
      id TEXT PRIMARY KEY,
      student_email TEXT NOT NULL,
      week_ref TEXT,
      training_adherence TEXT,
      nutrition_adherence TEXT,
      cardio_adherence TEXT,
      free_meals TEXT,
      hunger_level TEXT,
      binge_or_snacking TEXT,
      sleep_quality TEXT,
      energy_level TEXT,
      stress_level TEXT,
      weekly_weight TEXT,
      waist TEXT,
      strength_status TEXT,
      main_difficulty TEXT,
      routine_context TEXT,
      weekly_score INTEGER,
      support_needed TEXT,
      coach_status TEXT,
      coach_reply TEXT,
      coach_reply_at TEXT,
      reviewed_at TEXT,
      reviewed_by TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS weekly_plans (id TEXT PRIMARY KEY, student_email TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS progression_logs (id TEXT PRIMARY KEY, student_email TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS followup_logs (id TEXT PRIMARY KEY, student_email TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS retention_actions (id TEXT PRIMARY KEY, student_email TEXT, created_at TEXT NOT NULL);
  `);
}

export function applyRc1PremiumMigrations(sqlite, migrations = RC1_PREMIUM_MIGRATIONS) {
  for (const migration of migrations) sqlite.exec(fs.readFileSync(migration, 'utf8'));
}

export function createRc1D1Fixture() {
  const sqlite = new DatabaseSync(':memory:');
  applyBaseSchema(sqlite);
  applyRc1PremiumMigrations(sqlite);
  return { sqlite, db: createD1SqliteAdapter(sqlite), migrations: RC1_PREMIUM_MIGRATIONS };
}
