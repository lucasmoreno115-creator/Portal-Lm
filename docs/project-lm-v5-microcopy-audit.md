# V5-13B — Guided Microcopy QA Pass

## Escopo

Auditoria textual da Jornada Projeto LM V5 em execução real, cobrindo hero, resumo da jornada, Etapa 1, Plano B, vitórias, recuperação, manutenção, estados vazios, carregamento, erro, conclusão, bloqueio, CTAs, mensagens auxiliares, subtítulos e formulários.

Este PR não altera backend, contratos, rotas, APIs, banco, autenticação, Premium ou Admin. As mudanças são restritas a copy de frontend, labels de view model já existentes e documentação.

## Critérios utilizados

1. O usuário deve entender onde está, o que fazer e por que fazer em menos de 3 segundos.
2. Cada CTA deve indicar o que acontece depois do clique.
3. Estados vazios devem responder: “O que o usuário deve fazer agora?”.
4. Erros visíveis ao usuário não devem expor códigos internos.
5. Preferir frases menores, mais concretas e menos emocionais.
6. Evitar repetição excessiva de “direção”, “continuar” e “dias difíceis” na mesma superfície.
7. Manter contratos e rotas intactos.

## Problemas encontrados

| Área | Copy anterior | Problema | Ajuste aplicado |
| --- | --- | --- | --- |
| Hero/resumo | “Você não precisa começar de novo. Precisa continuar...” | Repetia a mensagem emocional e ocupava espaço mobile. | Substituída por orientação direta: ver o próximo passo e avançar hoje. |
| CTA principal | “CONTINUAR MINHA JORNADA” | Genérico; não indicava o resultado do clique. | Alterado para “VER MEU PRÓXIMO PASSO”. |
| Formulários | “Salvar” | CTA genérico em todas as etapas. | CTAs específicos por formulário: definir ações, criar Plano B, registrar vitória, salvar protocolos e definir meta. |
| Etapa 1 | “MISSÃO DA SEMANA / Pare de Recomeçar” | Tom de missão e repetição emocional; podia parecer gamificado. | Alterado para “Ações mínimas da semana”. |
| Plano B | “Dias Difíceis” em título, subtítulo e mensagens | Repetição excessiva e menos acionável. | Reduzido para “Plano B” com instrução sobre plano ideal não caber. |
| Vitórias | “Registre momentos em que você escolheu continuar” | Abstrato; não explica o que registrar. | Ajustado para “Registre uma escolha concreta que mostrou progresso”. |
| Recuperação | “Voltar para a Direção” | Repetia “direção” e soava mais slogan que tarefa. | Alterado para “Recuperação” com foco em retomar sem improviso. |
| Manutenção | “Sua Evolução” | Pouco específico para ação atual. | Alterado para “Manutenção” e meta simples. |
| Estados vazios | “Você ainda não...” | Indicavam ausência, mas nem sempre o próximo passo. | Estados vazios agora orientam a ação imediata. |
| Estado de erro | Mensagem genérica e form feedback com erro bruto | Risco de expor erro técnico ou backend message sem próximo passo. | Adicionado mapeamento humano para timeout, rede, contrato inválido e operações em andamento. |
| Loading | “Preparando sua direção...” | Mais longo e repetia direção/continuar. | Reduzido para “Preparando seu próximo passo.” |

## Mudanças realizadas

- Redução de frases emocionais repetidas nas superfícies principais.
- CTAs de formulário passaram a explicar a ação real.
- Estados vazios foram reescritos para indicar o próximo passo.
- Mensagens de erro visíveis foram humanizadas para os códigos `PROJECT_LM_V5_NETWORK_ERROR`, `PROJECT_LM_V5_REQUEST_TIMEOUT`, `PROJECT_LM_V5_INVALID_CONTRACT`, `PROJECT_LM_V5_SAVE_IN_PROGRESS` e `PROJECT_LM_V5_LOAD_IN_PROGRESS`.
- Labels, subtítulos e mensagens do view model foram encurtados sem mudar chaves, ações ou contratos.
- Screen contracts mantiveram rotas e mapeamentos oficiais, com apenas ajustes textuais.

## Mudanças recusadas

- Não foram criadas novas telas, rotas ou componentes.
- Não foram alteradas regras de progressão.
- Não foram alterados payloads, nomes de campos, endpoints ou códigos internos.
- Não foram alterados fluxos Premium, Admin ou autenticação.
- Não foi removido o retorno técnico `code` do state layer porque ele é útil para telemetria e testes; apenas a mensagem visível ao usuário foi humanizada.
- Não foi adicionada nova camada de i18n para evitar mudança estrutural fora do escopo.

## Checklist de clareza

- [x] Hero explica a ação principal sem excesso de texto.
- [x] CTA principal responde o que acontece no clique.
- [x] Cada formulário tem CTA específico.
- [x] Estados vazios indicam o que fazer agora.
- [x] Estados bloqueados direcionam o usuário de volta ao passo atual.
- [x] Estados concluídos indicam revisão ou retorno ao resumo.
- [x] Erros visíveis não expõem códigos internos.
- [x] Loading e saving são curtos e humanos.
- [x] Repetições de “direção”, “continuar” e “dias difíceis” foram reduzidas.
- [x] Contratos, rotas e APIs permaneceram intactos.

## Riscos restantes

- A auditoria é textual e estática; validação com usuários reais pode revelar termos mais claros para públicos específicos.
- Algumas mensagens técnicas continuam existindo no state layer para diagnóstico e telemetria, embora não sejam exibidas como copy principal.
- O copy aprovado em versões anteriores pode exigir alinhamento editorial se houver guia de tom externo não presente no repositório.

## Próximo PR recomendado

V5-14 — Validação assistida de microcopy em sessão real: observar usuários navegando a jornada em mobile, medir dúvidas por etapa e ajustar apenas textos que ainda causem hesitação.
