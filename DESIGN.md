# Pokopia Wiki

## 产品目标

- Pokopia Wiki 是一个面向 Pokopia 游戏资料的社区 Wiki。
- 所有人都可以浏览 Wiki 内容。
- 已注册并完成邮箱验证的用户可以创建、编辑、删除 Wiki 内容。
- 前台以 Pokemon、栖息地、物品、材料单、每日 CheckList、Life、Dish、Events、Actions、Dream Island、Clothes 为主要浏览入口。
- 管理入口用于维护全局配置、语言、系统文案、列表排序和每日 CheckList。

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
  - Life 标签
- 支持翻译的字段：
  - `name`
  - `title`
  - `details`：仅 Pokemon 介绍使用
  - `genus`：仅 Pokemon Genus 使用
- 实体仍保留基础 `name`、`title`、`details` 或 `genus` 字段，默认语言内容以基础字段为准。
- API 返回展示名称时按当前语言解析，回退顺序为：请求语言翻译 -> 默认语言翻译 -> 基础字段。
- 编辑表单必须避免本地化 UI 覆盖基础名称；翻译字段只展示当前需要编辑的语言。
- 系统级文案独立于实体翻译，不进入 `entity_translations`。
- 系统级文案 key 由代码 catalog 维护，覆盖前端界面、后端错误提示和认证邮件模板。
- 系统级文案值存储在 `system_wording_values`，key 元信息存储在 `system_wording_keys`：
  - `key`
  - `module`
  - `surface`：`frontend` / `backend` / `email`
  - `description`
  - `placeholders`
  - `enabled`
  - `locale`
  - `value`
- 后端启动时同步代码 catalog，只补充缺失 key 和初始 value，不覆盖管理员已维护的 value。
- 系统级文案回退顺序为：请求语言 value -> 默认语言 value -> 代码内置 fallback。
- 系统级文案中的占位符必须与默认文案一致，例如 `{count}`、`{name}`；保存时校验，避免运行时插值失败。
- 前端组件必须通过 Vue I18n key 读取系统文案，不直接写用户可见硬编码文案；后续新增模块必须先在 catalog 中注册 wording key。
- 后端返回给前端的 user-facing 错误信息必须通过系统文案解析，不返回 token/hash、内部调试字段或未本地化的内部错误文本。
- 管理入口提供 System wordings 维护能力，可按语言、模块、端和缺失状态查看并编辑系统级文案。

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

## 实体讨论

- Pokemon、物品、材料单、栖息地详情页支持讨论。
- 所有人都可以浏览实体讨论。
- 已注册并完成邮箱验证的用户可以发表评论，并回复顶层评论。
- 讨论回复只支持一层回复，不做无限嵌套。
- 评论作者可以删除自己的评论；删除后正文不再展示，已有回复保留在原位置。
- 被删除实体的讨论会随实体删除一并清理。
- 讨论按创建时间正序展示。
- 讨论内容是用户生成内容，正文按作者输入展示，不进入 `entity_translations`。
- API 对外只返回评论作者的 `id` 和 `displayName`。
- API 不返回邮箱、token/hash、内部调试字段、`deleted_at`、`deleted_by_user_id` 等内部删除字段。

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

### Life 标签

- 名称
- 用于 Life Post 分类展示和 Feed 筛选。

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

Pokemon 编辑表单使用标签页组织字段：

- 编辑表单提供 Fetch data 功能：
  - 已验证用户可输入 data identifier 或 Pokemon ID，从同一个搜索输入查询基础资料或图片候选。
  - Fetch data 从仓库 `data/` CSV 查询基础资料并填入当前表单。
  - Fetch 输入框提供 data 列表搜索，搜索范围包含 Pokemon ID、identifier、当前语言名称和默认语言名称；结果只展示 `#ID`、名称和 identifier。
  - Fetch 搜索结果默认关闭，只在用户主动点击输入框或输入内容时展开；Escape、失焦 / 点击外部、选择结果后关闭。
  - Fetch 搜索不使用防抖或节流；前端在每次新搜索时取消上一条搜索请求，并且只渲染最新请求结果。
  - Fetch 只填入 CSV 可提供的字段：ID、名称、Genus、Height、Weight、Types、六维和名称/Genus 翻译；不填入 Details、喜欢的环境、特长、特长掉落物品或喜欢的东西。
  - Fetch 不直接创建或更新 Pokemon；用户仍需通过 Save 保存，保存时沿用现有编辑审计。
  - Fetch 根据 `languages.code` 自动匹配 CSV 语言列：`en`、`ja`、`ko`、`fr`、`de`、`es`、`it` 使用同名列；`zh-CN` / `zh-SG` 等简体语言使用 `zh_hans`；`zh-TW` / `zh-HK` / `zh-MO` 使用 `zh_hant`。
  - Fetch 会自动确保 canonical Pokemon Types 存在于 `pokemon_types`，Type ID 与 `data/localized_type_name.csv` 和 `frontend/public/types` 图标文件保持一致；用户不需要为 Fetch 手工创建 Type 配置。
  - Type 展示使用 `frontend/public/types/small/{typeId}.png` 图标并保留文字名称。
- 编辑表单提供 Pokemon 图片选择功能：
  - 已验证用户通过 Fetch data 的同一个 data identifier / Pokemon ID 输入框，从 `https://pokesprite.tootaio.com/sprites/` 静态图片树查询对应 Pokemon 的可用图片候选。
  - 图片候选只使用 `/sprites/pokemon/...` 相对路径，后端按固定资源族生成候选并用 `HEAD` 校验存在性；不保存任意外部 URL。
  - 图片选择不直接创建或更新 Pokemon；用户仍需通过 Save 保存，保存时沿用现有编辑审计。
  - 图片选择界面使用 Pokédex 风格：上方显示当前选择的大图，大图下方显示版本、状态和描述，再下方以缩略图网格展示同一 Pokemon 的不同风格 / 版本 / 状态。
  - Pokemon 保存显示图片的相对路径、风格、版本、状态和描述；API 对外返回可直接展示的图片 URL，但不暴露内部校验状态。
- 基础标签页：
  - 第一行：ID、名称
  - 第二行：喜欢的环境、特长
  - 第三行：喜欢的东西
  - 特长掉落物品随已选择且支持掉落物的特长显示
  - Pokemon 图片选择区
- Advance 标签页：
  - 第一行：Genus
  - 第二行：Details
  - 第三行：Height / Weight，身高与体重控件在桌面端同一行展示
  - 第四行：Types
  - 第五行：六维 Stats

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
- Pokemon 卡片在已配置图片时展示所选图片缩略图；未配置图片时保留默认 Poké Ball 标记。

Pokemon 详情页展示：

- 基本信息
- 已配置图片时，详情主内容在六维 Stats 右侧展示正方形居中的 Pokédex 风格图片；页面内不直接展示图片版本、状态或描述，用户可通过图片 Modal 查看详情；未配置图片时不显示图片区。
- 主内容顶部按以下布局展示：
  - 左上：Genus & Details；无区块标题；如有 Genus，先展示 Genus，再以分割线连接 Details 内容
  - 左下：Height / Weight 与 Types 按 2:1 比例并排；Height / Weight 无区块标题，在 Dimension 区内左右并排展示并以中间分割线隔开，每组按英制、分割线、公制、标签上下排列；Types 不显示 Type 1 / Type 2 文案，上下布局并居中展示
  - 右侧：六维 Stats；已配置图片时图片展示在 Stats 右侧
- 六维使用 ProgressBar 展示，最大值按 150 计算。
- 特长
- 特长掉落物品
- 喜欢的环境
- 喜欢的东西
- 相关 Pokemon：与关联喜欢的东西的物品在桌面端左右并排展示；按相同喜欢的环境优先，其次按共同喜欢的东西数量从多到少排序；支持按喜欢的环境筛选，默认筛选当前 Pokemon 的喜欢的环境，也可切换到其他喜欢的环境或全部；每个筛选视图最多展示 6 个；每项第一行左侧展示名称，右侧展示特长和喜欢的环境，第二行展示喜欢的东西，并高亮共同喜欢的东西
- 关联喜欢的东西的物品：与相关 Pokemon 在桌面端左右并排展示
- 出现的栖息地
- 最后编辑信息
- 讨论
- 编辑历史：通过详情页 Tabs 展示

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
- 讨论
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
- 讨论
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
- 讨论
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
- 标签：使用 Life 标签配置，可多选
- 创建者、最后编辑者、创建时间、最后编辑时间
- 评论
- 评论回复：仅支持回复顶层评论，不做无限嵌套
- Reactions：`like`、`helpful`、`fun`、`thanks`

前台行为：

- 所有人都可以浏览 Life 信息流。
- 信息流按创建时间倒序展示。
- 已注册并完成邮箱验证的用户可以发布 Life Post。
- 作者本人可以编辑、删除自己的 Life Post；删除 Life Post 使用软删除。
- 已注册并完成邮箱验证的用户发布或编辑 Life Post 时可以选择一个或多个 Life 标签。
- 已注册并完成邮箱验证的用户可以评论 Life Post，并回复顶层评论。
- 评论作者可以删除自己的评论；删除评论后正文不再展示，已有回复保留在原位置。
- 已软删除的 Life Post 不出现在信息流、搜索或标签筛选结果中，也不能继续编辑、评论或设置 Reaction。
- 每条 Life Post 默认只展示评论入口与评论数量；评论列表、回复和评论输入默认折叠，用户点击后展开。
- 已注册并完成邮箱验证的用户可以对每条 Life Post 选择一个 Reaction；普通点击默认设置 `like`，再次点击 `like` 会取消，当前为其他 Reaction 时普通点击会替换为 `like`。
- Life Reaction 的其他类型通过右键 / context menu 或可见展开按钮打开 Popup 选择；再次选择当前 Reaction 会取消，选择其他 Reaction 会替换原 Reaction。
- 支持按 Life Post 正文搜索；用户按 Enter 或点击 Search 按钮后提交搜索，不随输入实时请求；搜索结果仍按创建时间倒序展示并分页加载。
- Feed 使用 Tabs 展示 Life 标签筛选；包含 All 和后台配置的 Life 标签；点击标签后按该标签筛选，搜索和标签筛选可以同时生效。
- 信息流分页加载，初始展示最新一页，滚动到底部自动加载更多。
- 当前没有图片上传、转发、置顶或单独审核流程。
- Life Post 是用户生成内容，正文按作者输入展示，不进入 `entity_translations`。

API 暴露边界：

- Life Post 作者信息只返回 `id` 和 `displayName`。
- Life Post 标签只返回 `id` 和按当前语言解析后的 `name`。
- Life Comment 作者信息只返回 `id` 和 `displayName`。
- Life Reaction 对外只返回按类型汇总的数量和当前用户自己的 Reaction，不返回其他用户的 Reaction 明细。
- Life Post 列表 API 返回分页结果：`items`、`nextCursor`、`hasMore`；`cursor` 是不透明分页令牌。
- API 不返回邮箱、token/hash、内部调试字段或不必要的审计 payload。
- API 不返回 Life Post 的 `deleted_at`、`deleted_by_user_id` 等内部软删除字段。
- 非作者不能编辑或删除其他用户的 Life Post。
- 非作者不能删除其他用户的 Life Comment。

## 开发中入口

以下前台公开入口当前仅展示“正在开发中”占位页，不提供数据模型、后端 API、编辑表单、管理入口或排序能力：

- Dish
- Events
- Actions：游戏内快捷动作，例如挥手、跳舞等。
- Dream Island
- Clothes

这些开发中入口在主导航和占位页中显示状态 Badge，便于用户识别当前功能状态。

## 前端交互与 UI

- UI 风格以 `DesignGuidelines.html` 为准。
- 页面结构以 `AppShell`、`PageHeader`、列表、详情区和管理区为核心。
- 全局主导航使用 `AppShell` 侧边栏；移动端通过导航按钮打开侧边栏抽屉。
- 页面级分类、筛选或辅助内容切换使用 Tabs，避免在内容页继续增加侧边栏。
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
- Life 使用信息流顶部 New Post / 编辑按钮打开普通 Modal 发布与编辑，不使用路由驱动 Modal。
- 进入或关闭编辑 Modal 时应保留底层页面上下文，不进行不必要的滚动跳转。
- 用户界面不得展示内部字段名、调试数据、计划说明或“已修改某字段”一类实现说明。

## API 概览

公开浏览 API：

- `GET /api/languages`
- `GET /api/system-wordings`
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
- `GET /api/life-posts`：支持 `cursor` / `limit` 分页读取；支持 `search` 按 Life Post 正文搜索；支持 `tagId` 按 Life 标签筛选。
- `GET /api/discussions/:entityType/:entityId/comments`：读取实体讨论；`entityType` 支持 `pokemon`、`items`、`recipes`、`habitats`。

认证 API：

- `POST /api/auth/register`
- `POST /api/auth/verify-email`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

已验证用户编辑 API：

- Pokemon、栖息地、物品、材料单的创建、更新、删除。
- `GET /api/pokemon/fetch-options`：按搜索词返回 Pokemon CSV data 搜索结果；需要已验证用户；只返回 `id`、`identifier`、`name`。
- `POST /api/pokemon/fetch`：按 data identifier 或 Pokemon ID 查询 CSV 资料并填充 Pokemon 编辑表单；需要已验证用户；不直接保存 Pokemon。
- `POST /api/pokemon/image-options`：按 data identifier 或 Pokemon ID 查询 pokesprite 可用图片候选；需要已验证用户；只返回 `id`、`identifier` 和图片候选列表。
- Life Post 的创建，以及作者本人对 Life Post 的更新、删除。
  - `POST /api/life-posts`
  - `PUT /api/life-posts/:id`
  - `DELETE /api/life-posts/:id`
- Life Comment 的创建，以及作者本人对 Life Comment 的删除。
  - `POST /api/life-posts/:postId/comments`
  - `POST /api/life-posts/:postId/comments/:commentId/replies`
  - `DELETE /api/life-comments/:id`
- 实体讨论评论的创建、回复，以及作者本人对评论的删除。
  - `POST /api/discussions/:entityType/:entityId/comments`
  - `POST /api/discussions/:entityType/:entityId/comments/:commentId/replies`
  - `DELETE /api/discussions/comments/:id`
- Life Reaction 的设置、替换和取消。
  - `PUT /api/life-posts/:id/reaction`
  - `DELETE /api/life-posts/:id/reaction`
- 每日 CheckList 的创建、更新、删除、排序。
- 全局配置项的创建、更新、删除、排序。
- 语言的创建、更新、删除、排序。
- 系统级文案的查看和更新。
  - `GET /api/admin/system-wordings`
  - `PUT /api/admin/system-wordings/:key`
- Pokemon、物品、材料单、栖息地的列表排序。

## 开发与验证

- 本项目在 WSL 中开发，运行验证主要通过 Docker。
- 常规轻量验证：
  - `pnpm lint`
  - `pnpm typecheck`
- 不在 WSL 中运行测试作为完成任务的前置条件。
- Docker 运行问题以用户提供的 `docker compose up --build` 输出为准进行后续修复。
