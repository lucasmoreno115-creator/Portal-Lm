# LM Premium 3.0 — 01 Current Operational Flow

## Objetivo
Este documento descreve o funcionamento operacional atual da Consultoria LM Premium a partir da auditoria técnica do Build 0. Ele não propõe novas funcionalidades, não muda decisões de produto e não altera o sistema. O objetivo é explicitar como o trabalho acontece hoje para que o software sirva ao processo da consultoria, e não o contrário.

## Princípio operacional
A Consultoria LM Premium é um serviço personalizado. O Portal LM organiza acesso, informações, check-ins, plano alimentar, plano semanal, follow-up, timeline e leitura administrativa. A decisão clínica, a prescrição nutricional, a interpretação do contexto do aluno, a atualização do plano e o acompanhamento continuam sendo responsabilidades humanas do profissional.

## Visão macro do fluxo
```text
Novo aluno
  ↓
Criar acesso
  ↓
Enviar anamnese
  ↓
Aluno responde anamnese
  ↓
Lucas analisa informações
  ↓
Lucas cria plano alimentar e orientações iniciais
  ↓
Aluno acessa portal e executa plano
  ↓
Aluno envia check-ins/progressão
  ↓
Sistema organiza dados e alertas
  ↓
Lucas analisa feedbacks
  ↓
Lucas responde, ajusta ou acompanha
  ↓
Consultoria continua em ciclos
```

## Papéis

### Sistema
Responsável por organizar o processo:
- criar e validar acesso do aluno;
- receber anamnese;
- armazenar plano alimentar, plano semanal, check-ins, progressões e logs de acompanhamento;
- exibir ao aluno o que já foi registrado pelo profissional;
- exibir ao admin a visão consolidada do aluno;
- registrar timeline e sinais operacionais;
- preservar a separação com Projeto LM e MFit conforme documentado.

O sistema não é responsável por:
- diagnosticar;
- prescrever por conta própria;
- substituir julgamento clínico;
- substituir contato humano;
- substituir o MFit como fonte oficial de treinos.

### Lucas / profissional
Responsável por conduzir a consultoria:
- decidir a estratégia nutricional;
- analisar anamnese, check-ins e progressões;
- criar e atualizar plano alimentar;
- definir plano semanal/orientações;
- interpretar riscos, adesão, contexto e necessidades do aluno;
- responder feedbacks e decidir próximos passos;
- usar MFit como fonte oficial para treinos.

### Aluno
Responsável por executar e informar:
- acessar o Portal com email/token;
- responder anamnese;
- consultar plano alimentar e orientações;
- executar o combinado fora do sistema;
- enviar check-ins;
- registrar progressão quando aplicável;
- acessar MFit para treinos.

## Fluxo operacional detalhado

### 1. Entrada de novo aluno
**Responsável principal:** Lucas/admin.

**Entradas:** dados básicos do aluno, email, plano/produto, status inicial e necessidade de acesso.

**Sistema faz:** registra ou atualiza `student_access`, token e status de acesso; permite diferenciar Premium e Projeto LM pelo campo de plano já existente.

**Lucas faz:** confirma que o aluno pertence à Consultoria Premium, cria/libera acesso e envia instruções de entrada.

**Aluno faz:** recebe instruções e acessa o Portal.

**Saídas:** aluno com acesso criado, token disponível e produto associado.

**Decisões humanas:** confirmar que o aluno é Premium, decidir quando liberar, orientar o aluno.

**Decisões automáticas:** validação técnica de login/token e redirecionamento conforme plano.

### 2. Anamnese Premium
**Responsável principal:** aluno preenche; Lucas analisa.

**Entradas:** respostas de anamnese enviadas pelo aluno.

**Sistema faz:** recebe formulário em `anamnese-premium.html`, salva em `premium_anamnesis` e permite leitura/status no admin.

**Lucas faz:** analisa respostas, identifica contexto, necessidades, riscos e prioridades antes de criar ou ajustar plano.

**Aluno faz:** responde com informações relevantes da consultoria.

**Saídas:** anamnese registrada, disponível para análise administrativa.

**Decisões humanas:** interpretação da anamnese e conduta.

**Decisões automáticas:** persistência do envio e disponibilidade no painel admin.

### 3. Construção do plano alimentar
**Responsável principal:** Lucas.

**Entradas:** anamnese, objetivo do aluno, contexto clínico, histórico, feedbacks e decisão profissional.

**Sistema faz:** fornece tela admin para criar/editar plano alimentar e disponibiliza ao aluno o plano ativo.

**Lucas faz:** define plano alimentar, orientações, estrutura e ajustes necessários.

**Aluno faz:** consulta e executa o plano fora do sistema.

**Saídas:** registro em `nutrition_plans`, plano ativo visível no portal e potencial evento de timeline.

**Decisões humanas:** prescrição, ajustes, interpretação de adesão e necessidades.

**Decisões automáticas:** salvar, buscar plano ativo e exibir.

### 4. Organização semanal
**Responsável principal:** Lucas.

**Entradas:** objetivo da semana, foco de treino/cardio/nutrição, risco principal e mensagem do coach.

**Sistema faz:** salva plano semanal em `weekly_plans` e apresenta no portal/admin.

**Lucas faz:** define o foco semanal com base no acompanhamento.

**Aluno faz:** consulta a orientação semanal e executa o combinado.

**Saídas:** plano semanal disponível.

**Decisões humanas:** foco semanal, risco, mensagem e conduta.

**Decisões automáticas:** persistência e exibição do plano semanal.

### 5. Execução pelo aluno
**Responsável principal:** aluno.

**Entradas:** plano alimentar, plano semanal, rotina individual, treinos no MFit e orientações recebidas.

**Sistema faz:** mantém as informações organizadas e acessíveis.

**Lucas faz:** permanece como referência de acompanhamento e decisão.

**Aluno faz:** executa alimentação, rotina, orientações e treinos pelo MFit.

**Saídas:** execução prática fora do sistema e dados futuros de feedback.

**Decisões humanas:** ajustes de comportamento e comunicação entre aluno e profissional.

**Decisões automáticas:** nenhuma decisão de prescrição; apenas disponibilidade das informações.

### 6. Check-in e progressão
**Responsável principal:** aluno envia; Lucas interpreta.

**Entradas:** respostas de check-in, percepção de execução, dificuldades, peso/medidas/progresso quando aplicável.

**Sistema faz:** salva check-ins em `student_checkins`, progressões em `progression_logs`, registra timeline e disponibiliza no admin.

**Lucas faz:** avalia o feedback, identifica padrões, responde quando necessário e decide se plano deve ser mantido ou alterado.

**Aluno faz:** envia informações com regularidade e acompanha retornos.

**Saídas:** histórico de check-ins/progressões, fila administrativa e contexto para decisão.

**Decisões humanas:** análise, resposta, ajuste ou manutenção de estratégia.

**Decisões automáticas:** armazenamento, ordenação, listagem e alertas operacionais.

### 7. Follow-up e retenção
**Responsável principal:** Lucas/admin.

**Entradas:** sinais de ausência, risco, pendências, check-ins sem resposta, status do aluno e histórico.

**Sistema faz:** organiza logs de follow-up, ações de retenção, alertas, command center e portal alerts.

**Lucas faz:** decide se deve contatar, responder, resolver pendência, atualizar plano ou apenas acompanhar.

**Aluno faz:** responde contatos e retoma execução quando aplicável.

**Saídas:** registro de acompanhamento, ação de retenção ou resolução.

**Decisões humanas:** priorização e abordagem de acompanhamento.

**Decisões automáticas:** consolidação de alertas e exibição administrativa.

### 8. Ciclo contínuo de consultoria
**Responsável principal:** Lucas e aluno.

**Entradas:** histórico completo, anamnese, plano, check-ins, progressão, follow-up e contexto externo.

**Sistema faz:** mantém a memória operacional da consultoria.

**Lucas faz:** interpreta o conjunto de dados e define continuidade, ajustes ou novas orientações.

**Aluno faz:** continua execução e feedback.

**Saídas:** continuidade do acompanhamento personalizado.

**Decisões humanas:** todas as decisões de conduta, prescrição e acompanhamento.

**Decisões automáticas:** organização e recuperação dos dados.

## Responsabilidades por etapa
| Etapa | Sistema | Lucas/profissional | Aluno |
|---|---|---|---|
| Acesso | Armazena e valida email/token/status/plano | Cria/libera acesso | Usa credenciais |
| Anamnese | Recebe e lista respostas | Analisa e interpreta | Preenche |
| Plano alimentar | Salva e exibe plano | Prescreve e atualiza | Consulta e executa |
| Plano semanal | Salva e exibe foco semanal | Define foco e mensagem | Consulta e aplica |
| Check-in | Salva e lista feedbacks | Analisa e responde | Envia feedback |
| Progressão | Salva histórico | Interpreta evolução | Registra dados |
| Follow-up | Organiza alertas/logs | Decide contato/ação | Responde/retoma |
| Treino | Apenas aponta para MFit quando aplicável | Usa MFit como fonte oficial | Acessa MFit |

## Decisões humanas versus automáticas

### Decisões humanas
- O que prescrever.
- Quando alterar plano.
- Como interpretar anamnese e check-in.
- Como responder feedback.
- Quando acionar aluno.
- Como conduzir estratégia nutricional e acompanhamento.

### Decisões automáticas atuais
- Validar acesso por email/token.
- Redirecionar aluno conforme plano registrado.
- Salvar formulários e registros.
- Carregar plano ativo/históricos.
- Agregar informações para telas admin.
- Exibir alertas/logs operacionais.

## Conflitos ou pontos a não decidir neste documento
- O sistema atual compartilha `student_access` entre Premium e Projeto LM; isso é fato operacional atual, não decisão de arquitetura final.
- Rotas Projeto LM sob `/api/portal/project-lm/*` existem; este documento não decide remoção nem renomeação.
- O Portal não deve assumir treino Premium; o MFit continua boundary externa.
