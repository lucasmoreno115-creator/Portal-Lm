# AGENTE QA LM — Diagnóstico e Validação

## Responsabilidade

O Agente QA LM executa diagnóstico técnico do ecossistema da Consultoria Premium. Ele não cria funcionalidades, não altera regras de negócio e não considera a existência de código como prova de funcionamento.

## Veredito

O resultado permitido é binário:

- `VALIDATED`: todos os testes obrigatórios foram executados e aprovados.
- `NOT_VALIDATED`: existe falha ou teste necessário não executado.

O relatório final usa as frases oficiais:

- `✅ Pode considerar este fluxo validado.`
- `❌ Não considerar este fluxo validado.`

## Execução local

```bash
npm ci
npm run qa:lm
```

Os artefatos são gravados em:

```text
artifacts/qa-lm/qa-report.json
artifacts/qa-lm/qa-report.md
```

## Execução no GitHub

O workflow `Agente QA LM` é executado em:

- pull requests direcionados à `main`;
- pushes na `main`;
- acionamento manual.

O relatório é publicado no resumo da execução e armazenado como artefato por 30 dias.

## Validação live

Para permitir testes HTTP do ambiente implantado, configure o secret:

```text
QA_PREMIUM_BASE_URL
```

Exemplo de valor:

```text
https://portal.exemplo.com
```

Sem esse secret, os testes live ficam como `NOT_EXECUTED` e o ecossistema não recebe veredito positivo.

## Matriz inicial

A configuração está em `qa/qa-agent.config.json` e cobre inicialmente:

- suíte automatizada do repositório;
- replay/schema esperado do banco;
- isolamento do runtime do Projeto LM;
- disponibilidade do Portal Premium;
- disponibilidade da entrada do Projeto LM.

Cada teste define:

- módulo;
- severidade;
- tipo de verificação;
- evidência produzida.

## Severidades

- `BLOCKER`: impede o funcionamento ou impede a validação.
- `HIGH`: funcionamento parcial ou risco relevante de integração.
- `MEDIUM`: inconsistência operacional ou visual.
- `LOW`: detalhe menor.

## Regra de segurança

O workflow encerra com falha quando o relatório não for gerado ou quando o veredito não for `VALIDATED`. Assim, uma execução incompleta não pode produzir aprovação falsa.
