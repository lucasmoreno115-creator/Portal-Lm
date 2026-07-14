export function createResolvePendingItemUseCase({ pendingItemRepository, followupEntryRepository, randomUUID = crypto.randomUUID }) {
  return async function resolvePendingItem({ id, created_by = null }) {
    if (!id) return { ok: false, error: 'id é obrigatório.', status: 400 };
    const item = await pendingItemRepository.findById(id); if (!item) return { ok: false, error: 'Pendência não encontrada.', status: 404 };
    const resolved = await pendingItemRepository.resolve(id, { created_by });
    await followupEntryRepository?.append?.({ id: randomUUID(), student_id: item.student_id, entry_type: 'PENDING_ITEM_RESOLVED', title: `Pendência resolvida: ${item.title}`, content: item.description, source: 'admin', related_entity_type: 'premium_pending_items', related_entity_id: id, created_by });
    return { ok: true, data: resolved };
  };
}
