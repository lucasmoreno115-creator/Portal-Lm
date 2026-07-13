# LM Premium 3.0 — 03 Domain Boundaries

## Objetivo
Este documento define fronteiras de domínio separando o estado atual do Portal do escopo futuro aprovado do LM Premium 3.0. Quando há conflito entre o sistema atual e o desenho aprovado, o conflito é documentado e não resolvido neste Build.

## Regra de leitura
- **Estado atual** descreve o que existe hoje no Portal.
- **Escopo futuro aprovado** descreve o que deve orientar o LM Premium 3.0.
- Este documento não autoriza remoções, migrations, refactors ou mudanças de API.

---

## PLATAFORMA LM

### Estado atual
A Plataforma/Portal ainda mistura entrada de aluno, redirecionamento por plano, páginas públicas, Premium, Projeto LM e infraestrutura compartilhada.

### Escopo futuro aprovado
A Plataforma LM é responsável somente por:
- login;
- autenticação;
- controle de acesso;
- direcionamento ao produto correto.

### Nunca responsável por
- Executar consultoria Premium.
- Conter Prontuário LM, plano alimentar, feedback semanal, pendências ou Evolução do Acompanhamento.
- Conter jornada do Projeto LM como se fosse Premium.
- Prescrever, diagnosticar ou interpretar dados clínicos.
- Substituir MFit.

---

## CONSULTORIA PREMIUM

### Estado atual
O Premium atual usa portal do aluno, páginas admin, plano alimentar, plano semanal, check-ins, progressão, follow-up, alertas, timeline, anamnese e Student 360. Esses elementos existem hoje, mas nem todos pertencem ao núcleo futuro.

### Escopo futuro aprovado
A Consultoria Premium é responsável por:
- anamnese;
- plano alimentar;
- feedback semanal;
- gestão de pendências;
- Prontuário LM;
- Evolução do Acompanhamento;
- Workspace do profissional;
- Workspace do aluno.

### Nunca responsável por
- Automatizar prescrição clínica/nutricional sem decisão do profissional.
- Executar o processo no lugar do aluno.
- Manter plano semanal como núcleo do Premium 3.0.
- Manter follow-up como módulo independente.
- Tratar progressão de carga como core.
- Ser fonte oficial de treino.
- Incorporar o modelo de treino do Projeto LM como treino Premium.
- Usar MFit como se fosse módulo interno do Portal.

### Reclassificações aprovadas
| Estado atual | Classificação para Premium 3.0 |
|---|---|
| Check-ins | Feedback semanal |
| Student 360 | Prontuário LM |
| Timeline/históricos relevantes | Evolução do Acompanhamento |
| Alertas, logs acionáveis e retenção | Gestão de pendências e condutas |
| Follow-up independente | Não deve permanecer como módulo independente |
| Plano semanal | Fora do novo núcleo |
| Progressão de carga/progressão operacional | Conveniência fora do core/candidata à descontinuação |

---

## PROJETO LM

### Estado atual
O Projeto LM possui superfícies próprias, runtime público e rotas/tabelas `project_lm_*` e `lm2_*`. Também há rotas históricas em namespace `/api/portal/project-lm/*`.

### Escopo futuro aprovado
O Projeto LM é responsável por:
- produto automatizado para pessoas que desejam iniciar ou recomeçar o emagrecimento;
- jornada automatizada;
- onboarding, missões, ações diárias, biblioteca, semanas e check-ins próprios;
- rotas, tabelas e runtime próprios do Projeto LM.

### Nunca responsável por
- Representar consultoria personalizada.
- Criar plano alimentar Premium individualizado.
- Ler ou alterar dados Premium fora de contrato explícito.
- Usar Workspace do profissional ou Prontuário LM como parte da jornada automatizada.
- Definir treino oficial da Consultoria Premium.

---

## MFIT

### Estado atual
O Portal Premium aponta para MFit por link externo; não há evidência de que o Portal substitua a operação de treino do MFit no Premium.

### Escopo futuro aprovado
MFit é responsável por:
- ser a fonte oficial dos treinos da Consultoria Premium;
- hospedar/organizar a experiência de treino quando o aluno precisa acessar treinos;
- permanecer como domínio externo de treino.

### Nunca responsável por
- Gerenciar anamnese, plano alimentar, feedback semanal, pendências, Prontuário LM ou Evolução do Acompanhamento.
- Substituir Workspace do profissional ou Workspace do aluno.
- Ser tratado como tabela, módulo ou Worker interno do Portal LM.

---

## Fluxos compartilhados permitidos
- Plataforma LM autentica e direciona para Premium ou Projeto LM.
- Infraestrutura compartilhada atual pode continuar existindo até separação futura segura, desde que não redefina fronteiras de produto.
- Observabilidade compartilhada por área é permitida se não expõe dados sensíveis nem mistura decisões de produto.
- Link externo para MFit é permitido como direcionamento, não como substituição.

## Fluxos proibidos
- Plataforma LM assumir responsabilidades do núcleo Premium além de autenticação/acesso/direcionamento.
- Premium consumir jornada do Projeto LM como substituto de consultoria.
- Projeto LM gravar ou alterar plano alimentar Premium.
- Premium assumir dados de treino `training_*` como treino oficial.
- MFit ser substituído por telas de treino do Portal Premium.
- Follow-up permanecer como domínio independente do Premium 3.0.
- Plano semanal ser tratado como core do Premium 3.0.
- Progressão de carga ser tratada como core do Premium 3.0.

## Dependências permitidas
- `student_access` como camada de compatibilidade atual para login/produto, até decisão futura.
- Link externo para MFit.
- Serviços de observabilidade, logs e saúde, desde que preservem separação por área.
- Reuso temporário de infraestrutura estática/Worker enquanto não houver separação segura.

## Dependências proibidas
- Dependência funcional do Premium em engines do Projeto LM.
- Dependência do Premium em tabelas `lm2_*` ou `project_lm_*`.
- Dependência do Projeto LM em telas do Workspace profissional Premium.
- Dependência do Premium em tabelas `training_*` para substituir MFit.
- Uso de rotas `/api/portal/project-lm/*` como padrão futuro sem decisão explícita.

## Conflitos entre estado atual e escopo aprovado
| Conflito | Estado atual | Escopo futuro aprovado | Decisão neste Build |
|---|---|---|---|
| Plataforma ampla demais | Portal mistura entrada, produtos e operações | Plataforma LM só faz login, auth, acesso e direcionamento | Documentar apenas |
| Login compartilhado | `portal-login.html` redireciona conforme `student_access.plan` | Permitido como compatibilidade, mas pertence à Plataforma LM | Não alterar |
| Worker compartilhado | Premium, Admin e Projeto LM no mesmo `workers/api.js` | Fronteiras conceituais claras antes de separação física | Documentar risco |
| Namespace misto | Rotas Projeto LM sob `/api/portal/project-lm/*` | Projeto LM fora do namespace Premium | Não renomear agora |
| Plano semanal | Existe como tela/tabela | Não faz parte do novo núcleo | Não remover; classificar fora do core |
| Progressão | Existe como tela/rota | Conveniência fora do core/candidata à descontinuação | Não remover; classificar |
| Follow-up | Existe como módulo/telas | Deve virar pendências, condutas e Evolução | Não remover; reclassificar |
| Treinos | Projeto LM tem `training_*`; Premium aponta para MFit | MFit segue fonte oficial | Documentar boundary |
