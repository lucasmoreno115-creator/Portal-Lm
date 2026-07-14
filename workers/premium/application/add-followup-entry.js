import { assertFollowupEntryType } from '../domain/followup-entry.js';
export function createAddFollowupEntryUseCase({ studentRepository, followupEntryRepository, randomUUID = crypto.randomUUID }) {
  return async function addFollowupEntry({ student_id, entry_type, title, content, source = 'admin', related_entity_type = null, related_entity_id = null, created_by = null }) {
    if (!student_id) return { ok: false, error: 'student_id é obrigatório.', status: 400 };
    const student = await studentRepository.findByStudentId(student_id); if (!student) return { ok: false, error: 'Aluno Premium não encontrado.', status: 404 };
    assertFollowupEntryType(entry_type); if (!title) return { ok: false, error: 'title é obrigatório.', status: 400 };
    return { ok: true, data: await followupEntryRepository.append({ id: randomUUID(), student_id, entry_type, title, content, source, related_entity_type, related_entity_id, created_by }) };
  };
}
