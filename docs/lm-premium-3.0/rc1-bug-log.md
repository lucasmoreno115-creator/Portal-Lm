# Release 3.0.0 — Bug log

> Release 3.0.0: este documento é mantido como histórico da RC1 e referência operacional para a release oficial.


## Bugs encontrados na PR #270
1. Auditoria CLI aceitava ausência de dados e retornava sucesso.
2. Snapshot não tinha contrato obrigatório nem diferenciação entre tabela ausente e tabela vazia.
3. Smoke era apenas inventário de contratos, não executor HTTP real.
4. Verify aceitava objetos vazios como evidência suficiente.
5. E2E era baseado em objetos/SQL simplificado, não em migrations, repositories e casos de uso reais.
6. Readiness report afirmava prontidão acima da evidência disponível.

## Correções
- Auditoria agora exige `--snapshot`, valida estrutura e usa exit codes `0/1/2`.
- Smoke HTTP real implementado com dry-run explícito, fetch, timeout e payload mínimo.
- Verify exige evidências reais e falha sem snapshot/schema/smoke/flags.
- E2E local usa SQLite temporário com migrations reais até `0033`, repositories, casos de uso, read models e presenters de produção.
- Documentação separa implementado, executado localmente, pendente de staging e produção.

## Migration corretiva
Nenhuma migration corretiva foi criada.
