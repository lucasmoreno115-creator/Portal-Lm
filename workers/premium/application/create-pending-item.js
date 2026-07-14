import { assertPendingItemPriority, assertPendingItemType } from '../domain/pending-item.js';
export function createCreatePendingItemUseCase({ studentRepository, pendingItemRepository, followupEntryRepository, randomUUID = crypto.randomUUID }) {
  return async function createPendingItem({ student_id, type, title, description, priority = 'NORMAL', source = 'manual', related_entity_type = null, related_entity_id = null, due_at = null, created_by = null }) {
    if (!student_id) return { ok: false, error: 'student_id é obrigatório.', status: 400 };
    const student = await studentRepository.findByStudentId(student_id); if (!student) return { ok: false, error: 'Aluno Premium não encontrado.', status: 404 };
    assertPendingItemType(type); assertPendingItemPriority(priority);
    const item = await pendingItemRepository.create({ id: randomUUID(), student_id, type, title: title || type, description, priority, source, related_entity_type, related_entity_id, due_at, created_by });
    await followupEntryRepository?.append?.({ id: randomUUID(), student_id, entry_type: 'PENDING_ITEM_CREATED', title: `Pendência criada: ${item.title}`, content: item.description, source, related_entity_type: 'premium_pending_items', related_entity_id: item.id, created_by });
    return { ok: true, data: item };
  };
}
