function rows(result) { return result?.results ?? []; }
export function createD1FollowupEntryRepository(db) {
  return Object.freeze({
    async append(entry) {
      const now = entry.created_at ?? new Date().toISOString();
      await db.prepare(`INSERT INTO premium_followup_entries (id, student_id, entry_type, title, content, source, related_entity_type, related_entity_id, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(entry.id, entry.student_id, entry.entry_type, entry.title, entry.content ?? null, entry.source ?? 'admin', entry.related_entity_type ?? null, entry.related_entity_id ?? null, entry.created_by ?? null, now, entry.updated_at ?? now).run();
      return this.findById(entry.id);
    },
    findById(id) { return db.prepare('SELECT * FROM premium_followup_entries WHERE id = ? LIMIT 1').bind(id).first(); },
    async listByStudentId(studentId, { limit = 50, offset = 0 } = {}) { return rows(await db.prepare('SELECT * FROM premium_followup_entries WHERE student_id = ? ORDER BY datetime(created_at) DESC, id DESC LIMIT ? OFFSET ?').bind(studentId, limit, offset).all()); },
    async listByRelatedEntity(type, id) { return rows(await db.prepare('SELECT * FROM premium_followup_entries WHERE related_entity_type = ? AND related_entity_id = ? ORDER BY datetime(created_at) DESC, id DESC').bind(type, id).all()); },
    async update(id, patch = {}) { const current = await this.findById(id); if (!current) return null; const next = { ...current, ...patch, updated_at: new Date().toISOString() }; await db.prepare('UPDATE premium_followup_entries SET title=?, content=?, updated_at=? WHERE id=?').bind(next.title, next.content ?? null, next.updated_at, id).run(); return this.findById(id); },
  });
}
