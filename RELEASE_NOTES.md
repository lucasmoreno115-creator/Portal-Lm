# Release Notes — LM Premium 3.0.0

## Resumo executivo

LM Premium 3.0.0 é a release oficial de produção que consolida os Builds 0 a 6 e o ciclo RC1. O escopo é exclusivamente documental, organizacional, operacional e de versionamento.

## O que mudou

- Documentação oficial de release, operação, deploy, administração, arquitetura, endpoints, banco, matriz de funcionalidades, checklist de produção, proposta de tag e manifesto.
- Referência de produção atualizada para Release 3.0.0, mantendo RC1 apenas como histórico.
- Consolidação da arquitetura Premium: Student Identity, Prontuário LM, Weekly Feedback, Nutrition Workflow e Professional Workspace.

## Por que mudou

A release transforma o conjunto validado na RC1 em material operacional de produção, reduzindo ambiguidade para deploy, rollback, suporte, auditoria e administração.

## Benefícios

- Critérios claros para deploy e rollback.
- Catálogos de endpoints e banco para operação e auditoria.
- Manual de uso do profissional e guia operacional do sistema.
- Manifesto único da release para rastreabilidade.
- Compatibilidade explícita com os contratos existentes.

## Compatibilidade

- Sem alteração de UX.
- Sem alteração de regras clínicas.
- Sem alteração de domínio.
- Sem alteração de banco.
- Sem migrations novas.
- Sem alteração de endpoints, APIs ou payloads públicos.
- Projeto LM permanece isolado.

## Riscos conhecidos

- A aplicação de migrations históricas exige auditorias prévias já documentadas nos próprios scripts e arquivos SQL.
- Smoke em ambiente real depende de tokens, URL de staging/produção e aluno Premium válido.
- Rollback deve ser conduzido por restore/controle de deploy, não por remoção manual de dados clínicos.

## Itens futuros — 3.1

- Melhorias incrementais de observabilidade operacional.
- Refinamento de relatórios administrativos.
- Automação adicional de validações de release.
- Evoluções planejadas apenas após abertura formal do ciclo 3.1.
