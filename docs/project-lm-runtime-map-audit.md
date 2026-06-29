# PR 28 — Projeto LM Runtime Map Audit

## 1. Resumo executivo

Esta auditoria mapeia exclusivamente o runtime real do **Projeto LM oficial** quando um aluno acessa a URL pública `/projeto-lm`. O fluxo oficial atual é uma SPA estática servida por rewrite para `public/project-lm-2.html`, com CSS e JavaScript isolados em `public/assets/css/project-lm-2.css` e `public/assets/js/project-lm-2-*`. O runtime oficial não carrega assets V5, páginas antigas `projeto-lm-*.html`, CSS Premium, JS Premium, Admin ou componentes Premium.

O frontend oficial consome endpoints `/api/project-lm-2/*` implementados no bloco central de `workers/api.js` e protegidos por autenticação compartilhada de aluno via `x-student-email` e `x-student-token`. O banco oficial efetivamente usado por esses endpoints é o conjunto `lm2_profiles`, `lm2_journeys`, `lm2_week_1_foundation`, `lm2_week_2_foundation`, `lm2_week_3_foundation`, `lm2_week_4_foundation` e `lm2_checkins`.

Após a Fase 2, o runtime oficial usa o backend `lm2_*` como fonte principal de verdade para onboarding, perfil, Semanas 1 a 4, check-ins, conclusão do programa e elegibilidade para Premium Bridge. `localStorage` permanece como cache de interface e sessão compartilhada, não como persistência oficial de progresso.

## 2. Runtime oficial

### URL, rewrite e entrypoint

| Item | Mapeamento | Status |
| --- | --- | --- |
| URL pública oficial | `/projeto-lm` | Oficial |
| Rewrite estático | `/projeto-lm /project-lm-2.html 200` | Correto |
| Entrypoint interno | `public/project-lm-2.html` | Implementação interna, não deve ser link público |
| Alias físico GitHub Pages | `public/projeto-lm/index.html` | Fallback compatível com host estático sem `_redirects` |
| Router interno | Hash routes (`#home`, `#week-1`, etc.) | Oficial |
| Outro entrypoint ativo no runtime de `/projeto-lm` | Não identificado | V5/legado congelados |

`public/project-lm-2.html` é apenas detalhe de implementação: a URL canônica de aluno é `/projeto-lm`, preservando a navegação por hash. O login compartilhado também envia alunos `projeto_lm` para `/projeto-lm`, e o menu compartilhado constrói links canônicos `/projeto-lm#...`. Para GitHub Pages ou outro host que não aplica `public/_redirects`, `public/projeto-lm/index.html` existe como alias físico seguro, carregando somente os mesmos assets oficiais do LM 2.0 com caminhos relativos ao diretório. A limitação do GitHub Pages é que a resolução exata de `/projeto-lm` pode normalizar para `/projeto-lm/`; servir `/projeto-lm` sem barra ou extensão de forma estrita exige rewrite/redirect configurado no provedor.

### Bootstrap real

1. O host estático reescreve `/projeto-lm` para `/project-lm-2.html`; quando o host não suporta `_redirects`, GitHub Pages pode servir o alias físico `public/projeto-lm/index.html`.
2. O HTML carrega o CSS oficial.
3. O HTML carrega os scripts na ordem: estado, router, app.
4. `ProjectLm2App.boot()` exige sessão local (`lm_student_email` + `lm_student_token`).
5. Sem sessão, redireciona para `/portal-login.html`.
6. Com sessão, renderiza inicialmente `home` e dispara `GET /api/project-lm-2/home` + `GET /api/project-lm-2/progress`.
7. A navegação interna acontece por hash e renderização client-side no elemento `#project-lm-2-root`.

## 3. Mapa de arquivos carregados

### Assets diretos de `public/project-lm-2.html`

| Ordem | Arquivo | Tipo | Classificação | Observações |
| --- | --- | --- | --- | --- |
| 1 | `assets/css/project-lm-2.css` | CSS | Oficial | Único CSS carregado pelo entrypoint oficial. |
| 2 | `assets/js/project-lm-2-state.js` | JS | Oficial | Cria `window.ProjectLm2State` e persiste estado em `localStorage`. |
| 3 | `assets/js/project-lm-2-router.js` | JS | Oficial | Cria `window.ProjectLm2Router` e normaliza hash routes. |
| 4 | `assets/js/project-lm-2-app.js` | JS | Oficial | Cria `window.ProjectLm2App`, renderiza telas, chama APIs e vincula eventos. |

### Assets não carregados pelo entrypoint oficial

| Asset/família | Classificação | Evidência operacional |
| --- | --- | --- |
| `project-lm-v5.css`, `project-lm-v5-*.js` | Legado/deprecated | Pertencem ao entrypoint V5 separado, não ao HTML oficial. |
| `project-lm.css`, `projeto-lm-*.html`, `project-lm-profile.html` | Legado antigo | Não são referenciados por `public/project-lm-2.html`. |
| `portal.css`, `portal-shared.js`, páginas Premium | Compartilhados/Premium fora do runtime | Não são carregados diretamente pelo runtime oficial. |
| `lm-access.js` | Compartilhado aceitável fora do entrypoint | Não é carregado por `project-lm-2.html`; influencia menus/redirects em páginas do portal. |
| Fontes externas | Não identificadas | Nenhum `<link>`/`@import`/script externo no entrypoint oficial. |
| Imagens | Não identificadas | O entrypoint oficial não referencia imagens. |
| Scripts externos | Não identificados | O único link externo runtime é a CTA WhatsApp no fim do programa, acionada por clique. |

## 4. JavaScript runtime

### Ordem de carregamento e globais

| Ordem | Arquivo | Global criado | Responsabilidade |
| --- | --- | --- | --- |
| 1 | `project-lm-2-state.js` | `window.ProjectLm2State` | Estado inicial, sanitização, leitura/escrita de `localStorage`, `getState`, `updateState`, `resetState`. |
| 2 | `project-lm-2-router.js` | `window.ProjectLm2Router` | Catálogo de rotas por hash, normalização, leitura de `location.hash`, navegação por `location.hash`. |
| 3 | `project-lm-2-app.js` | `window.ProjectLm2App` | Autenticação local, wrapper `requestLm2`, renderização de telas, chamadas API, manipulação de eventos, abertura de assets de treino/alimentação. |

### Dependências entre arquivos

- `project-lm-2-state.js` é independente e deve ser carregado antes do app.
- `project-lm-2-router.js` é independente do state, mas o app depende dele para `normalizeRoute`, `navigate` e `getCurrentRoute`.
- `project-lm-2-app.js` depende de ambos (`ProjectLm2State` e `ProjectLm2Router`) e falharia funcionalmente se carregado antes deles.
- Não foi identificado carregamento indireto de arquivos V5/legado a partir de `project-lm-2-app.js`.

## 5. Mapa de rotas

> Observação: o router contém nomes internos `week-3-placeholder` e `week-4-placeholder`; no produto, eles representam as telas oficiais das Semanas 3 e 4. Também existem aliases internos `week-1-placeholder` e `home-placeholder` que renderizam `week-1` e `home`.

| Hash route | Tela/função renderizada | Estado necessário | APIs usadas pela tela/ação | Persistência | Status |
| --- | --- | --- | --- | --- | --- |
| `welcome` | Boas-vindas e início do onboarding | Sessão válida; pode ser exibida quando backend informa `onboarding_completed=false` | Nenhuma direta | Local apenas até avançar onboarding | Completa |
| `onboarding-name` | Coleta nome | `state.name` local | Nenhuma direta | Local até submit final | Completa |
| `onboarding-goal` | Coleta objetivo | `state.goal` local | Nenhuma direta | Local até submit final | Completa |
| `onboarding-sex` | Coleta sexo | `state.sex` local | Nenhuma direta | Local até submit final | Completa |
| `onboarding-weight` | Coleta peso/altura e cria direção | `name`, `goal`, `sex`, `weight_kg`, `height_cm` | `POST /api/project-lm-2/onboarding`, depois `GET /api/project-lm-2/home` | Backend (`lm2_profiles`, `lm2_journeys`, `lm2_week_1_foundation`) + cache local | Completa |
| `direction-created` | Confirma direção criada | Estado aplicado do onboarding/home | Nenhuma direta | Local/estado backend já salvo | Completa |
| `home` | Home/jornada com próxima ação | Estado local; recarrega se `home_loaded=false` | `GET /api/project-lm-2/home` + `GET /api/project-lm-2/progress` | Backend como fonte para semanas 1/2/checkins; local como cache | Completa até Semana 2, parcial para 3/4 |
| `direction` | “Minha Direção” com botões de treino/alimentação | `training_plan_id`, `nutrition_plan_id` em state | Nenhuma API; abre `/project-lm-2-training.html?plan=...` ou `/project-lm-2-nutrition.html?plan=...` | IDs vêm do backend/cache local | Parcial: assets de destino não aparecem no inventário oficial carregado |
| `profile-edit` | Atualização de dados do perfil | Perfil no state | `PUT /api/project-lm-2/profile` | Backend (`lm2_profiles`) + cache local | Completa |
| `week-1` | Aula Semana 1 e Plano B | `week_1_video_completed`, `plan_b` | `POST /api/project-lm-2/week-1/video-complete`, `POST /api/project-lm-2/plan-b` | Backend (`lm2_week_1_foundation`) + cache local | Completa |
| `daily-checkin` | Check-in diário | `daily_checkin_answer`, jornada atual | `POST /api/project-lm-2/checkin` | Backend (`lm2_checkins`) + cache local | Completa |
| `week-complete` | Conclusão Semana 1 | Week status completo | `POST /api/project-lm-2/activate-week-2` | Backend (`lm2_journeys`, `lm2_week_2_foundation`) | Completa |
| `week-2` | Aula, reflexão e resposta mínima da Semana 2 | `week_2_*`, progresso | `POST /api/project-lm-2/week-2/video-complete`, `POST /api/project-lm-2/week-2/reflection` | Backend (`lm2_week_2_foundation`, `lm2_checkins`) + cache local | Completa |
| `week-2-complete` | Conclusão Semana 2 | Week 2 completa | `POST /api/project-lm-2/activate-week-3` | Backend (`lm2_journeys`, `lm2_week_3_foundation`) | Completa |
| `week-3-placeholder` | Conteúdo oficial da Semana 3 | Estado carregado de `home`/ações backend | `POST /api/project-lm-2/week-3/video-complete`, `POST /api/project-lm-2/week-3/reflection`, `POST /api/project-lm-2/week-3/complete` | Backend (`lm2_week_3_foundation`, `lm2_journeys`) + cache local | Completa |
| `week-3-complete` | Conclusão Semana 3 | `week_3_completed` do backend | Nenhuma direta; navega para Semana 4 | Backend (`lm2_week_3_foundation`, `lm2_journeys`) | Completa |
| `week-4-placeholder` | Conteúdo oficial da Semana 4 | Estado carregado de `home`/ações backend | `POST /api/project-lm-2/week-4/video-complete`, `POST /api/project-lm-2/week-4/reflection`, `POST /api/project-lm-2/week-4/complete` | Backend (`lm2_week_4_foundation`) + cache local | Completa |
| `week-4-complete` | Conclusão Semana 4 | `week_4_completed` do backend | Navega para `program-completion` | Backend (`lm2_week_4_foundation`) | Completa |
| `program-completion` | Fechamento do programa | Semana 4 concluída no backend | `POST /api/project-lm-2/program-completion` | Backend (`lm2_journeys`) + cache local | Completa |
| `premium-bridge` | Ponte comercial para Consultoria Premium | `program_completed`/`premium_bridge_eligible` do backend ou menu | Nenhuma API; CTA externa WhatsApp | Backend para elegibilidade; clique externo | Completa como CTA |

## 6. Mapa de APIs consumidas pelo front

Todas as chamadas oficiais passam por `requestLm2`, que exige sessão local e adiciona headers `x-student-email`/`x-student-token`. O app mantém endpoints de status semanal (`weekStatus`, `week2Status`) disponíveis no contrato, enquanto as ações funcionais de Semana 3, Semana 4 e conclusão do programa usam chamadas backend oficiais.

| Endpoint | Método | Chamador/tela | Payload esperado | Resposta esperada | Tabelas envolvidas | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/api/project-lm-2/onboarding` | POST | `onboarding-weight` / `submitOnboarding` | `{ name, goal, sex, weight_kg, height_cm }` | `{ ok:true, data: homeData }` | Lê/escreve `lm2_profiles`, cria/lê `lm2_journeys`, cria/lê `lm2_week_1_foundation`, lê `lm2_checkins` para progresso | Oficial/completo |
| `/api/project-lm-2/home` | GET | Boot/home e pós-onboarding | Sem payload | `{ ok:true, data: homeData }`; se sem onboarding, `{ onboarding_completed:false }` | Lê `lm2_profiles`, `lm2_journeys`, `lm2_week_1_foundation`, `lm2_week_2_foundation` quando semana 2, `lm2_checkins`; pode criar week foundations | Oficial/completo até Semana 2 |
| `/api/project-lm-2/progress` | GET | `loadHome` em paralelo com home | Sem payload | Continuidade, dias restantes, meta, check-in de hoje | Lê `lm2_journeys`, `lm2_checkins` | Oficial/completo |
| `/api/project-lm-2/week-1/video-complete` | POST | Semana 1 | Sem payload | `homeData` atualizado | Lê `lm2_profiles`, `lm2_journeys`, `lm2_checkins`; cria/atualiza `lm2_week_1_foundation` | Oficial/completo |
| `/api/project-lm-2/plan-b` | POST | Semana 1 | `{ unable_to_train, overeating, no_motivation }` | `homeData` atualizado | Atualiza `lm2_week_1_foundation`; lê perfil/jornada/checkins | Oficial/completo |
| `/api/project-lm-2/checkin` | POST | `daily-checkin` | `{ answer: "on_track" | "adapted" | "off_track" }` | `progressData`, 201 em sucesso; 409 se já fez hoje | Insere/lê `lm2_checkins`, lê `lm2_profiles`, `lm2_journeys` | Oficial/completo |
| `/api/project-lm-2/profile` | PUT | `profile-edit` | `{ name, goal, sex, weight_kg, height_cm }` | `homeData` atualizado | Atualiza `lm2_profiles`, lê/cria jornada/foundation conforme onboarding | Oficial/completo |
| `/api/project-lm-2/activate-week-2` | POST | `week-complete` | Sem payload | `{ current_week:2, activated:true }` | Lê `lm2_profiles`, `lm2_journeys`, `lm2_week_1_foundation`, `lm2_checkins`; atualiza `lm2_journeys`; cria `lm2_week_2_foundation` | Oficial/completo |
| `/api/project-lm-2/week-2/video-complete` | POST | Semana 2 | Sem payload | `homeData` atualizado | Atualiza/cria `lm2_week_2_foundation`, lê perfil/jornada/week1/checkins | Oficial/completo |
| `/api/project-lm-2/week-2/reflection` | POST | Semana 2 | `{ reflection }` ou `{ minimum_response }` | `homeData` atualizado | Atualiza/cria `lm2_week_2_foundation`, lê perfil/jornada/week1/checkins | Oficial/completo |
| `/api/project-lm-2/week-status` | GET | Definido no app, não chamado diretamente no runtime atual | Sem payload | Status da semana atual | Lê `lm2_profiles`, `lm2_journeys`, `lm2_week_1_foundation` ou `lm2_week_2_foundation`, `lm2_checkins`; pode criar foundation | Oficial backend; não consumido no fluxo atual |
| `/api/project-lm-2/week-2/status` | GET | Definido no app, não chamado diretamente no runtime atual | Sem payload | Status Semana 2 | Lê `lm2_profiles`, `lm2_journeys`, `lm2_week_2_foundation`, `lm2_checkins`; pode criar foundation | Oficial backend; não consumido no fluxo atual |
| `/api/project-lm-2/activate-week-3` | POST | `week-2-complete` | Sem payload | `{ current_week:3, activated:true }` ou erro guardrail | Lê `lm2_profiles`, `lm2_journeys`, `lm2_week_2_foundation`, `lm2_checkins`; atualiza `lm2_journeys` e cria `lm2_week_3_foundation` | Oficial/completo |
| `/api/project-lm-2/week-3/video-complete` | POST | Semana 3 | Sem payload | `homeData` atualizado | Atualiza/cria `lm2_week_3_foundation`, lê perfil/jornada/checkins | Oficial/completo |
| `/api/project-lm-2/week-3/reflection` | POST | Semana 3 | `{ reflection }` ou `{ minimum_response }` | `homeData` atualizado | Atualiza/cria `lm2_week_3_foundation`, lê perfil/jornada/checkins | Oficial/completo |
| `/api/project-lm-2/week-3/complete` | POST | Semana 3 | Sem payload | `homeData` atualizado com `current_week=4` | Atualiza `lm2_week_3_foundation`, `lm2_journeys`; cria `lm2_week_4_foundation` | Oficial/completo |
| `/api/project-lm-2/week-4/video-complete` | POST | Semana 4 | Sem payload | `homeData` atualizado | Atualiza/cria `lm2_week_4_foundation`, lê perfil/jornada/checkins | Oficial/completo |
| `/api/project-lm-2/week-4/reflection` | POST | Semana 4 | `{ reflection }` ou `{ minimum_response }` | `homeData` atualizado | Atualiza/cria `lm2_week_4_foundation`, lê perfil/jornada/checkins | Oficial/completo |
| `/api/project-lm-2/week-4/complete` | POST | Semana 4 | Sem payload | `homeData` atualizado com `week_4_completed=true` | Atualiza `lm2_week_4_foundation` | Oficial/completo |
| `/api/project-lm-2/program-completion` | POST | Program completion | Sem payload | `homeData` atualizado com `program_completed=true` e `premium_bridge_eligible=true` | Atualiza `lm2_journeys` (`status`, `completed_at`, `program_completed_at`, `premium_bridge_eligible`) | Oficial/completo |

## 7. Mapa de tabelas

| Tabela | Endpoints que leem | Endpoints que escrevem | Finalidade | Status |
| --- | --- | --- | --- | --- |
| `lm2_profiles` | Todos endpoints oficiais que exigem onboarding; `home`; `progress` indiretamente não lê perfil | `onboarding`, `profile` | Perfil técnico do aluno: nome, objetivo, sexo, peso, altura, IDs de plano alimentar/treino | Ativa |
| `lm2_journeys` | `home`, `progress`, `week-status`, `checkin`, ações semanais, ativações e conclusão do programa | `onboarding` cria, `activate-week-2`/`activate-week-3`/`week-3/complete` atualizam `current_week`; `program-completion` atualiza conclusão/elegibilidade | Jornada 30 dias, semana atual, datas de transição, conclusão e elegibilidade Premium Bridge | Ativa |
| `lm2_week_1_foundation` | `home`, `week-status`, ações Semana 1, ativações, home Semana 2 | `onboarding`/ensure cria, `week-1/video-complete`, `plan-b` atualizam | Requisitos Semana 1: aula e Plano B | Ativa |
| `lm2_week_2_foundation` | `home` na Semana 2, `week-status`, `week-2/status`, `activate-week-3`, ações Semana 2 | `activate-week-2`/ensure cria, `week-2/video-complete`, `week-2/reflection` atualizam | Requisitos Semana 2: aula, reflexão e resposta mínima | Ativa |
| `lm2_checkins` | `progress`, `home`, `week-status`, `week-2/status`, ativações | `checkin` insere | Check-ins diários e pontos de continuidade por semana | Ativa |
| `lm2_week_3_foundation` | `home`, ações Semana 3, conclusão Semana 3 | `activate-week-3`/ensure cria; endpoints Semana 3 atualizam | Requisitos Semana 3: aula, reflexão, resposta mínima e conclusão | Ativa |
| `lm2_week_4_foundation` | `home`, ações Semana 4, conclusão Semana 4/programa | `week-3/complete`/ensure cria; endpoints Semana 4 atualizam | Requisitos Semana 4: aula, reflexão, resposta mínima e conclusão | Ativa |

## 8. Mapa de estado local

### localStorage

| Chave | Usada por | Finalidade | Classificação |
| --- | --- | --- | --- |
| `project-lm-2-state` | `ProjectLm2State` | Estado serializado do runtime LM 2.0 | Cache de interface; backend é fonte oficial de progresso |
| `lm_student_email` | Login compartilhado e `ProjectLm2App.getAuth()` | Identificação para API | Fonte local de sessão compartilhada |
| `lm_student_token` | Login compartilhado e `ProjectLm2App.getAuth()` | Token enviado em header | Fonte local de sessão compartilhada |
| `lm_student_name` | Login/menu compartilhado | Nome de aluno em páginas compartilhadas | Compartilhado fora do entrypoint |
| `lm_student_plan`, `lm_student_plan_type` | Login/menu/access | Segmentação Premium vs Projeto LM | Compartilhado fora do entrypoint |

### sessionStorage

O runtime oficial `project-lm-2.html` não usa `sessionStorage` diretamente. `lm-access.js` usa `sessionStorage.lm_access_message` para mensagens de acesso negado em páginas compartilhadas; isso é dependência indireta de navegação, não asset carregado pela SPA oficial.

### Hash

O hash (`window.location.hash`) é a fonte de navegação interna. O router normaliza rotas desconhecidas para `welcome`; o app normalmente inicia renderizando `home` e depois usa `hashchange` para renderizações subsequentes.

### Estado em memória

`ProjectLm2State` mantém uma variável interna `state`, sempre sanitizada e congelada quando exposta por `getState()`. `updateState()` persiste em `localStorage`. Alguns flags (`home_loaded`, `direction_loaded`) são cache de sessão/renderização e são reinicializados para `false` no load inicial.

### Fonte da verdade, cache e fallback

| Domínio | Fonte da verdade atual | Cache/fallback | Risco de desalinhamento |
| --- | --- | --- | --- |
| Sessão | `localStorage` compartilhado + validação backend | Nenhum fallback seguro | Logout/limpeza derruba acesso; token local é acoplamento compartilhado. |
| Onboarding/perfil | Backend `lm2_profiles` | `project-lm-2-state` | Cache local pode exibir dados antigos até `home` recarregar. |
| Jornada semanas 1/2 | Backend `lm2_journeys`, `lm2_week_1_foundation`, `lm2_week_2_foundation`, `lm2_checkins` | `project-lm-2-state` | Desalinhamento temporário se API falhar após estado local mudar. |
| Semana 3 | Backend `lm2_week_3_foundation` + `lm2_journeys` | `project-lm-2-state` | Cache local não é fonte oficial; novo dispositivo recupera via `home`. |
| Semana 4 | Backend `lm2_week_4_foundation` | `project-lm-2-state` | Cache local não é fonte oficial; novo dispositivo recupera via `home`. |
| Conclusão do programa | Backend `lm2_journeys.program_completed_at/status/premium_bridge_eligible` | `project-lm-2-state` | Cache local não é fonte oficial. |

## 9. Dependências compartilhadas

| Dependência | Como aparece | Classificação | Risco/observação |
| --- | --- | --- | --- |
| `portal-login.html` | Destino de redirect quando não há sessão; grava credenciais e plano em `localStorage` | Aceitável/necessária hoje | Acoplamento de autenticação compartilhada. |
| `workers/api.js` | Implementa APIs LM 2.0 junto de Premium, Admin e legados | Risco técnico | Arquivo concentra muitas responsabilidades; mudanças em outras áreas podem afetar LM 2.0. |
| `lm-access.js` | Menus e redirects compartilhados apontam para `/projeto-lm#...` | Aceitável com cautela | Não é carregado pela SPA, mas influencia navegação vinda do portal. Ainda contém helpers antigos de onboarding/profile legado. |
| `portal.html` | Redireciona aluno `projeto_lm` para `/projeto-lm#home` e possui links canônicos | Temporária/aceitável | Premium/portal compartilham ponto de entrada e podem confundir inventário se alterados. |
| `portal-shared.js` | Não carregado diretamente pelo entrypoint oficial | Sem dependência runtime direta | Fora do caminho oficial `/projeto-lm`. |
| APIs legadas `/api/project-lm/*` e `/api/portal/project-lm/*` | Coexistem no mesmo Worker após bloco `/api/project-lm-2/*` | Risco de manutenção | Não são chamadas pelo runtime oficial, mas convivem no mesmo roteador. |

## 10. Limites com Consultoria Premium

### Confirmado: Projeto LM oficial não carrega Premium

- `public/project-lm-2.html` carrega somente `project-lm-2.css`, `project-lm-2-state.js`, `project-lm-2-router.js` e `project-lm-2-app.js`.
- Não há carregamento direto de `portal.css`, páginas Premium, componentes Premium, Admin ou scripts Premium no entrypoint oficial.
- As chamadas fetch do app oficial usam somente `/api/project-lm-2/*`.
- A CTA `premium-bridge` não carrega runtime Premium; apenas redireciona para WhatsApp quando clicada.

### Confirmado: Premium não carrega assets `project-lm-2-*`

Busca estática em `portal.html`, `portal-login.html`, páginas `portal*.html`, `admin*.html`, `anamnese-premium.html`, `public/project-lm-v5.html` e app V5 encontrou referência direta a `project-lm-2` apenas em `public/assets/js/lm-access.js`, que é um arquivo compartilhado de controle/menu, e não em páginas Premium como asset carregado. Testes existentes também validam que páginas Premium/portal/V5 não carregam `project-lm-2-app.js` em cenários de onboarding/home/check-in.

## 11. Riscos encontrados

| Risco | Severidade | Detalhe |
| --- | --- | --- |
| Regressão de fonte da verdade local | Média | Semanas 3/4 e conclusão agora têm backend; manter testes para impedir retorno a persistência exclusiva em `localStorage`. |
| `home` combina backend e cache local | Média | O backend é fonte oficial, mas `project-lm-2-state` ainda cacheia UI e precisa ser mantido subordinado às respostas `homeData`. |
| Acoplamento com `workers/api.js` monolítico | Média | O bloco LM 2.0 convive com rotas Premium, Admin e legadas. |
| Acoplamento com login compartilhado | Média | `ProjectLm2App` depende de chaves `lm_student_*` em `localStorage`; mudanças no login quebram runtime. |
| Assets de direção para treino/alimentação não aparecem no inventário carregado | Média | O app redireciona para `/project-lm-2-training.html` e `/project-lm-2-nutrition.html`, mas esses arquivos não aparecem no inventário atual. |
| Altura em migration base | Baixa/média | O código usa `height_cm`; a migration `0019` listada nesta auditoria não declara essa coluna, embora testes/mocks e código assumam o campo. Requer validação de histórico de migrations antes de correção futura. |
| Router com nomes `placeholder` para telas reais | Baixa/média | Semanas 3/4 são renderizadas por rotas chamadas `week-3-placeholder`/`week-4-placeholder`, o que dificulta leitura operacional. |

## 12. Recomendações

1. **Não alterar runtime nesta PR**: manter esta auditoria como fotografia técnica.
2. **Consolidar fonte da verdade das Semanas 3 e 4** em APIs/tabelas `lm2_*` antes de novas evoluções de produto.
3. **Manter a transição Semana 2 → Semana 3 ligada ao endpoint oficial `activate-week-3`**, preservando guardrails de conclusão.
4. **Manter persistência backend para Semanas 3/4 e conclusão do programa** como contrato obrigatório de futuras alterações.
5. **Isolar o módulo `/api/project-lm-2/*` fora de `workers/api.js`** em refactor futuro sem alteração contratual, reduzindo risco de regressões cruzadas.
6. **Documentar explicitamente os assets de treino/alimentação** (`project-lm-2-training.html` e `project-lm-2-nutrition.html`) ou removê-los do fluxo em PR futura se não existirem, após decisão de produto.
7. **Manter `/projeto-lm` como única URL pública**; não criar links públicos para `project-lm-2.html`, V5 ou páginas legadas.
8. **Adicionar testes estáticos futuros** para garantir que `project-lm-2.html` continue carregando somente assets oficiais e que Premium não passe a carregar `project-lm-2-*`.

## 13. Plano sugerido para consolidação

### Fase 1 — Contratos e persistência faltante

- Contratos de Semana 3, Semana 4 e conclusão do programa definidos no runtime atual.
- Migrations `lm2_week_3_foundation`, `lm2_week_4_foundation` e campos de conclusão em `lm2_journeys` presentes.
- Endpoints `/api/project-lm-2/week-3/*`, `/api/project-lm-2/week-4/*` e `/api/project-lm-2/program-completion` presentes.

### Fase 2 — Alinhamento de UI sem mudança de UX

- Persistência local das Semanas 3/4 substituída por chamadas aos endpoints oficiais.
- `activate-week-3` usado na transição real da Semana 2 para a Semana 3.
- `localStorage` mantido como cache, não fonte da verdade.

### Fase 3 — Isolamento técnico

- Extrair handlers LM 2.0 para módulo próprio mantendo rotas e payloads.
- Separar testes `project-lm-2`, V5 legado e V4 legado.
- Documentar dependências compartilhadas aceitas (`portal-login.html`, `lm-access.js`) e pontos que devem ser isolados futuramente.

### Fase 4 — Limpeza controlada de legado

- Após freeze e cobertura de testes, planejar remoção ou arquivamento explícito de V5/legado em PRs separadas.
- Garantir que nenhuma navegação pública use entrypoints internos ou congelados.
