# RC1 — Checklist de release

## Antes do deploy
- [ ] Backup confirmado e validado.
- [ ] SHA da release registrado.
- [ ] Migrations revisadas na ordem.
- [ ] Auditoria sem `BLOCKING`.
- [ ] Testes completos executados.
- [ ] Feature flags definidas.
- [ ] Variáveis de ambiente verificadas.
- [ ] Plano de rollback disponível.

## Durante o deploy
- [ ] Aplicar migrations na ordem.
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
Perda/divergência de identidade, múltiplos planos publicados, vazamento de dados, Projeto LM aparecendo no Premium, autenticação quebrada, migration incompleta, erro sistêmico no Workspace ou dados misturados entre alunos.
