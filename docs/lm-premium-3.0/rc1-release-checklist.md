# Release 3.0.0 — Checklist de release

> Release 3.0.0: este documento é mantido como histórico da RC1 e referência operacional para a release oficial.


## Antes do deploy
- [ ] Backup D1 real exportado e validado.
- [ ] SHA da release registrado.
- [ ] Snapshot JSON gerado com todas as tabelas obrigatórias.
- [ ] `audit-lm-premium-rc1` executado sem `BLOCKING`.
- [ ] Schema JSON validado com tabelas, colunas e índices essenciais.
- [ ] Smoke HTTP de staging executado e aprovado.
- [ ] Verify pós-deploy executado com evidências reais.
- [ ] Feature flags definidas.
- [ ] Variáveis de ambiente verificadas.
- [ ] Plano de rollback disponível.

## Durante o deploy
- [ ] Aplicar migrations na ordem documentada.
- [ ] Executar auditorias intermediárias.
- [ ] Interromper em conflito.
- [ ] Validar schema.
- [ ] Executar smoke tests.
- [ ] Validar logs sem dados sensíveis.

## Depois do deploy
- [ ] Login admin.
- [ ] Login aluno.
- [ ] Workspace.
- [ ] Prontuário.
- [ ] Feedback.
- [ ] Plano.
- [ ] Anamnese.
- [ ] Student 360.
- [ ] Projeto LM.
- [ ] Contagens.
- [ ] Erros.
- [ ] Performance básica.

## Critérios de rollback
Perda/divergência de identidade, múltiplos planos publicados, vazamento de dados, Projeto LM aparecendo no Premium, autenticação quebrada, migration incompleta, erro sistêmico no Workspace ou dados de alunos misturados.
