# Production Checklist — LM Premium 3.0.0

## Antes do deploy

- [ ] Branch `release/lm-premium-3.0.0` revisada.
- [ ] PR aprovada.
- [ ] Backup validado.
- [ ] Auditorias sem bloqueios.
- [ ] Migrations históricas conferidas.
- [ ] Feature flags conferidas.
- [ ] `npm test` aprovado.
- [ ] `node --check workers/api.js` aprovado.

## Durante

- [ ] Janela de deploy aberta.
- [ ] Artefato correto publicado.
- [ ] Logs monitorados.
- [ ] Smoke mínimo executado.
- [ ] Sem erro 5xx crítico.

## Depois

- [ ] Workspace validado.
- [ ] Prontuário validado.
- [ ] Feedback semanal validado.
- [ ] Plano alimentar validado.
- [ ] Projeto LM validado como isolado.
- [ ] Evidências anexadas.

## Rollback

- [ ] Critério de rollback confirmado.
- [ ] Artefato anterior restaurado.
- [ ] Banco restaurado apenas se necessário.
- [ ] Smoke pós-rollback executado.
- [ ] Incidente registrado.

## Build 6.6 — checklist antes de produção

- [ ] Validar staging completo do Workspace Premium em `/admin`.
- [ ] Confirmar login, logout e bloqueio de usuário não admin.
- [ ] Confirmar Prontuário, Feedback, Plano, Anamnese e Student 360 por `student_id`.
- [ ] Confirmar rollback em `/admin-legacy.html`.
- [ ] Não executar migrations em produção para este Build.

### Correção PR #276

- [ ] Confirmar `PREMIUM_ADMIN_CUTOVER_ENABLED=true` em staging antes de promover `/admin` para o Workspace.
- [ ] Confirmar `PREMIUM_ADMIN_CUTOVER_ENABLED=false` abrindo `/admin-legacy.html`.
- [ ] Confirmar que `/admin-legacy.html` contém o Admin Hub legado operacional.
- [ ] Confirmar que `/admin-anamneses.html?student_id=...` e `/admin-student.html?student_id=...` abrem telas funcionais reais.
