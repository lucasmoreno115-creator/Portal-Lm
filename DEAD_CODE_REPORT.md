# Dead Code Report (não removido)

## Worker
- Em `workers/api.js`, funções renomeadas para `__deprecated_nullableTrimmed`, `__deprecated_safeJsonParse`, `__deprecated_getWeekRef`, `__deprecated_inferRiskLevelFromOutcome` permanecem no arquivo e não são mais utilizadas diretamente após consolidação.
- Potenciais constantes com baixa utilização devem ser confirmadas com cobertura de teste e telemetria antes de remoção.

## Frontend
- Não foram removidos scripts/trechos no frontend neste ciclo.
- Recomenda-se varredura posterior por funções sem referência cruzando templates HTML e handlers inline.
