# Deployment

## Prerequisites

- Linux VM with Docker Engine and Docker Compose plugin
- DNS record pointing your domain at the VM
- ports `80` and `443` open

## Initial setup

1. Copy `.env.example` to `.env`.
2. Set `PUBLIC_BASE_URL` to your domain name.
3. Set `INTERNAL_API_SECRET`, `AUTH_SECRET`, and `AUTH_LOCAL_PASSWORD` to explicit strong secrets.
4. Set `AUTH_LOCAL_USERNAME` and `AUTH_LOCAL_EMAIL` for the local owner account.
5. Add OAuth client IDs and secrets only for providers you want to enable. OAuth users must match `AUTH_OWNER_EMAILS` or `AUTH_OWNER_USERNAMES`.
6. Run `pnpm compose:up`.

## Stack entrypoints

- `/` -> personal-agent control-plane dashboard
- `/api/status` -> API status payload
- `/health/live` -> API liveness
- `/health/ready` -> API readiness
- `/temporal` -> Temporal UI, basic auth protected
- `/grafana` -> Grafana, basic auth protected

## Operational commands

- Start: `pnpm compose:up`
- Stop: `pnpm compose:down`
- Logs: `pnpm compose:logs`
- Restart one service: `docker compose --env-file .env -f infra/docker/docker-compose.yml restart <service>`

## Persistence and backup targets

Persisted Docker volumes:

- `postgres_data`
- `redis_data`
- `minio_data`
- `grafana_data`
- `prometheus_data`
- `loki_data`
- `tempo_data`
- `caddy_data`

Back up at minimum:

- Postgres volume or logical dumps
- MinIO object storage data
- Grafana state if dashboards are modified in-place
- Caddy data for certificates during migration scenarios

## Verification

1. `docker compose --env-file .env -f infra/docker/docker-compose.yml ps`
2. open `https://<your-domain>/`
3. confirm dependency badges are green
4. `curl https://<your-domain>/health/ready`
5. `curl -X POST https://<your-domain>/api/smoke/temporal`
