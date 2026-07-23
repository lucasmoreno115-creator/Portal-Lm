# Sprint X2 — Matriz de Contratos Workspace × Portal

**Status:** especificação oficial para as próximas sprints de implementação.  
**Data:** 2026-07-23.  
**Escopo:** Consultoria Premium. Este documento define contratos-alvo; não altera rotas, schemas, persistência, autenticação ou comportamento em produção.

## 1. Resumo executivo

Esta matriz transforma os achados da [auditoria X1](workspace-portal-data-source-audit-x1.md) em decisões de ownership e de publicação. A cadeia do Portal passa a ser, por regra, **autor da escrita → persistência oficial → endpoint público canônico → renderizador do Portal**. Nenhuma cópia editorial pode se apresentar como prescrição individual.

| Situação | Integrações / decisão |
| --- | --- |
| Contrato válido, a preservar | O plano alimentar possui escrita Premium, versão publicada e leitura pública de `nutrition_plans`; a publicação já arquiva a versão anterior. O check-in Premium também possui calendário, envio e histórico em `student_checkins`. |
| Contratos concorrentes | Nutrição tem duas rotas/presenters públicos; check-in tem os formulários legado e Premium; ajuda tem WhatsApp e `#supportNeeded`; progressão diverge entre `recommendation` da UI e `decision` persistido. |
| Desconectados a integrar | `weekly_plans` é lido pela Home, mas sua escrita encontrada é somente a rota administrativa legada; decisão da revisão Premium não preenche a mensagem pública `coach_reply`. |
| Externos ou estáticos intencionais | MFIT é a fonte externa do treino no estado atual. Biblioteca é conteúdo global estático, versionado no repositório. Textos institucionais, títulos e instruções gerais permanecem estáticos e não simulam dados do aluno. |
| Primeiras correções | X3 conecta resposta pública à revisão; X4 operacionaliza o Plano da Semana; X5 remove fallbacks enganosos da Home; X6 unifica nutrição; X7 consolida check-in; X8 trata identidade e acesso. |

**Rastreabilidade X1.** A X1 classificou o treino interno como não comprovado/P0, o Plano da Semana, resposta profissional e duas apresentações nutricionais como P1, e os conflitos de check-in/progressão como P2/P3. As decisões abaixo respondem diretamente a esses achados, sem declarar como integração ativa uma tabela ou conteúdo sem consumidor comprovado.

## 2. Princípios obrigatórios dos contratos

1. **Fonte única.** Cada unidade individual tem uma única persistência e um único presenter/endpoint público canônico. Uma rota em compatibilidade não cria uma segunda autoridade.
2. **Escrita explícita.** O contrato identifica se o escritor é profissional, aluno, sistema ou serviço externo. O Portal não infere autoria de HTML, cache ou constantes.
3. **Publicação explícita.** Conteúdo prescrito individual só fica visível após `PUBLISHED`/liberação formal. Salvar rascunho, calcular no cliente ou existir em tabela não equivale a publicar.
4. **Ausência não é conteúdo.** Sem prescrição ou registro, mostrar estado vazio específico; nunca texto genérico que pareça uma orientação do profissional.
5. **Falha não é fallback.** Falha de API mostra indisponibilidade e opção de tentar novamente; não preserva DOM editorial, dados de sessão anterior nem uma prescrição aparente.
6. **Mínimo privilégio público.** O presenter público expõe somente campos destinados ao aluno. Decisões internas, razões internas e anotações operacionais não são fallback de mensagem pública.
7. **Legado temporário.** Toda compatibilidade deve registrar justificativa, condição de ativação, estratégia de remoção e risco. Ela é observável e deixa de ser aceita depois da migração definida.
8. **Conteúdo externo e estático explícitos.** MFIT não é prescrição interna; Biblioteca não é conteúdo individual. Ambos têm rótulo e comportamento próprios, não estados simulados de Workspace.

### Vocabulário padronizado de estado

| Estado | Significado e uso |
| --- | --- |
| `NOT_CREATED` | Não há registro individual para a unidade. |
| `DRAFT` | Profissional salvou conteúdo, mas o aluno não pode vê-lo. |
| `READY_TO_PUBLISH` | Conteúdo validado/aguardando ação formal de publicação; não é visível. |
| `PUBLISHED` | Versão pública e elegível para leitura do aluno, sujeito ao acesso Premium. |
| `ARCHIVED` | Versão histórica, nunca a versão atual pública. |
| `UNAVAILABLE` | Conteúdo/serviço externo não está configurado ou não está disponível; não é erro de leitura. |
| `ERROR` | A leitura/escrita falhou; deve ser comunicado, sem fallback de conteúdo. |

Nem todo domínio implementará todos os estados. Acesso usa estados de consulta; MFIT e Biblioteca não inventam ciclo editorial. Textos livres não são estados técnicos.

## 3. Matriz principal de contratos

**Convenções:** os endpoints estão prefixados por `/api`. “—” significa que a X1 não comprovou endpoint atual, e não autorização para criar um nesta sprint. “Futuro” descreve o contrato a implementar, não uma rota criada agora.

| Domínio | Campo do Portal | Escrita | Fonte oficial / persistência | Endpoint de escrita atual | Endpoint de leitura atual | Publicação | Ausência | Erro | Fallback permitido | Contrato-alvo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Acesso | estado de acesso | profissional/sistema | `premium_students.consultation_status` | `POST /admin/premium/workspace/students/:id/release-planning` ou `pause-access` | `GET /portal/premium/access-state` | `ACTIVE` libera módulos Premium | sem registro: compatibilidade migratória, não autorização perpétua | indisponibilidade do gate | somente `LEGACY_COMPATIBLE` observado | C1: status oficial e migração de ausência |
| Identidade | nome do aluno | sistema autenticado | identidade da sessão + perfil oficial; cache `lm_student_name` | não comprovado | não há endpoint de perfil comprovado | sessão válida | “Aluno” neutro, sem nome em cache | indisponibilidade de perfil, sem reutilizar cache | cache somente se pertencer à mesma sessão | C2: perfil autenticado canônico |
| Home | próxima ação / status | sistema, a partir de estados oficiais | composição pública de acesso, anamnese, plano e check-in | — | Home consulta acesso, check-ins e weekly plan separadamente | estado calculado, não texto editorial | CTA/estado determinístico aplicável | card indisponível | nenhum texto de exemplo | C5: read model de estados reais |
| Nutrição | nome, objetivo, estratégia, atualização | profissional | `nutrition_plans.title, goal, strategy, published_at/updated_at` | `POST /admin/premium/students/:id/nutrition-plan/draft`; `PATCH /admin/premium/nutrition-plans/:id/draft`; `POST .../:id/publish` | `GET /portal/nutrition-plan` e `GET /portal/premium/nutrition-plan/current` | `PUBLISHED` + `is_active=1` | “Seu plano alimentar ainda está sendo preparado.” | “Não foi possível carregar seu plano agora.” | campos opcionais vazios; nunca plano legado ativo sem status | C3: uma rota/presenter canônicos |
| Nutrição | refeição: nome, ordem, hora, orientação | profissional | `nutrition_plans.meals_json[]` | mesmos endpoints de draft | mesmas duas rotas | plano ativo publicado | seção não exibida se não prescrita | erro do plano | rótulo técnico neutro apenas para dado malformado | JSON canônico completo |
| Nutrição | alimento, quantidade, unidade, nota | profissional | `meals_json[].items[]` | PATCH de draft | mesmas duas rotas | plano ativo publicado | não mostrar item inexistente | erro do plano | nenhum `primary_text` substitui lista real quando houver itens | JSON canônico completo |
| Nutrição | substituição/equivalência | profissional | `meals_json[].substitutions`, `substitutions_json` | PATCH de draft | rota do menu hoje renderiza ambas | plano ativo publicado | ocultar bloco vazio | erro do plano | nenhum | presenter canônico expõe e renderer único renderiza |
| Nutrição | adesão, observações, hidratação, suplementos, Plano B | profissional | `adherence_rules_json`, `notes`; hidratação/suplementos não comprovados no schema; Plano B ausente | PATCH de draft para campos comprovados | presenters divergentes | plano ativo publicado | ocultar campo não prescrito; Plano B = `NOT_CREATED` | erro do plano | não usar JSONs do Projeto LM | declarar campos persistidos antes de expô-los; Plano B requer contrato futuro separado |
| Nutrição | versão atual, histórico e PDF | profissional/sistema | `status,is_active,version_number,archived_at,supersedes_plan_id` | publish/archive no fluxo Premium | leitura pública atual; impressão ainda não rastreada | apenas versão ativa `PUBLISHED`; histórico só em superfície futura autorizada | sem versão ativa = vazio | erro explícito | compatibilidade de `status=null` somente durante migração | versão atual canônica; PDF consome o mesmo presenter |
| Plano semanal | foco, treino, nutrição, risco, mensagem, período, atualização | profissional | `weekly_plans` com `week_ref`, campos editoriais, status/publicação | `POST /admin/weekly-plan` (legado; sem UI Premium comprovada) | `GET /portal/weekly-plan` | futuro: semana vigente `PUBLISHED`; atual lê `ACTIVE` | “Seu planejamento semanal ainda está sendo preparado.” | indisponibilidade do plano semanal | nenhum HTML editorial | C4: resumo explícito do profissional |
| Cardio | meta, unidade, frequência, duração, orientação | profissional | futuro `weekly_plans.cardio_target` estruturado/compatível | endpoint legado do plano semanal | `GET /portal/weekly-plan` | junto ao Plano da Semana publicado | card “Meta de cardio ainda não definida.” | indisponibilidade do Plano da Semana | nenhum | C7: resumo semanal; detalhamento no MFIT quando aplicável |
| Treino/MFIT | link e disponibilidade | profissional configura link; MFIT mantém treino | URL/configuração externa; treino é MFIT | não comprovado | CTA externo atual na Home | `UNAVAILABLE` se link não configurado; MFIT governa sua publicação | “Seu treino está disponível no MFIT quando o acesso for configurado.” | “Não foi possível abrir o MFIT agora.” | nenhum treino interno, exercício ou série fictícios | C6: CTA externo explicitamente rotulado |
| Check-in | semana, prazo, disponibilidade, formulário, envio, histórico | aluno; sistema agenda | `student_checkins.week_ref,available_at,submitted_at,analyzed_at,...` | POST Premium do feedback (rota exata mantida pelo contrato público atual); POST legado `/portal/checkin` | GET Premium current/history; legado `/portal/checkins` | disponível no calendário; enviado após submissão | `NOT_AVAILABLE`/“Seu check-in ainda não está disponível.” | mensagem de erro da superfície | legado só em migração | C8: feedback semanal Premium canônico |
| Resposta | resposta pública, data e status analisado | profissional | `student_checkins.coach_reply,coach_reply_at,analyzed_at` | hoje reply legado `PATCH /admin/checkins/:id/reply`; decisão Premium distinta | presenter de feedback lê `coach_reply` | resposta é visível após mensagem pública salva; análise não cria texto implicitamente | “Sua resposta profissional aparecerá após a análise.” | indisponibilidade da resposta | nenhum `decision_reason` interno | C9: decisão interna + mensagem pública explícita |
| Progressão | desempenho, sugestão e histórico | aluno; sistema sugere | `progression_logs`; regra client-side | POST `/portal/progression` | GET `/portal/progression` | registro confirmado; sugestão não é prescrição | “Sem histórico de progressão.” | erro de salvar/carregar explícito | nenhuma carga prescrita simulada | C10: ferramenta autônoma; persistir `decision` canônico |
| Biblioteca | artigos e textos educativos | equipe via deploy | HTML/array versionado no repositório | deploy, não API | arquivo estático | não aplicável | não aplicável | erro de carregamento estático convencional | conteúdo global estático | C11: D — estático intencional |
| Ajuda | CTA de suporte | equipe configura URL oficial | URL WhatsApp oficial | deploy/configuração atual | `wa.me` pelo menu efetivo | não aplicável | CTA permanece disponível | comunicar falha de abertura | `#supportNeeded` somente compatibilidade a remover/separar | C12: WhatsApp direto canônico |

## 4. Contratos por domínio e evidências

### C1 — Acesso Premium

- **Decisão.** `premium_students.consultation_status` é a fonte única de acesso Premium. Estados permitidos no contrato: `PENDING` (não libera), `ACTIVE` (libera Home, nutrição, Plano da Semana, check-in, progressão e CTA MFIT), `PAUSED` (bloqueia módulos individuais, preservando apenas orientação de contato) e `INACTIVE`/encerrado (bloqueia). O nome físico de estados existentes deve ser mapeado sem criar schema nesta sprint.
- **Escrita/publicação/leitura.** Profissional ou sistema altera por `release-planning`/`pause-access`; o gate lê `GET /portal/premium/access-state`. O acesso controla elegibilidade, mas não transforma rascunho em conteúdo publicado.
- **Ausência e legado.** Sem linha em `premium_students`, retornar `LEGACY_COMPATIBLE` somente para coortes identificadas durante X8, com telemetria/registro de migração. Não criar autorização implícita para novos alunos. Risco: acesso a conteúdo sem status oficial.
- **Evidência X1 e impacto.** X1 comprovou o gate e os endpoints administrativos, mas encontrou ausência de registro liberando acesso. Consumidores: bootstrap da Home e módulos Premium; X8 substitui a compatibilidade sem quebrar a coorte migrada.

### C2 — Identidade do aluno

- **Decisão.** A autoridade é a identidade autenticada da sessão, resolvida por endpoint oficial de perfil do aluno a ser definido em X8. `localStorage.lm_student_name` é somente cache de apresentação, vinculado a um identificador imutável de sessão/aluno.
- **Leitura e ausência.** Até existir o endpoint, a X2 não inventa rota: o consumo atual é `portal-premium-home.html` linha de leitura de `lm_student_name`. Sem nome oficial, usar “Aluno” como saudação neutra; não preencher com dado de sessão anterior.
- **Invalidação.** No bootstrap, comparar ID do perfil/sessão com a chave do cache; em login, troca de conta e logout, limpar ou substituir o cache. Se perfil falhar, não usar cache de outro ID.
- **Evidência X1 e impacto.** X1 não confirmou quem escreve o localStorage. Consumidor atual: Home; X8 introduz a leitura oficial e torna o cache derivado.

### C3 — Plano alimentar

- **Decisão canônica.** A rota pública canônica futura é **`GET /api/portal/premium/nutrition-plan/current`**, com **`presentPublicNutritionPlan()`** como presenter canônico. Justificativa: já filtra rascunho/inativo/arquivado e é a representação Premium nomeada. `GET /api/portal/nutrition-plan`/`publicNutritionPlan()` torna-se adaptador de compatibilidade temporária para a rota atualmente ligada ao menu, delegando à mesma forma canônica.
- **JSON público alvo.** `id`, `versionNumber`, `title`, `goal`, `strategy`, `publishedAt`, `updatedAt`, `meals` (ordem, hora, orientação, itens e substituições), `substitutions`, `adherenceRules`, `notes`, `hydration`, `supplements` e `status`. Campos sem persistência comprovada (`hydration`, `supplements`) devem ser `null`/omitidos até terem fonte oficial; Plano B não integra este contrato e fica `NOT_CREATED` até contrato próprio. O renderer não pode inventar valores padrão individuais.
- **Ciclo.** Profissional cria/edita `DRAFT`, pode marcar `READY_TO_PUBLISH`, publica uma única versão ativa `PUBLISHED`; publicação arquiva a anterior como `ARCHIVED`. A leitura pública devolve somente a atual. Histórico é separado da “versão atual” e exige superfície autorizada futura. Impressão/PDF deve consumir o mesmo JSON canônico; a superfície atual de impressão permanece fora do contrato até ser rastreada.
- **Evidência X1 e impacto.** Escrita: `public/admin-premium-nutrition-plan.js` (`createDraft`, `persistDraft`, publicação); persistência e transição: `d1-nutrition-plan-repository.js` (`updateDraft`, `publish`, `archive`); leituras/presenters: `workers/api.js` (`publicNutritionPlan`) e `workers/premium/presenters/nutrition-plan-public-presenter.js` (`presentPublicNutritionPlan`). Consumidores são as duas páginas nutricionais e impressão futura. X6 unifica sem retirar a rota do menu antes de migrá-la.

### C4 — Plano da Semana

- **Decisão.** `weekly_plans` permanece a entidade oficial, mas deixa de ser copy editorial ou agregador automático. O profissional escreve um **resumo semanal explícito** no editor Workspace a criar/conectar em X4: `week_ref`, `starts_at`, `ends_at`, `training_direction`, `nutrition_focus`, `cardio_target`, `main_risk`, `coach_message`, `status`, `published_at`, `updated_at`.
- **Publicação e versão.** Há no máximo uma versão `PUBLISHED` vigente por aluno e semana; rascunhos e semanas futuras não aparecem. Na troca de semana, a Home seleciona `week_ref` vigente; se não houver publicação, mostra vazio. Uma nova publicação para a mesma semana substitui a ativa e preserva a anterior como `ARCHIVED` para histórico, não como fallback público.
- **Limites.** Direção de treino e alimentação são textos de contexto, não séries/exercícios nem cópia das refeições. Cardio é meta resumida. O endpoint legado atual `POST /api/admin/weekly-plan` e `GET /api/portal/weekly-plan` são evidência de transição; X4 define a escrita Premium e leitura pública canônica sem criar ambas nesta PR.
- **Evidência X1 e impacto.** A IIFE de `public/portal-premium-home.html` lê o GET; `workers/api.js` consulta `weekly_plans`; não há UI Premium escritora comprovada. Consumidores: cards Home. X4 troca textos HTML e `catch` vazio por estados reais.

### C5 — Home do aluno

- **Decisão.** Cada card é consumidor, não fonte. A próxima ação é determinada nesta ordem: acesso não `ACTIVE` → **acesso pendente/bloqueado**; anamnese pendente → **anamnese pendente**; plano `NOT_CREATED`/`DRAFT` → **plano em preparação**; plano `PUBLISHED` → **plano liberado**; check-in disponível sem envio → **check-in disponível**; envio sem análise → **check-in enviado**; `analyzed_at` com resposta pública → **feedback analisado**. Empates usam a primeira ação pendente que exige o aluno.
- **Cards.** Plano alimentar consome C3; treino usa somente o CTA C6; cardio e foco usam C4; check-in consome C8; mensagem profissional consome C9. “Jornada” e mensagem institucional continuam D/estáticos e devem ser visualmente rotulados para não parecer resposta individual.
- **Falhas.** Falha de uma fonte torna somente seu card `ERROR`/indisponível; falha do gate bloqueia conteúdo individual. A Home não mantém valores HTML, `||` ou qualquer histórico como se fosse semana atual.
- **Evidência X1 e impacto.** Arquivo/função: IIFE e bootstrap em `public/portal-premium-home.html`; leituras atuais `GET /portal/checkins` e `GET /portal/weekly-plan`. X1 demonstrou `Promise.all`/`catch` silencioso e teste de qualquer histórico. X5 implementará o read model e renderização sem alterar este contrato.

### C6 — Treino e MFIT

- **Decisão.** No estado atual, MFIT é a fonte oficial externa de treino. Workspace Premium não prescreve treino internamente; o Portal mostra CTA rotulado “Treino disponível no MFIT”, nunca exercícios, séries, repetições, cargas, descanso, mídia ou substituições como dados internos.
- **Responsabilidade e estados.** A equipe/profissional configura a URL externa quando esse processo existir; MFIT é responsável pelo conteúdo e publicação. Sem URL/acesso configurado, estado `UNAVAILABLE` informa a indisponibilidade; erro ao abrir mostra falha de redirecionamento. Não há fallback interno.
- **Evidência X1 e impacto.** Home usa URL externa fixa; não há fetch/renderizador Premium nem tela Workspace comprovados para `training_exercises`. O schema sem consumidor não é integração. Consumidores: card/CTA Home; sem sprint de integração interna necessária.

### C7 — Cardio

- **Decisão.** O Portal mostra somente resumo em `weekly_plans.cardio_target`: unidade, frequência, duração e orientação textual, escritos pelo profissional e publicados com C4. Caso o detalhamento pertença ao treino, ele permanece MFIT e não é copiado.
- **Estados.** Sem meta publicada: “Meta de cardio ainda não definida.” Rascunho não aparece. Falha da leitura do Plano da Semana é `ERROR`; não usar o texto editorial da Home. Cardio relatado pelo aluno no check-in é adesão, não meta prescrita.
- **Evidência X1 e impacto.** X1 provou que a meta atual é texto de `weekly_plans` e que o cardio do check-in é relato. Consumidores: Home; X4 define o editor e X5 o estado visual.

### C8 — Check-in semanal

- **Decisão.** `portal-premium-weekly-feedback.html` é a superfície canônica Premium. O formulário canônico usa `student_checkins` com `week_ref`, disponibilidade, prazo, submissão, status, análise, decisão, resposta e histórico; o serviço de agenda é a autoridade para disponibilidade/prazo.
- **Estados.** Sem janela: `NOT_AVAILABLE`; disponível: `PUBLISHED` para o aluno (aberto ao envio); enviado: não substituir pelos dados de semana anterior; analisado: apresentar C9; histórico é somente semanas anteriores/atual identificadas por `week_ref`. Erro de API aparece em mensagem própria da página, sem reaproveitar formulário ou histórico como confirmação.
- **Legado.** `portal-checkin.html` e `/portal/checkin(s)` permanecem somente como compatibilidade durante X7, sem novos campos/regras Premium. A migração mapeia dados legados ao registro semanal sem supor que `available_at/submitted_at` ausentes significam janela Premium válida.
- **Evidência X1 e impacto.** `portal-premium-weekly-feedback.js` (`load`) e `weekly-feedback-schedule-service` sustentam o fluxo Premium; `portal-checkin.html` escreve/lê a mesma tabela por caminho legado. Consumidores: Home, feedback Premium e legado. X7 centraliza o contrato público.

### C9 — Resposta profissional

- **Decisão (modelo B).** Decisão interna e mensagem pública são campos explícitos e distintos em `student_checkins`: `decision_code`, `decision_reason`, `followup_at`, `coach_reply`, `coach_reply_at`, `analyzed_at`. A revisão Workspace grava os três campos de decisão/análise e oferece ação explícita para gravar a mensagem pública; publicar a mensagem não revela `decision_reason`.
- **Leitura/publicação.** O Portal lê somente `coach_reply`, `coach_reply_at` e estado de análise via presenter público. Não há mensagem até ela ser salva; “analisado” não deve gerar frase automática. O atual `PATCH /api/admin/checkins/:id/reply` é compatibilidade, não o escritor Premium alvo.
- **Evidência X1 e impacto.** A decisão atual em `.../weekly-feedbacks/:id/decision` não preenche `coach_reply`; `portal-premium-weekly-feedback.js` usa `professionalResponse.message`, e a rota legada de reply preenche a coluna exibida. Consumidores: ambos os check-ins, Home/estado de feedback. X3 implementará esta ponte P1.

### C10 — Progressão de carga

- **Decisão.** Permanece ferramenta autônoma do aluno: aluno registra desempenho, regra client-side produz **orientação** e `progression_logs` guarda o resultado. Não é prescrição, não consulta MFIT nem plano Workspace, e profissional somente poderá consultar em contrato futuro.
- **Campo canônico.** O payload e persistência devem convergir em `decision` como decisão/orientação exibida; `recommendation` é alias de migração de entrada até X7/X8, nunca a segunda fonte. Ausência mostra “Sem histórico de progressão”; erro de salvar/carregar é explícito.
- **Evidência X1 e impacto.** `portal-progressao.html` (`decide`) calcula antes da API, enquanto POST envia `recommendation` e Worker persiste `decision`. Consumidor: a própria página e histórico; não adicionar edição profissional nesta fase.

### C11 — Biblioteca

- **Decisão.** D — estático intencional. Artigos educacionais globais pertencem ao arquivo/array versionado no repositório e são publicados por deploy editorial, não pelo profissional em atendimento. Não há endpoint, estado individual, persistência de aluno ou fallback de Workspace.
- **Evidência X1 e impacto.** `public/portal-biblioteca.html` contém array inline e não tem API. Consumidor: Biblioteca; mudanças editoriais seguem revisão/deploy normal.

### C12 — Preciso de Ajuda

- **Decisão.** WhatsApp direto pela URL oficial de suporte é o único CTA canônico atual. É conteúdo/configuração institucional, não ticket, check-in nem notificação Workspace.
- **Legado e falha.** `#supportNeeded` é fallback legado: deve ser removido ou exposto como ação de check-in distinta em sprint posterior, nunca como alternativa silenciosa ao CTA. Falha ao abrir WhatsApp comunica indisponibilidade; não grava `student_checkins.support_needed` automaticamente.
- **Evidência X1 e impacto.** `getMenuItemsForPlan()` em `public/assets/js/lm-access.js` abre `wa.me`; `portal-shared.js` aponta fallback para `#supportNeeded`. Consumidores: menu e navegação compartilhada; não requer integração interna imediata.

## 5. Contrato de ausência, bloqueio e erro

| Domínio | Sem conteúdo | Não publicado | Acesso bloqueado | Erro de API | Fallback |
| --- | --- | --- | --- | --- | --- |
| Acesso | migração `LEGACY_COMPATIBLE` limitada | n/a | “Seu acesso Premium ainda não está liberado.” | “Não foi possível verificar seu acesso agora.” | nenhum, salvo coorte legada |
| Identidade | “Aluno” | n/a | n/a | saudação neutra; não dado antigo | cache da mesma sessão apenas |
| Plano alimentar | “Seu plano alimentar ainda está sendo preparado.” | mesma mensagem, sem conteúdo de rascunho | orientar contato/acesso | “Não foi possível carregar seu plano agora.” | campos opcionais vazios |
| Plano da Semana/Cardio | “Seu planejamento semanal ainda está sendo preparado.” / “Meta de cardio ainda não definida.” | igual, sem texto editorial | orientar contato/acesso | “Não foi possível carregar seu planejamento semanal agora.” | nenhum |
| Treino/MFIT | “O acesso ao MFIT ainda não foi configurado.” | governado pelo MFIT | orientar contato/acesso | “Não foi possível abrir o MFIT agora.” | nenhum |
| Check-in | “Seu check-in ainda não está disponível.” | janela não aberta | orientar contato/acesso | mensagem de erro do formulário | legado somente durante X7 |
| Resposta profissional | “Sua resposta profissional aparecerá após a análise.” | mensagem não salva não é pública | orientar contato/acesso | “Não foi possível carregar sua resposta agora.” | nenhum |
| Progressão | “Sem histórico de progressão.” | n/a | conforme acesso à ferramenta | erro explícito de salvar/carregar | nenhum |
| Biblioteca | n/a | deploy ainda não publicado | n/a | erro estático convencional | nenhum |
| Ajuda | CTA institucional disponível | n/a | CTA pode continuar institucional | aviso de falha de abertura | nenhum `#supportNeeded` |

## 6. Compatibilidade e migração

| Contrato atual | Contrato-alvo | Consumidores | Estratégia de migração | Compatibilidade temporária | Risco conhecido |
| --- | --- | --- | --- | --- |
| `/portal/nutrition-plan` + `publicNutritionPlan()` e `/portal/premium/nutrition-plan/current` + `presentPublicNutritionPlan()` | uma rota/presenter Premium canônicos | menu, duas páginas, futura impressão | especificar JSON, adaptar rota legada à saída canônica, migrar menu/renderers, medir uso, retirar adaptador | rota do menu mantém adapter até consumidores migrarem | mesma publicação com campos divergentes |
| `portal-checkin.html` e `portal-premium-weekly-feedback.html` | feedback semanal Premium | Home, ambos formulários, revisão | mapear histórico/semana, apontar navegação ao Premium, impedir novas dependências no legado, comunicar retirada | legado só para registros/coortes em transição | mesma tabela com disponibilidade e campos diferentes |
| ausência de `premium_students` libera `LEGACY_COMPATIBLE` | status obrigatório em `consultation_status` | gate/Home/módulos | identificar coorte, criar/confirmar status antes da data de corte, monitorar acessos compatíveis, desativar | apenas IDs explicitamente migrados | autorização implícita |
| `weekly_plans` legado `ACTIVE` sem editor Premium e seleção sem `week_ref` | resumo semanal publicado por semana | Home | criar/conectar editor, adicionar ciclo de publicação/seleção de semana, migrar linhas ativas, retirar copy HTML | leitura legada somente enquanto houver registros convertidos | orientação aparente sem profissional |
| `lm_student_name` sem escritor comprovado | perfil autenticado + cache vinculado à sessão | Home | fornecer perfil oficial, versionar chave de cache com ID, limpar no logout/troca, remover leitura autoritativa | cache da mesma sessão | identidade antiga após troca de sessão |
| `wa.me` no menu e `#supportNeeded` no nav | WhatsApp direto oficial | menu/nav | centralizar CTA na URL oficial, renomear/remover fallback de suporte, manter select apenas como campo de check-in se necessário | nenhum fallback de ajuda depois da centralização | pedido aparenta ser enviado sem ticket |
| `recommendation` enviado versus `decision` persistido | `decision` como orientação persistida | Progressão/histórico | aceitar alias na borda, converter/validar, mudar UI e remover alias após dados/consumidores migrarem | alias observável e com prazo de remoção | histórico diferente da sugestão exibida |
| decisão Premium separada de `coach_reply` legado | decisão interna + mensagem pública explícita | Workspace, dois check-ins, Home | adicionar ação/campo público no fluxo Workspace, presenter só expõe reply, migrar replies existentes sem expor razões | endpoint legado de reply até Workspace publicar mensagens | análise não chega ao aluno |

**Regra de saída de legado.** Cada compatibilidade deve ter dono, métrica de uso e data de corte definida na sprint que a implementa. Se não puder ser removida na data de corte, deve continuar marcada como risco e não ser tratada como contrato canônico.

## 7. Plano de implementação priorizado

| Sprint | Prioridade | Resultado implementável | Dependência/critério de saída |
| --- | --- | --- | --- |
| **X3 — Resposta profissional integrada** | P1 | Workspace grava decisão interna e mensagem pública C9; Portal mostra apenas a mensagem pública. | `coach_reply` e timestamps consistentes; nenhuma anotação interna exposta. |
| **X4 — Plano da Semana operacional** | P1 | Editor Workspace → `weekly_plans` → publicação semanal → leitura Home. | uma versão vigente por `week_ref`; campos C4/C7 e vazio definidos. |
| **X5 — Home sem fallbacks enganosos** | P1/P2 | Cards C5 usam estados reais e `ERROR`, sem HTML editorial/`catch` silencioso. | próxima ação determinística; nenhum histórico antigo marca check-in atual. |
| **X6 — Contrato canônico do plano alimentar** | P1/P3 | Presenter e rota C3 unificados, compatibilidade sem quebra. | uma forma JSON pública; campos/ausências idênticos em menu, alternativa e PDF quando rastreado. |
| **X7 — Check-in Premium canônico** | P1/P3 | Fluxo Premium único C8 e plano de retirada legado; alinhar progressão C10 se compartilhada. | disponibilidade, prazo, semana, resposta e histórico canônicos. |
| **X8 — Identidade e acesso** | P2/P3 | Perfil autenticado é a identidade; acesso implícito legado tem migração/corte. | cache não é autoridade; novos alunos sem status não recebem autorização. |

Treino/MFIT, Biblioteca e ajuda já possuem contratos explícitos (externo/estático/institucional) e não exigem integração interna antes dessas sprints. Qualquer implementação posterior deve atualizar esta especificação somente junto com evidência de endpoint, função, persistência e impacto de consumidor.

## 8. Índice de evidências X1 usado por este contrato

| Contrato | Achado X1 | Arquivo/função atual | Endpoint atual | Persistência | Impacto de consumidor |
| --- | --- | --- | --- | --- | --- |
| C1 | ausência Premium libera compatibilidade | `public/portal-premium-home.html` bootstrap; `workers/api.js` `getPremiumGate()` | `GET /portal/premium/access-state`; POSTs release/pause | `premium_students.consultation_status` | gate da Home e módulos |
| C2 | nome lido de localStorage, escritor não confirmado | `public/portal-premium-home.html` (leitura `lm_student_name`) | não comprovado | localStorage | saudação Home |
| C3 | duas rotas/presenters com campos distintos | `portal-plano-alimentar.html` `loadPlan`/`renderPlan`; renderer `renderMealContent`; `portal-premium-nutrition-plan.js` `render` | dois GETs nutricionais; draft/PATCH/publish Premium | `nutrition_plans` e JSON | menu, página alternativa, impressão futura |
| C4/C7 | weekly plan é texto independente e sem editor Premium | Home IIFE; `workers/api.js` handlers | `GET /portal/weekly-plan`; `POST /admin/weekly-plan` | `weekly_plans` | foco/cardio/Home |
| C5 | Home preserva valores em falha e usa histórico geral | `public/portal-premium-home.html` IIFE/`Promise.all` | `GET /portal/checkins`, weekly plan e gate | `student_checkins`, `weekly_plans` | todos os cards Home |
| C6 | não há treino Premium comprovado | CTA da Home; ausência de renderizador/fetch | URL MFIT externa | fora deste repositório | card/CTA treino |
| C8/C9 | dois check-ins; decisão não escreve reply | `portal-checkin.html`; `portal-premium-weekly-feedback.js` `load`; UI Workspace de decisão | GET/POST Premium e legado; `PATCH /admin/checkins/:id/reply` | `student_checkins`, `premium_followup_entries` | check-ins, Home, feedback |
| C10 | calculadora do aluno e conflito de campos | `portal-progressao.html` `decide`; `workers/api.js` handler | GET/POST `/portal/progression` | `progression_logs` | página/histórico de progressão |
| C11 | biblioteca inline sem API | `public/portal-biblioteca.html` array `data` | n/a | arquivo versionado | Biblioteca |
| C12 | dois caminhos de suporte incompatíveis | `public/assets/js/lm-access.js` `getMenuItemsForPlan`; `public/portal-shared.js` nav | WhatsApp externo / nenhum ticket | URL constante / campo legado de check-in | menu e navegação |

Este índice não substitui a auditoria X1: ele fixa quais fatos foram usados para cada decisão e obriga as sprints futuras a manter a rastreabilidade ao alterar consumidores ou contratos.
