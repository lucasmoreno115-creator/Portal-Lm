# System Flow Report

## Fluxo macro
1. Portal aluno autentica em `/api/portal/login`.
2. Endpoints `/api/portal/*` usam validação de aluno (`validateStudent`) e gravam eventos de timeline.
3. Admin consome `/api/admin/*` com autorização por header/token e gerencia checkins, planos e student 360.
4. Student 360 agrega dados de múltiplas fontes (`student_access`, `premium_anamnesis`, `student_checkins`, `weekly_plans`, `nutrition_plans`, `activity_timeline`).
5. Timeline final = baseline de domínio + eventos persistidos em `activity_timeline`.

## Entradas principais
- Frontend Portal: login, checkin, progressão.
- Frontend Admin: command center, followup, retenção, student 360.

## Saídas principais
- Payloads JSON normalizados por endpoint.
- Eventos operacionais na tabela `activity_timeline`.

## Restrições mantidas
- Sem novas features.
- Sem novos endpoints.
- Sem novas tabelas.
- Sem mudança de comportamento funcional intencional.
