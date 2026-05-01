# Pokopia Wiki

## 产品目标

- Pokopia Wiki 是一个面向 Pokopia 游戏资料的社区 Wiki。
- 所有人都可以浏览 Wiki 内容。
- 已注册并完成邮箱验证的用户可以创建、编辑、删除 Wiki 内容。
- 前台以 Pokemon、栖息地、物品、材料单、每日 CheckList、Life 为主要浏览入口。
- 管理入口用于维护全局配置、语言、列表排序和每日 CheckList。

## 技术栈

- Monorepo：pnpm workspace，Node.js >= 22，TypeScript。
- 前端：Vue、Vite、Vue Router、Vue I18n、Iconify。
- 后端：Node.js、Fastify、pg、PostgreSQL。
- 运维：Docker / docker compose。
- 依赖版本遵循现有 `package.json`，新增依赖时优先使用当前主流稳定版本，并保持项目结构简单。

## 全局设计原则

- `DESIGN.md` 是产品行为、数据结构和 API 暴露边界的单一事实来源。
- API 只返回业务需要的字段，不返回密码、token hash、验证 token、内部调试字段或不必要的元数据。
- 用户界面只展示业务数据和设计内的文案，不展示提示词、计划、调试信息、字段内部名或修改说明。
- 可编辑 Wiki 内容必须记录创建者、最后编辑者、创建时间、最后编辑时间和编辑历史。
- 列表顺序由 `sort_order` 控制，默认按创建时间旧到新初始化，排序值按 10 递增以便后续插入和拖拽排序。

## 国际化

- 前端使用 Vue I18n 管理界面文案，并通过 `X-Locale` 请求头告知后端当前语言。
- 前端当前语言保存在 `localStorage` 的 `pokopia_locale`。
- 后端默认语言为 `en`。
- 语言配置存储在 `languages`：
  - `code`
  - `name`
  - `enabled`
  - `is_default`
  - `sort_order`
- 语言 code 格式为 `xx` 或 `xx-YY`，例如 `en`、`zh-CN`。
- 系统必须且只能有一个默认语言。
- 初始语言包含：
  - `en`：English，默认语言
  - `zh-CN`：简体中文
- 实体翻译存储在 `entity_translations`：
  - `entity_type`
  - `entity_id`
  - `locale`
  - `field_name`
  - `value`
- 支持翻译的实体：
  - Pokemon
  - 特长
  - Pokemon Types
  - 喜欢的环境
  - 喜欢的东西 / 标签
  - 物品分类
  - 物品用途
  - 入手方式
  - 物品
  - 地图
  - 栖息地
  - 每日 CheckList Task
- 支持翻译的字段：
  - `name`
  - `title`
  - `details`：仅 Pokemon 介绍使用
  - `genus`：仅 Pokemon Genus 使用
- 实体仍保留基础 `name`、`title`、`details` 或 `genus` 字段，默认语言内容以基础字段为准。
- API 返回展示名称时按当前语言解析，回退顺序为：请求语言翻译 -> 默认语言翻译 -> 基础字段。
- 编辑表单必须避免本地化 UI 覆盖基础名称；翻译字段只展示当前需要编辑的语言。

## 用户与认证

- 用户可注册：
  - 邮箱
  - 显示名
  - 密码
- 邮箱保存为小写。
- 密码只保存 hash。
- 注册后必须通过邮箱验证。
- 邮件发送使用 Resend：
  - `RESEND_API_KEY`
  - `EMAIL_FROM`
  - `APP_ORIGIN` 或 `FRONTEND_ORIGIN`
- 验证邮件包含一次性验证链接。
- 验证 token 只保存 hash，并带过期时间和使用状态。
- 只有邮箱已验证的用户可以登录。
- 登录成功后返回明文 session token 给前端；数据库只保存 session token hash。
- 前端将登录 token 保存在 `localStorage` 的 `pokopia_auth_token`。
- 用户可退出登录，退出时删除对应 session。
- 对外用户字段只包含必要信息：
  - 当前用户：`id`、`email`、`displayName`、`emailVerified`
  - 编辑署名：`id`、`displayName`

## Community 编辑与审计

- 已验证用户可以通过前台或管理入口编辑 Wiki 内容。
- 新增、修改、删除 Wiki 内容时必须写入审计信息。
- 可编辑实体包含：
  - Pokemon
  - 栖息地
  - 物品
  - 材料单
  - 每日 CheckList Task
  - 全局配置项
- 主要可编辑表包含：
  - `created_by_user_id`
  - `updated_by_user_id`
  - `created_at`
  - `updated_at`
  - `sort_order`
- 详细编辑历史存储在 `wiki_edit_logs`：
  - `entity_type`
  - `entity_id`
  - `action`：`create` / `update` / `delete`
  - `user_id`
  - `changes`
  - `created_at`
- 详情页展示最后编辑者、最后编辑时间和编辑历史面板。
- 编辑历史中的用户信息只展示必要署名，不暴露邮箱、token、hash 或内部元数据。

## 全局配置数据

以下配置项都支持创建、编辑、删除、翻译和拖拽排序。

### 特长

- 名称
- 是否有掉落物：`has_item_drop`
- 已移除 `subcategory` 字段。
- 当特长允许掉落物时，Pokemon 编辑中可为该 Pokemon + 特长配置一个掉落物品。

### Pokemon Types

- 名称
- 用于 Pokemon 属性配置。
- Pokemon 可选择 1 到 2 个 Type，用于表达双属性。

### 喜欢的环境

- 名称

### 喜欢的东西 / 标签

- 名称
- 同时用于：
  - Pokemon 喜欢的东西
  - 物品标签

### 物品分类

- 名称
- 用于物品和材料单按结果物品分类展示。

### 物品用途

- 名称
- 物品用途可为空。

### 入手方式

- 名称
- 可关联到物品和材料单。

### 地图

- 名称
- 用于栖息地中 Pokemon 出现地点。

## Pokemon

Pokemon 可配置：

- ID
- 名称
- Genus：可为空，支持翻译
- 介绍 / Details：可为空，支持翻译
- Height：默认输入 `ft/in`，可切换输入 `m`；详情页同时展示 `ft/in` 与 `m`
- Weight：默认输入磅 `lb`，可切换输入 `kg`；详情页同时展示 `lbs` 与 `kg`
- Height / Weight 换算结果四舍五入；`m` / `kg` 保留 2 位小数，`in` 取整数，`lb` 保留 1 位小数。
- Types：可多选，最多 2 个
- 喜欢的环境：单选
- 特长：可多选，最多 2 个
- 特长掉落物品：按 Pokemon + 特长配置，单选物品
- 喜欢的东西：可多选，最多 6 个
- 六维：
  - HP
  - Attack
  - Defense
  - Special Attack
  - Special Defense
  - Speed
- 出现的栖息地：由栖息地出现配置反向展示
- 翻译
- 排序

Pokemon 列表功能：

- 搜索
- 按喜欢的环境筛选
- 按特长筛选：
  - 满足任意条件
  - 满足全部条件
- 按喜欢的东西筛选：
  - 满足任意条件
  - 满足全部条件
- 按自定义排序展示

Pokemon 详情页展示：

- 基本信息
- 主内容顶部按以下布局展示：
  - 左上：Genus & Details；无区块标题；如有 Genus，先展示 Genus，再以分割线连接 Details 内容
  - 左下：Height / Weight 与 Types 按 2:1 比例并排；Height / Weight 无区块标题，在 Dimension 区内左右并排展示并以中间分割线隔开，每组按英制、分割线、公制、标签上下排列；Types 不显示 Type 1 / Type 2 文案，上下布局并居中展示
  - 右侧：六维 Stats
- 六维使用 ProgressBar 展示，最大值按 150 计算。
- 特长
- 特长掉落物品
- 喜欢的环境
- 喜欢的东西
- 关联喜欢的东西的物品
- 出现的栖息地
- 最后编辑信息
- 编辑历史：保留在右侧 Sidebar 展示

## 物品

物品可配置：

- 名称
- 分类：必填
- 用途：可为空
- 入手方式：可多选
- 客制化：
  - 可染色
  - 可双区染色
  - 可改花纹
- 无材料单：`no_recipe`
- 标签：使用喜欢的东西配置，可多选
- 翻译
- 排序

物品列表功能：

- 搜索
- 按分类展示为标签页
- 按用途筛选
- 按标签筛选
- 按自定义排序展示

物品详情页展示：

- 基本信息
- 分类
- 用途
- 入手方式
- 客制化
- 标签
- 关联材料单
- 作为材料出现的材料单
- 相关栖息地
- 相关 Pokemon 掉落
- 最后编辑信息
- 编辑历史

## 材料单

材料单与物品是一对一关系：

- 一个材料单必须关联一个结果物品。
- 一个物品最多只能有一个材料单。
- 标记为 `no_recipe` 的物品不能创建材料单。
- 材料单没有独立名称，展示名称来自结果物品。

材料单可配置：

- 结果物品
- 入手方式：可多选
- 需要材料：多项物品 + 数量
- 排序

材料单列表功能：

- 独立于物品列表展示
- 按结果物品分类展示
- 按自定义排序展示

材料单详情页展示：

- 结果物品
- 入手方式
- 需要材料列表
- 最后编辑信息
- 编辑历史

## 栖息地

栖息地可配置：

- 名称
- 配方：多项物品 + 数量
- 可出现的 Pokemon
- 翻译
- 排序

Pokemon 出现配置：

- Pokemon
- 地图：可多选
- 时间：可多选
  - 早晨
  - 中午
  - 傍晚
  - 晚上
- 天气：可多选
  - 晴天
  - 阴天
  - 雨天
- 稀有度：1 到 3 星

栖息地列表功能：

- 按自定义排序展示
- 展示配方摘要和可能出现的 Pokemon 摘要

栖息地详情页展示：

- 配方列表
- 可能出现的 Pokemon 列表
- 出现时间
- 出现天气
- 稀有度
- 出现的地图列表
- 最后编辑信息
- 编辑历史

## 每日 CheckList

每日 CheckList Task 可配置：

- Task 标题
- 翻译
- Task 顺序

前台行为：

- 展示每日要做的 Task。
- 每个 Task 可勾选。
- 勾选状态保存在浏览器本地。
- 勾选状态按本地日期自动清空，不删除 Task。
- 已删除 Task 的本地勾选状态会自动清理。

管理行为：

- 已验证用户可新增、编辑、删除 Task。
- 已验证用户可通过 Handle 拖拽排序。

## Life

Life 是社区生活分享信息流，类似轻量社交动态。

Life Post 可配置：

- Post 内容正文
- 创建者、最后编辑者、创建时间、最后编辑时间
- 评论
- 评论回复：仅支持回复顶层评论，不做无限嵌套
- Reactions：`like`、`helpful`、`fun`、`thanks`

前台行为：

- 所有人都可以浏览 Life 信息流。
- 信息流按创建时间倒序展示。
- 已注册并完成邮箱验证的用户可以发布 Life Post。
- 作者本人可以编辑、删除自己的 Life Post。
- 已注册并完成邮箱验证的用户可以评论 Life Post，并回复顶层评论。
- 评论作者可以删除自己的评论；删除评论后正文不再展示，已有回复保留在原位置。
- 每条 Life Post 默认只展示评论入口与评论数量；评论列表、回复和评论输入默认折叠，用户点击后展开。
- 已注册并完成邮箱验证的用户可以对每条 Life Post 选择一个 Reaction；普通点击默认设置 `like`，再次点击 `like` 会取消，当前为其他 Reaction 时普通点击会替换为 `like`。
- Life Reaction 的其他类型通过右键 / context menu 打开 Popup 选择；再次选择当前 Reaction 会取消，选择其他 Reaction 会替换原 Reaction。
- 当前没有图片上传、转发、分页、置顶或单独审核流程。
- Life Post 是用户生成内容，正文按作者输入展示，不进入 `entity_translations`。

API 暴露边界：

- Life Post 作者信息只返回 `id` 和 `displayName`。
- Life Comment 作者信息只返回 `id` 和 `displayName`。
- Life Reaction 对外只返回按类型汇总的数量和当前用户自己的 Reaction，不返回其他用户的 Reaction 明细。
- API 不返回邮箱、token/hash、内部调试字段或不必要的审计 payload。
- 非作者不能编辑或删除其他用户的 Life Post。
- 非作者不能删除其他用户的 Life Comment。

## 前端交互与 UI

- UI 风格以 `DesignGuidelines.html` 为准。
- 页面结构以 `AppShell`、`PageHeader`、列表、详情区和管理区为核心。
- 导航和主要操作使用图标增强识别。
- 数据加载状态使用 Skeleton，避免裸文本 loading。
- 分类切换使用 Tabs。
- 布尔或模式选择使用 SwitchGroup、checkbox、segmented control 等合适控件。
- 多选和单选复用 `TagsSelect`，支持搜索、键盘操作和必要时的内联创建。
- 主要实体的新建和编辑使用路由驱动的 Modal：
  - `/pokemon/new`
  - `/pokemon/:id/edit`
  - `/habitats/new`
  - `/habitats/:id/edit`
  - `/items/new`
  - `/items/:id/edit`
  - `/recipes/new`
  - `/recipes/:id/edit`
- Life 使用信息流内联发布与编辑，不使用路由驱动 Modal。
- 进入或关闭编辑 Modal 时应保留底层页面上下文，不进行不必要的滚动跳转。
- 用户界面不得展示内部字段名、调试数据、计划说明或“已修改某字段”一类实现说明。

## API 概览

公开浏览 API：

- `GET /api/languages`
- `GET /api/options`
- `GET /api/daily-checklist`
- `GET /api/pokemon`
- `GET /api/pokemon/:id`
- `GET /api/habitats`
- `GET /api/habitats/:id`
- `GET /api/items`
- `GET /api/items/:id`
- `GET /api/recipes`
- `GET /api/recipes/:id`
- `GET /api/life-posts`

认证 API：

- `POST /api/auth/register`
- `POST /api/auth/verify-email`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

已验证用户编辑 API：

- Pokemon、栖息地、物品、材料单的创建、更新、删除。
- Life Post 的创建，以及作者本人对 Life Post 的更新、删除。
  - `POST /api/life-posts`
  - `PUT /api/life-posts/:id`
  - `DELETE /api/life-posts/:id`
- Life Comment 的创建，以及作者本人对 Life Comment 的删除。
  - `POST /api/life-posts/:postId/comments`
  - `POST /api/life-posts/:postId/comments/:commentId/replies`
  - `DELETE /api/life-comments/:id`
- Life Reaction 的设置、替换和取消。
  - `PUT /api/life-posts/:id/reaction`
  - `DELETE /api/life-posts/:id/reaction`
- 每日 CheckList 的创建、更新、删除、排序。
- 全局配置项的创建、更新、删除、排序。
- 语言的创建、更新、删除、排序。
- Pokemon、物品、材料单、栖息地的列表排序。

## 开发与验证

- 本项目在 WSL 中开发，运行验证主要通过 Docker。
- 常规轻量验证：
  - `pnpm lint`
  - `pnpm typecheck`
- 不在 WSL 中运行测试作为完成任务的前置条件。
- Docker 运行问题以用户提供的 `docker compose up --build` 输出为准进行后续修复。
