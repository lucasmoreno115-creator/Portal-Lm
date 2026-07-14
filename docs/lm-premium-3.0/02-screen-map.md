# LM Premium 3.0 — 02 Screen Map

## Objetivo
Este documento mapeia as telas atuais e separa claramente o estado atual do Portal do escopo futuro aprovado do LM Premium 3.0. Ele não altera rotas, telas, arquivos de produção ou decisões já aprovadas.

## Escopo futuro aprovado do Premium 3.0
O novo núcleo da Consultoria Premium é composto por:
- anamnese;
- plano alimentar;
- feedback semanal;
- gestão de pendências;
- Prontuário LM;
- Evolução do Acompanhamento;
- Workspace do profissional;
- Workspace do aluno.

Ficam fora do núcleo:
- plano semanal atual;
- progressão de carga/progressão operacional, classificada como conveniência candidata à descontinuação;
- follow-up como módulo independente, que deve ser reclassificado como pendências, condutas e Evolução do Acompanhamento;
- treinos dentro do Portal, pois MFit continua responsável por treinos.

## Legenda de estado futuro
- **Core Premium 3.0**: parte do escopo futuro aprovado.
- **Estado atual / compatibilidade**: existe hoje, mas não define o core futuro.
- **Reclassificar**: deve ser reinterpretado dentro dos conceitos aprovados.
- **Fora do core / candidato à descontinuação**: não deve orientar o novo núcleo.
- **Outro produto**: pertence ao Projeto LM, Plataforma LM ou MFit.

## PLATAFORMA LM
A Plataforma LM é responsável somente por login, autenticação, controle de acesso e direcionamento ao produto correto.

| Tela | Estado atual | Objetivo atual | Quem acessa | Dependências | Estado futuro |
|---|---|---|---|---|---|
| `portal-login.html` | Entrada compartilhada de aluno | Login com email/token e redirecionamento por produto | Aluno Premium ou Projeto LM | `portal-shared.js`, `/api/portal/login`, `student_access` | Plataforma LM: login, autenticação, controle de acesso e direcionamento |
| `index.html` | Entrada pública/landing | Entrada institucional/diagnóstico/links | Público | Assets raiz e rotas públicas/legado | Fora do núcleo Premium; classificar como Plataforma/marketing se mantida |

## CONSULTORIA PREMIUM — Workspace do aluno
Fluxo futuro aprovado:
```text
Workspace do aluno
  ↓
Anamnese
  ↓
Plano alimentar
  ↓
Feedback semanal
  ↓
Pendências visíveis ao aluno quando aplicável
  ↓
Evolução do Acompanhamento apresentada ao aluno quando aplicável
  ↓
MFit para treinos
```

| Tela atual | Estado atual | Objetivo atual | Quem acessa | Dependências | Estado futuro |
|---|---|---|---|---|---|
| `anamnese-premium.html` | Existe | Coletar respostas da anamnese | Aluno Premium | `/api/anamnese-premium`, `premium_anamnesis` | Core Premium 3.0: Anamnese |
| `portal.html` | Existe | Dashboard com atalhos, plano semanal, histórico, progressão e link MFit | Aluno Premium | `portal.css`, `portal-shared.js`, `/api/portal/me`, `/api/portal/weekly-plan`, `/api/portal/checkins`, `/api/portal/progression` | Reclassificar como Workspace do aluno; remover mentalmente dependência do plano semanal como core |
| `portal-plano-alimentar.html` | Existe | Exibir plano alimentar ativo | Aluno Premium | `/api/portal/nutrition-plan`, `nutrition_plans` | Core Premium 3.0: Plano alimentar |
| `portal-plano-alimentar-print.html` | Existe | Versão de consulta/impressão do plano | Aluno Premium | `/api/portal/nutrition-plan` | Compatibilidade do Plano alimentar, se necessário |
| `portal-checkin.html` | Existe | Enviar check-in | Aluno Premium | `/api/portal/checkin`, `student_checkins` | Reclassificar como Feedback semanal |
| `portal-progressao.html` | Existe | Registrar progressão/progresso | Aluno Premium | `/api/portal/progression`, `progression_logs` | Fora do core; conveniência candidata à descontinuação ou absorção pela Evolução do Acompanhamento |
| `portal-biblioteca.html` | Existe | Biblioteca/apoio do portal | Aluno Premium | Dependências estáticas/portal | Reavaliar; não listado no core aprovado |

## CONSULTORIA PREMIUM — Workspace do profissional
Fluxo futuro aprovado:
```text
Workspace do profissional
  ↓
Alunos
  ↓
Prontuário LM
  ↓
Anamnese
  ↓
Plano alimentar
  ↓
Feedback semanal
  ↓
Pendências e condutas
  ↓
Evolução do Acompanhamento
```

| Tela atual | Estado atual | Objetivo atual | Quem acessa | Dependências | Estado futuro |
|---|---|---|---|---|---|
| `admin-login.html` | Existe | Login admin | Lucas/admin | `admin-auth.js`, `/api/admin/session/login` | Plataforma LM/Admin: autenticação profissional |
| `admin.html` | Existe | Hub admin | Lucas/admin | `admin-auth.js` | Reclassificar como entrada do Workspace do profissional |
| `admin-students.html` | Existe | Lista e acesso de alunos | Lucas/admin | `/api/admin/students`, `/api/admin/student-access` | Workspace do profissional: alunos/acesso operacional |
| `admin-student.html` | Existe | Student 360/visão consolidada | Lucas/admin | `/api/admin/student-360`, planos, check-ins, acesso, follow-up | Core Premium 3.0: Prontuário LM |
| `admin-anamneses.html` | Existe | Lista/detalhe de anamneses | Lucas/admin | `/api/admin/anamneses`, `premium_anamnesis` | Core Premium 3.0: Anamnese dentro do Prontuário/Workspace |
| `admin-nutrition-plan.html` | Existe | Criar/editar/publicar plano alimentar | Lucas/admin | `/api/admin/nutrition-plan`, `nutrition_plans` | Core Premium 3.0: Plano alimentar |
| `admin-weekly-plan.html` | Existe | Salvar foco/plano semanal | Lucas/admin | `/api/admin/weekly-plan`, `weekly_plans` | Estado atual / fora do novo núcleo |
| `admin-checkins.html` | Existe | Ler e responder check-ins | Lucas/admin | `/api/admin/checkins`, `/api/admin/checkins/:id/reply` | Reclassificar como Feedback semanal |
| `admin-followup.html` | Existe | Follow-up, retenção e ações | Lucas/admin | `/api/admin/followup-*`, `/api/admin/retention-*` | Reclassificar; não deve existir como módulo independente |
| `admin-alerts.html` | Existe | Alertas do portal | Lucas/admin | `/api/admin/portal-alerts` | Reclassificar como gestão de pendências |
| `admin-command-center.html` | Existe | Visão operacional, saúde, alertas e prioridade | Lucas/admin | `/api/admin/command-center`, `/api/admin/health-check`, `/api/admin/operational-logs` | Reclassificar como Workspace do profissional/gestão de pendências, sem virar módulo separado de follow-up |

## PROJETO LM
| Tela | Estado atual | Objetivo | Quem acessa | Dependências | Estado futuro |
|---|---|---|---|---|---|
| `public/project-lm-2.html` | Oficial LM 2.0 | Jornada automatizada | Aluno Projeto LM | `public/assets/js/project-lm-2-*`, `/api/project-lm-2/*`, `lm2_*` | Outro produto; não expandir para Premium |
| `public/project-lm-v5.html` | V5/compatibilidade | Jornada Projeto LM V5 | Aluno Projeto LM | `/assets/js/project-lm-v5-app.js`, `/api/project-lm/*`, `project_lm_*` | Outro produto/compatibilidade |
| `public/projeto-lm/index.html` | Alias/canônico público | Entrada Projeto LM | Aluno Projeto LM | Assets públicos Projeto LM | Outro produto |
| `projeto-lm-*.html` raiz | Legado | Conteúdos/jornada antiga | Aluno Projeto LM legado | Scripts/rotas Projeto LM | Outro produto/compatibilidade |
| `project-lm-profile.html` | Legado | Perfil/onboarding Projeto LM | Aluno Projeto LM | `project-lm-profile.js`, rotas profile | Outro produto |

## ADMIN legado/geral
| Tela/rota | Estado atual | Objetivo atual | Estado futuro |
|---|---|---|---|
| Rotas admin `leads`, `metrics`, `alerts` | Existem no Worker | Funil/diagnóstico legado | Reavaliar; não são núcleo aprovado do Premium 3.0 |

## Telas realmente importantes para o escopo aprovado
### Workspace do aluno
1. Anamnese.
2. Plano alimentar.
3. Feedback semanal.
4. Pendências visíveis quando aplicável.
5. Evolução do Acompanhamento quando aplicável.
6. Link/direcionamento externo para MFit.

### Workspace do profissional
1. Alunos/acesso operacional.
2. Prontuário LM.
3. Anamnese.
4. Plano alimentar.
5. Feedback semanal.
6. Gestão de pendências.
7. Condutas.
8. Evolução do Acompanhamento.

## Conflitos encontrados
- O login atual é compartilhado por Premium e Projeto LM; no futuro isso pertence à Plataforma LM, limitada a login, autenticação, controle de acesso e direcionamento.
- O dashboard atual do aluno mistura itens core e fora do core, como plano semanal e progressão.
- O admin atual possui follow-up como módulo/tela independente, mas o Premium 3.0 deve representar ações relevantes como pendências, condutas e Evolução do Acompanhamento.
- Student 360 existe hoje; o conceito futuro aprovado é Prontuário LM.
- Check-in existe hoje; o conceito futuro aprovado é feedback semanal.

## Build 3 — Prontuário LM

- `public/admin-premium-student-record.html?student_id=<student_id>`: nova superfície administrativa Premium, protegida por sessão admin, destinada à leitura longitudinal do acompanhamento profissional.
- A tela coexiste com `admin-student.html` (Student 360) e com as páginas legadas de anamnese, plano alimentar, check-ins e follow-up.
- A navegação para o Prontuário deve respeitar a feature flag simples `PREMIUM_STUDENT_RECORD_ENABLED`; quando desligada, as páginas legadas continuam sendo o caminho operacional.

## Build 4 — Feedback Semanal Premium

- `public/portal-premium-weekly-feedback.html`: superfície mobile-first do aluno para visualizar semana, prazo recomendado, enviar/editar feedback antes da análise, ver confirmação, resposta profissional e histórico recente.
- `public/admin-premium-weekly-feedbacks.html`: superfície operacional de sábado para listar feedbacks aguardando análise, alunos sem resposta e registrar conduta profissional.
- As telas coexistem com `portal-checkin.html` e `admin-checkins.html`; rotas legadas continuam como compatibilidade.

## Build 5 — Plano Alimentar Profissional

- `public/admin-premium-nutrition-plan.html?student_id=<student_id>`: nova superfície administrativa para ciclo `DRAFT → PUBLISHED → ARCHIVED`, protegida por sessão admin e por adoção visual via `PREMIUM_NUTRITION_PLAN_WORKFLOW_ENABLED`.
- `public/portal-premium-nutrition-plan.html`: superfície mobile-first para leitura do plano `PUBLISHED` atual, sem rascunhos, histórico administrativo ou IDs internos.
- `admin-nutrition-plan.html` e `/api/admin/nutrition-plan` permanecem como compatibilidade legada durante o rollback visual.
