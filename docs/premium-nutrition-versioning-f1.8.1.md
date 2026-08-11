# F1.8.1 — contrato investigado de versionamento alimentar

O botão **Editar planejamento** entrega explicitamente `state.current` ao handler, que valida `source.id` e chama `POST /api/admin/premium/nutrition-plans/:planId/duplicate-as-draft` com `{ student_id, replace_existing_draft: false }`. O endpoint responde `200` com o novo plano administrativo em `data`. Eventos de DOM não são aceitos como identificadores.

O domínio trata versões publicadas como imutáveis. A duplicação aceita uma origem `PUBLISHED` ou `ARCHIVED`, copia seu conteúdo para um novo registro `DRAFT`, com novo ID, e não troca o plano corrente. O draft ainda não tem número de versão nem `supersedes_plan_id`; esses campos são definidos na publicação.

`POST /api/admin/premium/nutrition-plans/:planId/publish`, com `{ student_id }`, arquiva a versão corrente (`status = ARCHIVED`, `is_active = 0`, `archived_at` preenchido), publica o draft (`status = PUBLISHED`, `is_active = 1`), atribui o próximo `version_number` e liga `supersedes_plan_id` à versão anterior.

Não existe uma rota de histórico separada consumida pelo editor. O contrato administrativo real é `GET /api/admin/premium/students/:studentId/nutrition-plan`, cuja resposta `data` contém `current`, `draft` e `history`. O repositório ordena o histórico por versão decrescente e data de publicação decrescente. O Portal usa separadamente `GET /api/portal/nutrition-plan`, que resolve apenas a versão publicada ativa; portanto, o draft não deve aparecer antes da republicação.

O smoke cria uma fixture própria, conduz o lifecycle por `READY_TO_RELEASE` até `ACTIVE`, publica V1, duplica pelo endpoint canônico, altera V2, prova V1 no Portal durante o draft, publica V2 e comprova V1 intacta no `history`. As leituras de access-state antes e depois garantem que o versionamento não regride o lifecycle.
