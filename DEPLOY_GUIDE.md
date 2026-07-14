# Deploy Guide — LM Premium 3.0.0

## Escopo

Guia operacional para promover a Release 3.0.0 a produção. Não cria funcionalidades, não altera banco e não inicia Build 7.

## 1. Backup

1. Confirmar ambiente alvo.
2. Exportar banco D1/produção antes de qualquer ação.
3. Guardar artefatos estáticos atuais.
4. Registrar versão atual, commit implantado e horário UTC.
5. Validar que backup pode ser restaurado em ambiente seguro.

## 2. Auditoria

1. Executar auditorias históricas aplicáveis em staging.
2. Validar snapshot Premium com `scripts/audit-lm-premium-rc1.mjs` quando disponível.
3. Confirmar ausência de duplicidades bloqueantes em feedback semanal.
4. Confirmar ausência de conflitos bloqueantes no ciclo de plano alimentar.
5. Registrar evidências.

## 3. Migrations

1. Não criar migrations para esta release.
2. Não reaplicar migrations já aplicadas.
3. Se o ambiente ainda não tiver migrations Premium históricas, aplicar somente pela ordem oficial de controle do ambiente.
4. Respeitar precondições das migrations 0029, 0031 e 0032.
5. Parar se houver conflito, erro ou divergência de schema.

## 4. Smoke

1. Executar smoke em staging com URL, token admin, token aluno e `student_id` válido.
2. Confirmar respostas 200/401/403/404/409 esperadas.
3. Confirmar que nenhum token aparece no relatório.
4. Executar smoke em produção somente após deploy, em janela controlada.

## 5. Verify

1. Executar verificação com snapshot, schema, smoke results e feature flags.
2. Confirmar flags Premium habilitadas conforme ambiente.
3. Confirmar índices e tabelas exigidas.
4. Registrar resultado final.

## 6. Feature Flags

- `PREMIUM_PROFESSIONAL_WORKSPACE_ENABLED`: controla o workspace profissional.
- Flags equivalentes de ambiente devem ser conferidas antes e depois do deploy.
- Não ativar fluxos experimentais fora do escopo 3.0.0.

## 7. Deploy

1. Congelar mudanças funcionais.
2. Confirmar commit da Release 3.0.0.
3. Publicar artefato estático/worker conforme rotina atual.
4. Não criar tag antes da aprovação da PR.
5. Não fazer deploy se testes locais obrigatórios falharem.

## 8. Validação

1. Validar login/admin.
2. Validar workspace profissional.
3. Validar Student 360/prontuário.
4. Validar anamnese Premium.
5. Validar feedback semanal.
6. Validar plano alimentar atual e workflow admin.
7. Validar isolamento do Projeto LM.

## 9. Rollback

1. Parar novas publicações.
2. Reverter artefato/worker para commit anterior aprovado.
3. Restaurar banco somente se houver corrupção ou mudança de schema indevida.
4. Registrar causa, horário e evidência.
5. Reexecutar smoke mínimo após rollback.

## 10. Critérios de parada

- Falha em backup ou restore testado.
- Divergência de schema não explicada.
- Duplicidade bloqueante em dados clínicos/operacionais.
- Smoke com erro 5xx em rota Premium crítica.
- Vazamento de dados sensíveis em payload público.
- Projeto LM afetado por fluxo Premium.
- Qualquer alteração funcional detectada nesta release documental.
