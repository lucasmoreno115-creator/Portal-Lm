# Workspace UX Audit Report — Sprint W3.2.5 / PR P1

**Data da auditoria:** 23 de julho de 2026  
**Escopo:** somente o Workspace Premium e suas superfícies diretamente acionadas pelo profissional: login, dashboard, lista/busca/cadastro, prontuário, liberação e cópia de acesso, feedbacks, estados vazios, loading e erro.  
**Método:** revisão estática do HTML, CSS, JavaScript e contratos/documentação do repositório; inspeção dos fluxos e dos estados de interface implementados. Não foram alterados arquivos de produção, regras de negócio ou dados. Não houve validação em ambiente autenticado com dados reais; portanto, as constatações de comportamento são baseadas no código e precisam de confirmação em teste assistido antes de qualquer correção.

## Resumo executivo

O Workspace Premium tem uma base operacional sólida: sessão administrativa centralizada, listas com estados vazios, cartões de operação, busca instantânea, carregamento de prontuário e boa adoção de APIs do DOM que evitam interpolação insegura. A hierarquia geral do dashboard e da lista também é coerente dentro da própria tela.

Os atritos mais relevantes estão nas **transições entre superfícies** e na **inconsistência entre Workspace, Prontuário e Feedbacks**. O profissional alterna entre dois modelos de prontuário (resumo embutido e página dedicada), encontra ações potencialmente duplicadas para liberar acesso e precisa usar uma tela de feedback visualmente e tecnicamente desconectada. Há ainda riscos reais de acessibilidade por foco/scroll e de operação por mensagens de sucesso tratadas como erro.

**Veredito de auditoria:** `NOT_VALIDATED`. O fluxo foi revisado por leitura estática, mas não foi possível executar todos os cenários autenticados e de falha com dados representativos. **❌ Não considerar este fluxo validado.**

## Fluxos auditados

| Fluxo | Superfície/artefato revisado | Cobertura |
|---|---|---|
| Login e sessão | `admin-login.html`, `admin-auth.js` | formulário, retorno, mensagem de erro e redirecionamento |
| Dashboard e navegação | Workspace | cartões, âncoras, atualizar, sair e scroll programático |
| Lista, busca e cadastro | Workspace | carregamento, paginação, busca local, vazio e criação |
| Prontuário | resumo embutido + página dedicada | abertura, pendências, anamnese, plano, evolução e estados de falha |
| Liberação e cópia de acesso | Workspace + prontuário | confirmação, feedback e atualização posterior |
| Feedbacks | página de revisão semanal | lista, detalhe, decisão, vazios e erros |
| Loading, erros e responsividade | todas as superfícies acima | esqueletos, mensagens e estilos de foco/movimento |

## Pontos positivos

- A sessão usa um módulo único de autenticação, remove tokens legados, valida retorno interno e limpa a sessão expirada antes de redirecionar ao login.
- Os cartões operacionais expõem rótulos, descrição e estado ocupado para leitores de tela; a lista de alunos também tem rótulo, busca associada e botão de limpar busca nomeado.
- A lista apresenta estados vazios acionáveis, destaca o termo pesquisado usando nós de texto/`mark` e mantém o foco no campo após limpar a busca.
- O prontuário dedicado usa `textContent`, `createElement` e `replaceChildren` para dados dinâmicos; a anamnese longa é progressivamente revelada por `details`.
- Há suporte parcial a redução de movimento no skeleton do dashboard e nas transições da lista, e o dashboard respeita a preferência ao navegar para seus painéis.

## Problemas encontrados

| ID | Descrição | Categoria | Severidade | Impacto | Esforço | Recomendação |
|---|---|---|---|---|---|---|
| WUX-01 | O card **Check-ins em aberto** aparece como métrica, mas é indisponível e comunica “Lista ainda não definida”. Ele ocupa o mesmo nível de destaque das ações operacionais sem permitir ação. | UX | Média | Gera expectativa sem caminho de resolução e reduz a confiança no dashboard. | Pequeno | Ocultar a métrica até existir ação/lista, ou apresentá-la como aviso de produto fora do grupo de CTAs. |
| WUX-02 | Dashboard, lista e prontuário convivem na mesma página longa; cartões e navegação disparam scroll suave. O retorno do prontuário apenas o oculta e não restaura foco ou posição do aluno de origem. | Operação | Alta | O profissional perde contexto e percorre trechos repetidos para alternar entre alunos. | Médio | Definir uma única estratégia: rota dedicada para prontuário ou painel lateral; ao voltar, restaurar foco e posição no card acionador. |
| WUX-03 | Há dois prontuários: “Ver resumo” embutido no Workspace e “Abrir Prontuário” em página dedicada. O resumo embutido tem ações próprias, mas não mostra pendências/evolução completas. | Arquitetura | Alta | Duplica modelo mental, manutenção e caminhos de ação; decisões podem ser feitas no contexto incompleto. | Grande | Eleger o Prontuário dedicado como fonte de interação e limitar o Workspace a resumo + CTA único, ou formalizar o painel embutido como painel lateral completo. |
| WUX-04 | A liberação existe em caminhos diferentes: próxima ação do resumo, mudança de status e “Liberar planejamento” no prontuário. Os textos falam ora em acesso ao aluno, ora em Portal, ora em planejamento. | Operação | Alta | Risco de executar ação errada ou não entender o pré-requisito entre plano publicado, status e acesso. | Médio | Consolidar em uma ação primária com pré-condições, consequência e status final explícitos; manter ações secundárias apenas quando semanticamente distintas. |
| WUX-05 | Sucesso de “Copiar acesso” e de ações de estado é enviado ao painel global com classe `error`; além disso, a cópia depende de Clipboard API e não informa fallback quando indisponível. | UX | Alta | Mensagem visualmente alarmante após sucesso e possível falha silenciosa ao copiar acesso. | Pequeno | Separar toast/alerta de sucesso, erro e aviso; confirmar a cópia somente após sucesso e oferecer seleção/cópia manual como fallback. |
| WUX-06 | O formulário de cadastro não informa estado de envio, não desabilita submit e só atualiza a lista; o aluno recém-criado não é aberto, nem há CTA de “Copiar acesso” no resultado. | Operação | Média | Duplicação por duplo clique e etapas adicionais para concluir o onboarding. | Pequeno | Aplicar estado ocupado, bloquear reenvio, anunciar resultado e oferecer CTA direto para prontuário/cópia de acesso. |
| WUX-07 | A busca é somente local em até 25 itens carregados, embora a documentação do Workspace descreva busca de domínio por nome, e-mail e telefone com endpoint próprio. A UI anuncia “Nome ou e-mail” e não busca telefone. | Operação | Alta | Profissional pode concluir incorretamente que um aluno não existe quando estiver fora da primeira página. | Médio | Usar busca remota com debounce, paginação/resultado total e texto de escopo; suportar os campos previstos no contrato. |
| WUX-08 | “Carregar mais” é ocultado durante a busca. Como a busca local cobre somente itens já carregados, não há como ampliar o conjunto sem apagar o termo. | UX | Média | Interrompe a pesquisa e obriga repetição de passos. | Pequeno | Paginar os resultados da busca remota; como contingência, manter “carregar mais” com texto que explique a ampliação local. |
| WUX-09 | O Workspace usa foco programático após abrir prontuário, mas sempre faz scroll suave, inclusive com `prefers-reduced-motion`; navegação para alunos e visão geral também ignora essa preferência. | Acessibilidade | Média | Pode causar desconforto vestibular e deslocamento inesperado em navegação por teclado/leitor de tela. | Pequeno | Centralizar utilitário de navegação que respeite redução de movimento e só mova foco após mudança de contexto confirmada. |
| WUX-10 | No prontuário dedicado, falhas ao resolver pendência e ao registrar evolução não são capturadas localmente; podem resultar em rejeição não tratada e botão permanentemente desabilitado. O estado de carregamento é somente texto. | UX | Alta | Ações críticas podem parecer concluídas ou ficar bloqueadas sem recuperação clara. | Médio | Padronizar estados `loading/success/error`, reabilitar controles em `finally`, mostrar retry e manter foco no erro. |
| WUX-11 | O formulário “Novo registro profissional” usa placeholder como único rótulo e expõe códigos internos (`PROFESSIONAL_NOTE`, `PROFESSIONAL_DECISION`) ao profissional. | Acessibilidade | Média | Campo perde nome persistente e linguagem técnica eleva erro de preenchimento. | Pequeno | Adicionar `label` visível, ajuda contextual e rótulos humanos para os tipos; preservar os valores técnicos somente no contrato. |
| WUX-12 | A página de Feedbacks usa UI clara genérica, sem autenticação administrativa carregada, sem navegação/saída e sem o sistema visual escuro dos demais fluxos. Itens de lista são clicáveis mas não são botões, e o detalhe é JSON bruto em `pre`. | UI | Alta | Fluxo parece outro produto, prejudica teclado, leitura e decisão profissional. | Médio | Integrar autenticação/navegação compartilhadas, usar botões semânticos e apresentar campos do feedback em estrutura legível com estado selecionado. |
| WUX-13 | O botão “Registrar decisão” não fica desabilitado sem feedback selecionado; o clique simplesmente não faz nada. Ao salvar, não bloqueia duplo envio nem limpa/fecha o detalhe de forma explícita. | Operação | Média | Tentativas sem efeito e possibilidade de decisão duplicada. | Pequeno | Desabilitar até haver seleção, indicar aluno/semana selecionados, aplicar estado ocupado e atualizar a seleção após sucesso. |
| WUX-14 | Estilos e componentes divergem: Workspace usa painéis escuros, botões contornados e radius 18px; Prontuário usa CTA dourado preenchido/radius 24px; Feedbacks usa fundo claro e controles básicos. | UI | Média | As quatro superfícies não parecem parte de um produto único. | Médio | Criar tokens compartilhados de cor, tipografia, espaçamento, foco e componentes de botão/painel para as superfícies Premium. |
| WUX-15 | O CSS e JS de Workspace/Prontuário existem duplicados entre raiz de `public/` e `public/assets/`; o HTML servido usa `assets`, mas há cópias paralelas. | Arquitetura | Média | Risco de correção aplicada ao arquivo não servido e de regressão por divergência futura. | Médio | Manter uma fonte canônica e gerar/copyar artefatos via build com verificação de paridade, ou remover cópias não referenciadas. |
| WUX-16 | A lista re-renderiza todos os cards e recria Maps/referências a cada caractere de busca; após ações, dispara recarga simultânea de prontuário, lista e resumo. Não há cancelamento de requests ou estado de loading para lista/atualizar. | Performance | Baixa | Em bases maiores pode causar custo desnecessário, conteúdo intermitente e respostas fora de ordem. | Médio | Debounce/cancelamento com `AbortController`, renderização incremental e estados ocupados por região; medir antes/depois com dados representativos. |

## Classificação por severidade

### Crítica

Nenhum item crítico identificado na revisão estática. Isso não substitui teste autenticado de liberação de acesso e de decisão de feedback.

### Alta

- **WUX-02:** contexto perdido na alternância de prontuário.
- **WUX-03:** dois modelos concorrentes de prontuário.
- **WUX-04:** ambiguidade nas ações de liberação.
- **WUX-05:** sucesso tratado como erro e cópia sem fallback.
- **WUX-07:** busca incompleta para a base de alunos.
- **WUX-10:** falhas sem recuperação em ações do prontuário.
- **WUX-12:** Feedbacks desconectado visual e semanticamente.

### Média

- **WUX-01, WUX-06, WUX-08, WUX-09, WUX-11, WUX-13, WUX-14 e WUX-15.**

### Baixa

- **WUX-16.**

## Quick Wins — baixo esforço / alto impacto

1. **WUX-05:** separar feedback de sucesso/erro e disponibilizar fallback para cópia de acesso.
2. **WUX-06:** adicionar estado ocupado ao cadastro e CTA de continuação para prontuário/cópia.
3. **WUX-09:** respeitar `prefers-reduced-motion` em todo scroll programático e restaurar foco no retorno.
4. **WUX-11:** rotular o registro profissional e trocar códigos internos por linguagem humana.
5. **WUX-13:** desabilitar decisão sem feedback selecionado e impedir duplo envio.
6. **WUX-01:** tirar a métrica indisponível da hierarquia de CTAs até que tenha destino útil.

## Melhorias futuras — fora do escopo desta PR

- Sessão de teste moderado com profissionais usando dados mascarados para medir tempo, erros e compreensão de “liberar acesso”.
- Instrumentação de funil por ação: pesquisa sem resultado, abertura de prontuário, cópia de acesso, liberação, decisão e erro de API.
- Revisão de contraste com ferramenta automatizada e leitor de tela em Chrome/Firefox/Safari, incluindo zoom 200% e navegação somente por teclado.
- Definição de design system Premium compartilhado e consolidação dos artefatos estáticos duplicados.
- Medição de performance com lista grande, rede lenta e requests concorrentes antes de otimizações.

## Recomendação de priorização

1. **P0 — segurança operacional:** WUX-04, WUX-05 e WUX-10. Padronizar semântica/feedback de ações irreversíveis ou sensíveis e garantir recuperação de falha.
2. **P1 — fluxo principal:** WUX-02, WUX-03 e WUX-07. Escolher a superfície principal de prontuário e tornar busca confiável para a base completa.
3. **P2 — coerência e acessibilidade:** WUX-09, WUX-11, WUX-12, WUX-13 e WUX-14.
4. **P3 — sustentabilidade:** WUX-15 e WUX-16, após estabelecer a arquitetura e medir desempenho.

## Evidências técnicas consultadas

- O Workspace declara dashboard, painel de cadastro, busca e prontuário embutido; os cartões de check-ins em aberto são indisponíveis por marcação estrutural.
- A implementação de Workspace confirma busca local sobre `state.students`, página de 25 itens, mensagens globais e scroll/foco programáticos.
- O Prontuário dedicado concentra pendências, plano, anamnese, feedbacks e evolução, mas usa confirmações/alertas nativos e possui caminhos sem tratamento de erro local.
- A tela de Feedbacks é uma implementação isolada com lista clicável, JSON em `pre` e chamadas autenticadas apenas por `credentials: 'include'`.
- A documentação de produto prevê busca remota e filtros mais amplos que os expostos no Workspace atual.

## Critério de aceite da auditoria

- [x] Todos os fluxos do Workspace Premium indicados no escopo foram revisados por código e documentação.
- [x] Cada problema possui ID, categoria, severidade, impacto, esforço e recomendação.
- [x] Há Quick Wins priorizados por baixo esforço e alto impacto.
- [x] Nenhum arquivo de produção foi alterado; este relatório é o único artefato adicionado.
- [ ] Validação interativa autenticada concluída com dados representativos — pendente de ambiente e credenciais de QA.
