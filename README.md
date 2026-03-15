# TG-Pilot

[English README](README_EN.md)

TG-Pilot 是一个 Telegram 自动化管理面板。你可以在网页里管理多个账号，配置自动签到任务，并让任务按固定规则每天自动执行。

> AI 驱动：项目已集成 AI 能力（识图、计算题），可直接用于自动任务流程。

## 这个项目是做什么的？

- 统一管理多个 Telegram 账号
- 自动签到、定时发送消息、点击按钮
- 支持 AI 识图和 AI 计算题动作
- 在网页中查看任务执行日志和历史结果
- 适合 VPS 长期运行

## 项目特点

- 多账号管理：一个面板管理多个账号
- 动作序列：支持「发送文本 / 点击文字按钮 / 发送骰子 / AI识图 / AI计算」
- 日志可视化：可查看任务执行流程和最后机器人回复
- 稳定性优化：并发控制、429/超时场景优化、长期运行内存优化
- 容器化部署：Docker / Docker Compose 开箱即用

## 快速部署（推荐）

1. 安装 Docker 和 Docker Compose
2. 创建配置目录：
   ```bash
   mkdir -p tg-pilot/data && cd tg-pilot
   ```
3. 在服务器终端执行以下命令，直接生成 `docker-compose.yml` 配置文件：
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
         - APP_SECRET_KEY=your_secret_key # 强烈建议修改为随机字符串
   EOF
   ```
4. 执行启动命令：
   ```bash
   docker compose up -d
   ```
5. 浏览器打开 `http://服务器IP:9987` 进行登录。

默认凭据：
- 账号：`admin`
- 密码：`admin123`

## 更新版本

当有新版本发布时（你推送了新的代码），只需要在服务器上的 `tg-pilot` 目录下运行这两条命令即可无损升级：

```bash
docker compose pull
docker compose up -d
```

### 附：单行命令启动（可选）

如果你不想使用 docker-compose，也可以直接通过以下命令启动：

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

如果你走反代（如 Nginx），可改成仅本机监听：`-p 127.0.0.1:9987:8080`

## 数据目录与权限说明

- 默认数据目录：`/data`
- 当 `/data` 不可写时，会自动降级到 `/tmp/TG-Pilot`（非持久化）
- 新镜像已支持根据 `/data` 挂载目录属主 UID/GID 自动适配运行身份，通常无需 `chmod 777`

容器内排查命令：

```bash
id
ls -ld /data
touch /data/.probe && rm /data/.probe
```

## 常用环境变量（简版）

- `APP_SECRET_KEY`: 面板密钥，强烈建议设置
- `ADMIN_PASSWORD`: 初次安装时 admin 账户的默认密码（安全起见强烈建议设置，未设置则默认 admin123）
- `APP_HOST`: FastAPI 容器监听 IP，防暴露默认 `127.0.0.1`（如需用公网直连或宿主机反代端口请设为 `0.0.0.0`）
- `APP_DATA_DIR`: 自定义数据目录（优先级高于面板配置）
- `TG_SESSION_MODE`: `file`（默认）或 `string`（arm64 推荐）
- `TG_SESSION_NO_UPDATES`: `1` 启用 `no_updates`（仅 `string` 模式）
- `TG_GLOBAL_CONCURRENCY`: 全局并发（默认 `1`）
- `APP_TOTP_VALID_WINDOW`: 面板 2FA 容错窗口

## 自定义数据目录

你可以通过两种方式设置数据目录：

1. 面板设置：`系统设置 -> 全局签到设置 -> 数据目录`
2. 环境变量：`APP_DATA_DIR=/your/path`

说明：
- 修改后建议重启后端服务生效
- 该目录请务必可写，并挂载持久化卷

## 健康检查

- `GET /healthz`：快速健康检查
- `GET /readyz`：服务就绪检查

## 项目结构

```text
backend/      FastAPI 后端与调度器
tg_signer/    Telegram 自动化核心
frontend/     Next.js 管理面板
```

## 更新日志

### 2026-03-12
- 修复核心底层问题：修复因 Pyrogram 请求超时及 `FloodWait` 重试引发的并发锁饥饿、`Task exception` 未正确回收导致容器内存泄漏及网络高 I/O 问题。

### 2026-03-06

- 任务动作序列优化：排序调整为「发送文本消息 -> 点击文字按钮 -> 发送骰子 -> AI识图 -> AI计算」。
- AI 动作优化：`AI识图`、`AI计算`支持在右侧子模式切换（发文本 / 点按钮）。
- 任务复制粘贴优化：
  - 复制任务改为弹窗展示配置，支持一键复制。
  - 右上角粘贴导入优先自动读剪贴板，失败时自动弹出手动粘贴导入框。
- 日志展示优化：任务日志弹窗支持显示“任务：XXX执行成功/失败”及最后机器人消息。
- 主页状态检测优化：刷新/打开页面时账号状态检测更稳，减少误报“检测失败”。
- 移动端与弹窗 UI 优化：任务卡片操作区布局更紧凑，动作序列控件高度更统一。
- 导出编码修复：修复含 emoji 配置导出时的编码问题（UTF-8）。
- 容器权限兼容增强：按 `/data` 挂载目录属主 UID/GID 自动适配运行身份，降低 VPS 写入失败概率。

### 2026-03-01

- AI 动作升级、AI 配置保存修复、手机号验证码登录改为手动确认。
- `TimeoutError` 与 `429 transport flood` 高频日志优化。
- 长时运行稳定性与内存占用优化。
- 新增自定义数据目录配置。

## 技术栈

FastAPI、Uvicorn、APScheduler、Pyrogram/Kurigram、Next.js、Tailwind CSS、OpenAI SDK。
