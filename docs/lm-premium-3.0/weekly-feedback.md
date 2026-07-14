# LM Premium 3.0 — Build 4 — Feedback Semanal Premium

## 1. Objetivo
Transformar o check-in em Feedback Semanal Premium: o aluno relata fatos da semana, o sistema cria pendência objetiva de análise, Lucas registra uma conduta humana, a decisão entra na Evolução do Acompanhamento e a pendência é resolvida.

## 2. Fluxo semanal
Sexta-feira: feedback disponível e lembrete de preparação. Sábado de manhã: lembrete final. Sábado: revisão profissional. O sistema organiza o trabalho; Lucas segue responsável pela interpretação e decisão.

## 3. Disponibilidade
A semana oficial usa `YYYY-Www` ISO, por exemplo `2026-W29`. A disponibilidade começa na sexta-feira da semana de referência e é calculada por `weekly-feedback-schedule-service.js` em `America/Sao_Paulo`.

## 4. Prazo recomendado
O prazo recomendado é sábado às 09:00/12:00 operacional configurado no serviço, tratado como orientação. Após o prazo o feedback continua disponível e pode ser marcado como atrasado apenas por derivação.

## 5. Timezone
Todas as decisões de dia da semana, lembrete, disponibilidade e prazo usam `America/Sao_Paulo`. Persistência continua em timestamps ISO.

## 6. Modelo de domínio
Estados principais: `NOT_AVAILABLE`, `AVAILABLE`, `RESPONDED`, `ANALYZED`. Atraso e ausência de resposta são condições derivadas, não estados persistidos.

## 7. Perguntas
O formulário preserva adesão ao treino, adesão alimentar, cardio, sono, energia, estresse, peso opcional, cintura opcional, dificuldade principal, necessidade de suporte e observações/contexto.

## 8. Resposta do aluno
Há no máximo um feedback por aluno/semana por índice único e criação idempotente. Antes da análise, reenvio edita a resposta existente e preserva `submitted_at`; depois da análise a edição é bloqueada.

## 9. Análise profissional
A tela administrativa lista feedbacks aguardando análise, alunos sem resposta e permite abrir o relato completo. O detalhe expõe fatos e contexto, sem comparação interpretativa automática.

## 10. Condutas
Condutas humanas: `KEEP_STRATEGY`, `UPDATE_PLAN`, `CONTACT_STUDENT`, `REQUEST_MORE_INFORMATION`, exibidas em português. Nenhuma conduta altera plano ou envia mensagem automaticamente.

## 11. Pendências
Resposta cria `ANALYZE_WEEKLY_FEEDBACK`. Decisão resolve essa pendência. `UPDATE_PLAN` cria `CREATE_NUTRITION_PLAN`; `CONTACT_STUDENT` cria `CONTACT_STUDENT`; `REQUEST_MORE_INFORMATION` cria `REQUEST_INFORMATION`; `KEEP_STRATEGY` não cria pendência adicional.

## 12. Evolução
Toda decisão gera `premium_followup_entries` com tipo `PROFESSIONAL_DECISION`, `related_entity_type = student_checkins` e `related_entity_id = feedback_id`. O campo legado `coach_reply` permanece compatível.

## 13. Lembretes
`premium_feedback_reminders` registra preparação operacional idempotente para `FRIDAY_PREPARATION` e `SATURDAY_MORNING`. Não há provedor real de WhatsApp/e-mail neste Build; o canal é fila operacional.

## 14. Contratos
Aluno: `/api/portal/premium/weekly-feedback/current`, `POST /current` e `/history`, sem `student_id`. Admin: pending, missing, detail, decision e prepare reminders.

## 15. Segurança
Aluno usa identidade autenticada, não envia `student_id`; endpoints admin ficam no gate administrativo; Projeto LM é bloqueado nas rotas Premium; UI usa `textContent`, `createElement` e `replaceChildren`.

## 16. Idempotência
Garantida para aluno/semana, pendência de análise, decisão profissional por índice de evolução, resolução de pendência, pendências adicionais abertas e lembretes por aluno/semana/tipo/canal.

## 17. Rollback
Desligar `PREMIUM_WEEKLY_FEEDBACK_ENABLED` para esconder navegação nova e `PREMIUM_WEEKLY_FEEDBACK_REMINDERS_ENABLED` para impedir preparação de lembretes. Endpoints legados de check-in permanecem.

## 18. Limitações
A tela é operacional e simples. Não há envio real de mensagens, comparação clínica automática, gráficos, IA, prescrição automática nem alteração automática de plano.

## 19. Próximos passos
No Build futuro, ampliar navegação dos workspaces e UX de alteração de decisão, sem avançar para automação clínica.
