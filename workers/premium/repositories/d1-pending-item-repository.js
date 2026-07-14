function rows(result) { return result?.results ?? []; }
export function createD1PendingItemRepository(db) {
  return Object.freeze({
    async create(item) {
      const now = item.created_at ?? new Date().toISOString();
      const existing = await db.prepare(`SELECT * FROM premium_pending_items WHERE student_id=? AND type=? AND COALESCE(related_entity_type,'')=COALESCE(?,'') AND COALESCE(related_entity_id,'')=COALESCE(?,'') AND status='OPEN' LIMIT 1`).bind(item.student_id, item.type, item.related_entity_type ?? null, item.related_entity_id ?? null).first();
      if (existing) return existing;
      await db.prepare(`INSERT INTO premium_pending_items (id, student_id, type, title, description, status, priority, source, related_entity_type, related_entity_id, due_at, resolved_at, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(item.id, item.student_id, item.type, item.title, item.description ?? null, item.status ?? 'OPEN', item.priority ?? 'NORMAL', item.source ?? 'manual', item.related_entity_type ?? null, item.related_entity_id ?? null, item.due_at ?? null, null, item.created_by ?? null, now, item.updated_at ?? now).run();
      return this.findById(item.id);
    },
    findById(id) { return db.prepare('SELECT * FROM premium_pending_items WHERE id = ? LIMIT 1').bind(id).first(); },
    async listOpenByStudentId(studentId, { limit = 100 } = {}) { return rows(await db.prepare(`SELECT * FROM premium_pending_items WHERE student_id=? AND status='OPEN' ORDER BY CASE priority WHEN 'HIGH' THEN 0 ELSE 1 END, datetime(created_at) DESC LIMIT ?`).bind(studentId, limit).all()); },
    async listByStudentId(studentId, { status = null, limit = 100, offset = 0 } = {}) { const where = status ? 'student_id=? AND status=?' : 'student_id=?'; const params = status ? [studentId, status] : [studentId]; return rows(await db.prepare(`SELECT * FROM premium_pending_items WHERE ${where} ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?`).bind(...params, limit, offset).all()); },
    async resolve(id, { resolved_at, created_by } = {}) { const now = resolved_at ?? new Date().toISOString(); await db.prepare(`UPDATE premium_pending_items SET status='RESOLVED', resolved_at=?, updated_at=?, created_by=COALESCE(created_by, ?) WHERE id=?`).bind(now, now, created_by ?? null, id).run(); return this.findById(id); },
    async dismiss(id, { updated_at } = {}) { const now = updated_at ?? new Date().toISOString(); await db.prepare(`UPDATE premium_pending_items SET status='DISMISSED', updated_at=? WHERE id=?`).bind(now, id).run(); return this.findById(id); },
  });
}
