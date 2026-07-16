# Architecture Summary — LM Premium 3.0.0

## Domínio

Modela estados e regras Premium: status de anamnese, consulta, feedback, plano alimentar, pendências, follow-up e eventos.

## Application

Use cases orquestram ações: identidade, anamnese, feedback semanal, prontuário, plano alimentar, workspace e decisões profissionais.

## Repositories

Repositórios D1 encapsulam persistência para alunos Premium, anamnese, feedbacks, planos, eventos, pendências, prontuário e read models.

## Services

Serviços tratam identidade do aluno, agenda de consulta, eventos Premium e lembretes/agenda de feedback semanal.

## Presenters

Presenters separam payloads administrativos e públicos, mantendo compatibilidade e evitando vazamento de campos internos.

## Workers

`workers/api.js` compõe aplicação Premium, autenticação, rotas e serialização JSON. Arquivos em `workers/premium/*` mantêm a arquitetura modular.

## Routes

Rotas Premium incluem portal do aluno, admin, workspace, prontuário, feedback semanal, plano alimentar e compatibilidade legada.

## Database

Banco usa tabelas Premium e tabelas legadas compatíveis, com migrations históricas até 0033 e índices para consultas operacionais.

## Identity

`student_id` é identidade oficial Premium; e-mail normalizado permanece para compatibilidade e resolução de dados históricos.

## Read Models

Workspace e Saturday Review usam consultas otimizadas e índices para listar alunos, pendências, status e eventos recentes.

## Build 6.6 — Admin Shell Premium

O Admin Shell Premium é nativo HTML/CSS/JS e preserva o Workspace Premium como base visual. Ele centraliza autenticação via `admin-auth.js`, logout, loading, erro, feature flag desligada, navegação administrativa única e painel contextual por `student_id`.
