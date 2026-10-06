# 云溪品牌规范服务（Brand Spec Service）

将 Tailwind 主题扩展为全栈品牌规范服务：设计令牌（网页编辑按钮 / 步骤 / 素材状态 / 导出标识）统一建模，
后台负责校验、版本化与发布，数据库存储品牌版本与项目绑定，前端资源与导出预览同源生成。

## 🛠 技术栈
- Frontend: React 18 + TypeScript 5 + Vite 5 + Tailwind CSS 3.4 + Zustand + React Router
- Backend: Node.js 20 + Express 4 + TypeScript + TypeORM（zod 入参校验 / winston 日志 / HMAC 令牌认证）
- Database: MySQL 8.0（TypeORM 管理，严禁裸 SQL；本地与测试环境可用 sql.js 同构运行）

## 🚀 启动指南 (How to Run)
1. 确保 Docker Desktop 已启动。
2. 在根目录执行：`docker compose up --build`
3. 等待容器启动完成（MySQL 健康检查通过后后端自动建表并写入种子数据）。

## 🔗 服务地址 (Services)
- Frontend: http://localhost:3000 （品牌规范后台入口：页头「品牌规范」或 http://localhost:3000/brand）
- Backend API: http://localhost:4000/api （健康检查 http://localhost:4000/api/health）
- Database: localhost:3306 (user: root / pass: root，库名 brand)

## 🧪 测试账号
- Admin: admin / 123456

## ✅ 本地验证（非 Docker）
```bash
# 后端单元 / 服务 / HTTP 测试（31 个用例，覆盖全部验收场景）
cd backend && npm ci && npm test
# 后端本地运行（内置 sql.js，无需 MySQL）
DB_TYPE=sqljs npm run dev
# 前端
cd frontend && npm ci && npm run build
```

---

## 架构与核心设计

### 1. 令牌模型与校验（backend/src/tokens）
- **规范即白名单**：`schema.ts` 声明全部令牌（分组：基础色板 / 网页编辑按钮 / 步骤 / 素材状态 / 导出标识 / 系统保护）。
  服务端只接受规范内的键与类型化值（颜色 / 尺寸 / 别名），**不接收任意脚本或不受限 CSS**：
  未知键 → `UNKNOWN_TOKEN`；含 `<>`、`;{}`、`url()`、`javascript:`、`expression()`、`@import` 等 → `UNSAFE_VALUE`。
- **别名**：值可写 `{other.token}`。解析时 DFS 检测：
  - 循环（含互指、自指）→ `ALIAS_CYCLE`，报错信息含完整链路 `a → b → a`
  - 引用缺失 → `ALIAS_MISSING`；类型不匹配 → `ALIAS_TYPE_MISMATCH`；缺项 → `MISSING_TOKEN`
- **对比度**：WCAG 2.x 相对亮度，20 条前后景规则（含**暗色背景**场景：暗底文字、导出角标、字幕、焦点环），
  不足即 `CONTRAST_INSUFFICIENT`，错误级阻断发布。
- **系统保护（用户主题不可覆盖）**：
  - `system.error.fg` 必须保持红色色相（≤24° 或 ≥332°），否则 `PROTECTED_ERROR_SEMANTICS` —— 错误语义不可被改写
  - 焦点环宽度 ≥ 2px 且在明/暗背景上对比度 ≥ 3:1，否则 `FOCUS_INVISIBLE` —— 键盘焦点必须可见

### 2. 版本、并发与项目绑定（backend/src/services）
- **品牌版本**：草稿 → 发布；发布时分配版本号并生成编译产物（`tokenHash` / `cssHash`）。
- **并发发布（两个管理员）**：保存与发布均为**原子 compare-and-set**
  （`UPDATE ... WHERE id=? AND lockVersion=? AND status='draft'`），
  唯一约束 `(brandId, versionNumber)` 兜底跨草稿竞争；冲突返回 `409 VERSION_CONFLICT` 并记录审计事件。
- **项目绑定**：`follow`（跟随最新发布）/ `pin`（固定版本）。`GET /api/projects/:slug/effective-theme`
  返回项目实际生效版本与样式地址 —— 网页页头徽章展示的就是该接口返回的**实际生效版本**。
- **已批准成片不漂移**：素材保存批准时的令牌快照；品牌发布后，跟随型项目中快照与新解析值不一致的素材
  仅被标记 `needs_re_review`，**快照不变**（字幕颜色不会在未复核时变化），复核通过才采用新版本。

### 3. 编译时样式 vs 受约束运行时变量（取舍与实现）
| 维度 | 编译时生成样式（`compileCss`） | 受约束运行时变量（`buildRuntimeCss`） |
|---|---|---|
| 产物 | 完整工具类样式（按钮/步骤/徽章/焦点环），内容哈希命名 `brand-<hash>.css` | 仅 `:root` 下规范内 `--brand-*` 变量 |
| 缓存 | `Cache-Control: immutable, max-age=1年`，URL 含哈希，**设备缓存旧包不影响新版本发布** | `no-cache` + ETag，每次校验后生效 |
| 按租户定制 | 需发布新版本生成新产物（适合稳定品牌资产） | 按项目实时解析生效版本（适合多租户快速切换） |
| 内容安全 | 构建期一次性校验，产物静态可配 CSP/SRI | 只输出白名单变量，值经类型与安全校验，无选择器/脚本面 |
| 失败兜底 | 构建失败 → 发布事务回滚，线上继续用旧版本 | 校验失败的版本不会成为生效版本 |

实现上**两者同源**：发布时由同一份解析结果生成编译产物与运行时变量（`tokenHash` 一致），
导出预览接口 `/api/versions/:id/export-preview` 也复用同一解析结果 —— 前端资源与导出预览必然来自同一版本。

### 4. 验收场景对照
| 场景 | 实现 | 测试 |
|---|---|---|
| 别名互指 | `ALIAS_CYCLE` 阻断保存与发布 | `tokens.test.ts` / `api.test.ts` |
| 暗色背景对比不足 | 暗底规则组（角标/字幕/焦点环/错误标识） | `tokens.test.ts` |
| 两个管理员并发发布 | 原子 CAS + 唯一约束 → 409 + 审计 | `service.test.ts` |
| 构建样式失败 | 发布事务回滚，版本保持草稿，记录 `build_failed` | `service.test.ts` |
| 设备缓存旧包 | 内容哈希 URL + 前端轮询生效版本，页头显示**实际生效版本**并提供一键更新 | `ThemeProvider.tsx` |
| 拖拽 / 播放器错误 / 禁用态 | 视觉验证页 `/brand/verify` 全部组件由令牌变量驱动 | 手工/视觉验证 |

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
    build: ./backend                    # node:20-alpine 多阶段构建
  frontend:
    build: ./frontend                   # node:20-alpine 构建 + nginx:alpine 运行
```

#### 2. npm 依赖源
**使用淘宝镜像**（国内访问快），两个 Dockerfile 中均已配置：
```dockerfile
RUN npm config set registry https://registry.npmmirror.com
```

### 常用镜像推荐
| 技术栈 | 推荐镜像 | 说明 |
|--------|---------|------|
| MySQL | `mysql:8.0` | 数据库 |
| Node.js | `node:20-alpine` | 前端/后端构建 |
| Nginx | `nginx:alpine` | 前端生产环境 |

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
