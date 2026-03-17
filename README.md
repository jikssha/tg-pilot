<div align="center">

# 🚀 TG-Pilot

** Telegram 多账号自动化批量签到任务管理面板**

[![Version](https://img.shields.io/badge/version-v3.3-purple.svg)](https://github.com/jikssha/tg-pilot)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker Pulls](https://img.shields.io/docker/pulls/jikssha/tg-pilot)](https://github.com/jikssha/tg-pilot/pkgs/container/tg-pilot)
[![Docker Image Size](https://img.shields.io/docker/image-size/jikssha/tg-pilot/latest)](https://github.com/jikssha/tg-pilot/pkgs/container/tg-pilot)

[English Documentation](README_EN.md) · [反馈问题](https://github.com/jikssha/tg-pilot/issues)

</div>

---

**TG-Pilot** 是一款专为高效与稳定性打造的 Telegram 多账号自动化批量签到任务管理面板。通过全新重构的 Linear 风格极简暗黑 Web 界面，你可以轻松管理多个 Telegram 账号，配置自动化签到任务，并让所有繁杂的交互操作在后台 24 小时全自动运行。

项目深度集成了 **AI 视觉与运算模型**，使得在复杂的阻断或验证场景下依旧如履平地。非常适合部署在 VPS 上作为自动化引擎。

## ✨ 核心特性

- **🎮 多账号矩阵管理**：支持单面板统一管理无限个 Telegram 会话账号，随时查看状态。
- **💎 极简 Linear 审美 (v3.3)**：全新重构的 Pure Dark 风格控制台，不仅好看，更有呼吸感执行反馈与高效交互。
- **⚙️ 全能动作序列**：原生支持「发送文本 / 点击按钮 / 发送特定骰子表情 / AI 智能识图 / AI 计算解密」。
- **📱 隐匿设备伪装**：底层通信自带官方设备指纹伪装（如 MacBook / iPhone），抹除脚本执行痕迹。
- **📈 实时任务雷达**：集成化任务卡片，支持一键执行、历史日志筛选（仅看失败）、快捷配置复制。
- **🧠 原生 AI 驱动**：遇到验证码、计算题？配置好 API 即可让大模型在任务流中全自动帮你解决。
- **🛡️ 极致维稳架构**：严格的并发控制、原生应对 `429 Too Many Requests`，告别内存泄漏与进程僵死。
- **📦 现代化容器部署**：提供高定制化的 Docker 镜像，只需一行命令即可跨平台开箱即用。

## 🚀 一键部署 (Docker Compose)

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

当你需要更新到最新内核时，只需进入配置目录，拉取最新镜像并重启即可：

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

## 📝 近期更新

### V3.3 前端深度交互与品牌视觉优化
- **新增 🔔 每日任务汇总报告**：Bot 通知新增每日定时汇总功能，支持自定义发送时间，全天自动化动态一目了然。
- **集成 🎨 极光绿品牌视觉**：全面启用全新设计的 TG-Pilot 品牌图标与 Favicon，并在控制台右上角深度集成 GitHub 快捷入口，提升专业感。
- **增强 🎇 任务执行沉浸感**：点击“执行”后按钮即刻变为动态旋转状态，运行中的任务卡片新增**绿色渐变呼吸灯边框**，让自动化执行过程肉眼可见。
- **新增 👁️ 2FA 安全输入切换**：手机号/扫码登录时，两步验证密码框支持点击“小眼睛”图标切换明文显示，彻底告别盲打烦恼。
- **优化 🔍 历史日志智能过滤**：任务历史弹窗顶部新增“仅看失败”开关，并在界面中引入 CirclesThree 动态图标，大日志量筛选效率提升 200%。
- **统一 🎨 全局主题变量系统**：重构了前端颜色体系，将所有硬编码色值统一为 CSS 变量（--accent-glow），支持一键更换全局品牌色。

### V3.2 全新 Linear 风格 UI 重构
- **重构 🎨 极简暗黑界面**：主控制面板完全重构为 Linear 现代开发工具风格（ Sidebar + Detail Area ）。侧边栏支持多账号滚动列表管理兼呼吸灯状态，全面启用纯暗黑模式。
- **重置 🎯 核心焦点面板**：取消了主页冗杂的杂项设置大面积平铺，调整界面工作区优先级。大幅凸显了卡片化的签到任务独立看板系统，Hover 可唤出快捷操作，方便直观掌控矩阵号动态。
- **优化 📊 极客内联终端**：移除了繁杂的弹窗日志，新控制台底部引入自带高亮的极客风格 Terminal 独立日志输出区，追踪任务如丝般顺滑。

### V3.1 核心重构与优化
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
