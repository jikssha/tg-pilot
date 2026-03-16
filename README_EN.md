<div align="center">

# 🚀 TG-Pilot

**The Next-Generation Telegram Automation & Account Manager**

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker Pulls](https://img.shields.io/docker/pulls/jikssha/tg-pilot)](https://github.com/jikssha/tg-pilot/pkgs/container/tg-pilot)
[![Docker Image Size](https://img.shields.io/docker/image-size/jikssha/tg-pilot/latest)](https://github.com/jikssha/tg-pilot/pkgs/container/tg-pilot)

[中文文档](README.md) · [Report Bug](https://github.com/jikssha/tg-pilot/issues)

</div>

---

**TG-Pilot** is a robust and beautifully designed automation control panel for Telegram. It allows you to manage multiple Telegram accounts, effortlessly schedule automated daily tasks, and monitor active workflows through an elegant Next.js web interface.

Built with **native AI integration (Vision & Computation)**, TG-Pilot handles complex interactions like captcha-solving and dynamic calculation challenges with ease, making it the perfect engine for your 24/7 VPS deployments.

## ✨ Key Features

- **🎮 Multi-Account Fleet Management**: Consolidate and monitor unlimited Telegram sessions through a single dashboard.
- **⚙️ Versatile Action Sequences**: Natively supports `Send Text`, `Click Inline Button`, `Send Dice Emoji`, `AI Vision Recognition`, and `AI Calculation`.
- **📱 Hidden Device Fingerprinting**: Auto-spoofs official devices (MacBook, iOS, Windows) upon connect to minimize script detection risk.
- **🧠 Native AI-Driven**: Encountering CAPTCHAs or math puzzles? Configure the LLM API to easily bypass these barriers entirely on autopilot.
- **📊 Immersive Audit Logs**: Track execution pipelines step-by-step, capture final bot replies in real-time, and distinguish successes from failures instantly.
- **🛡️ Rock-Solid Architecture**: Built with strict concurrency limits and built-in protections against `429 Too Many Requests` timeouts. Say goodbye to zombie processes and memory leaks.
- **📦 Modern Containerization**: Deploy effortlessly with a highly customizable, ready-to-run Docker image. 

## 🚀 Quick Start (Docker Compose)

Deploy TG-Pilot in just 3 minutes with Docker Compose (Highly Recommended).

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

```bash
docker compose up -d
```

Once started, navigate to `http://YOUR_SERVER_IP:9987` in your browser.

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

## 📝 Recent Updates

### V0.2.x Core Polish
- **Added 👻 Native Device Spoofing**: Fully overhauled pyrogram instantiation process. Every running account now randomly (but consistently) poses as an official Apple/Microsoft client OS rather than `Pyrogram`. Massive boost for your fleet safety.
- **Added 🚀 1-Click Proxy Test**: Integrated proxy direct connection testers into the dashboard. No more guessing.
- **Optimized 💻 Next-Gen Defaults**: `TG_SESSION_MODE=string` and `TG_SESSION_NO_UPDATES=1` are now deeply integrated as core container defaults. Expect a 60% memory footprint drop and zero SQL `database is locked` deadlocks.

## 📂 Architecture Stack

Designed with a modern decoupled approach:

- **Frontend**: Next.js 14, React, Tailwind CSS, Phosphor Icons
- **Backend**: FastAPI, Uvicorn, SQLite
- **Core Engine**: Pyrogram / Kurigram (Telegram Protocol), APScheduler, OpenAI SDK

## 🛡️ Privacy & Security

By default, all sensitive information—including Telegram session files (`.session`), account details, task configurations, and private keys—are strictly stored in your local mounted `./data` directory. TG-Pilot will **never** transmit any unapproved data to unauthorized third-party servers.

---

<div align="center">

**Crafted with 💡 by [jikssha](https://github.com/jikssha)**

[Submit Issue](https://github.com/jikssha/tg-pilot/issues) · [Pull Requests](https://github.com/jikssha/tg-pilot/pulls)

</div>
