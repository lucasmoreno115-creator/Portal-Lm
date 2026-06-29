# LM 2.0-25 — Auditoria Completa do Projeto LM

## Resumo executivo

Esta auditoria cobre exclusivamente o Projeto LM e não propõe alteração funcional. O estado atual indica que a versão em produção para alunos `projeto_lm` é o **LM 2.0**, servido pela URL canônica `/projeto-lm`, que reescreve para o entrypoint oficial `public/project-lm-2.html` e preserva as rotas por hash. O login em `portal-login.html` envia alunos com plano `projeto_lm` para `/projeto-lm`; além disso, o controle de acesso em `public/assets/js/lm-access.js` aponta o menu do Projeto LM para `/projeto-lm#...`.

Há pelo menos três camadas históricas coexistindo:

1. **LM 2.0 oficial atual**: `public/project-lm-2.html`, `project-lm-2-*`, endpoints `/api/project-lm-2/*`, tabelas `lm2_*`.
2. **V5 isolada anterior**: `public/project-lm-v5.html`, `project-lm-v5-*`, endpoints `/api/project-lm/*`, tabelas `project_lm_journeys` e correlatas.
3. **Legado portal/projeto-lm**: páginas `projeto-lm-*.html`, `project-lm-profile.html`, `project-lm.css`, trechos em `portal.css`, endpoints `/api/portal/project-lm/*` e `/api/project-lm/profile`, tabelas `project_lm_*` antigas.

## Arquitetura atual

```mermaid
flowchart TD
  A[index.html] --> B[portal-login.html]
  B -->|plan = projeto_lm| R[/projeto-lm]
  R -->|rewrite 200| C[public/project-lm-2.html]
  B -->|outros planos| P[portal.html / Premium]
  C --> D[project-lm-2-state.js]
  C --> E[project-lm-2-router.js]
  C --> F[project-lm-2-app.js]
  F --> G[/api/project-lm-2/*]
  G --> H[lm2_profiles]
  G --> I[lm2_journeys]
  G --> J[lm2_week_1_foundation]
  G --> K[lm2_week_2_foundation]
  G --> L[lm2_checkins]
```

### Camadas oficiais do LM 2.0

- **Entrypoint**: `public/project-lm-2.html` carrega somente `assets/css/project-lm-2.css`, `project-lm-2-state.js`, `project-lm-2-router.js` e `project-lm-2-app.js`.
- **CSS**: `public/assets/css/project-lm-2.css` controla shell, cards, botões, inputs, modal, estados de opção e responsividade do LM 2.0.
- **Estado**: `public/assets/js/project-lm-2-state.js` mantém o estado local serializado em `localStorage` com chave própria.
- **Router**: `public/assets/js/project-lm-2-router.js` define rotas por hash.
- **App**: `public/assets/js/project-lm-2-app.js` renderiza telas, chama APIs, decide próxima ação e executa navegação interna.
- **API**: `workers/api.js` roteia `/api/project-lm-2/*` após autenticação por `x-student-email` e `x-student-token`.
- **Banco**: migrations `0019`, `0020` e `0021` definem o núcleo `lm2_*`.

## Fluxo real de autenticação e redirects

```mermaid
flowchart TD
  A[index.html] -->|meta refresh| B[portal-login.html]
  B -->|POST /api/portal/login| C{plan}
  C -->|projeto_lm| D[/projeto-lm]
  C -->|premium/default| E[portal.html]
  D --> F{sessão localStorage?}
  F -->|não| B
  F -->|sim| G[hash atual / welcome]
  G --> H[GET /api/project-lm-2/home]
  H -->|onboarding_completed=false| I[welcome/onboarding]
  H -->|onboarding ok| J[#home]
  J --> K{next_action}
  K -->|week_1_video/create_plan_b| L[#week-1]
  K -->|daily_checkin| M[#daily-checkin]
  K -->|week_1_complete| N[#week-complete]
  K -->|week_2_*| O[#week-2]
```

Pontos de mudança de rota identificados:

- `index.html` redireciona para `portal-login.html`.
- `portal-login.html` salva `lm_student_email`, `lm_student_token`, `lm_student_name`, `lm_student_plan` e `lm_student_plan_type`; em seguida envia `projeto_lm` para `/projeto-lm` e demais planos para `portal.html`.
- `public/assets/js/lm-access.js` monta menus do Projeto LM apontando para `projectLm2Route(...)`, principalmente `#home`, `#week-1`, `#daily-checkin` e `#premium-bridge`.
- `project-lm-2-app.js` exige sessão; sem sessão redireciona para `/portal-login.html`.
- `ProjectLm2Router.navigate()` muda `window.location.hash`.
- `loadHome()` decide entre `welcome` e `home` conforme `onboarding_completed` retornado pela API.
- A Home decide a rota primária por `next_action`, `current_week`, flags de conclusão e `program_completed`.

## Fluxo oficial do Projeto LM

```mermaid
flowchart TD
  Landing[Landing/Login] --> Login[portal-login.html]
  Login --> Onboarding[/projeto-lm#welcome / #onboarding-*]
  Onboarding --> Home[#home]
  Home --> Jornada[#home: semana, continuidade, próxima ação]
  Jornada --> Treino[#direction: Meu Treino]
  Jornada --> Alimentar[#direction: Minha Alimentação]
  Jornada --> PlanoB[#week-1: Meu Plano B]
  Jornada --> Checkin[#daily-checkin]
  Checkin --> Semanas[#week-1, #week-2, #week-3-placeholder, #week-4-placeholder]
  Semanas --> Conclusao[#program-completion]
  Conclusao --> Bridge[#premium-bridge]
```

Páginas/telas realmente utilizadas no fluxo oficial atual:

- `portal-login.html` para login.
- `public/project-lm-2.html` como única página física do produto.
- Hash routes oficiais: `welcome`, `onboarding-name`, `onboarding-goal`, `onboarding-sex`, `onboarding-weight`, `direction-created`, `home`, `direction`, `profile-edit`, `week-1`, `daily-checkin`, `week-complete`, `week-2`, `week-2-complete`, `week-3-placeholder`, `week-3-complete`, `week-4-placeholder`, `week-4-complete`, `program-completion`, `premium-bridge`.

Observação: “Minha Jornada”, “Treino”, “Plano Alimentar”, “Plano B”, “Check-in”, “Semanas” e “Conclusão” existem no LM 2.0 como telas internas por hash, não como arquivos HTML separados.

## Arquivos mapeados

| Caminho | Finalidade | Utilizado atualmente? | Classificação |
|---|---|---:|---|
| `/projeto-lm` via `public/_redirects` | URL pública canônica com rewrite para o entrypoint LM 2.0 | Sim | Oficial |
| `public/project-lm-2.html` | Entrypoint HTML oficial LM 2.0 | Sim | Oficial |
| `public/assets/css/project-lm-2.css` | CSS oficial LM 2.0 | Sim | Oficial |
| `public/assets/js/project-lm-2-state.js` | Estado local LM 2.0 | Sim | Oficial |
| `public/assets/js/project-lm-2-router.js` | Router hash LM 2.0 | Sim | Oficial |
| `public/assets/js/project-lm-2-app.js` | Renderização, fluxo e API LM 2.0 | Sim | Oficial |
| `public/assets/js/lm-access.js` | Controle de acesso/menu; aponta Projeto LM para LM 2.0 | Sim em páginas legadas/portal | Compartilhado/ativo |
| `workers/api.js` | Worker com endpoints LM 2.0, V5 e legado | Sim | Ativo misto |
| `migrations/0019_lm2_data_layer.sql` | Tabelas LM 2.0 base | Sim | Oficial banco |
| `migrations/0020_lm2_daily_checkins.sql` | Check-ins diários LM 2.0 | Sim | Oficial banco |
| `migrations/0021_lm2_week_transition_activation.sql` | Campos de transição semanal LM 2.0 | Sim | Oficial banco |
| `docs/lm-2-official-architecture.md` | Documento de arquitetura LM 2.0 | Sim | Documentação ativa |
| `docs/lm-2-api-contracts.md` | Contratos API LM 2.0 | Sim | Documentação ativa |
| `docs/lm-2-data-state-model.md` | Modelo de dados/estado LM 2.0 | Sim | Documentação ativa |
| `docs/lm-2-foundation-sprint.md` | Histórico/foundation LM 2.0 | Sim | Documentação ativa |
| `docs/lm-2-week-unlock-continuity-logic.md` | Regras de continuidade | Sim | Documentação ativa |
| `docs/lm-2-week-2-completion-guardrails.md` | Guardrails semana 2 | Sim | Documentação ativa |
| `tests/project-lm-2-*.test.mjs` | Testes estáticos/contratos LM 2.0 | Sim | Ativos |
| `public/project-lm-v5.html` | Entrypoint V5 anterior | Não no login atual | Legado provável |
| `public/assets/css/project-lm-v5.css` | CSS V5 | Não no fluxo atual | Legado provável |
| `public/assets/js/project-lm-v5-state.js` | Estado V5 | Não no fluxo atual | Legado provável |
| `public/assets/js/project-lm-v5-screen-contracts.js` | Contratos UI V5 | Não no fluxo atual | Legado provável |
| `public/assets/js/project-lm-v5-app.js` | App/router V5 | Não no fluxo atual | Legado provável |
| `docs/project-lm-v5-*.md` | Documentação V5 | Histórico | Legado/documentação |
| `tests/project-lm-v5-*.test.mjs` | Testes V5 | Ainda no repositório | Potencialmente obsoletos |
| `projeto-lm-jornada.html` | Jornada legada multi-página | Não no fluxo atual | Legado |
| `projeto-lm-planejamento.html` | Planejamento legado | Não no fluxo atual | Legado |
| `projeto-lm-dia-dificil.html` | Plano B/dia difícil legado | Não no fluxo atual | Legado |
| `projeto-lm-consistencia.html` | Consistência legado | Não no fluxo atual | Legado |
| `projeto-lm-biblioteca.html` | Biblioteca legado | Não no fluxo atual | Legado |
| `projeto-lm-conteudo.html` | Conteúdo legado | Não no fluxo atual | Legado |
| `projeto-lm-conquistas.html` | Marcos/conquistas legado | Não no fluxo atual | Legado |
| `projeto-lm-estatisticas.html` | Estatísticas legado | Não no fluxo atual | Legado |
| `projeto-lm-onboarding.html` | Onboarding legado | Não no fluxo atual | Legado |
| `projeto-lm-plano-inicial.html` | Plano inicial legado | Não no fluxo atual | Legado |
| `project-lm-profile.html` | Perfil/onboarding legado | Não no fluxo atual | Legado |
| `project-lm-profile.js` | Script perfil legado | Não no fluxo atual | Legado |
| `project-lm-planning.js` | Script planejamento legado | Não no fluxo atual | Legado |
| `project-lm.css` | CSS legado das páginas `projeto-lm-*` | Só legado | Legado |
| `portal.css` | CSS Premium + blocos Projeto LM legado | Sim para portal; parcialmente legado para Projeto LM | Ativo misto |
| `portal.html` | Portal Premium; redireciona Projeto LM para LM 2.0 | Sim | Compartilhado |

## APIs do Projeto LM

### Oficiais LM 2.0

| Endpoint | Método | Finalidade | Usado por | Status |
|---|---:|---|---|---|
| `/api/project-lm-2/onboarding` | POST | Cria/atualiza perfil e jornada inicial | `project-lm-2-app.js` | Oficial |
| `/api/project-lm-2/profile` | PUT | Atualiza perfil | `project-lm-2-app.js` | Oficial |
| `/api/project-lm-2/home` | GET | Estado agregado da home | `project-lm-2-app.js` | Oficial |
| `/api/project-lm-2/checkin` | POST | Registra check-in diário | `project-lm-2-app.js` | Oficial |
| `/api/project-lm-2/progress` | GET | Progresso/continuidade | `project-lm-2-app.js` | Oficial |
| `/api/project-lm-2/week-status` | GET | Status da semana atual | `project-lm-2-app.js` | Oficial |
| `/api/project-lm-2/week-1/video-complete` | POST | Concluir aula semana 1 | `project-lm-2-app.js` | Oficial |
| `/api/project-lm-2/plan-b` | POST | Salvar Plano B semana 1 | `project-lm-2-app.js` | Oficial |
| `/api/project-lm-2/activate-week-2` | POST | Ativar semana 2 | `project-lm-2-app.js` | Oficial |
| `/api/project-lm-2/week-2/video-complete` | POST | Concluir aula semana 2 | `project-lm-2-app.js` | Oficial |
| `/api/project-lm-2/week-2/reflection` | POST | Salvar reflexão/resposta mínima semana 2 | `project-lm-2-app.js` | Oficial |
| `/api/project-lm-2/week-2/status` | GET | Status semana 2 | `project-lm-2-app.js` | Oficial |
| `/api/project-lm-2/activate-week-3` | POST | Guardrail de ativação semana 3 | `project-lm-2-app.js` | Oficial parcial |

### V5 coexistente

| Endpoint | Método | Finalidade | Usado por | Status |
|---|---:|---|---|---|
| `/api/project-lm/journey` | GET | Jornada V5 agregada | `project-lm-v5-app.js` | Legado provável |
| `/api/project-lm/stage-1/actions` | POST | Criar ações etapa 1 | `project-lm-v5-app.js` | Legado provável |
| `/api/project-lm/stage-1/actions/:id/complete` | POST | Completar ação etapa 1 | `project-lm-v5-app.js` | Legado provável |
| `/api/project-lm/plan-b` | POST | Plano B V5 | `project-lm-v5-app.js` | Legado provável |
| `/api/project-lm/victories` | POST | Vitórias V5 | `project-lm-v5-app.js` | Legado provável |
| `/api/project-lm/recovery` | POST | Recuperação V5 | `project-lm-v5-app.js` | Legado provável |
| `/api/project-lm/maintenance-goals` | POST | Metas manutenção V5 | `project-lm-v5-app.js` | Legado provável |

### Legado portal

| Endpoint | Método | Finalidade | Usado por | Status |
|---|---:|---|---|---|
| `/api/project-lm/profile` e `/api/portal/project-lm/profile` | GET/POST | Perfil/onboarding legado | `lm-access.js`, páginas/profile legado | Legado |
| `/api/portal/project-lm/current-mission` | GET | Missão semanal legado | `projeto-lm-jornada.html` | Legado |
| `/api/portal/project-lm/daily-actions/summary` | GET | Resumo ações legado | páginas legadas | Legado |
| `/api/portal/project-lm/consistency` | GET | Consistência legado | páginas legadas | Legado |
| `/api/portal/project-lm/library` | GET | Biblioteca legado | páginas legadas | Legado |
| `/api/portal/project-lm/library/:slug` | GET | Conteúdo da biblioteca | `projeto-lm-conteudo.html` | Legado |
| `/api/portal/project-lm/library/complete` | POST | Completar conteúdo | `projeto-lm-conteudo.html` | Legado |
| `/api/portal/project-lm/daily-actions` | POST | Registrar ação diária legado | páginas legadas | Legado |

## Banco de dados relacionado ao Projeto LM

### LM 2.0 oficial

- `lm2_profiles`: perfil técnico do aluno, dados de onboarding, ids internos de plano alimentar e treino.
- `lm2_journeys`: jornada de 30 dias, semana atual, status e datas de transição.
- `lm2_week_1_foundation`: conclusão da aula da semana 1 e Plano B inicial.
- `lm2_week_2_foundation`: conclusão/reflexão/resposta mínima da semana 2.
- `lm2_checkins`: check-ins diários e pontos de continuidade.

### V5/legado coexistente

- `project_lm_profiles`: perfil/onboarding legado.
- `project_lm_daily_actions`: ações diárias legado.
- `project_lm_library_content`: biblioteca legado.
- `project_lm_library_progress`: progresso biblioteca legado.
- `project_lm_weekly_missions`: missões semanais legado.
- `project_lm_journeys`, `project_lm_stage1_actions`, `project_lm_plan_b`, `project_lm_victories`, `project_lm_recovery_protocols`, `project_lm_maintenance_goals`: fundação V5.

## CSS

Arquivos CSS utilizados:

- `public/assets/css/project-lm-2.css`: efetivo no LM 2.0.
- `portal.css`: efetivo no login/portal e ainda contém blocos de Projeto LM legado.
- `project-lm.css`: efetivo apenas nas páginas HTML legadas `projeto-lm-*` se acessadas diretamente.
- `public/assets/css/project-lm-v5.css`: efetivo apenas no entrypoint V5 se acessado diretamente.

Controle efetivo no LM 2.0:

| Área | Arquivo efetivo |
|---|---|
| Layout/shell | `public/assets/css/project-lm-2.css` |
| Cards | `public/assets/css/project-lm-2.css` |
| Botões | `public/assets/css/project-lm-2.css` |
| Cores | `public/assets/css/project-lm-2.css` |
| Tipografia | `public/assets/css/project-lm-2.css` |
| Modal | `public/assets/css/project-lm-2.css` |
| Navegação | Principalmente renderizada em JS; visual em `project-lm-2.css` |

Duplicidade/conflito:

- `project-lm-2.css`, `project-lm-v5.css`, `project-lm.css` e trechos de `portal.css` definem estilos para experiências Projeto LM diferentes.
- `portal.css` possui muitos seletores `.projeto-lm-*` e `.lm-onboarding-page`, mas esses seletores não controlam o LM 2.0 oficial.
- O risco principal não é conflito direto no LM 2.0, porque o entrypoint carrega CSS isolado, mas sim manutenção e falsa percepção de que alterar `portal.css`/`project-lm.css` afeta produção atual.

## JavaScript

| Arquivo | Responsabilidade | Dependências | Duplicidade |
|---|---|---|---|
| `project-lm-2-state.js` | Estado local oficial | `localStorage` | Sobrepõe conceitos de `project-lm-v5-state.js` |
| `project-lm-2-router.js` | Router hash oficial | `window.location.hash` | Duplicado com router interno V5 e navegação multi-página legado |
| `project-lm-2-app.js` | Bootstrap, render, API, eventos, fluxo semanal | State + Router + Fetch | Concentra muitas responsabilidades |
| `lm-access.js` | Plano/acesso/menu compartilhado | `localStorage`, `api()` legado | Contém referência a `/project-lm/profile` legado e rotas LM 2.0 |
| `project-lm-v5-app.js` | App V5 | V5 state/contracts | Legado provável |
| `project-lm-v5-state.js` | Estado V5 | localStorage | Legado provável |
| `project-lm-v5-screen-contracts.js` | Contratos de tela V5 | V5 state | Legado provável |
| `project-lm-profile.js` | Perfil legado | `portal-shared.js`/API | Legado |
| `project-lm-planning.js` | Planejamento legado | DOM/API legado | Legado |

## Testes

Testes ativos do LM 2.0:

- `tests/project-lm-2-foundation.test.mjs`
- `tests/project-lm-2-auth-entry.test.mjs`
- `tests/project-lm-2-official-cutover.test.mjs`
- `tests/project-lm-2-production-hardening.test.mjs`
- `tests/project-lm-2-data-api.test.mjs`
- `tests/project-lm-2-home-direction-ui.test.mjs`
- `tests/project-lm-2-onboarding-ui.test.mjs`
- `tests/project-lm-2-daily-checkin-ui.test.mjs`
- `tests/project-lm-2-week-unlock-ui.test.mjs`

Testes potencialmente obsoletos para a versão atual:

- `tests/project-lm-v5-*.test.mjs`, pois validam V5 isolada que não é mais a rota oficial do login.
- `tests/v4-route-inventory.test.mjs`, `tests/v4-dependency-inventory.test.mjs` e afins podem continuar úteis como inventário, mas não representam o fluxo oficial LM 2.0.
- `tests/project-lm-current-mission.test.mjs` cobre a lógica legacy `/api/portal/project-lm/current-mission`.

## Duplicidades encontradas

| Tipo | Arquivos/endpoints | Oficial aparente | Legado aparente | Motivo |
|---|---|---|---|---|
| Home/Jornada | `/projeto-lm#home`, `project-lm-2.html#home`, `project-lm-v5.html#project-lm/journey`, `projeto-lm-jornada.html` | `/projeto-lm` + LM 2.0 | V5 e HTML legado | Login e menu apontam para a URL canônica LM 2.0 |
| Onboarding | Hash `onboarding-*`, `project-lm-profile.html`, `projeto-lm-onboarding.html`, V5 jornada | LM 2.0 | Perfil/onboarding legado | API oficial é `/api/project-lm-2/onboarding` |
| Router | `project-lm-2-router.js`, router V5, links multi-página `projeto-lm-*` | `project-lm-2-router.js` | demais | Fluxo oficial é SPA por hash |
| CSS | `project-lm-2.css`, `project-lm-v5.css`, `project-lm.css`, blocos Projeto LM em `portal.css` | `project-lm-2.css` | demais para Projeto LM | Entrypoint oficial carrega CSS isolado |
| API | `/api/project-lm-2/*`, `/api/project-lm/*`, `/api/portal/project-lm/*` | `/api/project-lm-2/*` | demais | Três gerações convivem no Worker |
| Banco | `lm2_*`, `project_lm_*` | `lm2_*` | `project_lm_*` para fluxo atual | Versões antigas mantêm schemas |
| Testes | `project-lm-2-*`, `project-lm-v5-*`, `v4-*` | `project-lm-2-*` | V5/V4 | Cobrem arquiteturas anteriores |

## Arquivos órfãos ou sem rota oficial

- `public/project-lm-v5.html` e assets `project-lm-v5-*`: acessíveis diretamente, mas não apontados pelo login atual.
- `projeto-lm-*.html`: acessíveis diretamente, mas não fazem parte da rota oficial LM 2.0.
- `project-lm-profile.html`, `project-lm-profile.js`: substituídos pelo onboarding hash do LM 2.0.
- `project-lm-planning.js`: usado somente por `projeto-lm-planejamento.html`, que é legado.
- Trechos Projeto LM em `portal.css`: órfãos para LM 2.0, embora possam afetar páginas legadas se acessadas.

## Riscos encontrados

1. **Três arquiteturas coexistem** e podem gerar manutenção em arquivos errados.
2. **Worker concentra APIs oficiais, V5, legado, Premium e Admin**, aumentando risco de regressão cruzada.
3. **`lm-access.js` é compartilhado** e ainda consulta `/project-lm/profile` legado para onboarding, embora redirecione Projeto LM para LM 2.0.
4. **Semanas 3 e 4 no front têm estado parcialmente local**, enquanto o backend oficial possui guardrail explícito até ativação da semana 3; isso pode gerar desalinhamento de persistência.
5. **Testes V5/V4 permanecem ativos** e podem bloquear mudanças futuras mesmo quando não representam produção.
6. **Documentação histórica conflitante**: docs V5 falam de rota oficial V5; docs LM 2.0 falam de rota oficial LM 2.0.

## Recomendações

1. Congelar formalmente `public/project-lm-2.html` como entrypoint oficial do Projeto LM atual.
2. Criar inventário técnico separado para arquivos V5 e legado com decisão explícita: manter compatibilidade, arquivar ou remover em PR futura.
3. Separar no Worker um módulo lógico para `/api/project-lm-2/*` antes de qualquer nova evolução.
4. Alinhar documentação: marcar docs V5/V4 como históricas e manter docs `lm-2-*` como referência atual.
5. Revisar testes V5/V4 e classificar como histórico, compatibilidade ou remover futuramente.
6. Evitar alterações em `portal.css` para tentar modificar o LM 2.0; mudanças visuais oficiais devem ocorrer apenas em `project-lm-2.css`.
7. Documentar a decisão de produto para semanas 3 e 4: persistência backend completa ou experiência apenas local/placeholder.

## Plano sugerido de consolidação

1. **PR de documentação**: marcar versão oficial, matriz legado e ownership dos arquivos.
2. **PR de testes**: separar suites `project-lm-2`, `project-lm-v5-legacy` e `v4-legacy`.
3. **PR de API sem comportamento novo**: extrair handlers `/api/project-lm-2/*` para módulo próprio mantendo contratos.
4. **PR de limpeza controlada**: remover ou arquivar V5/legado somente após decisão formal e validação de produção.
5. **PR de backend weeks 3/4**: se aprovado pelo produto, persistir as semanas 3 e 4 para eliminar estado local frágil.
