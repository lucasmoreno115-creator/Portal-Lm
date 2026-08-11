# F2.1-fix3 — weekly feedback current identity

## Causa

`createGetCurrentWeeklyFeedbackUseCase()` consumia o resultado de `identityService.resolve()` como `identity.student_id`.

O contrato real do serviço de identidade retorna o aluno canônico em `identity.student`, portanto o identificador correto é `identity.student.student_id`.

O valor `undefined` era encaminhado para `weeklyFeedbackRepository.findByStudentAndWeek()` e chegava ao bind D1, causando HTTP 500 no `GET /api/portal/premium/weekly-feedback/current` antes da avaliação temporal.

## Correção

- usar o `student_id` canônico dentro de `identity.student`;
- manter sem alterações a janela temporal de sexta a domingo;
- adicionar regressão unitária para terça-feira (`NOT_AVAILABLE`), sexta-feira (`AVAILABLE`) e identidade bloqueada fail-closed.

## Escopo protegido

Sem migrations, schema, lifecycle, auth compartilhada, UI, fingerprints, Projeto LM ou regression budget.
