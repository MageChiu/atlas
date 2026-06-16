# Atlas - 路过

在线互动式虚拟旅行体验产品（MVP）。

## 仓库结构

```
atlas/
  docs/        项目设计文档（总纲、前后端设计、数据模型、API 协议、任务拆解）
  tasks/       开发任务拆解（公共 / 后端 / 前端 三轨道）
  shared/      公共部分：共享类型、API 协议契约、枚举/错误码、Mock 种子数据
  frontend/    前端工程（Next.js + PixiJS，阶段 B 实现）
  backend/     后端工程（NestJS/FastAPI，阶段 A 实现）
```

## 工作区

本仓库使用 npm workspaces 管理，公共类型通过 `@atlas/shared` 引用。

```bash
npm install                      # 安装全部 workspace 依赖
npm run build:shared             # 构建共享包（前后端编译前置）
```

## 端口与环境变量

先复制环境变量模板：前端用 `frontend/.env.local`，后端用 `backend/.env`，均参考根目录 [.env.example](./.env.example)。

| 变量 | 作用 | 默认 |
| --- | --- | --- |
| `FRONTEND_PORT` | 前端 web 服务端口（dev/start 通用） | `3000` |
| `PORT` | 后端服务端口 | `3001` |
| `NEXT_PUBLIC_API_BASE_URL` | 前端访问的后端基址（端口须与 `PORT` 一致） | `http://localhost:3001` |
| `NEXT_PUBLIC_USE_MOCK` | 前端是否走 Mock 数据 | `true` |

## 一键本地部署运行

主目录提供 `run.sh`，一条命令完成「装依赖 → 构建公共包 → 启动前后端」。

```bash
./run.sh            # 开发模式（默认）：装依赖 + 构建 shared + 并行启动前后端
./run.sh build      # 仅编译：shared + 后端 + 前端 web 产物
./run.sh prod       # 生产模式：先编译再以生产方式启动前后端
./run.sh install    # 仅强制重装依赖
./run.sh stop       # 停止由脚本启动的前后端进程
```

- 默认地址：前端 http://localhost:3000 ，后端 http://localhost:3001 。
- 端口可通过根目录 `.env`（参考 `.env.example`）或环境变量覆盖：`FRONTEND_PORT`、`PORT`。
- 脚本会自动加载根目录 `.env`，并在 `Ctrl+C` 退出时清理子进程。

## Web 本地启动与编译

若需单独控制各端，可在仓库根目录使用 npm workspaces 命令。

```bash
# —— 开发模式（热更新）——
npm run dev:frontend             # 启动前端 web，默认 http://localhost:3000
npm run dev:backend              # 启动后端 API，默认 http://localhost:3001

# —— 自定义端口 ——
FRONTEND_PORT=4000 npm run dev:frontend       # 前端改用 4000
npm run dev:frontend -- -p 4000               # 或通过参数透传给 next

# —— 生产编译 ——
npm run build:web                # = 构建 shared + 前端（web 产物）
npm run build:frontend           # 同上
npm run build:backend            # 构建 shared + 后端
npm run build                    # 默认构建 web（shared + 前端）

# —— 生产启动 ——
npm run start:frontend           # 启动已编译的前端（读 FRONTEND_PORT）
npm run start:backend            # 启动已编译的后端（读 PORT）
```

> 联调时：先 `npm run dev:backend` 起后端，再把前端 `NEXT_PUBLIC_USE_MOCK=false` 并确保 `NEXT_PUBLIC_API_BASE_URL` 指向后端端口，最后 `npm run dev:frontend`。

## 开发流程

先完成 `shared/`（公共部分基线）并冻结，再并行推进 `frontend/` 与 `backend/`。
详见 [tasks/README.md](./tasks/README.md)。
