# Changelog

## LM Premium 3.0.0

Release oficial de produção do LM Premium 3.0. Esta versão consolida a arquitetura construída entre os Builds 0 a 6 e validada em RC1, sem introduzir novas funcionalidades, sem alterar UX, regras clínicas, domínio, banco ou payloads públicos.

### Arquitetura nova

A release formaliza a separação em camadas de domínio, aplicação, repositórios, serviços, presenters, workers e rotas. O objetivo é manter regras operacionais explícitas, contratos de API preservados e evolução futura controlada.

### Student Identity

A identidade oficial do aluno Premium passa a ser representada por `student_id`, preservando compatibilidade com e-mail e dados legados. O serviço de identidade atua como camada de resolução e evita acoplamento direto de fluxos Premium ao identificador histórico.

### Prontuário LM

O Prontuário LM consolida anamnese, feedbacks, planos, pendências, decisões profissionais e timeline operacional em uma visão longitudinal para acompanhamento profissional.

### Weekly Feedback

O fluxo de feedback semanal foi consolidado com disponibilidade, submissão, análise, decisões profissionais e lembretes operacionais, mantendo payload público compatível para o aluno.

### Nutrition Workflow

O workflow de plano alimentar foi estabilizado com rascunho, publicação, histórico, arquivamento e duplicação como rascunho, preservando a compatibilidade do plano atual publicado.

### Professional Workspace

O workspace profissional consolida lista de alunos, busca, resumo operacional, pendências e revisão de sábado como read models administrativos voltados à operação Premium.

### RC1

A RC1 permanece registrada como marco histórico de validação, auditoria, smoke, segurança, feature flags e readiness. A Release 3.0.0 promove esse conjunto validado para produção.

### Compatibilidade preservada

A release mantém compatibilidade com rotas, payloads, tabelas e contratos públicos existentes. Não há migrations novas nem mudanças funcionais nesta entrega de produção.

### Projeto LM isolado

O Projeto LM permanece isolado e preservado. A Release 3.0.0 documenta a fronteira entre os fluxos Premium e Projeto LM sem alterar arquivos, payloads ou comportamento do Projeto LM.
