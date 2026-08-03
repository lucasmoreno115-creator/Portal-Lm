import { DatabaseSync } from 'node:sqlite';

export class SqliteD1 {
  constructor(file) {
    this.file = file;
    this.database = new DatabaseSync(file);
    this.calls = [];
  }

  prepare(sql) {
    this.calls.push(sql);
    return new SqliteD1Statement(this, sql);
  }

  async batch(statements) {
    this.database.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.database.exec('COMMIT');
      return results;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  close() {
    this.database.close();
  }
}

class SqliteD1Statement {
  constructor(owner, sql, params = []) {
    this.owner = owner;
    this.sql = sql;
    this.params = params;
  }

  bind(...params) {
    return new SqliteD1Statement(this.owner, this.sql, params);
  }

  async run() {
    const result = this.owner.database.prepare(this.sql).run(...this.params);
    const changes = Number(result.changes);
    return { changes, meta: { changes } };
  }

  async all() {
    return { results: this.owner.database.prepare(this.sql).all(...this.params).map(toPlainObject) };
  }

  async first() {
    const row = this.owner.database.prepare(this.sql).get(...this.params);
    return row ? toPlainObject(row) : null;
  }
}

export function executeSql(file, sql) {
  const database = new DatabaseSync(file);
  try {
    database.exec(sql);
  } finally {
    database.close();
  }
}

export function querySql(file, sql) {
  const database = new DatabaseSync(file, { readOnly: true });
  try {
    return database.prepare(sql).all().map(toPlainObject);
  } finally {
    database.close();
  }
}

function toPlainObject(row) {
  return { ...row };
}
