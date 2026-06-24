# V4-10 Admin Flow Consolidation

Auditoria estrutural e informativa dos fluxos administrativos do Portal LM. Este documento não remove telas, não altera UI, não altera endpoints, não altera banco de dados e não cria migrations.

## Objetivo

Consolidar oficialmente os fluxos administrativos existentes e registrar uma matriz de consolidação futura para orientar decisões posteriores de produto e operação.

Perguntas respondidas:

1. Quais telas fazem parte do fluxo principal?
2. Quais telas são auxiliares?
3. Quais telas parecem legadas?
4. Quais telas podem ser absorvidas pelo Student 360?
5. Quais telas podem ser absorvidas pelo Command Center?
6. Quais telas devem ser protegidas contra remoção?

## Fluxo oficial esperado

Fluxo administrativo principal do Portal LM:

```text
Admin Login
↓
Command Center
↓
Student 360
↓
Cadastro de Aluno
```

Interpretação operacional:

- `admin-login.html` autentica o acesso administrativo.
- `admin-command-center.html` concentra a visão diária da operação.
- `admin-student.html` centraliza a análise e intervenção por aluno no Student 360.
- `admin-students.html` mantém o cadastro e liberação de acesso do aluno.
- `admin.html` permanece como hub administrativo protegido, sem ser tratado como legado.

## Categorias

### CORE

Telas necessárias para a operação diária e para o fluxo administrativo principal.

| Tela | Papel operacional |
|------|-------------------|
| `admin-login.html` | Entrada autenticada do administrador. |
| `admin-command-center.html` | Painel central de prioridades, saúde operacional e ações administrativas. |
| `admin-student.html` | Student 360 para acompanhamento individual e execução de ações por aluno. |
| `admin-students.html` | Cadastro de aluno e gestão inicial de acesso. |
| `admin.html` | Hub administrativo protegido e ponto de navegação para telas principais. |

Total CORE: 5

### AUXILIARY

Telas complementares ou usadas ocasionalmente, que ainda apoiam fluxos administrativos existentes.

| Tela | Papel operacional |
|------|-------------------|
| `admin-checkins.html` | Revisão de check-ins e respostas do coach. |
| `admin-weekly-plan.html` | Criação isolada de plano semanal. |
| `admin-nutrition-plan.html` | Edição isolada de plano alimentar. |
| `admin-anamneses.html` | Consulta e análise de anamneses premium. |

Total AUXILIARY: 4

### LEGACY_CANDIDATE

Telas sem navegação principal clara, com possível absorção futura por uma superfície administrativa mais central. Esta marcação não autoriza remoção automática.

| Tela | Observação |
|------|------------|
| `admin-followup.html` | Fluxo de retenção/follow-up pode ser consolidado em Student 360 ou Command Center. |
| `admin-alerts.html` | Alertas de portal podem ser consolidados no Command Center. |

Total LEGACY_CANDIDATE: 2

## Matriz de consolidação

| Tela | Categoria | Pode ser absorvida por | Justificativa |
|------|------------|------------------------|---------------|
| `admin.html` | CORE | Não aplicável | Hub administrativo protegido; não deve ser marcado como legado. |
| `admin-login.html` | CORE | Não aplicável | Entrada autenticada obrigatória para o fluxo administrativo. |
| `admin-command-center.html` | CORE | Não aplicável | Superfície central da operação diária. |
| `admin-student.html` | CORE | Não aplicável | Student 360 é a superfície consolidada por aluno. |
| `admin-students.html` | CORE | Não aplicável | Cadastro de aluno faz parte do fluxo principal esperado. |
| `admin-checkins.html` | AUXILIARY | Student 360 | Check-ins e respostas de coach são ações por aluno e podem aparecer dentro do contexto individual. |
| `admin-followup.html` | LEGACY_CANDIDATE | Student 360 / Command Center | Follow-ups combinam priorização operacional e ação individual por aluno. |
| `admin-alerts.html` | LEGACY_CANDIDATE | Command Center | Alertas são sinais operacionais agregados e combinam com a lógica de painel central. |
| `admin-weekly-plan.html` | AUXILIARY | Student 360 | Plano semanal é uma intervenção por aluno, já alinhada ao contexto individual. |
| `admin-nutrition-plan.html` | AUXILIARY | Student 360 | Plano alimentar é uma intervenção por aluno, já alinhada ao contexto individual. |
| `admin-anamneses.html` | AUXILIARY | Student 360 | Anamnese é informação clínica/operacional do aluno e pode ser exibida no dossiê individual. |

## Protected Administrative Screens

As telas abaixo são protegidas contra remoção e não podem ser marcadas como `LEGACY_CANDIDATE` nesta auditoria:

- `admin.html`
- `admin-login.html`
- `admin-command-center.html`
- `admin-student.html`
- `admin-students.html`

## Possíveis consolidações futuras

- Absorver check-ins, plano semanal, plano alimentar e anamnese no Student 360.
- Absorver alertas administrativos no Command Center.
- Distribuir follow-ups entre Command Center, para priorização, e Student 360, para execução individual.
- Manter telas auxiliares enquanto não existir decisão formal de produto, migração de uso e validação operacional.

## Restrições desta auditoria

- Nenhuma tela foi removida.
- Nenhuma rota foi removida.
- Nenhum endpoint foi alterado.
- Nenhuma migration foi criada.
- Nenhuma alteração de banco de dados foi proposta.
- Nenhuma alteração de UI foi proposta.
