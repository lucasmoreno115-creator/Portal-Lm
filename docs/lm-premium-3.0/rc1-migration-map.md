# LM Premium 3.0 RC1 — Mapa de migrations

Validação RC1: números Premium não duplicados e ordem obrigatória preservada de `0004` até `0033`.

| Nº | Migration | Objetivo | Tabelas/colunas/índices | Pré-condições | Auditoria relacionada | Reaplicação | Rollback | Risco |
|---|---|---|---|---|---|---|---|---|
| 0004 | `nutrition_plans` | Plano alimentar legado | tabela e índices básicos | schema base | lifecycle audit | protegida por `IF NOT EXISTS` | restore/backup | médio |
| 0005 | `premium_anamnesis` | Anamnese Premium | tabela e índices | schema base | RC1/anamnese | protegida | restore | médio |
| 0006 | `activity_timeline` | Timeline compatível | tabela timeline | schema base | RC1/evolução | protegida | restore | baixo |
| 0007 | `student_access_plan` | Acesso e planos | colunas de plano em `student_access` | `student_access` | RC1/identidade | depende de guards da migration | restore | médio |
| 0025 | `create_premium_students` | Identidade oficial | `premium_students`, índices email/status | deduplicar e-mails | RC1/identidade | protegida | backup + drop em teste | alto |
| 0026 | `add_student_id_to_premium_tables` | Associar tabelas Premium | `student_id` em anamnese/checkins/planos | `premium_students` | backfill + RC1 | não executar manualmente sem controle | backup | alto |
| 0027 | `create_premium_followup_entries` | Prontuário/evolução | tabela, índices, unicidade decisão | identidade | RC1/evolução | protegida | backup/drop teste | médio |
| 0028 | `create_premium_pending_items` | Pendências | tabela, índices, unique aberta | identidade | RC1/pendências | protegida | backup/drop teste | médio |
| 0029 | `weekly_feedback_operational_fields` | Campos operacionais | campos de decisão/revisão | feedback existente | RC1/feedback | aditiva | restore | médio |
| 0030 | `premium_feedback_reminders` | Fila operacional | tabela/índices lembretes | identidade + feedback | RC1/feedback | protegida | backup/drop teste | baixo |
| 0031 | `add_nutrition_plan_lifecycle` | Fase 1 lifecycle | status/version/source/supersedes + índices | auditoria antes do backfill final | nutrition lifecycle | aditiva; evitar repetição manual | restore | alto |
| 0032 | `finalize_nutrition_plan_lifecycle` | Constraints finais | backfill auditado + unique published/draft/version | auditoria sem bloqueios | nutrition lifecycle + RC1 | não idempotente operacionalmente; usar controle de migrations | restore | alto |
| 0033 | `professional_workspace_indexes` | Performance Workspace | índices para filtros/listas | tabelas Premium criadas | RC1/workspace | protegida | pode remover índices em teste | baixo |

## Ordem obrigatória
`0004 → 0005 → 0006 → 0007 → 0025 → 0026 → 0027 → 0028 → 0029 → 0030 → 0031 → auditoria sem BLOCKING → 0032 → 0033`.

## Dry-run RC1
- Cenário limpo deve aplicar todas as migrations via controle do D1 e retornar auditoria sem `BLOCKING`.
- Cenário com conflitos deve parar antes de `0032`, sem correção automática e sem apagamento.
- Reaplicação manual de migrations com mutação/backfill deve ser tratada como inadequada; reaplicação segura é via tabela de controle de migrations.

## Evidência e pendências após PR #270
- Evidência local: testes validam que o snapshot vazio, mas completo, é auditável; snapshot incompleto não é auditado e retorna exit code `2`.
- Evidência simulada: E2E com SQLite temporário valida persistência dos principais fluxos sem alterar migrations existentes.
- Pendente de staging: executar migrations em D1 temporário com dump real, gerar schema JSON, rodar auditoria, smoke e verify com evidências reais.
- Bloqueador de deploy: qualquer ausência de tabela/coluna/índice essencial, auditoria com `BLOCKING` ou smoke não executado/reprovado.
