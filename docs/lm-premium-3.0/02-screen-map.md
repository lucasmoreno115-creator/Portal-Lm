# LM Premium 3.0 — 02 Screen Map

## Objetivo
Este documento transforma a auditoria do Build 0 em mapa operacional de telas. Ele separa Plataforma LM, Consultoria Premium, Projeto LM e Admin, indicando objetivo, público, ação principal, dependências e estado futuro recomendado sem implementar alterações.

## Legenda de estado futuro
- **Preservar**: tela importante para o processo atual e reaproveitável.
- **Preservar como compatibilidade**: manter enquanto houver dependência histórica.
- **Reavaliar**: tela útil/legada que precisa decisão antes de Build funcional.
- **Não expandir para Premium**: pertence a outro domínio e não deve crescer dentro do Premium.

## PLATAFORMA LM
| Tela | Objetivo | Quem acessa | Principal ação | Dependências | Estado futuro |
|---|---|---|---|---|---|
| `index.html` | Entrada institucional/landing | Público | Iniciar navegação ou diagnóstico | Assets raiz, rotas públicas/legado | Reavaliar como superfície institucional |
| `portal-login.html` | Entrada única de aluno | Aluno Premium ou Projeto LM | Login com email/token | `portal-shared.js`, `/api/portal/login`, `student_access` | Preservar com contratos claros |
| `anamnese-premium.html` | Coletar anamnese Premium | Aluno Premium | Enviar respostas | `/api/anamnese-premium`, `premium_anamnesis` | Preservar |

## CONSULTORIA PREMIUM — aluno
Fluxo operacional esperado:
```text
Portal
  ↓
Hoje / visão geral
  ↓
Meu plano alimentar
  ↓
Minha semana
  ↓
Check-in
  ↓
Progressão
  ↓
MFit para treinos
```

| Tela | Objetivo | Quem acessa | Principal ação | Dependências | Estado futuro |
|---|---|---|---|---|---|
| `portal.html` | Dashboard do aluno Premium | Aluno Premium | Ver plano semanal, histórico e atalhos | `portal.css`, `portal-shared.js`, `/api/portal/me`, `/api/portal/weekly-plan`, `/api/portal/checkins`, `/api/portal/progression`, link MFit | Preservar como home Premium |
| `portal-plano-alimentar.html` | Exibir plano alimentar ativo | Aluno Premium | Consultar plano | `portal.css`, `portal-shared.js`, `/api/portal/nutrition-plan`, `nutrition_plans` | Preservar |
| `portal-plano-alimentar-print.html` | Versão de impressão do plano | Aluno Premium | Imprimir/consultar plano | `portal.css`, `/api/portal/nutrition-plan` | Preservar se impressão continuar necessária |
| `portal-checkin.html` | Enviar feedback/check-in | Aluno Premium | Registrar check-in | `portal.css`, `portal-shared.js`, `/api/portal/checkin`, `student_checkins` | Preservar |
| `portal-progressao.html` | Registrar evolução | Aluno Premium | Enviar peso/medidas/progresso | `portal.css`, `portal-shared.js`, `/api/portal/progression`, `progression_logs` | Preservar |
| `portal-biblioteca.html` | Biblioteca/apoio do portal | Aluno Premium | Consultar conteúdo de apoio | Dependências estáticas/portal | Reavaliar papel no Premium 3.0 |

## CONSULTORIA PREMIUM — admin operacional
Fluxo operacional esperado:
```text
Workspace admin
  ↓
Alunos
  ↓
Prontuário LM / Student 360
  ↓
Anamnese
  ↓
Plano alimentar
  ↓
Plano semanal
  ↓
Feedback / Check-ins
  ↓
Follow-up / Alertas
  ↓
Command Center
```

| Tela | Objetivo | Quem acessa | Principal ação | Dependências | Estado futuro |
|---|---|---|---|---|---|
| `admin-login.html` | Entrada admin | Admin/Lucas | Autenticar sessão admin | `admin-auth.js`, `/api/admin/session/login` | Preservar |
| `admin.html` | Hub admin | Admin/Lucas | Navegar para áreas admin | `admin-auth.js` | Preservar ou consolidar em workspace |
| `admin-students.html` | Lista/acesso de alunos | Admin/Lucas | Criar/editar acesso | `/api/admin/students`, `/api/admin/student-access` | Preservar |
| `admin-student.html` | Prontuário/Student 360 | Admin/Lucas | Ver aluno e operar ações centrais | `/api/admin/student-360`, `/api/admin/students`, planos, check-ins, acesso, follow-up | Preservar como tela crítica, mas modularizar futuramente |
| `admin-anamneses.html` | Lista/detalhe de anamneses | Admin/Lucas | Analisar e marcar status | `/api/admin/anamneses`, `premium_anamnesis` | Preservar |
| `admin-nutrition-plan.html` | Plano alimentar admin | Admin/Lucas | Criar/editar/publicar plano | `/api/admin/nutrition-plan`, `nutrition_plans` | Preservar |
| `admin-weekly-plan.html` | Plano semanal admin | Admin/Lucas | Salvar foco semanal | `/api/admin/weekly-plan`, `weekly_plans` | Preservar |
| `admin-checkins.html` | Fila de check-ins | Admin/Lucas | Ler e responder check-ins | `/api/admin/checkins`, `/api/admin/checkins/:id/reply` | Preservar |
| `admin-followup.html` | Acompanhamento e retenção | Admin/Lucas | Registrar follow-up/ações | `/api/admin/followup-*`, `/api/admin/retention-*` | Preservar |
| `admin-alerts.html` | Alertas do portal | Admin/Lucas | Ver alertas | `/api/admin/portal-alerts` | Preservar se mantiver alertas separados |
| `admin-command-center.html` | Visão operacional consolidada | Admin/Lucas | Monitorar saúde, alertas e prioridade | `/api/admin/command-center`, `/api/admin/health-check`, `/api/admin/operational-logs`, alertas | Preservar |

## PROJETO LM
| Tela | Objetivo | Quem acessa | Principal ação | Dependências | Estado futuro |
|---|---|---|---|---|---|
| `public/project-lm-2.html` | Entrada oficial LM 2.0 | Aluno Projeto LM | Executar jornada automatizada | `public/assets/js/project-lm-2-*`, `/api/project-lm-2/*`, `lm2_*` | Não expandir para Premium |
| `public/project-lm-v5.html` | Entrada V5/legado moderno | Aluno Projeto LM/compatibilidade | Jornada Projeto LM V5 | `/assets/js/project-lm-v5-app.js`, `/api/project-lm/*`, `project_lm_*` | Preservar como compatibilidade conforme decisão existente |
| `public/projeto-lm/index.html` | Alias/canônico público | Aluno Projeto LM | Entrar no Projeto LM | Assets públicos Projeto LM | Não expandir para Premium |
| `projeto-lm-*.html` raiz | Superfícies legadas Projeto LM | Aluno Projeto LM legado | Conteúdos/jornada antiga | Scripts/rotas Projeto LM | Preservar como compatibilidade até decisão |
| `project-lm-profile.html` | Perfil/onboarding Projeto LM legado | Aluno Projeto LM | Preencher perfil | `project-lm-profile.js`, rotas profile | Não expandir para Premium |

## ADMIN legado/geral
| Tela/rota | Objetivo | Quem acessa | Principal ação | Dependências | Estado futuro |
|---|---|---|---|---|---|
| Rotas admin `leads`, `metrics`, `alerts` | Funil/diagnóstico legado | Admin | Consultar leads/métricas/alertas | `/api/admin/leads`, `/api/admin/metrics`, `/api/admin/alerts` | Reavaliar; não parece core Premium 3.0 |

## Telas realmente importantes para Premium 3.0
### Aluno Premium
1. Login.
2. Portal/Home.
3. Plano alimentar.
4. Check-in.
5. Progressão.
6. Anamnese.
7. Acesso/ponte para MFit.

### Admin Premium
1. Login admin.
2. Alunos.
3. Student 360 / Prontuário LM.
4. Anamneses.
5. Plano alimentar.
6. Plano semanal.
7. Check-ins/feedback.
8. Follow-up/alertas.
9. Command Center.

## Conflitos encontrados
- O login é uma tela compartilhada por Premium e Projeto LM; o comportamento atual depende do plano do aluno.
- Algumas superfícies Projeto LM ainda vivem próximas ao Portal por namespace/arquivos históricos.
- O admin contém telas core Premium e rotas legadas no mesmo Worker.
