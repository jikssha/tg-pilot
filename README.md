<div align="center">

# 🚀 TG-Pilot

**次世代的 Telegram 自动化多账号管理面板**

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker Pulls](https://img.shields.io/docker/pulls/jikssha/tg-pilot)](https://github.com/jikssha/tg-pilot/pkgs/container/tg-pilot)
[![Docker Image Size](https://img.shields.io/docker/image-size/jikssha/tg-pilot/latest)](https://github.com/jikssha/tg-pilot/pkgs/container/tg-pilot)

[English Documentation](README_EN.md) · [反馈问题](https://github.com/jikssha/tg-pilot/issues)

</div>

---

**TG-Pilot** 是一款专为高效与稳定性打造的 Telegram 自动化管理面板。通过极简现代的 Web 界面，你可以轻松管理多个 Telegram 账号，配置自动化签到任务，并让所有繁杂的交互操作在后台 24 小时全自动运行。

项目深度集成了 **AI 视觉与运算模型**，使得在复杂的阻断或验证场景下依旧如履平地。非常适合部署在 VPS 上作为自动化引擎。

## ✨ 核心特性

- **🎮 多账号矩阵管理**：支持单面板统一管理无限个 Telegram 会话账号，随时查看状态。
- **⚙️ 全能动作序列**：原生支持「发送文本 / 点击按钮 / 发送特定骰子表情 / AI 智能识图 / AI 计算解密」。
- **📱 隐匿设备伪装**：底层通信自带官方设备指纹伪装（如 MacBook / iPhone），抹除脚本执行痕迹，极大降低矩阵号风控风险。
- **🧠 原生 AI 驱动**：遇到验证码、计算题？配置好 API 即可让大模型在任务流中全自动帮你解决。
- **📊 沉浸式日志追踪**：任务执行流水线追踪，实时截取机器人最后回复，失败与成功一目了然。
- **🛡️ 极致维稳架构**：严格的并发控制、原生应对 `429 Too Many Requests` 与超时熔断，告别内存泄漏与僵尸进程。
- **📦 现代化容器部署**：提供高定制化的 Docker 镜像，只需一行命令即可跨平台开箱即用。

## 🚀 极速部署 (Docker Compose)

我们强烈建议使用 Docker Compose 进行一键部署，只需 3 分钟即可拥有属于你的自动化控制台。

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

```bash
docker compose up -d
```

启动完成后，打开浏览器访问：`http://服务器IP:9987`

🎉 **默认初始凭据**：
- 默认账号：`admin`
- 默认密码：`admin123` *(请在登录后或通过环境变量及时修改)*

---

## 🔄 如何升级到最新版？

当你需要更新到最新内核时，只需进入配置目录，拉取最新镜像并重启即可**无损光速升级**：

```bash
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

## 📝 近期更新

### V0.2.x 核心重构与优化
- **新增 👻 官方设备隐匿伪装**：彻底重构底层 Pyrogram 连接，对每个登入账号全自动固定伪装为随机的苹果/微软官方设备，消灭脚本特征指纹，保护小号矩阵安全。
- **新增 🚀 一键代理测试连通性**：在面板增减账号时，无需盲猜代理是否生效，直接可一键直连检验。
- **优化 💻 环境默认值大改版**：默认全面采用 `TG_SESSION_MODE=string` 和 `TG_SESSION_NO_UPDATES=1`，单账号内存消耗骤降 60%，彻底消灭因磁盘 I/O 带来的 `database is locked` 死结问题。

## 📂 项目架构

项目采用前后端分离的主流现代技术栈：

- **Frontend**: Next.js 14, React, Tailwind CSS, Phosphor Icons
- **Backend**: FastAPI, Uvicorn, SQLite
- **Core Engine**: Pyrogram / Kurigram (Telegram 协议), APScheduler, OpenAI SDK

## 🛡️ 数据与安全申明

默认情况下，所有的 Telegram 账号信息、登录会话 (`.session`)、定时任务以及私密配置均储存在你挂载的 `./data` 本地目录中。TG-Pilot 不会向任何未授权的第三方外部服务器回传敏感数据。

---

<div align="center">

**由 [jikssha](https://github.com/jikssha) 精心打造**

[提交 Issue](https://github.com/jikssha/tg-pilot/issues) · [Pull Requests](https://github.com/jikssha/tg-pilot/pulls)

</div>
