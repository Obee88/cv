# Deploying to vps.codes.hr — Guide for Managed Projects

This document is for agents (or developers) working on a project that will be deployed and managed by the VPS deploy-manager at `vps.codes.hr`. Read it before writing any Dockerfile, CI workflow, or infrastructure code.

---

## How the platform works

The VPS runs a single Docker host on Hetzner with three always-on platform services:

- **Caddy** (via `caddy-docker-proxy`) — the reverse proxy. It auto-routes HTTPS traffic to any container that carries the right labels and is joined to the `codes-vps_edge` network. TLS (Let's Encrypt) is handled automatically; you don't manage certs.
- **Postgres 16** — a shared cluster. Each managed project gets its own dedicated database and role, provisioned automatically by the dashboard when the project is created. You never touch the superuser credentials.
- **Dashboard** at `https://vps.codes.hr` — the control plane. It receives signed webhooks from GitHub Actions, pulls the new image from GHCR, writes a `compose.yml` for your project under `/opt/vps/projects/<slug>/`, and runs `docker compose up -d`. It also manages env vars, secrets, deploy history, rollbacks, and logs.

---

## What your project must provide

### 1. A Docker image published to GHCR

Your image must be built and pushed to GitHub Container Registry on every push to `main`. The image name must follow this convention:

```
ghcr.io/<github-org-or-user>/<project-slug>:<git-sha>
```

Where `<project-slug>` is the short identifier you registered in the dashboard (lowercase, hyphens only). The dashboard rejects any image whose name doesn't start with the configured `imageName` prefix.

A minimal GH Actions workflow for this:

```yaml
# .github/workflows/deploy.yml
name: Build & Deploy

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: ghcr.io/${{ github.repository_owner }}/<project-slug>:${{ github.sha }}

      - name: Notify VPS dashboard
        run: |
          PAYLOAD=$(jq -n \
            --arg image "ghcr.io/${{ github.repository_owner }}/<project-slug>:${{ github.sha }}" \
            --arg sha "${{ github.sha }}" \
            '{ image: $image, sha: $sha }')
          SIG="sha256=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "${{ secrets.WEBHOOK_SECRET }}" | awk '{print $2}')"
          curl -sf -X POST "${{ secrets.WEBHOOK_URL }}" \
            -H "Content-Type: application/json" \
            -H "X-Signature: $SIG" \
            -d "$PAYLOAD"
```

Set two repository secrets in GitHub: `WEBHOOK_URL` and `WEBHOOK_SECRET`. Both are displayed in the dashboard after you register the project. The exact workflow snippet (already filled in with your slug and URL) is also shown in the dashboard's setup checklist.

### 2. A Dockerfile

Write a standard multi-stage Dockerfile. The final stage should run as a non-root user. There are no other constraints on the base image or build approach.

Key requirements:
- The app must listen on a **single TCP port** (you configure this in the dashboard when adding the project).
- If the app has a health endpoint (recommended — `GET /healthz` returning 200 is enough), configure it as the `HEALTHCHECK` in your Dockerfile. The deployer will wait up to 60 seconds for the container to become healthy before marking the deployment successful.

```dockerfile
# Example for a Node.js backend
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
USER app
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --retries=3 CMD wget -qO- http://localhost:3000/healthz || exit 1
CMD ["node", "dist/server.js"]
```

### 3. DNS

Add a CNAME (or A record) for your project's domain pointing at the VPS IP (`vps.codes.hr` resolves to it). The dashboard's setup checklist shows the exact DNS record to create. Caddy picks up the domain automatically via the container labels it writes — you don't write any Caddyfile.

---

## Infrastructure the platform provides

| Resource | What you get | How |
|---|---|---|
| **HTTPS** | Auto-TLS via Let's Encrypt for any domain you register | Done by Caddy — no action needed |
| **PostgreSQL database** | Dedicated DB + role (`app_<slug>`) with a random password | Toggle "Provision database" when creating the project in the dashboard |
| **DATABASE_URL** | Auto-injected into your container's environment | Dashboard writes it to the project's `.env`; treat it as always available |
| **Reverse proxy** | Traffic on 80/443 routed to your container | Done via Caddy labels the dashboard writes — no action needed |
| **Docker networks** | Your container joins `codes-vps_edge` (internet-facing) and `codes-vps_data` (Postgres access) | Done by the dashboard's generated `compose.yml` |

---

## Environment variables and secrets

Manage all env vars in the dashboard under your project's settings page. The dashboard encrypts values you mark as secrets (AES-256-GCM at rest). They are written to a `.env` file alongside your `compose.yml` at deploy time.

**`DATABASE_URL` is always auto-managed** — don't set it manually. It's injected automatically when the database flag is on. Your app should read it from the environment with no defaults; the platform guarantees its presence when the container starts.

For a typical webapp:

```
# Set these in the dashboard, not in your repo
SECRET_KEY=…
SMTP_HOST=…
REDIS_URL=…          # if you bring your own Redis container later
```

Do **not** commit `.env` files or hardcoded secrets to your repo.

---

## For a FE + BE + database webapp

The platform deploys containers, not Compose stacks. Run your frontend and backend as **separate projects** registered in the dashboard, each with its own slug, image, and domain. There is no shared `docker-compose.yml` in your repo for production.

Typical setup:

| Project slug | Domain | Port | DB? |
|---|---|---|---|
| `myapp-api` | `api.myapp.com` | 8080 | ✅ yes |
| `myapp-web` | `myapp.com` | 3000 | ❌ no |

The frontend container calls the backend via its public domain (`https://api.myapp.com`). There is no private inter-container network linking different projects — use public HTTPS between services.

If you ship a single container that serves both FE and BE (e.g. a Next.js app with an API route), that's one project, one slug, and simpler to manage.

---

## Checklist before your first push

- [ ] Dockerfile builds and the image runs locally with `docker run -e DATABASE_URL=… -p <port>:<port> <image>`
- [ ] Health endpoint returns 200 (`/healthz` or similar)
- [ ] `WEBHOOK_URL` and `WEBHOOK_SECRET` set as GitHub repo secrets
- [ ] Project registered in the dashboard (slug, image name, port, domain, DB flag)
- [ ] DNS record created and propagated
- [ ] Push to `main` — watch the deployment row go `pending → running → success` in the dashboard

---

## Limitations (v1)

- **Single host** — no horizontal scaling. The CPX22 (2 vCPU, 4 GB RAM) is the ceiling.
- **One Postgres cluster** — all projects share the same Postgres instance. Schema migrations are your responsibility; the platform provisions the role/DB but does not run migrations for you. Run them at container startup (recommended) or as a one-off task.
- **No inter-project private networking** — services talk to each other over HTTPS, not over a Docker internal network.
- **No built-in object storage** — bring your own (Cloudflare R2, S3, etc.) and inject credentials via the dashboard env vars.
