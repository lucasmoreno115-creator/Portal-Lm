# Configuração Web Push do Portal LM

A infraestrutura de dispositivos lê `VAPID_PUBLIC_KEY` no Worker. Os ambientes também devem reservar `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` para a etapa futura de entrega; eles não são consumidos nesta Sprint.

Configure os três valores como secrets/variáveis do ambiente de deploy, fora do repositório. Somente `VAPID_PUBLIC_KEY` pode sair do Worker, por `GET /api/portal/push/config`. Nunca registre ou devolva `VAPID_PRIVATE_KEY` em respostas, HTML, testes ou logs.
