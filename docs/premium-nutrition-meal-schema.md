# Schema de refeições do plano alimentar Premium

`nutrition_plans.meals_json` permanece o contrato canônico persistido. A evolução **v2** é aditiva e não requer migration de banco.

## Refeição textual v2

```json
{
  "id": "meal-1",
  "name": "Almoço",
  "time": "12:00",
  "guidance": "Preferir comida preparada em casa.",
  "primary_text": "100 g de arroz\n100 g de feijão\n150 g de frango",
  "substitutions": [{ "id": "swap-1", "text": "150 g de batata\n150 g de carne moída" }],
  "items": []
}
```

`primary_text` e cada `substitutions[].text` são texto puro multilinha; as quebras de linha são persistidas e apresentadas com `white-space: pre-wrap` no Portal.

## Compatibilidade v1

Refeições estruturadas existentes (`items` com `food`, `quantity`, `unit`, notas e substituições) continuam válidas. O normalizador canônico preserva esses objetos durante leitura e escrita, e o Workspace os mantém como dados legados ao salvar um rascunho textual. Não há conversão, limpeza ou exclusão automática.

A validação de publicação exige `primary_text` para uma refeição textual nova. Uma refeição v1 com itens estruturados continua publicável para preservar versões e planos já migrados. Rascunhos seguem aceitando conteúdo incompleto.
