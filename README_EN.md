<div align="center">
# 🚀 TG-Pilot

**The Next-Generation Telegram Automation & Account Manager**

[![Version](https://img.shields.io/badge/version-v3.6.1-purple.svg)](https://github.com/jikssha/tg-pilot)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker Pulls](https://img.shields.io/docker/pulls/jikssha/tg-pilot)](https://github.com/jikssha/tg-pilot/pkgs/container/tg-pilot)
[![Docker Image Size](https://img.shields.io/docker/image-size/jikssha/tg-pilot/latest)](https://github.com/jikssha/tg-pilot/pkgs/container/tg-pilot)

[中文文档](README.md) · [Changelog](CHANGELOG.md) · [Architecture](docs/architecture.md) · [Lightweight ADR](docs/adr/0001-lightweight-product-line.md) · [Report Bug](https://github.com/jikssha/tg-pilot/issues)

</div>

---

**TG-Pilot** is a robust and beautifully designed automation control panel for Telegram. It allows you to manage multiple Telegram accounts, effortlessly schedule automated daily tasks, and monitor active workflows through a newly refactored, Linear-style pure dark mode web interface.

Built with **native AI integration (Vision & Computation)**, TG-Pilot handles complex interactions like captcha-solving and dynamic calculation challenges with ease, making it the perfect engine for your 24/7 VPS deployments.

## ✨ Key Features

- **🎮 Multi-Account Fleet Management**: Consolidate and monitor unlimited Telegram sessions through a single dashboard.
- **💎 Minimalist Linear Aesthetic (v3.5/v3.6.1)**: Completely refactored Pure Dark console. v3.6 refines the **Settings UI**, while v3.6.1 hardens the engineering baseline for long-term maintenance.
- **⚙️ Versatile Action Sequences**: Natively supports `Text`, `Buttons`, `Dices`, `AI Vision`, and `Math Challenges`.
- **📱 Hidden Device Fingerprinting**: Auto-spoofs official device fingerprints (MacBook/iPhone) to minimize detection.
- **📈 Real-time Task Radar**: Integrated task cards with one-click run, history log filtering (failures only), and config cloning.
- **🧠 Native AI-Driven**: Encountering puzzles? Configure the LLM API to bypass them entirely on autopilot.
- **⚡ Session Clone Engine (v3.5)**: High-performance session migration terminal. Export full ZIP credentials and restore fleet presence on new hardware in seconds.
- **🚀 Bulk Flow Distribution (v3.5)**: Select multiple accounts and push "Task Packages" instantly.
- **🌏 Deep UI Localization (v3.6)**: Full Chinese localization for all configuration modules (AI, Backup, API, Account) with refined hints.
- **📦 Modern Containerization**: Deploy effortlessly with a highly customizable, ready-to-run Docker image.
 


We provide two ways to deploy TG-Pilot. Ensure [Docker](https://docs.docker.com/engine/install/) is installed on your server.

### Option 1: Docker Compose (Recommended)

### 1. Prerequisites

Ensure [Docker](https://docs.docker.com/engine/install/) and [Docker Compose](https://docs.docker.com/compose/install/) are installed on your server.

```bash
# Create and enter the project directory
mkdir -p tg-pilot/data && cd tg-pilot
```

### 2. Generate Configuration

Run the following command to instantly generate the standard configuration file:

```yaml
cat << 'EOF' > docker-compose.yml
services:
  app:
    image: ghcr.io/jikssha/tg-pilot:latest
    container_name: tg-pilot
    restart: unless-stopped
    ports:
      - "9987:9987"
    volumes:
      - ./data:/data
    environment:
      - TZ=Asia/Shanghai
      - APP_SECRET_KEY=your_secret_key # ⚠️ Strongly recommended to change this to a random string!
      - TG_SESSION_MODE=string         # Recommended: In-Memory mode to reduce disk I/O
      - TG_SESSION_NO_UPDATES=1        # Recommended: Drop irrelevent chat messages, saving memory
EOF
```

### 3. Launch

Once started, navigate to `http://YOUR_SERVER_IP:9987` in your browser.

### Option 2: Docker Run (Quick Single Command)

For quick testing, you can use a single `docker run` command (ensure you modify the `APP_SECRET_KEY`):

```bash
docker run -d \
  --name tg-pilot \
  -p 9987:9987 \
  -v $(pwd)/data:/data \
  -e TZ=Asia/Shanghai \
  -e APP_SECRET_KEY=your_secret_key_here \
  -e TG_SESSION_MODE=string \
  -e TG_SESSION_NO_UPDATES=1 \
  --restart unless-stopped \
  ghcr.io/jikssha/tg-pilot:latest
```

🎉 **Default Initial Credentials**:
- Username: `admin`
- Password: `admin123` *(Please change this immediately after logging in or via environment variables)*

---

## 🔄 Seamless Updates

When a new core version is released, simply run these two commands in your configuration directory to upgrade without any data loss:

```bash
docker compose pull
docker compose up -d
```

## 🛠️ Advanced Configuration

To meet various operational demands, TG-Pilot offers extensive environment variables. You can append these under the `environment` section in your `docker-compose.yml`:

| Variable | Description | Recommended / Default |
|---|---|---|
| `APP_SECRET_KEY` | JWT signing key for the panel | **Required** (Must be changed) |
| `ADMIN_PASSWORD` | Initial password for the admin | `admin123` |
| `APP_DATA_DIR` | Directory for core data and sessions | Panel config or `/data` |
| `TG_SESSION_MODE` | Telegram session storage (`file` or `string`) | Recommend `string` to drop I/O spikes |
| `TG_SESSION_NO_UPDATES`| Block unread channel/group updates | Recommend `1` to save memory |
| `TG_GLOBAL_CONCURRENCY`| Global concurrency limit for tasks | Default: `1` |
| `APP_TOTP_VALID_WINDOW`| 2FA tolerance window (seconds) | - |

*(Reverse Proxy Tip: If you are protecting your panel behind Nginx, it is highly recommended to change the port binding to `- "127.0.0.1:9987:9987"` to prevent direct public access.)*

## 📜 Full Changelog

Please refer to [CHANGELOG.md](CHANGELOG.md) for detailed version history.

## 📂 Architecture Stack

Designed with a modern decoupled approach:

- **Frontend**: Next.js 14, React, Tailwind CSS, Phosphor Icons
- **Backend**: FastAPI, Uvicorn, SQLite
- **Core Engine**: Pyrogram / Kurigram (Telegram Protocol), APScheduler, OpenAI SDK

Current product-line boundaries:

- **Product entrypoint**: `frontend + backend`
- **Execution engine and CLI compatibility layer**: `tg_signer`
- **Legacy entrypoint**: `tg_signer/webui`, kept for compatibility only and no longer expanded

See the supporting docs for details:

- [Architecture](docs/architecture.md)
- [Lightweight ADR](docs/adr/0001-lightweight-product-line.md)
- [Stage Gates](docs/stage-gates.md)

## 🛡️ Privacy & Security

By default, all sensitive information—including Telegram session files (`.session`), account details, task configurations, and private keys—are strictly stored in your local mounted `./data` directory. TG-Pilot will **never** transmit any unapproved data to unauthorized third-party servers.

---

<div align="center">

**Crafted with 💡 by [jikssha](https://github.com/jikssha)**

[Submit Issue](https://github.com/jikssha/tg-pilot/issues) · [Pull Requests](https://github.com/jikssha/tg-pilot/pulls)

</div>
