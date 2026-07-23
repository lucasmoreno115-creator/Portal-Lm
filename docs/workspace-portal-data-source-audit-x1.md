# Sprint X1 — Auditoria das fontes de dados: Workspace → Portal do Aluno Premium

**Data da auditoria:** 2026-07-23. **Escopo:** somente Consultoria Premium; leitura estática do repositório, sem chamadas a ambiente remoto e sem alteração de runtime. “Workspace” abaixo inclui as telas administrativas Premium efetivamente presentes. As classificações A–F significam: A integrado, B parcialmente integrado, C desconectado, D estático intencional, E legado/fallback e F não confirmado.

## Resumo executivo

O conteúdo prescrito com cadeia Premium comprovada é o **plano alimentar canônico**: o editor Premium grava rascunho em `nutrition_plans`, a publicação torna uma versão `PUBLISHED`/`is_active=1`, e as duas rotas públicas (`GET /api/portal/nutrition-plan` e `GET /api/portal/premium/nutrition-plan/current`) consultam o mesmo use-case. Contudo, a superfície realmente ligada pela navegação é a primeira, que usa o mapper legado `publicNutritionPlan()`; a página de rota Premium usa `presentPublicNutritionPlan()`. Ambas chegam à mesma leitura, mas não têm o mesmo contrato público. Isto torna a apresentação A para a fonte publicada e B/E para o contrato/renderização.

A Home e o “Plano da Semana” não são um agregador de prescrição. A Home apenas busca `student_checkins` e **um texto independente** de `weekly_plans`; treino/MFIT, cardio e nutrição exibidos são textos estáticos quando não há linha ativa. O endpoint de escrita de `weekly_plans` é legado (`/api/admin/weekly-plan`) e não foi encontrado no Workspace Premium; portanto os cards são C/E, não uma integração com o profissional. Não há página Premium de treino: o CTA abre o MFIT externo. A progressão é uma calculadora client-side e um diário do aluno, sem prescrição nem edição Workspace.

Há dois formulários de check-in para a mesma tabela (`student_checkins`): o legado `portal-checkin.html` e o Premium `portal-premium-weekly-feedback.html`. Ambos escrevem/leem a mesma persistência, mas diferem em disponibilidade, campos e revisão. O Workspace oferece decisão estruturada, que não popula `coach_reply`; por isso a resposta exibida no Portal depende da rota administrativa legada de reply. Isto é P1/B/C conforme o campo.

## Arquitetura comprovada

1. As páginas em `public/` chamam `portal-shared.js` (token em `localStorage`, cabeçalhos `x-student-*`) ou `fetch` com cookie. `portal-premium-home.html` também consulta `GET /api/portal/premium/access-state` antes de mostrar o corpo.
2. Em `workers/api.js`, `getPremiumGate()` lê `premium_students.consultation_status`; módulos Premium exigem `ACTIVE` (exceto aluno sem registro Premium, compatibilidade legada). Acesso e liberação são, portanto, distintos do conteúdo de cada plano.
3. O Worker roteia para use-cases/repositórios Premium para nutrição e feedback. D1 é a persistência: `nutrition_plans.meals_json`/campos correlatos, `student_checkins`, `weekly_plans` e `progression_logs`. Não há endpoint Premium de treino prescrito.
4. `presentPublicNutritionPlan()` filtra versão inativa/rascunho/arquivada e adapta JSON para a forma pública; `publicWeeklyFeedback()` (em `workers/api.js`) limita os campos expostos.

## Inventário visual do Portal

| Página / componente | Rótulos e campos visíveis | Vazio / erro / fallback | Classe |
|---|---|---|---|
| `portal-premium-home.html`, hero/cards | saudação, próxima ação, status (check-in/plano/treinos/cardio/foco), Missão da Semana, mensagem do consultor, Jornada, links | HTML inicial contém valores editoriais; erro de `Promise.all` é silencioso e preserva-os | B/C/D/E por campo |
| `portal-plano-alimentar.html` + `premium-nutrition-plan-renderer.js` **(rota do menu)** | título/objetivo/estratégia, refeições, itens, equivalências, observações, hidratação/suplementos se fornecidos, conversor e WhatsApp | plano ausente/erro explícitos; conversor é constante client-side | A/B/C/D/E |
| `portal-premium-nutrition-plan.html` + `portal-premium-nutrition-plan.js` **(rota alternativa)** | título, objetivo, estratégia, atualização, refeições, itens, substituições, notas e mensagem | `null`/falha explícitos | A/B/E |
| `portal-plano-alimentar-print.html` **(aberta pelo PDF)** | versão imprimível do plano | confirmar separadamente no fluxo de impressão; não é chamada de API pela Home | F |
| `portal-checkin.html` | formulário, histórico, resposta do Lucas/data | “Sem histórico”; resposta ausente informa que aparecerá depois; erro no submit visível | A/B |
| `portal-premium-weekly-feedback.html` | adesões, peso/medidas, dificuldade/suporte/contexto, status, prazo, resposta profissional, histórico | `NOT_AVAILABLE`; desabilita envio em `ANALYZED`; erro em `#message` | A/B |
| `portal-progressao.html` | exercício, faixa, carga, reps, qualidade, recomendação e histórico | “Sem histórico”; cálculo com regras fixas client-side | C/D |
| `portal-biblioteca.html` | oito artigos educacionais | array inline, sem API/estado de erro | D |
| menu efetivo `assets/js/lm-access.js` | “Preciso de ajuda” abre URL `wa.me` fixa; o fallback em `portal-shared.js` aponta para `#supportNeeded` | não há endpoint/persistência própria; os dois caminhos divergem | C/D/E |
| treino | somente link externo “MFIT”; não há página/renderizador Premium de treino | sem estado de publicação/vazio | C |

## Matriz de rastreabilidade (uma unidade de informação por linha)

| Área | Campo visível | Renderizador → leitura | Persistência comprovada | Workspace edita / escrita | Fallback | Classe |
|---|---|---|---|---|---|---|
| Acesso | experiência, estado de liberação | `portal-premium-home.html` bootstrap → `GET /portal/premium/access-state` | `premium_students.consultation_status`; ausência de linha vira `LEGACY_COMPATIBLE` | Sim: ações `release-planning`/`pause-access` no Workspace → `POST /api/admin/premium/workspace/students/:id/...` | ausência de aluno Premium libera compatibilidade | B/E |
| Home | nome do aluno | linha 138 lê `localStorage.lm_student_name` | storage local, preenchimento não rastreado nesta auditoria | Não confirmado | “Aluno” | E |
| Home | check-in enviado/pendente | IIFE → `GET /portal/checkins` | `student_checkins` via repositório Premium | aluno cria; profissional visualiza/revisa | qualquer histórico, não somente semana atual, marca “Enviado” | B (P2) |
| Home | foco, treino, cardio, nutrição, risco, observação | IIFE → `GET /portal/weekly-plan` | `weekly_plans.training_focus`, `cardio_target`, `nutrition_focus`, `main_risk`, `coach_message` | Não no Workspace Premium encontrado; endpoint legado `POST /api/admin/weekly-plan` | cinco textos editoriais quando nulo; erro silencioso | C/E (P1) |
| Home | mensagem do consultor / Jornada | HTML | constantes HTML | Não | n/a | D |
| Plano alimentar (rota menu) | título/objetivo/estratégia e data | `portal-plano-alimentar.html:renderPlan/loadPlan` → `GET /portal/nutrition-plan` → `publicNutritionPlan()` | `nutrition_plans.title,goal,strategy,updated_at` | Sim; draft/create/PATCH/publish em endpoints Premium | estratégia/observações vazias e erro explícito | A/B/E |
| Plano alimentar (rota alternativa) | título/objetivo/estratégia/data | `portal-premium-nutrition-plan.js:render` → `GET /portal/premium/nutrition-plan/current` → `presentPublicNutritionPlan()` | `nutrition_plans.title,goal,strategy,published_at/updated_at` | Sim; mesma publicação | defaults “Plano alimentar”/“Objetivo não informado” | A/B/E |
| Plano alimentar | nome/ordem/hora/orientação da refeição | `portal-plano-alimentar.html:renderPlan` + `PortalNutritionPlanRenderer.renderMealContent`; rota alternativa `render` | `nutrition_plans.meals_json` (array, ordem preservada) | Sim; editor serializa `meals` no PATCH de rascunho | nome “Refeição”; array vazio | A/B |
| Plano alimentar | alimento, quantidade, unidade, nota | `formatStructuredItem`/`renderMealContent` (rota menu) e `render` (alternativa) → `meal.items` | `meals_json[].items[].food,quantity,unit,note` | Sim, pelo JSON do editor | `primary_text` substitui visualmente a lista | B |
| Plano alimentar | substituições/equivalências | `renderMealContent` renderiza substituições por refeição; `renderFoodEquivalences` renderiza `plan.substitutions` na rota menu | `meals_json[].substitutions`; `nutrition_plans.substitutions_json` | Sim | rota alternativa não renderiza equivalências do plano | A na rota menu; B/P1 na alternativa |
| Plano alimentar | observações | `plan.notes` | `nutrition_plans.notes` (alias `observations`) | Sim | omitido se vazio | A |
| Plano alimentar | regras de adesão, hidratação, suplementos, Plano B | rota menu renderiza hidratação/suplementos **se** mapper os entregar; `publicNutritionPlan()` não os entrega. Nenhuma rota renderiza `adherence_rules`/Plano B | `adherence_rules_json`; hydration/supplements não constam do schema canônico | regras: Sim; demais F | condicionais ocultam campos ausentes | B/F |
| Plano alimentar | plano ativo/histórico/status | presenter filtra `PUBLISHED` + `is_active=1` | `nutrition_plans.status,is_active,version_number,archived_at,supersedes_plan_id` | Sim; publicação arquiva anterior | aceitar `status == null` se ativo | A/E |
| Check-in legado | adesões, medidas, fome/sono/energia/estresse/dificuldade/suporte | `portal-checkin.html` → POST/GET `/portal/checkin(s)` | `student_checkins` colunas homônimas | aluno cria; admin legado pode responder | histórico vazio/“orientação aparecerá” | A |
| Check-in legado | resposta do Lucas | `c.coach_reply` no GET | `student_checkins.coach_reply,coach_reply_at` | Não no Workspace Premium; `PATCH /api/admin/checkins/:id/reply` legado | mensagem de espera | C (P1) |
| Feedback Premium | status/prazo/perguntas/histórico | `portal-premium-weekly-feedback.js:load` → GET current/history | `student_checkins.week_ref,available_at,submitted_at,analyzed_at,...` | aluno escreve POST; Workspace lista/revisa | labels fixos, prazo calculado por schedule service | A/B |
| Feedback Premium | resposta profissional | `professionalResponse.message` | somente `student_checkins.coach_reply` | decisão Workspace grava decisão/follow-up, não `coach_reply` | “Ainda não há...” | C (P1) |
| Progressão | recomendação | `decide()` em `portal-progressao.html` | nenhum dado profissional; regra fixa | Não | defaults de faixa/decisão no POST | C/D |
| Progressão | histórico do aluno | GET `/portal/progression` | `progression_logs` | aluno grava POST; Workspace não edita | “Sem histórico”; API persiste `decision`, UI envia `recommendation` (não `decision`) | B/C (P2) |
| Biblioteca | textos | array `data` inline | arquivo HTML | Não | n/a | D |
| Ajuda | CTA de suporte | menu efetivo → URL WhatsApp `wa.me`; fallback de nav → `#supportNeeded` | URL constante; alternativamente `student_checkins.support_needed` após envio do check-in | não há ação Workspace de suporte | dois caminhos incompatíveis | C/E |
| Treino/exercícios/séries/reps/descanso/mídia/cardio prescrito | CTA MFIT | URL externa fixa em Home | fora do repositório/portal; `training_exercises` existe no schema mas sem consumidor Portal Premium encontrado | Não confirmado | n/a | F/C (P0 para expectativa de prescrição) |

## Matriz Workspace × Portal

| Ação no Workspace | Dado persistido | Consumidor Portal | Atualiza ao próximo GET? / liberação | Situação |
|---|---|---|---|---|
| Criar/editar rascunho alimentar | `nutrition_plans` com `status='DRAFT'`, JSON canônico | nenhum | Não / ainda não publicado | correto, isolado |
| Publicar plano alimentar | mesma linha passa a `PUBLISHED,is_active=1`; anterior arquivada | plano alimentar atual | Sim / requer plano publicado e aluno `ACTIVE` | Integrado A |
| Arquivar plano | `status='ARCHIVED',is_active=0` | plano atual torna-se vazio se não houver outro | Sim / n/a | Integrado A |
| Criar aluno / liberar planejamento / pausar acesso | `premium_students.consultation_status` e acesso operacional | guardas da Home/módulos | Sim / `ACTIVE` exigido | Parcial B: ausência de registro ativa compatibilidade legada |
| Revisar feedback (decisão) | `student_checkins.decision_*`, `analyzed_at`; `premium_followup_entries` | status/form/histórico, mas não a mensagem de resposta | Sim / n/a | Parcial B; resposta Portal desconectada C |
| Responder check-in legado | `coach_reply,coach_reply_at,coach_status` | Histórico do check-in e feedback Premium | Sim / n/a | Integrado tecnicamente, fora do Workspace Premium |
| Editar plano semanal | `weekly_plans.*`, `ACTIVE` | cards Home | Sim / aluno `ACTIVE` | Desconectado C: somente endpoint/admin legados encontrado |
| Criar/editar treino, cardio prescrito, mídia | nenhuma rota/tela Workspace Premium encontrada | MFIT externo | Não confirmado | Não confirmado F |
| Editar biblioteca | nenhuma | conteúdo inline | n/a | Estático D |
| Acionar ajuda | URL WhatsApp fixa; fallback para campo legado de check-in | não há consumidor administrativo dedicado | n/a | Desconectado C/E |

## Auditorias específicas

### Plano alimentar

**Fluxo provado.** `public/admin-premium-nutrition-plan.js` carrega o registro, cria `POST /api/admin/premium/students/:id/nutrition-plan/draft`, salva `PATCH /api/admin/premium/nutrition-plans/:id/draft` e publica `POST .../:id/publish`. `workers/api.js` encaminha aos use-cases; `d1-nutrition-plan-repository.js` atualiza `nutrition_plans.meals_json`, `substitutions_json`, `adherence_rules_json`, `notes` e metadados, e em `publish()` arquiva a publicação anterior. O Portal chama a rota pública, que usa `getNutritionPlan` e `presentPublicNutritionPlan`; portanto não é cópia derivada.

**Dois consumidores públicos.** A navegação Premium comprovadamente abre `portal-plano-alimentar.html`, não `portal-premium-nutrition-plan.html`. A primeira chama `/portal/nutrition-plan` e usa `publicNutritionPlan()`; a segunda chama `/portal/premium/nutrition-plan/current` e usa `presentPublicNutritionPlan()`. A primeira renderiza equivalências de `substitutions_json`, mas seu mapper não expõe `hydration`, `supplements`, `observations` nem `published_at`; a segunda expõe vários desses campos, mas não renderiza equivalências do plano. Logo, publicação é integrada, enquanto a superfície depende da rota (B/P1).

**Lacunas.** O schema canônico contém refeições no JSON e não tabelas `nutrition_plan_meals`; não se deve declarar tabela de itens. Não há campo/renderer de Plano B na cadeia Premium. Os arquivos `public/assets/js/project-lm-runtime/engines/nutrition/*.json` (incluindo `plan_b.json`, alimentos e substituições) pertencem ao runtime Projeto LM e não são importados pelo renderer Premium auditado: são legado fora do fluxo Premium, não fallback acionado pelo plano Premium.

### Treino, cardio e progressão

Não foi encontrado fetch Premium para treino, divisão semanal, sessão do dia, exercícios, séries, descanso, carga, substituições ou GIF. A Home aponta para MFIT e o único uso de `training_exercises` encontrado é esquema/storage sem consumidor Portal Premium provado. Classificar cada campo prescrito como F, e como risco P0 se a promessa operacional for apresentá-lo no Portal.

`portal-progressao.html` calcula recomendação antes de qualquer API; POST grava os dados informados pelo aluno em `progression_logs`. Não consulta treino, exercício prescrito ou carga do profissional. É um registro/ferramenta individual, não progressão configurada pelo Workspace (C/P2). Cardio no check-in é adesão relatada pelo aluno; meta de cardio da Home é texto de `weekly_plans`, não cardio prescrito.

### Plano da Semana e Home

O suposto Plano da Semana é a seção HTML `weekly-plan-editorial` da Home, não uma rota própria. O adapter é a IIFE na própria página: busca check-ins e `weekly_plans`; não agrega nutrição publicada, treino, MFIT ou progressão. A query seleciona a linha `ACTIVE` mais recentemente atualizada, ignorando `week_ref`; a atualização aparece no próximo carregamento, sem cache de aplicação. Se API falha, o `catch` vazio mantém os textos do HTML, mascarando indisponibilidade. A mensagem “consultor” e a Jornada nunca são substituídas pela API.

### Check-in

A tabela única é `student_checkins`; o POST legado deixa `available_at/submitted_at` ausentes, enquanto o POST Premium controla calendário/status pelo `weekly-feedback-schedule-service`. O Workspace Premium de revisão usa decisão estruturada; o Portal mostra resposta somente de `coach_reply`, comprovando que “Registrar decisão” não equivale a “Responder o aluno”. Histórico Premium mostra somente data/semana e Home trata qualquer linha histórica como check-in atual.

### Biblioteca e “Preciso de Ajuda”

A biblioteca é conteúdo global intencional no array da página e não deve ser individualizada. O menu Premium efetivo, definido por `getMenuItemsForPlan()`, direciona “Preciso de ajuda” para WhatsApp com texto fixo; somente o fallback de `portal-shared.js` aponta para o `<select>` legado. Não há ticket, endpoint, estado, notificação ou ação Workspace próprios. Portanto não há como o Workspace criar/publicar/liberar essa superfície.

## Fallbacks e conteúdo legado

| Local | Condição | Fonte alternativa | Visível | Mascara erro? | Risco |
|---|---|---|---|---|---|
| Home, campos semanais | API retorna nulo/valor vazio | cópia editorial HTML e `||` | Sim | Sim, inclusive `catch` vazio | P1/P2: parece orientação atual sem configuração |
| Home, check-in | qualquer registro histórico | marca “Enviado” | Sim | Sim | P2: status da semana incorreto |
| Home, saudação | sem `localStorage` | “Aluno” | Sim | Não | P3 |
| Gate Premium | sem `premium_students` | `LEGACY_COMPATIBLE`, released=true | Sim indiretamente | Sim | P1/P3: acesso não exige estado oficial |
| Presenter nutrição | `status` nulo e ativo | trata como plano público legado | Sim | Sim | P1: plano anterior/legado pode aparecer |
| Dois renderers nutricionais | menu e rota alternativa usam mappers/fields diferentes; `primary_text` prevalece sobre itens | Sim | Sim | P1: mesma publicação não tem a mesma apresentação |
| Ajuda | menu efetivo versus fallback de `nav()` | WhatsApp fixo versus `#supportNeeded` | Sim | Sim | P2/P3 |
| Home/weekly plan | erro de fetch | nenhum aviso; DOM inicial permanece | Sim | Sim | P1 |
| Progressão | POST sem `decision` | Worker grava “Manter carga” porque UI envia `recommendation` | Sim no histórico | Sim | P2 |
| Projeto LM JSONs | arquivos estáticos existem | não acionado pelo fluxo Premium | Não | Não nesta cadeia | P3/isolamento a monitorar |

## Itens desconectados, severidade e riscos

| Severidade | Item | Prova e impacto |
|---|---|---|
| P0 | Prescrição de treino/MFIT não é Portal Premium | não há rota/renderizador/Workspace Premium para `training_exercises`; aluno recebe somente link externo. Não afirmar que MFIT persiste nesta base. |
| P1 | Plano semanal não controlado pelo Workspace Premium | Home lê `weekly_plans`, mas a escrita achada é `/api/admin/weekly-plan`; textos estáticos passam por orientação se estiver ausente/erro. |
| P1 | Resposta profissional ao check-in não sai da decisão Workspace | UI de decisão chama `.../weekly-feedbacks/:id/decision`; Portal só lê `coach_reply`; reply é rota admin legada. |
| P1 | Duas rotas nutricionais apresentam a mesma publicação com contratos distintos | rota menu usa `publicNutritionPlan`; alternativa usa `presentPublicNutritionPlan`; equivalências e metadados divergem. |
| P1 | Plano nutricional legado ativo pode alcançar Portal | presenter alternativo aceita `status == null`; requer decisão explícita de migração/remoção na X2. |
| P2 | Home usa qualquer histórico como check-in enviado | `hasCheckin` testa tamanho, não `week_ref`. |
| P2 | Recomendação de progressão não persiste como exibida | payload usa `recommendation`, Worker espera `decision`. |
| P3 | duplicação de superfícies de check-in | ambos escrevem a mesma tabela com regras de status diferentes. |

## Recomendações para X2 (sem executar nesta X1)

1. Definir contrato único de treino/MFIT: fonte oficial, ownership, publicação, adapter e estados vazios antes de expor promessa de treino no Portal.
2. Consolidar a rota/mapper nutricional público antes de ampliar campos: uma única página deve receber e renderizar o mesmo contrato publicado.
3. Transformar o Plano da Semana em read model explícito ou documentar que é conteúdo editorial; conectá-lo ao Workspace Premium, filtrar por `week_ref` e substituir fallback silencioso por estado de indisponibilidade.
4. Unificar os dois formulários de check-in e fazer a ação profissional escolhida escrever o campo que o aluno vê, ou alterar o presenter/UI para exibir decisão aprovada.
5. Remover ou tornar observável a compatibilidade de `premium_students` ausente e `nutrition_plans.status` nulo após migração verificada.
6. Alinhar contrato de progressão (`recommendation` versus `decision`) e declarar claramente que é auto-registro, não prescrição.
7. Explicitar quais campos nutricionais são renderizados; decidir plano B, equivalências, hidratação, suplementos e substituições de plano antes de prometer suporte Portal.

## Itens não confirmados

- Quem popula `localStorage.lm_student_name` e o valor de token usado pelo Portal; esta auditoria encontrou o consumo, mas não uma prova de escrita no fluxo Premium.
- Sistema e persistência do MFIT, incluindo treino, mídia, cardio prescrito e publicação; estão fora desta base/fluxo rastreável.
- Uma tela administrativa atualmente ligada a `POST /api/admin/weekly-plan`; a rota existe, mas nenhuma interface Premium auditada a chama.
- Conteúdo e fetch completos de `portal-plano-alimentar-print.html`; ele é uma superfície aberta pelo botão PDF e deve ser rastreado separadamente se X2 tratar impressão como canal publicado.
- Colunas `hydration_json`/`supplements_json`: o presenter as tolera, mas elas não constam de `database/expected/migration-schema.sql` para `nutrition_plans`; não é seguro afirmar persistência oficial.

## Evidências de arquivo/função/endpoint/persistência

- Portal/Home/menu: `public/portal-premium-home.html` (bootstrap, IIFE e fallback), `public/assets/js/lm-access.js` (`getMenuItemsForPlan`, URL de ajuda) e `public/portal-shared.js` (fallback de nav); `GET /api/portal/checkins`, `GET /api/portal/weekly-plan`; handlers e query em `workers/api.js`.
- Nutrição: `public/portal-plano-alimentar.html` (`loadPlan`, `renderPlan`, `renderFoodEquivalences`), `public/assets/js/premium-nutrition-plan-renderer.js` (`formatStructuredItem`, `renderMealContent`), `public/portal-premium-nutrition-plan.js` (`render`), `workers/api.js` (`publicNutritionPlan`) e `workers/premium/presenters/nutrition-plan-public-presenter.js` (`presentPublicNutritionPlan`); `public/admin-premium-nutrition-plan.js` (`createDraft`, `persistDraft`, publicação); `workers/premium/repositories/d1-nutrition-plan-repository.js` (`updateDraft`, `publish`, `archive`); tabela `nutrition_plans`.
- Feedback: `public/portal-checkin.html`, `public/portal-premium-weekly-feedback.js` (`load`); rotas Portal e admin em `workers/api.js`; tabela `student_checkins`; decisão em `premium_followup_entries` quando aplicável.
- Plano semanal/progressão: handlers `workers/api.js`; tabelas `weekly_plans` e `progression_logs`; schema completo em `database/expected/migration-schema.sql`.
