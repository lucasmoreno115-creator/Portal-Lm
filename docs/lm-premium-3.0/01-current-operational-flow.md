# LM Premium 3.0 — 01 Current Operational Flow

## Objetivo
Este documento descreve o funcionamento operacional atual da Consultoria LM Premium e diferencia explicitamente o que existe hoje no Portal do escopo futuro aprovado do LM Premium 3.0. Ele é exclusivamente documental: não propõe implementação, não altera decisões aprovadas e não modifica produção.

## Separação obrigatória: estado atual vs escopo futuro aprovado

### Estado atual do Portal
Hoje o Portal LM organiza acesso, anamnese, plano alimentar, plano semanal, check-ins, progressão, follow-up, timeline, alertas e telas administrativas. Parte desse funcionamento existe por histórico do produto e por acoplamento técnico no Worker/D1.

### Escopo futuro aprovado do LM Premium 3.0
O núcleo futuro aprovado do Premium inclui somente:
- anamnese;
- plano alimentar;
- feedback semanal;
- gestão de pendências;
- Prontuário LM;
- Evolução do Acompanhamento;
- Workspace do profissional;
- Workspace do aluno.

### Fora do novo núcleo
- Plano semanal existe no Portal atual, mas não faz parte do novo núcleo Premium 3.0.
- Progressão de carga/progressão operacional é funcionalidade de conveniência fora do core e candidata à descontinuação.
- Follow-up não deve existir como módulo independente no Premium 3.0; ações relevantes devem ser representadas por pendências, condutas e Evolução do Acompanhamento.
- MFit continua sendo a fonte oficial dos treinos; o Portal não substitui o MFit.

## Princípio operacional
A Consultoria LM Premium é um serviço personalizado. O software deve apoiar o processo de Lucas, organizar informação e reduzir perda operacional. A decisão clínica, a prescrição nutricional, a interpretação do contexto do aluno, a conduta e o acompanhamento continuam sendo responsabilidades humanas do profissional.

## Fluxo operacional atual do Portal
```text
Novo aluno
  ↓
Criar/liberar acesso
  ↓
Enviar anamnese
  ↓
Aluno responde anamnese
  ↓
Lucas analisa informações
  ↓
Lucas cria plano alimentar
  ↓
Aluno acessa portal e executa orientações
  ↓
Aluno envia check-ins/feedbacks e, quando usa, registros de progressão
  ↓
Sistema organiza dados, histórico, alertas e telas admin
  ↓
Lucas analisa feedbacks e histórico
  ↓
Lucas responde, ajusta plano, registra conduta ou resolve pendência
  ↓
Consultoria continua em ciclos
```

## Fluxo futuro aprovado do Premium 3.0
```text
Novo aluno Premium
  ↓
Plataforma LM autentica e direciona
  ↓
Workspace do aluno apresenta anamnese
  ↓
Aluno responde anamnese
  ↓
Workspace do profissional organiza Prontuário LM
  ↓
Lucas analisa e define conduta
  ↓
Lucas registra plano alimentar
  ↓
Aluno executa o plano e usa MFit para treinos
  ↓
Aluno envia feedback semanal
  ↓
Sistema organiza pendências e Evolução do Acompanhamento
  ↓
Lucas analisa, registra conduta e atualiza plano quando necessário
  ↓
Consultoria continua
```

## Papéis no Premium 3.0

### Sistema
Responsável por organizar o processo:
- autenticar e direcionar o aluno por meio da Plataforma LM;
- receber e estruturar anamnese;
- armazenar plano alimentar definido por Lucas;
- receber feedback semanal;
- organizar pendências, condutas e Evolução do Acompanhamento;
- estruturar o Prontuário LM;
- oferecer Workspace do profissional e Workspace do aluno;
- preservar a fronteira com Projeto LM e MFit.

O sistema não é responsável por:
- diagnosticar;
- prescrever por conta própria;
- substituir julgamento clínico;
- substituir contato humano;
- manter follow-up como módulo independente;
- transformar plano semanal em núcleo do Premium 3.0;
- substituir o MFit como fonte oficial de treinos.

### Lucas / profissional
Responsável por conduzir a consultoria:
- analisar anamnese, histórico e feedback semanal;
- decidir estratégia nutricional e conduta;
- criar e atualizar plano alimentar;
- avaliar pendências e resoluções;
- registrar evolução do acompanhamento;
- interpretar riscos, adesão, contexto e necessidades do aluno;
- usar MFit como fonte oficial para treinos.

### Aluno
Responsável por executar e informar:
- acessar o produto correto após login;
- responder anamnese;
- consultar plano alimentar e orientações;
- executar o combinado fora do sistema;
- enviar feedback semanal;
- responder pendências quando aplicável;
- acessar MFit para treinos.

## Fluxo operacional detalhado

### 1. Entrada de novo aluno
**Estado atual:** `student_access` concentra email, token, plano/produto e status. O login atual redireciona o aluno conforme o plano registrado.

**Escopo Premium 3.0:** a Plataforma LM é responsável somente por login, autenticação, controle de acesso e direcionamento ao produto correto. A operação Premium começa depois do direcionamento ao Workspace correto.

**Responsável principal:** Lucas/admin para criação/liberação; Plataforma LM para autenticação/direcionamento.

**Entradas:** dados básicos do aluno, email, plano/produto, status inicial e necessidade de acesso.

**Saídas:** aluno autenticado e direcionado ao produto correto.

**Decisões humanas:** confirmar que o aluno pertence à Consultoria Premium e quando liberar acesso.

**Decisões automáticas:** validação técnica de login/token e direcionamento por produto.

### 2. Anamnese
**Estado atual:** `anamnese-premium.html` envia respostas para `premium_anamnesis`; admin lê e altera status por telas administrativas.

**Escopo Premium 3.0:** anamnese é parte do core e deve alimentar o Prontuário LM e as decisões humanas de Lucas.

**Responsável principal:** aluno preenche; Lucas analisa.

**Entradas:** respostas de anamnese.

**Saídas:** anamnese registrada e disponível no Prontuário LM/Workspace do profissional.

**Decisões humanas:** interpretação da anamnese e conduta.

**Decisões automáticas:** persistência, organização e disponibilização no contexto do aluno.

### 3. Plano alimentar
**Estado atual:** o Portal possui telas e rotas de plano alimentar admin/aluno baseadas em `nutrition_plans`.

**Escopo Premium 3.0:** plano alimentar é núcleo aprovado. O sistema registra e apresenta o plano; Lucas segue responsável por prescrever e alterar.

**Responsável principal:** Lucas.

**Entradas:** anamnese, feedbacks, contexto clínico, histórico, objetivo e decisão profissional.

**Saídas:** plano alimentar visível ao aluno e registrado no Prontuário/Evolução quando aplicável.

**Decisões humanas:** prescrição, ajustes e manutenção de estratégia.

**Decisões automáticas:** salvar, recuperar e exibir o plano autorizado.

### 4. Plano semanal existente
**Estado atual:** o Portal atual possui `weekly_plans` e telas de plano semanal.

**Escopo Premium 3.0:** plano semanal não faz parte do novo núcleo. Qualquer informação semanal relevante deve ser avaliada como feedback semanal, pendência, conduta ou Evolução do Acompanhamento, sem assumir o módulo atual como core futuro.

**Decisão deste documento:** documentar a diferença; não remover, renomear ou migrar nada neste Build.

### 5. Execução pelo aluno
**Estado atual:** o aluno consulta informações no Portal, executa fora do sistema e pode acessar MFit por link externo.

**Escopo Premium 3.0:** o Workspace do aluno deve apoiar execução do plano alimentar e envio de feedback semanal. Treinos continuam no MFit.

**Responsável principal:** aluno.

**Entradas:** plano alimentar, orientações de Lucas e treinos no MFit.

**Saídas:** execução prática e feedback semanal.

**Decisões humanas:** adesão, comunicação e ajustes combinados entre aluno e profissional.

**Decisões automáticas:** disponibilidade de informações e registro de feedback.

### 6. Feedback semanal
**Estado atual:** existem check-ins e históricos em `student_checkins`; a nomenclatura atual não é necessariamente o modelo final do Premium 3.0.

**Escopo Premium 3.0:** feedback semanal é núcleo aprovado. Deve servir como insumo para Lucas analisar evolução, pendências, condutas e necessidade de ajuste.

**Responsável principal:** aluno envia; Lucas interpreta.

**Entradas:** relato do aluno sobre execução, dificuldades, adesão e evolução percebida.

**Saídas:** feedback disponível no Workspace do profissional e na Evolução do Acompanhamento.

**Decisões humanas:** análise, resposta, conduta, ajuste ou manutenção de estratégia.

**Decisões automáticas:** armazenamento, organização e vinculação ao Prontuário/Evolução.

### 7. Progressão/progressão de carga existente
**Estado atual:** existem telas/rotas de progressão no Portal atual.

**Escopo Premium 3.0:** progressão de carga é funcionalidade de conveniência fora do core e candidata à descontinuação. Quando algum dado de evolução for relevante, ele deve ser tratado como parte da Evolução do Acompanhamento, não como núcleo independente.

**Decisão deste documento:** classificar como fora do core; não remover nem alterar comportamento neste Build.

### 8. Follow-up existente
**Estado atual:** existem telas, rotas e tabelas relacionadas a follow-up, retenção e alertas.

**Escopo Premium 3.0:** follow-up não deve existir como módulo independente. Ações relevantes devem ser representadas por pendências, condutas e Evolução do Acompanhamento.

**Decisão deste documento:** classificar o follow-up atual como legado/operacional a ser reinterpretado no desenho futuro, sem remoção neste Build.

### 9. Gestão de pendências, Prontuário LM e Evolução do Acompanhamento
**Estado atual:** parte das informações já existe distribuída entre Student 360, timeline, check-ins, progressões, planos, logs e alertas.

**Escopo Premium 3.0:** esses conceitos são centrais:
- **Gestão de pendências:** organiza o que exige ação, resposta, conduta ou resolução.
- **Prontuário LM:** consolida contexto do aluno, anamnese, plano, histórico e registros relevantes.
- **Evolução do Acompanhamento:** registra a trajetória da consultoria, feedbacks, condutas e mudanças relevantes.

**Decisão deste documento:** reconhecer que o sistema atual contém insumos distribuídos, mas o escopo futuro aprovado exige uma organização conceitual mais clara.

## Responsabilidades por etapa
| Etapa | Estado atual do Portal | Escopo futuro aprovado | Lucas/profissional | Aluno |
|---|---|---|---|---|
| Acesso | `student_access`, login e redirecionamento | Plataforma LM: login, auth, acesso e direcionamento | Libera acesso | Usa credenciais |
| Anamnese | Formulário e admin de anamneses | Core Premium 3.0 | Analisa e interpreta | Preenche |
| Plano alimentar | Admin/aluno via `nutrition_plans` | Core Premium 3.0 | Prescreve e atualiza | Consulta e executa |
| Plano semanal | Existe em `weekly_plans` | Fora do novo núcleo | Pode usar informação apenas se fizer sentido | Consulta enquanto existir |
| Check-in/feedback | `student_checkins` | Feedback semanal core | Analisa e responde | Envia feedback |
| Progressão | Existe como conveniência | Fora do core/candidata à descontinuação | Interpreta se relevante | Registra se existir |
| Follow-up | Módulo/telas existentes | Não deve ser módulo independente | Age por pendências/condutas | Responde quando acionado |
| Pendências | Distribuídas em alertas/logs/status | Core Premium 3.0 | Decide/resoluciona | Responde/resolve |
| Prontuário LM | Parcial em Student 360 | Core Premium 3.0 | Usa para decisão | Não administra |
| Evolução do Acompanhamento | Parcial em timeline/históricos | Core Premium 3.0 | Registra conduta | Fornece feedback |
| Treino | Link externo MFit | MFit externo | Usa MFit como fonte oficial | Acessa MFit |

## Decisões humanas versus automáticas

### Decisões humanas
- O que prescrever.
- Quando alterar plano alimentar.
- Como interpretar anamnese e feedback semanal.
- Qual conduta registrar.
- Qual pendência criar, priorizar ou resolver.
- Como conduzir estratégia nutricional e acompanhamento.

### Decisões automáticas atuais ou futuras permitidas
- Validar acesso por email/token ou mecanismo aprovado.
- Direcionar aluno conforme produto.
- Salvar formulários e registros.
- Carregar plano alimentar e históricos.
- Organizar Prontuário LM, pendências e Evolução do Acompanhamento.
- Exibir informações operacionais sem tomar decisão clínica.

## Conflitos ou pontos a não decidir neste documento
- O sistema atual compartilha `student_access` entre Premium e Projeto LM; isso é estado atual, não desenho final obrigatório.
- Rotas Projeto LM sob `/api/portal/project-lm/*` existem; este documento não decide remoção nem renomeação.
- Plano semanal existe hoje, mas não pertence ao novo núcleo Premium 3.0.
- Progressão de carga/progressão operacional existe hoje, mas é conveniência fora do core e candidata à descontinuação.
- Follow-up existe hoje, mas não deve permanecer como módulo independente no Premium 3.0.
- O Portal não deve assumir treino Premium; o MFit continua boundary externa.
