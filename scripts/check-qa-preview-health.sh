#!/usr/bin/env bash

set -euo pipefail

TARGET_URL="${1:-}"
MAX_TIME="${QA_HEALTH_MAX_TIME:-10}"
CONNECT_TIMEOUT="${QA_HEALTH_CONNECT_TIMEOUT:-5}"
MAX_REDIRECTS="${QA_HEALTH_MAX_REDIRECTS:-10}"

if [[ -z "$TARGET_URL" ]]; then
  echo "A URL do health check não foi informada." >&2
  exit 2
fi

set +e
STATUS=$(curl --silent --show-error --location \
  --proto '=http,https' \
  --output /dev/null \
  --write-out '%{http_code}' \
  --connect-timeout "$CONNECT_TIMEOUT" \
  --max-time "$MAX_TIME" \
  --max-redirs "$MAX_REDIRECTS" \
  "$TARGET_URL")
CURL_EXIT=$?
set -e

if [[ $CURL_EXIT -ne 0 ]]; then
  echo "Health check falhou antes de obter uma resposta final (curl exit $CURL_EXIT)." >&2
  exit 1
fi

if [[ "$STATUS" == "200" ]]; then
  echo "Preview disponível com HTTP final $STATUS."
  exit 0
fi

echo "Health check recebeu HTTP final ${STATUS:-indisponível}." >&2
exit 1
