# LM Premium 3.0 — Build 4 — Feedback Semanal Premium

## 1. Objetivo
Transformar o check-in em Feedback Semanal Premium: o aluno relata fatos da semana, o sistema cria pendência objetiva de análise, Lucas registra uma conduta humana, a decisão entra na Evolução do Acompanhamento e a pendência é resolvida.

## 2. Fluxo semanal
Sexta-feira: feedback disponível e lembrete de preparação. Sábado de manhã: lembrete final. Sábado: revisão profissional. Domingo: o mesmo feedback continua disponível e fica apenas atrasado por derivação após o prazo. Segunda-feira inicia um novo ciclo, ainda não disponível até a sexta-feira desse ciclo.

## 3. Disponibilidade
A semana oficial usa `YYYY-Www` ISO, por exemplo `2026-W29`. `weekRef`, `availableAt` e `recommendedDeadline` pertencem sempre ao mesmo ciclo operacional: sexta-feira 00:00 America/Sao_Paulo, sábado de manhã como prazo recomendado e domingo ainda apontando para a sexta/sábado do ciclo que está encerrando, nunca para a sexta seguinte.

## 4. Prazo recomendado
O prazo recomendado é sábado às 12:00 em `America/Sao_Paulo`, tratado como orientação. Após o prazo o feedback continua disponível na sexta, sábado e domingo; atraso não bloqueia Portal, plano ou submissão.

## 5. Timezone
Todas as decisões de dia da semana, lembrete, disponibilidade e prazo usam `America/Sao_Paulo`. Persistência continua em timestamps ISO/UTC. Datas próximas à meia-noite UTC são convertidas antes de decidir sexta/sábado/domingo/segunda.

## 6. Modelo de domínio
Estados principais: `NOT_AVAILABLE`, `AVAILABLE`, `RESPONDED`, `ANALYZED`. Atraso e ausência de resposta são condições derivadas, não estados persistidos.

## 7. Perguntas
O formulário preserva adesão ao treino, adesão alimentar, cardio, sono, energia, estresse, peso opcional, cintura opcional, dificuldade principal, necessidade de suporte e observações/contexto.

## 8. Resposta do aluno
Há no máximo um feedback por aluno/semana por índice único e submissão idempotente. Antes da análise, reenvio atualiza a resposta existente e preserva `submitted_at`; depois da análise a persistência bloqueia a edição e o endpoint retorna 409, inclusive se a decisão profissional ocorrer entre `GET current` e `POST current`.

## 9. Atomicidade da submissão
A submissão executa em uma unidade com `DB.batch`: criação/upsert idempotente do feedback, criação idempotente da pendência `ANALYZE_WEEKLY_FEEDBACK` e registro idempotente do evento `FEEDBACK_RECEIVED`. O evento usa ID determinístico por aluno/semana e metadata com o ID real do feedback persistido. Falha em qualquer statement impede confirmação de sucesso; retry não duplica feedback, pendência ou evento.

## 10. Análise profissional
A tela administrativa lista feedbacks aguardando análise, alunos sem resposta e permite abrir o relato completo. O detalhe expõe fatos e contexto, sem comparação interpretativa automática.

## 11. Condutas
Condutas humanas: `KEEP_STRATEGY`, `UPDATE_PLAN`, `CONTACT_STUDENT`, `REQUEST_MORE_INFORMATION`, exibidas em português. Nenhuma conduta altera plano ou envia mensagem automaticamente.

## 12. Pendências
Resposta cria `ANALYZE_WEEKLY_FEEDBACK`. Decisão resolve essa pendência. `UPDATE_PLAN` cria `CREATE_NUTRITION_PLAN`; `CONTACT_STUDENT` cria `CONTACT_STUDENT`; `REQUEST_MORE_INFORMATION` cria `REQUEST_INFORMATION`; `KEEP_STRATEGY` não cria pendência adicional.

## 13. Evolução
Toda decisão gera `premium_followup_entries` com tipo `PROFESSIONAL_DECISION`, `related_entity_type = student_checkins` e `related_entity_id = feedback_id`. O campo legado `coach_reply` permanece compatível.

## 14. Lembretes
`premium_feedback_reminders` registra preparação operacional idempotente para `FRIDAY_PREPARATION` e `SATURDAY_MORNING`. Não há provedor real de WhatsApp/e-mail neste Build; o canal é fila operacional.

## 15. Contratos
Aluno: `/api/portal/premium/weekly-feedback/current`, `POST /current` e `/history`, sem `student_id`. Admin: pending, missing, detail, decision e prepare reminders.

## 16. Segurança
Aluno usa identidade autenticada, não envia `student_id`; endpoints admin ficam no gate administrativo; Projeto LM é bloqueado nas rotas Premium; UI usa `textContent`, `createElement` e `replaceChildren`.

## 17. Idempotência
Garantida para aluno/semana, pendência de análise, evento de recebimento, decisão profissional por índice de evolução, resolução de pendência, pendências adicionais abertas e lembretes por aluno/semana/tipo/canal. `student_id` prevalece sobre e-mail em todas as operações novas.

## 18. Pré-condição da migration 0029
Antes de aplicar o índice `idx_student_checkins_student_id_week_unique`, execute `scripts/audit-weekly-feedback-duplicates.mjs` ou o SQL documentado na migration. Se existirem duplicidades legadas por `student_id + week_ref`, bloquear a aplicação do índice e revisar manualmente as respostas clínicas; não apagar, mesclar ou sobrescrever silenciosamente. Rollback operacional: deixar as colunas nullable sem uso e adiar o índice até os conflitos serem resolvidos.

## 19. Rollback
Desligar `PREMIUM_WEEKLY_FEEDBACK_ENABLED` para esconder navegação nova e `PREMIUM_WEEKLY_FEEDBACK_REMINDERS_ENABLED` para impedir preparação de lembretes. Endpoints legados de check-in permanecem.

## 20. Limitações
A tela é operacional e simples. Não há envio real de mensagens, comparação clínica automática, gráficos, IA, prescrição automática nem alteração automática de plano.

## 21. Próximos passos
No Build futuro, ampliar navegação dos workspaces e UX de alteração de decisão, sem avançar para automação clínica.

## 22. Evolução Build 5 — vínculo com Plano Alimentar

Quando uma decisão profissional `UPDATE_PLAN` cria pendência `CREATE_NUTRITION_PLAN`, o novo workflow de plano alimentar pode criar rascunho com `source_feedback_id`. A pendência só é resolvida na publicação da nova versão; abrir editor ou criar rascunho não altera plano e não encerra pendência.
