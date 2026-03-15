# TG-Pilot

[中文说明](README.md)

TG-Pilot is a Telegram automation panel. It helps you manage multiple accounts, run auto check-in tasks, and monitor execution logs from a web UI.

> AI-powered: AI actions (vision/math) are integrated and can be used directly in task workflows.

## What Is This Project For?

- Manage multiple Telegram accounts in one place
- Automate check-ins, message sending, and button clicking
- Use AI actions for image recognition and math challenges
- View execution flow logs and recent bot replies
- Run reliably on a VPS for long-term automation

## Key Features

- Multi-account management
- Action sequences: `Send Text`, `Click Text Button`, `Send Dice`, `AI Vision`, `AI Calculate`
- Visual logs with task-level details
- Stability improvements for timeout/429 scenarios and long-running memory behavior
- Docker-first deployment (easy to start and migrate)

## Quick Deployment (Recommended)

1. Install Docker and Docker Compose
2. Create directory:
   ```bash
   mkdir -p tg-pilot/data && cd tg-pilot
   ```
3. Run the following command to generate the `docker-compose.yml` config file directly:
   ```yaml
   cat << 'EOF' > docker-compose.yml
   services:
     app:
       image: ghcr.io/jikssha/tg-pilot:latest
       container_name: tg-pilot
       restart: unless-stopped
       ports:
         - "9987:8080"
       volumes:
         - ./data:/data
       environment:
         - TZ=Asia/Shanghai
         - APP_SECRET_KEY=your_secret_key # Strongly recommended to change this
   EOF
   ```
4. Start the container:
   ```bash
   docker compose up -d
   ```
5. Open `http://YOUR_SERVER_IP:9987` in a browser and log in.

Default credentials:
- Username: `admin`
- Password: `admin123`

## How To Update

When a new version is built, simply run these two commands within your `tg-pilot` directory to update seamlessly:

```bash
docker compose pull
docker compose up -d
```

### One-command Deploy (Optional)

If you prefer not to use Docker Compose, you can run the container directly:

```bash
docker run -d \
  --name tg-pilot \
  --restart unless-stopped \
  -p 9987:8080 \
  -v $(pwd)/data:/data \
  -e TZ=Asia/Shanghai \
  -e APP_SECRET_KEY=your_secret_key \
  ghcr.io/jikssha/tg-pilot:latest
```

If you use a reverse proxy like Nginx, bind locally only: `-p 127.0.0.1:9987:8080`

## Data Directory & Permissions

- Default data directory: `/data`
- If `/data` is not writable, app falls back to `/tmp/TG-Pilot` (non-persistent)
- New images can auto-adapt runtime UID/GID to `/data` owner in most VPS setups (usually no need for `chmod 777`)

Container checks:

```bash
id
ls -ld /data
touch /data/.probe && rm /data/.probe
```

## Common Environment Variables

- `APP_SECRET_KEY`: panel secret key (strongly recommended)
- `ADMIN_PASSWORD`: initial default password for the admin user (strongly recommended, otherwise defaults to insecure 'admin123')
- `APP_HOST`: API listening interface (defaults to `127.0.0.1` for security; use `0.0.0.0` if exposing container globally)
- `APP_DATA_DIR`: custom data directory (higher priority than panel setting)
- `TG_SESSION_MODE`: `file` (default) or `string` (recommended on arm64)
- `TG_SESSION_NO_UPDATES`: set `1` to enable `no_updates` (`string` mode only)
- `TG_GLOBAL_CONCURRENCY`: global concurrency limit (default `1`)
- `APP_TOTP_VALID_WINDOW`: panel 2FA tolerance window

## Custom Data Directory

You can set the data directory in two ways:

1. Panel: `System Settings -> Global Sign-in Settings -> Data Directory`
2. Env var: `APP_DATA_DIR=/your/path`

Notes:
- Restart backend service after changing it
- The path must be writable and mounted as persistent volume

## Health Checks

- `GET /healthz`: quick health endpoint
- `GET /readyz`: readiness endpoint

## Project Structure

```text
backend/      FastAPI backend and scheduler
tg_signer/    Telegram automation core
frontend/     Next.js management panel
```

## Changelog

### 2026-03-12
- Core stability fix: Fixed a severe memory leak and high network I/O issue caused by Pyrogram timeout & `FloodWait` infinite retry loops leading to async lock starvation and unretrieved task exceptions.

### 2026-03-06

- Action sequence order optimized: `Send Text -> Click Text Button -> Send Dice -> AI Vision -> AI Calculate`.
- AI actions refined: `AI Vision` and `AI Calculate` now support inline sub-modes (send text / click button).
- Task copy/paste UX improved:
  - Copy now opens a config dialog with one-click copy.
  - Top-right paste import tries clipboard first; falls back to manual paste dialog when unavailable.
- Task log dialog improved: now shows `Task: XXX succeeded/failed` and the latest bot reply.
- Dashboard status checks improved on page open/refresh to reduce false "Check Failed".
- Mobile/layout polish: task card action area is more compact, action-row control heights are unified.
- UTF-8 export fix: resolved task copy/export errors with emoji content.
- Container permission compatibility improved with `/data` owner UID/GID adaptation.

### 2026-03-01

- AI action upgrade, AI config save fix, and phone code login changed to manual confirmation.
- Reduced frequent `TimeoutError` and `429 transport flood` logs.
- Long-running stability and memory optimizations.
- Added custom data directory support.

## Tech Stack

FastAPI, Uvicorn, APScheduler, Pyrogram/Kurigram, Next.js, Tailwind CSS, OpenAI SDK.
