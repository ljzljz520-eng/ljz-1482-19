# 云溪公园 · 品牌规范服务（BrandSpec）

将 Tailwind 主题扩展为全栈品牌规范服务：网页端编辑按钮、步骤条、素材状态与导出标识令牌；
后台校验令牌类型与别名引用图；数据库持久化品牌版本与项目绑定（跟随/固定）；
发布生成编译时样式产物，运行时按项目供给受约束 CSS 变量，导出预览与网页强制同版本。

## 🛠 技术栈
- Frontend: React 18 + TypeScript 5 + Vite 5 + Tailwind CSS 3.4 + Zustand + React Router
- Backend: Node.js 20 + Express 4 + Prisma 5 + Zod + JWT + Winston
- Database: MySQL 8.0（Docker Volume 持久化）

## 🚀 启动指南 (How to Run)
1. 确保 Docker Desktop 已启动。
2. 在根目录执行：`docker compose up --build`
3. 等待容器启动完成后访问 `http://localhost:3000`
   - 后端启动时自动执行 `prisma migrate deploy` 并幂等填充种子数据
     （admin 账号、品牌 v1.0.0 已发布、v1.1.0 草稿、yunxi-park 项目、两条成片字幕审批）。

## 🔗 服务地址 (Services)
- Frontend: http://localhost:3000 （公园站点，页脚显示**实际生效品牌版本**）
- 管理控制台: http://localhost:3000/admin （品牌版本 / 项目绑定 / 视觉验证）
- Backend API: http://localhost:3001/api/health
- Database: localhost:3306 容器内 `db:3306`（user: root / pass: root，库名 brandspec）

## 🧪 测试账号
- Admin: admin / 123456

## 🧭 功能地图
| 页面 | 说明 |
|------|------|
| `/` `/audiovisual` `/timeline` | 公园站点（品牌主题消费者），页脚展示实际生效版本徽章 |
| `/admin/brands` | 品牌版本列表、新建草稿（基于最新发布复制） |
| `/admin/brands/:id` | 令牌编辑器：分类编辑、字面值/别名切换、实时服务端校验、发布 |
| `/admin/projects` | 项目绑定（跟随最新 / 固定版本）、成片字幕审批与复核 |
| `/admin/preview` | 视觉验证：按钮/步骤/素材状态/拖拽/播放器错误/禁用态/焦点/导出预览 |

## 🏗 核心设计

### 令牌模型与校验（后台校验类型与引用图）
- 命名空间白名单：`color / button / steps / asset / export / focus`；`system.*` 平台保留，用户主题不可定义。
- 叶子类型封闭集合：颜色（hex/rgb(a)）、尺寸（px/rem 上限）、字重枚举、透明度；未知字段一律拒绝。
- 别名 `{ "alias": "color.primary" }`：构建引用图，DFS 检测**循环（含互指）**、**缺项**、**类型不一致**。
- 语义红线：
  - 对比度（WCAG）：按钮/素材/徽章文字与底色 ≥ 4.5，**暗色播放器背景上的字幕色 ≥ 4.5**，禁用态 ≥ 3；
  - **系统错误含义不可覆盖**：`system.error.*` 恒定注入，且用户主题中 error/danger 语义的填充色必须保持感知红色域；
  - **键盘焦点必须可见**：焦点环与浅色/深色背景对比度 ≥ 3:1 且宽度 ≥ 2px。
- 安全：键名/值域均为白名单正则，结构上无法注入 `<script>`、`url()`、`@import` 等——**服务端不接收任意脚本或不受限 CSS 作为主题配置**。

### 编译时生成样式 vs 受约束运行时变量（取舍与实现）
| 维度 | 编译时产物 `GET /api/brands/:id/asset.css` | 运行时变量 `GET /api/projects/:slug/theme.css` |
|------|--------------------------------------------|------------------------------------------------|
| 内容 | CSS 变量 + `.bk-*` 组件类，发布时生成入库 | 仅白名单 `--brand-*` 变量，按项目生效版本实时生成 |
| 租户定制 | 需重新构建/发版，适合稳定品牌 | 改绑定即生效，适合多租户快速定制 |
| 缓存 | 内容寻址（contentHash）+ `immutable` 永久缓存，性能最优 | `ETag` + `max-age=30, stale-while-revalidate`，一致性优先 |
| 内容安全 | 构建期可信，可配 SRI | 值经服务端白名单校验；CSP `script-src 'self'`，样式仅同源+内联 |
| 取舍 | 运行时零成本但升级慢 | 即时生效但需防注入与缓存一致性设计 |

**同源保证**：两条轨道由同一条 `BrandVersion` 记录的同一份解析结果生成；
`GET /api/projects/:slug/export-preview?versionId=` 与项目当前生效版本不一致时返回 `409 VERSION_MISMATCH`，
**生成前端资源与导出预览所需样式强制来自同一版本**。
前端 `index.css` 内置 v1.0.0 编译时默认变量作为兜底（**设备缓存旧包**时页面仍可渲染），
启动时请求 `effective` 接口注入运行时变量并在页脚显示**实际生效版本**；本地记录版本落后于服务端时顶部提示品牌已更新。

### 品牌升级与字幕审批
- 项目自选 **follow（跟随最新发布）** 或 **pin（固定版本）**。
- 成片字幕批准时固化 `approvedVersionId + snapshotColor`；品牌升级后已批准字幕**颜色不变**，
  状态自动变为“待复核”，必须管理员复核后才采用新品牌色——**已批准成片的字幕颜色不会在未复核时变化**。

### 并发与一致性
- 发布/保存携带 `expectedRevision` 乐观锁，事务内条件更新；**两个管理员并发发布**时一方成功、另一方 `409`。
- 版本号 `(name, version)` 唯一约束；发布后不可变，`contentHash` 内容寻址。

## ✅ 验收场景对照
| 场景 | 实现与验证 |
|------|-----------|
| 别名互指 | `ALIAS_CYCLE`（报告完整环路径），自检 + 冒烟覆盖 |
| 暗色背景下对比不足 | 字幕色 vs 播放器暗底 < 4.5 → `CONTRAST_TOO_LOW`，保存/发布拒绝 |
| 两个管理员并发发布 | 乐观锁 + 事务，一方 `409 CONCURRENT_MODIFICATION/STALE_REVISION` |
| 构建样式失败 | 发布前完整校验失败 → `422` 不产出 artifact；存储令牌损坏 → `409 STORED_TOKENS_INVALID` |
| 设备缓存旧包 | index.html `no-cache` + 运行时变量注入 + 页脚显示实际生效版本 + 升级提示条 |
| 拖拽/播放器错误/禁用态 | `/admin/preview` 视觉验证页 |
| 任意脚本/不受限 CSS | 值域白名单，注入串直接 `BAD_VALUE` 拒绝 |

### 本地验证命令
```bash
cd backend
npm install
npm run test:brand   # 13 项品牌校验自检（别名/对比度/语义/焦点/注入）
npm run smoke        # 26 项 HTTP 冒烟（并发发布/版本一致/字幕冻结/绑定/缓存头）
```

---

## 🐳 Docker 镜像源配置 (Docker Registry Configuration)

### 推荐配置（基于实际项目验证）

#### 1. Docker 镜像源
**使用官方 Docker Hub 镜像**（已验证稳定可用）

```yaml
# docker-compose.yml 示例
services:
  db:
    image: mysql:8.0                    # MySQL 数据库
  
  backend:
    build: ./backend
    # Dockerfile 中使用：
    # - Node.js: node:20-alpine
  
  frontend:
    build: ./frontend
    # Dockerfile 中使用：
    # - node:20-alpine (构建)
    # - nginx:alpine (运行)
```

#### 2. npm 依赖源
**使用淘宝镜像**（国内访问快）

在 `Dockerfile` 中添加：
```dockerfile
RUN npm config set registry https://registry.npmmirror.com
```

### 常用镜像推荐

| 技术栈 | 推荐镜像 | 说明 |
|--------|---------|------|
| MySQL | `mysql:8.0` | 数据库 |
| Node.js | `node:20-alpine` | 前端/后端构建 |
| Nginx | `nginx:alpine` | 前端生产环境 |

### 配置示例

#### Node.js 项目 Dockerfile
```dockerfile
# 构建阶段
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com
RUN npm ci
COPY . .
RUN npm run build

# 生产阶段
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 使用建议

1. ✅ **优先使用官方镜像**：稳定可靠，无需配置镜像代理
2. ✅ **使用 Alpine 版本**：镜像体积小，构建速度快
3. ✅ **配置 npm 淘宝源**：加速国内依赖下载
4. ✅ **多阶段构建**：减小最终镜像体积

### 常见问题

**Q: Docker 镜像拉取失败？**  
A: 检查网络连接，确保 Docker Desktop 正常运行

**Q: npm install 很慢？**  
A: 确保已配置淘宝镜像源：`npm config set registry https://registry.npmmirror.com`

**Q: 首次启动后端报数据库连接重试？**  
A: 属正常现象，MySQL 初始化需数秒，后端会自动重试直至就绪
