# Release 3.0.0 — Revisão de segurança

> Release 3.0.0: este documento é mantido como histórico da RC1 e referência operacional para a release oficial.


## Evidência real local
- Smoke HTTP implementado não imprime tokens e redige chaves sensíveis na saída JSON.
- Auditoria e verify não modificam dados.
- Testes verificam payload público sem `token`, senha, sessão, `private_notes`, draft ou metadata operacional.
- Revisão estática confirma uso de queries parametrizadas nos repositories Premium existentes.

## Evidência simulada
- Smoke autenticado foi exercido com HTTP mockado/local nos testes, cobrindo 401, 403, 404, 409, 500, timeout e payload inválido.

## Pendente de staging
- Executar smoke contra URL real de staging com tokens rotacionáveis.
- Validar logs reais sem dados sensíveis.
- Validar headers/sessões reais de admin e aluno.

## Achados
| Severidade | Achado | Status |
|---|---|---|
| Medium | Smoke real de staging ainda pendente. | Warning |
| Medium | Backup/restore real ainda pendente. | Warning |
| Low | Auditoria usa snapshot JSON; export D1 precisa produzir contrato documentado. | Warning |
| Informational | Não houve Build 7, IA, automação ou envio automático. | OK |

Critical e High bloqueiam RC1; nenhum foi identificado localmente.
