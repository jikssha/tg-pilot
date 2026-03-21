<div align="center">

# 🚀 TG-Pilot

**Telegram 多账号自动化批量签到任务管理面板**

[![Version](https://img.shields.io/badge/version-v3.7.5-purple.svg)](https://github.com/jikssha/tg-pilot)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker Pulls](https://img.shields.io/docker/pulls/jikssha/tg-pilot)](https://github.com/jikssha/tg-pilot/pkgs/container/tg-pilot)
[![Docker Image Size](https://img.shields.io/docker/image-size/jikssha/tg-pilot/latest)](https://github.com/jikssha/tg-pilot/pkgs/container/tg-pilot)

[英文 / English](README_EN.md) · [更新日志 / CHANGELOG](CHANGELOG.md) · [架构说明 / Architecture](docs/architecture.md) · [轻量化 ADR](docs/adr/0001-lightweight-product-line.md) · [反馈问题](https://github.com/jikssha/tg-pilot/issues)

</div>

---

**TG-Pilot** 是一款专为高效与稳定性打造的 Telegram 多账号自动化批量签到任务管理面板。通过全新重构的 Linear 风格极简暗黑 Web 界面，你可以轻松管理多个 Telegram 账号，配置自动化签到任务，并让所有繁杂的交互操作在后台 24 小时全自动运行。`v3.7.5` 在 `v3.7` 的运维总览、审计追踪与预检式迁移恢复基础上，继续补齐了旧版本升级兼容、前端单入口交互、每日执行计划/重试/截止补偿，以及“今日执行概览”面板，让任务是否执行到、是否正在补偿、是否已经过期都能被直接看见。


## ✨ 核心特性

- **🎮 多账号矩阵管理**：支持单面板统一管理无限个 Telegram 会话账号，随时查看状态。
- **💎 极简 Linear 审美 (v3.5-v3.7.5)**：全新重构的 Pure Dark 风格控制台。v3.6 优化了 **设置页面 UI**，v3.6.1 补齐了工程基线与交付护栏，v3.7 引入运维与审计视角，v3.7.5 则继续把单入口工作台、任务反馈与运维面板打磨到可长期运维的状态。
- **⚙️ 全能动作序列**：原生支持「发送文本 / 点击按钮 / 发送特定骰子表情 / AI 智能识图 / AI 计算解密」。
- **📱 隐匿设备伪装**：底层通信自带官方设备指纹伪装（如 MacBook / iPhone），抹除脚本执行痕迹。
- **📈 实时任务雷达**：集成化任务卡片，支持一键执行、历史日志筛选（仅看失败）、快捷配置复制。
- **🧠 原生 AI 驱动**：遇到验证码、计算题？配置好 API 即可让大模型在任务流中全自动帮你解决。
- **⚡ 会话物理同步 (v3.5)**：新增高能“会话迁移终端”，一键导出全量 ZIP 凭证。
- **🚀 矩阵批量分发 (v3.5)**：支持多账号一键同步拉齐任务序列。
- **🌏 深度语言本地化 (v3.6)**：控制面板全模块（AI、备份、账号、API等）及其提示语完整中文化，术语更通俗。
- **🛡️ 运维审计中台 (v3.7-v3.7.5)**：设置面板现已整合 **系统运维概览**、**审计事件追踪** 与 **今日执行概览**，可集中查看服务就绪检查、调度器任务、账号状态分布、签到运行摘要、daily run 执行状态与关键管理动作。
- **🧪 预检式迁移恢复与热修复升级 (v3.7-v3.7.5)**：会话包与全量配置包在导入前先展示 manifest、文件清单、冲突数量与可导入数量，并且旧库升级到 `v3.7.x` 时已补齐 Alembic 空表/旧表结构兼容，不再要求删库重建。
- **📅 每日执行计划 MVP (v3.7.5)**：新增 `daily_task_runs` 账本、分散式随机排程、daily dispatcher、失败重试与当日截止补偿，为“每天至少执行到一次”提供可观察、可补偿的最小闭环。
- **📦 现代化容器部署**：提供高定制化的 Docker 镜像，只需一行命令即可跨平台开箱即用。


我们提供了两种主流的 Docker 部署方式。请确保你的环境已安装 [Docker](https://docs.docker.com/engine/install/)。

### 方法一：Docker Compose (推荐)

### 1. 准备环境

请确保你的服务器已安装 [Docker](https://docs.docker.com/engine/install/) 和 [Docker Compose](https://docs.docker.com/compose/install/)。

```bash
# 创建并进入项目目录
mkdir -p tg-pilot/data && cd tg-pilot
```

### 2. 生成配置文件

直接在终端执行以下命令生成标准配置文件：

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
      - APP_SECRET_KEY=your_secret_key # ⚠️ 强烈建议修改为复杂的随机字符串
      - TG_SESSION_MODE=string         # 推荐: 纯内存模式，减轻磁盘读写开销
      - TG_SESSION_NO_UPDATES=1        # 推荐: 拒收不相关的群组消息流，大幅降低内存占用
EOF
```

### 3. 一键启动

启动完成后，打开浏览器访问：`http://服务器IP:9987`
### 方法二：Docker Run

运行以下命令（请根据需要修改 `APP_SECRET_KEY`）：

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

🎉 **默认初始凭据**：
- 默认账号：`admin`
- 默认密码：`admin123` *(请在登录后或通过环境变量及时修改)*

---

## 🔄 如何更新？

```bash
cd tg-pilot
docker compose pull
docker compose up -d
```

## 🛠️ 进阶配置与环境变量

为了满足不同场景的极致需求，TG-Pilot 开放了丰富的环境变量设置。你可以在 `docker-compose.yml` 的 `environment` 节点下进行补充：

| 变量名 | 描述 | 默认值 / 建议 |
|---|---|---|
| `APP_SECRET_KEY` | 面板 JWT 签名密钥 | **必填** (务必修改) |
| `ADMIN_PASSWORD` | 管理员初始密码 | `admin123` |
| `APP_DATA_DIR` | 核心数据与会话存储路径 | 面板自动配置 或 `/data` |
| `TG_SESSION_MODE` | TG 会话储存驱动 (`file` 或 `string`) | 推荐 `string`，将大幅降低磁盘使用 |
| `TG_SESSION_NO_UPDATES` | 是否拒收群组新消息通信 | 推荐设为 `1`，将极大降低内存占用 |
| `TG_GLOBAL_CONCURRENCY` | 任务全局并发请求数限制 |默认 `1` |
| `APP_TOTP_VALID_WINDOW` | 2FA 双重验证的时间容错窗口 | - |

*(详细反代说明：如果你使用 Nginx，建议将端口映射改为 `- "127.0.0.1:9987:9987"`，阻断外部直连，提升安全性。)*

## 📜 更新日志

详细的版本演进记录请参阅：[CHANGELOG.md](CHANGELOG.md)

## 📂 项目架构

项目采用前后端分离的主流现代技术栈：

- **Frontend**: Next.js 14, React, Tailwind CSS, Phosphor Icons
- **Backend**: FastAPI, Uvicorn, SQLite
- **Core Engine**: Pyrogram / Kurigram (Telegram 协议), APScheduler, OpenAI SDK

当前产品主线与兼容策略如下：

- **产品入口**：`frontend + backend`
- **执行内核与 CLI 兼容层**：`tg_signer`
- **Legacy 入口**：`tg_signer/webui` 仅保留兼容，不再继续扩展

更多约束与阶段门禁请参阅：

- [架构说明](docs/architecture.md)
- [轻量化 ADR](docs/adr/0001-lightweight-product-line.md)
- [阶段门禁](docs/stage-gates.md)

## 🛡️ 数据与安全申明

默认情况下，所有的 Telegram 账号信息、登录会话 (`.session`)、定时任务以及私密配置均储存在你挂载的 `./data` 本地目录中。TG-Pilot 不会向任何未授权的第三方外部服务器回传敏感数据。

---

<div align="center">

**由 [jikssha](https://github.com/jikssha) 精心打造**

[提交 Issue](https://github.com/jikssha/tg-pilot/issues) · [Pull Requests](https://github.com/jikssha/tg-pilot/pulls)

</div>
