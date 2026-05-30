#!/usr/bin/env bash
set -euo pipefail

full=0
if [[ "${1:-}" == "--full" ]]; then
  full=1
fi

postgres_container="pas-local-ci-postgres"
postgres_port="${POSTGRES_PORT:-55432}"
compose_env=".env.local-ci"

cleanup() {
  docker rm -f "${postgres_container}" >/dev/null 2>&1 || true
  if [[ "${full}" == "1" ]]; then
    docker compose --env-file "${compose_env}" -f infra/docker/docker-compose.yml down >/dev/null 2>&1 || true
  fi
  rm -f "${compose_env}"
}
trap cleanup EXIT

run() {
  printf '\n==> %s\n' "$*"
  "$@"
}

run pnpm lint
run pnpm typecheck
run pnpm test:unit

docker rm -f "${postgres_container}" >/dev/null 2>&1 || true
run docker run -d --rm \
  --name "${postgres_container}" \
  -e POSTGRES_DB=agent_suite_test \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p "${postgres_port}:5432" \
  pgvector/pgvector:pg16

for _ in $(seq 1 30); do
  if docker exec "${postgres_container}" pg_isready -U postgres -d agent_suite_test >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

run env \
  INTERNAL_API_SECRET=test-secret \
  POSTGRES_HOST=127.0.0.1 \
  POSTGRES_PORT="${postgres_port}" \
  POSTGRES_DB=agent_suite_test \
  POSTGRES_USER=postgres \
  POSTGRES_PASSWORD=postgres \
  pnpm test:integration

run cp .env.example "${compose_env}"
run bash -c "docker compose --env-file '${compose_env}' -f infra/docker/docker-compose.yml config >/tmp/personal-agent-suite-compose.yaml"

if [[ "${full}" != "1" ]]; then
  printf '\nLocal CI passed. Run `pnpm ci:local:full` before declaring a commit ready when Docker stack time is acceptable.\n'
  exit 0
fi

run pnpm exec playwright install chromium
run docker compose --env-file "${compose_env}" -f infra/docker/docker-compose.yml build web api orchestrator
run docker compose --env-file "${compose_env}" -f infra/docker/docker-compose.yml up -d --remove-orphans

for _ in $(seq 1 60); do
  if curl -fsS http://localhost/health/live >/dev/null; then
    break
  fi
  sleep 2
done

run curl -fsS http://localhost/health/live
run curl -fsS http://localhost/health/ready
run curl -fsS -H "x-internal-api-secret: change-me-in-real-environments" http://localhost/api/status

anonymous_status="$(curl -ks -o /dev/null -w "%{http_code}" https://localhost/api/status)"
if [[ "${anonymous_status}" != "401" ]]; then
  printf 'Expected anonymous /api/status to return 401, got %s\n' "${anonymous_status}" >&2
  exit 1
fi

run curl -fsS -X POST -H "x-internal-api-secret: change-me-in-real-environments" http://localhost/api/smoke/temporal
run pnpm test:e2e
run bash -c "curl -ksSf https://localhost/ | grep -q 'Personal Agent Suite'"

printf '\nFull local CI passed.\n'
