# Pokopia Wiki

## 产品目标

- Pokopia Wiki 是一个面向 Pokopia 游戏资料的社区 Wiki。
- 所有人都可以浏览 Wiki 内容。
- 已注册并完成邮箱验证且拥有对应权限的用户可以创建、编辑、删除 Wiki 内容。
- 前台以 Home 首页、Pokemon、栖息地、物品、材料单、每日 CheckList、Life、Automation、Dish、Events、Actions、Dream Island、Clothes 为主要浏览入口。
- Home 首页路径为 `/`，用于聚合公开 Wiki 入口；Logo 导航回到 Home，用户可从 Home 进入核心资料、每日 CheckList、Life 和正在准备中的分区。
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
  - Life Category
  - Game Version
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
- 认证邮件和密码重置邮件使用标准化 Pokopia Wiki 品牌 HTML 外壳；正文、按钮文案、兜底链接提示和纯文本版本仍通过 `surface=email` 的系统级文案维护。
- 后端从 Resend 邮件发送响应 headers 读取日/月发送额度和 rate limit 状态，并维护短期内存 snapshot；当 Resend 已报告额度接近用尽、额度耗尽或 API 限流时，认证邮件发送会暂时停止并返回本地化用户提示。
- Resend 额度保护不使用本项目自增发送计数；默认按 Free 计划 `100/day`、`3000/month` 和 5 封保留量判断，可通过 `RESEND_DAILY_QUOTA_LIMIT`、`RESEND_MONTHLY_QUOTA_LIMIT`、`RESEND_QUOTA_RESERVE`、`RESEND_QUOTA_SNAPSHOT_TTL_MINUTES` 调整。
- 验证邮件包含一次性验证链接。
- 验证 token 只保存 hash，并带过期时间和使用状态。
- 只有邮箱已验证的用户可以登录。
- 用户可请求重置密码：
  - 重置请求只接收邮箱，并始终返回泛化成功信息，避免暴露邮箱是否已注册。
  - 重置邮件包含一次性重置链接。
  - 重置 token 只保存 hash，并带过期时间和使用状态。
  - 密码重置成功后不自动登录，并删除该用户已有 session。
- 登录页提供 Remember me：
  - 未勾选时前端将登录 token 保存在 `sessionStorage` 的 `pokopia_auth_token`，服务端 session 有效期为 1 天。
  - 勾选时前端将登录 token 保存在 `localStorage` 的 `pokopia_auth_token`，服务端 session 有效期为 30 天。
- 登录成功后返回明文 session token 给前端；数据库只保存 session token hash。
- 用户可退出登录，退出时删除对应 session。
- 对外用户字段只包含必要信息：
  - 当前用户：`id`、`email`、`displayName`、`emailVerified`
  - 编辑署名：`id`、`displayName`
- User Profile：
  - 登录用户可通过 `/profile` 查看自己的账号资料、邮箱验证状态、Referral 信息和公开主页内容。
  - 任意用户可通过 `/profile/:id` 访问其他用户的公开 Profile。
  - 公开 Profile 展示用户公开摘要、Life Feeds、Wiki 贡献统计、Like / Reaction 过的 Life Post 和评论过的内容。
  - Profile 使用 Tabs 组织：Feeds、Contributions、Reactions、Comments；仅自己的 `/profile` 额外展示 Account。
  - Contributions、Reactions、Comments 在对应 Tab 内提供二级分类：Contributions 可按主要内容类型或配置类查看，Reactions 可按 reaction 类型查看，Comments 可按 Life / Wiki discussion 来源查看。
  - 公开用户摘要只包含 `id`、`displayName` 和公开展示需要的加入时间；不公开邮箱、角色、权限、Referral Code、邀请链接、session、token/hash 或内部审计 payload。
  - 当前用户可在自己的 `/profile` Account Tab 更新 `displayName`、查看 Referral 信息、复制 Referral 邀请链接，并修改密码；当前版本不支持头像或邮箱修改。
  - 当前用户自己的 Profile 顶部摘要区可显示简化 Referral Code 和 Copy Link 入口；完整 Referral 卡片保留 Referral Code、邀请链接复制入口和有效邀请数量；这些字段不在公开 Profile 展示。
  - 修改密码必须提交当前密码和新密码；成功后更新 password hash、作废未使用的密码重置 token，并保留当前 session、删除该用户其他 session。
  - 修改密码 API 只返回本地化结果 message，不返回 user、session、token/hash 或内部审计 payload。
  - 更新显示名后，API 仍只返回当前用户必要字段，不返回 session、token/hash、内部审计或调试数据。
  - 显示名用于编辑署名、讨论和 Life 内容作者展示。

## 用户角色与权限

- Pokopia 使用 RBAC 权限模型：
  - 用户通过 `user_roles` 关联到一个或多个角色。
  - 角色通过 `role_permissions` 关联到一个或多个权限。
  - 后端只按启用状态的权限 key 做访问控制；前端只用于展示或隐藏操作入口，不能作为权限边界。
- 邮箱验证仍是所有写入能力的基础门槛；未验证用户即使拥有角色也不能执行受保护写操作。
- 对外当前用户字段只包含必要信息：
  - `id`
  - `email`
  - `displayName`
  - `emailVerified`
  - `roles`：只包含 `id`、`key`、`name`、`level`
  - `permissions`：当前用户启用权限 key 列表
- 编辑署名仍只展示用户 `id` 和 `displayName`，不展示角色、权限、邮箱、token/hash 或内部元数据。
- 权限记录存储在 `permissions`：
  - `key`：稳定权限 key，例如 `pokemon.create`
  - `name`
  - `description`
  - `category`
  - `enabled`
  - `system_permission`：系统初始化权限标记，仅用于管理端识别默认权限
- 角色记录存储在 `roles`：
  - `key`
  - `name`
  - `description`
  - `level`：用于表达管理层级，数值越大层级越高
  - `enabled`
  - `system_role`：系统初始化角色标记，仅用于管理端识别默认角色
- 初始角色包含：
  - `owner`：最高层级，拥有所有系统权限。
  - `admin`：拥有内容、系统配置、用户、角色和权限管理能力。
  - `editor`：拥有主要 Wiki 内容创建、更新、排序、上传和社区互动能力，不默认拥有删除、用户、角色或权限管理能力。
  - `member`：拥有 Life、讨论发布和删除本人内容的社区能力。
  - `viewer`：无写入权限，仅用于显式只读分组。
- Bootstrap 规则：
  - 启动时若已有已验证用户但没有任何 `owner` 用户，系统自动将最早完成验证的用户加入 `owner` 角色。
  - 若系统还没有 `owner` 用户，首个完成邮箱验证的用户自动加入 `owner` 角色。
  - 已完成邮箱验证且没有任何角色的用户默认加入 `editor` 角色；已有角色关系的用户不被覆盖。
  - 系统初始化只补齐默认角色、默认权限、Owner 关联和无角色已验证用户的默认 Editor 关联；不覆盖管理员对默认角色/权限元数据或角色权限分配的配置。
  - 新建权限会自动关联到 `owner` 角色，确保 Owner 始终拥有可用权限全集；`owner` 角色的权限分配不能在管理端被手动删改。
  - 系统必须始终至少保留一个拥有 `admin.permissions.update` 且可管理权限的有效用户；核心 RBAC 管理权限（`admin.access`、`admin.users.*`、`admin.roles.*`、`admin.permissions.*`）不能被禁用或删除；不能删除最后一个 Owner，不能移除最后一个 Owner 的关键权限能力。
- 权限管理能力本身也通过权限控制；只有拥有相应管理权限的用户可以查看、新增、编辑、删除权限、角色和用户角色关系。
- 用户角色分配必须同时满足层级边界：
  - `PUT /api/admin/users/:id/roles` 的基础权限为 `admin.users.update`。
  - 调用者只能分配或移除 `roles.level` 严格低于自己最高启用角色等级的角色。
  - `owner` 角色只能由当前拥有启用 `owner` 角色且拥有 `admin.users.assign-owner` 权限的调用者分配或移除。
  - 非 Owner 即使拥有 `admin.users.update` 或自定义高等级角色，也不能分配或移除 `owner` 角色。
- 管理 API 只返回权限管理所需字段，不返回密码、session token hash、verification/reset token hash、内部审计 payload 或调试字段。

## Referral

- Referral 是账号功能，用于让已注册用户邀请新用户加入 Pokopia Wiki。
- 每个用户都有一个稳定的 Referral Code：
  - 由系统生成。
  - 全局唯一。
  - 只包含大写英文字母和数字。
  - 现有用户在首次读取 Referral 信息或重新注册未验证账号时自动补齐。
- 登录用户可在 `/profile` Account Tab 查看自己的 Referral Code、邀请链接复制入口和有效邀请数量。
- 邀请链接使用前端注册页路径：`/register?ref=CODE`。
- 注册页支持：
  - 从 `ref` query 自动填入 Referral Code。
  - 用户手动输入 Referral Code。
  - Referral Code 可为空。
- 注册提交时后端校验 Referral Code：
  - 无效 Referral Code 拒绝注册并返回本地化错误。
  - 用户不能使用自己的 Referral Code；如邮箱已存在且该账号已有 Referral Code，注册时不能将自己设为邀请人。
  - 已存在未验证账号重新注册时，不覆盖已有邀请关系。
- Referral 只有在被邀请用户完成邮箱验证后才计入有效邀请数量。
- Referral 不改变现有邮箱验证要求；用户仍必须验证邮箱后才能登录和编辑。
- 当前版本不提供积分奖励、排行榜、邀请邮件发送、邀请制注册限制、后台统计或公开邀请人资料页。
- Referral API 对外只返回当前用户自己的 Referral 摘要，不返回被邀请用户邮箱、token/hash、内部审计字段或被邀请用户明细。

## 滥用防护与限流

- 后端使用 `@fastify/rate-limit` 和应用内用户级计数在应用层执行限流；默认内存存储适用于当前单实例运行，后续多实例部署需要切换到共享存储或反向代理层限流。
- Fastify 默认不信任代理转发 IP；部署在可信反向代理后方时，可设置 `TRUST_PROXY=true`，让 IP 限流使用代理解析后的客户端 IP。
- 限流 key 不对外暴露；邮箱限流使用规范化小写邮箱生成内部 key，已登录用户限流使用当前登录用户 ID，路由限流使用 HTTP method + route pattern。
- 触发限流时 API 返回 429 和本地化通用错误文案，并带 `Retry-After` 与 rate limit headers；响应不得返回邮箱、用户 ID、内部 key、token/hash 或调试信息。
- 可配置的已登录用户限流存储在 `rate_limit_settings`：
  - `settings`：JSON object，保存各用户级限流策略的 `maxRequests`、`timeWindowSeconds` 和 `cooldownSeconds`
  - `updated_by_user_id`
  - `created_at`
  - `updated_at`
- 管理端 Access 分组提供 Rate limits 设置区；查看需要 `admin.rate-limits.read`，更新需要 `admin.rate-limits.update`。
- 已登录用户级限流策略仅按用户 ID 计数，不再叠加写入路由 IP 限流或用户 + 路由写入限流；认证入口和受保护路由的 IP 防护仍保留。
- 认证入口限流：
  - 注册、登录、验证邮箱、请求重置密码、提交重置密码均按 IP + 路由限制为 20 次 / 10 分钟。
  - 登录额外按邮箱限制为 5 次 / 15 分钟。
  - 注册额外按邮箱限制为 3 次 / 1 小时。
  - 请求重置密码额外按邮箱限制为 3 次 / 1 小时，并按 IP + 路由限制为 10 次 / 15 分钟。
  - 提交重置密码额外按 IP + 路由限制为 10 次 / 15 分钟。
- 已登录保护路由按 IP + 路由限制为 120 次 / 10 分钟，避免单一来源反复触发鉴权查询。
- 用户账号资料写入默认按用户 ID 限制为 20 次 / 1 小时，并有 5 秒冷却时间。
- 管理写入（System config 配置项、用户角色、角色、权限、语言、系统文案、AI 审核设置和限流设置）默认按用户 ID 限制为 120 次 / 1 小时，并有 2 秒冷却时间。
- Wiki 内容写入（Pokemon、物品、材料单、栖息地、每日 CheckList 和排序）默认按用户 ID 限制为 120 次 / 1 小时，并有 2 秒冷却时间。
- 上传默认按用户 ID 限制为 20 次 / 1 小时，并有 30 秒冷却时间。
- Community 写入：
  - Life Post、Life 评论、Wiki 讨论评论和对应删除 / 更新操作默认按用户 ID 限制为 60 次 / 1 小时，并有 5 秒冷却时间。
  - Life reaction 写入默认按用户 ID 限制为 120 次 / 1 小时，并有 1 秒冷却时间。
- Pokemon Fetch 数据和图片候选查询默认按用户 ID 限制为 60 次 / 10 分钟，并有 1 秒冷却时间。

## Community 编辑与审计

- 已验证且拥有对应权限的用户可以通过前台或管理入口编辑 Wiki 内容。
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
- 编辑署名、编辑历史署名、Life 作者和讨论作者可链接到对应公开 Profile。

## Wiki 图片上传

- 已验证且拥有对应上传权限的用户可以为以下 Wiki 实体上传图片：
  - Pokemon
  - 物品图标
  - 栖息地
- 上传图片只支持 `png`、`jpg/jpeg`、`webp`、`gif`。
- 上传图片由服务端保存到受控上传目录，不接受任意外部 URL，也不信任客户端传入的最终文件路径。
- 上传路径由服务端按实体类型、实体展示名称和时间戳生成，格式示例：
  - `items/甜蜜蜜/20260501002000.png`
  - `pokemon/Pikachu/20260501002000.png`
  - `habitats/森林/20260501002000.png`
- 路径中的实体名称仅用于资源归档和可读性，实体关联仍以数据库 ID 为准。
- 每次上传都会写入 `entity_image_uploads` 历史记录：
  - `entity_type`
  - `entity_id`
  - `entity_name`
  - `path`
  - `original_filename`
  - `mime_type`
  - `byte_size`
  - `created_by_user_id`
  - `created_at`
- 实体表只保存当前显示图片的相对路径；历史上传记录不会因为切换当前图片而删除。
- 公共 API 对外返回图片上传历史只包含：`id`、`path`、`url`、`uploadedAt` 和上传者必要署名 `uploadedBy`；不返回 `entity_name`、原始文件名、MIME、文件大小、服务器绝对文件路径或内部存储元数据。若编辑接口确需实体关联，只能在受保护编辑接口返回 `entityId`。
- 图片上传本身不直接改变实体内容；用户仍需保存实体编辑表单后，当前图片选择才成为实体行为并写入现有编辑审计。
- Docker 运行时上传目录必须使用 volume 持久化，避免重新 build 后丢失用户上传图片。

## 实体讨论

- Pokemon、物品、材料单、栖息地详情页支持讨论。
- 所有人都可以浏览实体讨论。
- 已注册并完成邮箱验证且拥有 `discussions.comments.create` 权限的用户可以发表评论，并回复顶层评论。
- 讨论回复只支持一层回复，不做无限嵌套。
- 评论作者拥有 `discussions.comments.delete` 权限时可以删除自己的评论；拥有 `discussions.comments.delete-any` 权限的用户可以删除其他用户评论；删除后正文不再展示，已有回复保留在原位置。
- 被删除实体的讨论会随实体删除一并清理。
- 讨论按创建时间正序展示。
- 讨论列表按顶层评论分页读取，支持 `limit` / `cursor`；每页顶层评论携带其一层回复，响应包含 `items`、`nextCursor`、`hasMore`、`total`。
- 实体讨论评论和回复必须进入 AI 审核；未审核通过的评论不向普通访客公开。
- 作者本人和拥有 `discussions.comments.delete-any` 权限的管理用户可看到相关评论的审核状态，并可触发重新审核。
- 审核状态包括：`unreviewed`、`reviewing`、`approved`、`rejected`、`failed`；前端面向用户展示为未审核、审核中、审核通过、审核不通过、审核失败。
- 新增或更新审核目标时先进入不可公开状态；只有 AI 审核通过后才进入普通公开讨论列表。
- 审核失败不等于审核通过；失败内容保持不可公开，用户可重新审核。
- AI 审核会自动识别评论适合的语言区，语言区使用启用状态的 `languages.code`，但不影响系统 UI 语言。
- 讨论列表支持按语言区读取；`language=all` 或不传语言参数时读取全部已公开语言区，传入具体语言 code 时只读取对应语言区。
- 讨论内容是用户生成内容，正文按作者输入展示，不进入 `entity_translations`。
- API 对外只返回评论作者的 `id` 和 `displayName`。
- API 不返回邮箱、token/hash、内部调试字段、AI prompt、模型原始响应、内部审核错误、`deleted_at`、`deleted_by_user_id` 等内部字段。

## AI 审核

- Life Post、Life Comment、实体讨论评论和实体讨论回复都是用户生成内容，必须经过 AI 审核。
- AI 审核支持 Gemini-compatible `generateContent` API 和 OpenAI-compatible `chat/completions` API；End Point、API Key、模型、API 格式、鉴权方式、RPM 限流和启用状态可由拥有 `admin.ai-moderation.*` 权限的管理员配置。
- 默认使用 Gemini-compatible `generateContent` API 和 Bearer token 鉴权，以兼容 NewAPI 等转发服务；鉴权方式仍支持 Gemini 原生 query `key`。
- 后端日志必须对 API Key 脱敏，且不回显给前端。
- 默认 End Point 为 `https://ai.example.com/v1beta`；API Key 不写入前端包，不回显给前端，管理 API 只返回是否已配置。
- 管理配置存储在后端受控表中；API 不返回 API Key 明文、模型原始响应、prompt、请求体、内部错误堆栈或调试字段。
- 后端日志可以记录安全脱敏后的第三方 HTTP 状态和错误摘要，用于排查 Endpoint、模型或鉴权配置问题；日志不得包含 API Key、审核 prompt 或用户正文。
- 服务端审核请求必须限流，按配置的每分钟请求数串行发送，避免触发第三方 API RPM 限制。
- 为节省 Token：
  - 审核只发送待审核正文、允许的语言 code 和最小必要规则，不发送用户资料、页面上下文、审计 payload 或无关业务数据。
  - 对相同正文和相同 API 配置/模型使用内容 hash 缓存审核结果，避免重复调用 AI。
  - 审核请求使用结构化 JSON 输出、低温度和较小输出 token 上限。
- 安全要求：
  - 用户正文必须作为不可信内容处理，不能作为系统指令或开发指令执行。
  - 不允许通过用户正文关闭、绕过或降低安全审核。
  - 不使用会关闭 Gemini 安全拦截的配置；如果 Gemini 安全机制拦截 prompt 或候选结果，该内容按审核不通过处理。
  - OpenAI-compatible 转发模式下仍必须使用独立系统指令和结构化 JSON 解析；模型未返回明确合法结果时按审核失败处理。
  - 模型返回格式不合法、网络失败、超时或限流失败时，内容标记为审核失败，不得公开。
  - 只有 `approved` 状态可向普通访客公开；`unreviewed`、`reviewing`、`rejected`、`failed` 均不可公开。
- 审核语言区独立于系统 UI 语言：
  - 前台可选择 All languages 或具体语言区浏览内容。
  - 发布时客户端可传当前语言区作为 hint，但最终语言区由服务端 AI 审核结果决定。
  - 如果 AI 无法识别到启用语言区，回退到默认语言。
- 审核状态对普通访客不用于解释内部流程；只在作者本人或有管理权限的用户需要处理内容时展示。

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

### Life Category

- 名称
- 是否默认选中：最多一个 Life Category 可设为默认；新建 Life Post 时默认选中该分类。
- 是否可评分：Rateable Life Category 下的 Life Post 可由用户进行 1-5 星评分。
- 用于 Life Post 分类展示和 Feed 筛选。

### Game Version

- 版本号 / 名称
- ChangeLog：可为空，用于说明该版本主要变化。
- 用于 Life Post 发布时选择关联的游戏版本。
- Life Post 可不选择游戏版本；未选择时前台不展示版本号。
- Game Version 支持管理端创建、编辑、删除和排序。

## Pokemon

Pokemon 可配置：

- 内部 ID：`id`，系统唯一，用于路由、外键和实体关联；普通 Pokemon 新建时优先与展示 ID 一致，活动 Pokemon 由系统分配唯一内部 ID
- 展示 ID：`display_id`，详情页、列表卡片和选择器中显示为 `#ID`
- 是否为活动物品：`is_event_item`
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

Pokemon 的展示 ID 在普通 Pokemon 和活动 Pokemon 之间可以重复，例如允许同时存在普通 `#1 妙蛙种子` 和活动 `#1 毽子草`。数据库只要求同一个 `display_id + is_event_item` 组合唯一；前端路由和实体关联必须继续使用内部 `id`，不能使用展示 ID 作为路由或外键。

Pokemon 编辑表单使用标签页组织字段：

- 编辑表单提供 Fetch data 功能：
  - 已验证且拥有 `pokemon.fetch` 权限的用户可在 Fetch 输入框输入 data identifier 或官方 data Pokemon ID，从同一个搜索输入查询基础资料或图片候选。
  - Fetch data 从仓库 `data/` CSV 查询基础资料并填入当前表单。
  - Fetch 输入框提供 data 列表搜索，搜索范围包含 Pokemon ID、identifier、当前语言名称和默认语言名称；结果只展示 `#ID`、名称和 identifier。
  - Fetch 搜索结果默认关闭，只在用户主动点击输入框或输入内容时展开；Escape、失焦 / 点击外部、选择结果后关闭。
  - Fetch 搜索不使用防抖或节流；前端在每次新搜索时取消上一条搜索请求，并且只渲染最新请求结果。
  - Fetch 只填入 CSV 可提供的字段：官方 data ID、名称、Genus、Height、Weight、Types、六维和名称/Genus 翻译；不填入 Details、喜欢的环境、特长、特长掉落物品或喜欢的东西。
  - Fetch data 不要求官方 data ID 与 Pokopia 展示 ID 相同；若表单 ID 已有用户输入则保留该展示 ID，只有新建且 ID 为空时才用官方 data ID 作为初始展示 ID。
  - Fetch 不直接创建或更新 Pokemon；用户仍需通过 Save 保存，保存时沿用现有编辑审计。
  - Fetch 根据 `languages.code` 自动匹配 CSV 语言列：`en`、`ja`、`ko`、`fr`、`de`、`es`、`it` 使用同名列；`zh-CN` / `zh-SG` 等简体语言使用 `zh_hans`；`zh-TW` / `zh-HK` / `zh-MO` 使用 `zh_hant`。
  - Fetch 会自动确保 canonical Pokemon Types 存在于 `pokemon_types`，Type ID 与 `data/localized_type_name.csv` 和 `frontend/public/types` 图标文件保持一致；用户不需要为 Fetch 手工创建 Type 配置。
  - Type 展示使用 `frontend/public/types/small/{typeId}.png` 图标并保留文字名称。
- 编辑表单提供 Pokemon 图片选择功能：
  - 已验证且拥有 `pokemon.fetch` 权限的用户通过 Fetch data 的同一个 data identifier / 官方 data Pokemon ID 输入框，从 `https://pokesprite.tootaio.com/sprites/` 静态图片树查询对应 Pokemon 的可用图片候选。
  - 图片候选只使用 `/sprites/pokemon/...` 相对路径，后端按固定资源族生成候选并用 `HEAD` 校验存在性；不保存任意外部 URL。
  - 静态图片与官方 data identifier / 官方 data Pokemon ID 关联，不与 Pokopia 可编辑展示 ID 关联；用户修改 Pokopia 展示 ID 后，已选静态图片仍可保存。
  - 图片选择不直接创建或更新 Pokemon；用户仍需通过 Save 保存，保存时沿用现有编辑审计。
  - 图片选择界面使用 Pokédex 风格：上方显示当前选择的大图，大图下方显示版本、状态和描述，再下方以缩略图网格展示同一 Pokemon 的不同风格 / 版本 / 状态。
  - Pokemon 保存显示图片的相对路径、风格、版本、状态和描述；API 对外返回可直接展示的图片 URL，但不暴露内部校验状态。
  - Pokemon 也支持社区上传图片；上传图片使用通用 Wiki 图片上传历史，当前显示图片可在静态候选和上传图片之间切换。
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
- Pokemon 列表卡片只展示 Pokemon 图片和下方的 `#ID 名称`；不展示喜欢的环境、属性、特长、喜欢的东西或编辑元信息。
- Pokemon 卡片在已配置图片时展示所选图片缩略图；未配置图片时保留默认 Poké Ball 标记。

Pokemon 详情页展示：

- 基本信息
- 详情主内容在六维 Stats 右侧始终保留正方形图片区；已配置图片时展示居中的 Pokédex 风格图片，未配置图片时展示默认 Poké Ball 占位符；页面内不直接展示图片版本、状态或描述，用户可通过图片 Modal 查看详情。
- 主内容顶部按以下布局展示：
  - 左上：Genus & Details；无区块标题；如有 Genus，先展示 Genus，再以分割线连接 Details 内容
  - 左下：Height / Weight 与 Types 按 2:1 比例并排；Height / Weight 无区块标题，在 Dimension 区内左右并排展示并以中间分割线隔开，每组按英制、分割线、公制、标签上下排列；Types 不显示 Type 1 / Type 2 文案，上下布局并居中展示
  - 右侧：六维 Stats；图片或默认占位符展示在 Stats 右侧
- 六维使用 ProgressBar 展示，最大值按 150 计算。
- 特长
- 特长掉落物品：展示掉落物品图标；未配置图标时显示默认物品标记占位符
- 喜欢的环境
- 喜欢的东西
- 相关 Pokemon：与关联喜欢的东西的物品在桌面端左右并排展示；按相同喜欢的环境优先，其次按共同喜欢的东西数量从多到少排序；支持按喜欢的环境筛选，默认筛选当前 Pokemon 的喜欢的环境，也可切换到其他喜欢的环境或全部；每个筛选视图最多展示 6 个；每项左侧展示 Pokemon 图片或默认 Poké Ball 占位符，原列表项信息布局保持不变，第一行左侧展示名称，右侧展示特长和喜欢的环境，第二行展示喜欢的东西，并高亮共同喜欢的东西
- 关联喜欢的东西的物品：与相关 Pokemon 在桌面端左右并排展示；每项展示物品图标，未配置图标时显示默认物品标记占位符
- 出现的栖息地：每行左侧展示栖息地图片，未配置图片时显示默认栖息地标记占位符
- 最后编辑信息
- 讨论
- 编辑历史：通过详情页 Tabs 展示

## 物品

物品可配置：

- 名称
- 是否为活动物品：`is_event_item`
- 分类：必填
- 用途：可为空
- 入手方式：可多选
- 客制化：
  - 可染色
  - 可双区染色
  - 可改花纹
- 无材料单：`no_recipe`
- 标签：使用喜欢的东西配置，可多选
- 图标图片：通过通用 Wiki 图片上传维护当前图标和历史上传记录
- 翻译
- 排序

物品列表功能：

- 搜索
- 按分类展示为标签页
- 按用途筛选
- 按标签筛选
- 按自定义排序展示
- 物品列表卡片使用与 Pokemon 列表一致的居中图鉴式布局，只展示物品图标、名称和分类；不展示标签、入手方式或编辑元信息。
- 有用途的物品在卡片左上角以斜 Ribbon 展示用途名称。
- 已配置图标时，物品卡片展示图标缩略图；未配置图标时保留默认物品标记。

物品详情页展示：

- 基本信息
- 当前图标图片；未配置图标时展示默认物品标记占位符
- 顶部按图标 / 占位符与核心信息概览并排展示，移动端改为单列；顶部概览卡片不显示 `Image` / `Details` 通用区块标题，也不展示图片历史缩略图
- 分类
- 用途
- 入手方式
- 客制化
- 标签
- 关联材料单：展示结果物品图标和材料物品图标；未配置图标时显示默认物品标记占位符
- 作为材料出现的材料单：展示结果物品图标和材料物品图标；未配置图标时显示默认物品标记占位符
- 相关栖息地：展示栖息地图片或默认栖息地标记占位符，并展示配方材料物品图标
- 相关 Pokemon 掉落：展示 Pokemon 图片；未配置图片时显示默认 Poké Ball 占位符
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
- 材料单列表卡片使用与 Pokemon 列表一致的居中图鉴式布局，按结果物品展示图标、名称和分类；不展示编辑元信息。
- 有用途的结果物品在卡片左上角以斜 Ribbon 展示用途名称。
- Create Recipe 按钮展示在结果物品名称下方；已有材料单的卡片保留同等按钮空间但不显示按钮；标记为无材料单的物品展示禁用按钮；可创建材料单的物品展示可点击按钮并进入创建流程。

材料单详情页展示：

- 结果物品图片或默认材料单标记占位符；顶部概览卡片不显示 `Image` / `Details` 通用区块标题
- 结果物品名称、分类和用途；`GET /api/recipes/:id` 的 `item` 字段返回展示所需的 `id`、`name`、`image`、`category`、`usage`
- 入手方式
- 需要材料列表：展示材料物品图标；未配置图标时显示默认物品标记占位符
- 最后编辑信息
- 讨论
- 编辑历史

## 栖息地

栖息地可配置：

- 名称
- 是否为活动物品：`is_event_item`
- 配方：多项物品 + 数量
- 可出现的 Pokemon
- 图片：通过通用 Wiki 图片上传维护当前图片和历史上传记录
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
- 栖息地列表卡片使用与 Pokemon 列表一致的居中图鉴式布局，只展示栖息地图片和名称；不展示配方摘要、可能出现的 Pokemon 摘要或编辑元信息。
- 已配置图片时，栖息地卡片展示图片缩略图；未配置图片时保留默认栖息地标记。

栖息地详情页展示：

- 当前图片；未配置图片时展示默认栖息地标记占位符
- 顶部按图片 / 占位符与核心信息概览并排展示，移动端改为单列；顶部概览卡片不显示 `Image` / `Details` 通用区块标题，也不展示图片历史缩略图
- 配方列表：展示材料物品图标；未配置图标时显示默认物品标记占位符
- 可能出现的 Pokemon 列表：展示 Pokemon 图片；未配置图片时显示默认 Poké Ball 占位符
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

  - 已验证且拥有对应 CheckList 权限的用户可新增、编辑、删除 Task。
  - 已验证且拥有 `checklist.order` 权限的用户可通过 Handle 拖拽排序。

## Life

Life 是社区生活分享信息流，类似轻量社交动态。

Life Post 可配置：

- Post 内容正文
- Category：使用 Life Category 配置，必须且只能选择 1 个
- Game Version：可为空，使用 Game Version 配置；有值时在 Post 卡片展示版本号。
- 创建者、最后编辑者、创建时间、最后编辑时间
- 评论
- 评论回复：仅支持回复顶层评论，不做无限嵌套
- Reactions：`like`、`helpful`、`fun`、`thanks`
- Ratings：Rateable Category 下的 Post 支持 1-5 星评分；每个用户每条 Post 最多一条评分，重复评分会替换原评分。

前台行为：

- 所有人都可以浏览 Life 信息流。
- 信息流按创建时间倒序展示。
- 已注册并完成邮箱验证且拥有 `life.posts.create` 权限的用户可以发布 Life Post。
- 作者本人拥有 `life.posts.update` / `life.posts.delete` 权限时可以编辑、删除自己的 Life Post；删除 Life Post 使用软删除。
- 拥有 `life.posts.update-any` / `life.posts.delete-any` 权限的用户可以管理其他用户的 Life Post。
- 已注册并完成邮箱验证且拥有 `life.posts.create` 或 `life.posts.update` 权限的用户发布或编辑 Life Post 时必须选择 1 个 Life Category。
- 已注册并完成邮箱验证且拥有 `life.comments.create` 权限的用户可以评论 Life Post，并回复顶层评论。
- 评论作者拥有 `life.comments.delete` 权限时可以删除自己的评论；拥有 `life.comments.delete-any` 权限的用户可以删除其他用户评论；删除评论后正文不再展示，已有回复保留在原位置。
- 已软删除的 Life Post 不出现在信息流、搜索或 Category 筛选结果中，也不能继续编辑、评论或设置 Reaction。
- 每条 Life Post 默认只展示评论入口与评论数量；评论列表、回复和评论输入默认折叠，用户点击后展开。
- Life Feed 只随每条 Life Post 返回评论总数和最近少量评论预览；完整评论列表在展开评论区后通过独立分页接口按顶层评论正序读取，每页顶层评论携带其一层回复。
- 已注册并完成邮箱验证且拥有 `life.reactions.set` 权限的用户可以对每条 Life Post 选择一个 Reaction；普通点击默认设置 `like`，再次点击 `like` 会取消，当前为其他 Reaction 时普通点击会替换为 `like`。
- Life Reaction 的其他类型通过右键 / context menu 或可见展开按钮打开 Popup 选择；再次选择当前 Reaction 会取消，选择其他 Reaction 会替换原 Reaction。
- 已注册并完成邮箱验证且拥有 `life.ratings.set` 权限的用户可以对 Rateable Life Post 设置或取消 1-5 星评分；非 Rateable Category 下的 Post 不显示评分控件，也不能通过 API 评分。
- Life Post 展示评分时只展示平均分、评分人数和当前用户自己的评分；不展示其他用户的评分明细。
- 支持按 Life Post 正文搜索；用户按 Enter 或点击 Search 按钮后提交搜索，不随输入实时请求；搜索结果仍按创建时间倒序展示并分页加载。
- Feed 使用 Tabs 展示 Life Category 筛选；包含 All 和后台配置的 Life Category；点击 Category 后按该 Category 筛选，搜索和 Category 筛选可以同时生效。
- Feed 使用语言筛选展示 All languages 和启用语言；语言区筛选独立于系统 UI 语言，搜索、Category 和语言筛选可以同时生效。
- Feed 支持按 Game Version 筛选；All versions 表示不过滤版本。
- Feed 支持 Rateable 筛选；All 表示不过滤，Rateable only 只展示可评分 Category 下的 Post。
- Feed 支持排序：Latest 默认按创建时间倒序；Oldest 按创建时间正序；Top rated 按平均评分倒序，同分时按创建时间倒序。
- 信息流分页加载，初始展示最新一页，滚动到底部自动加载更多。
- 当前没有图片上传、转发或置顶。
- Life Post 和 Life Comment 必须进入 AI 审核；未审核通过的内容不向普通访客公开。
- 作者本人和拥有对应 `*-any` 管理权限的用户可以看到相关内容的审核状态，并可触发重新审核。
- Life Post 必须展示审核状态：审核中、未审核、审核失败、审核不通过；审核通过也可作为状态展示。
- 新增或更新 Life Post 后先进入不可公开状态，AI 审核通过后才出现在普通公开 Feed。
- Life Comment 和回复审核通过后才出现在普通公开评论列表、评论数量和评论预览中。
- 审核失败不等于审核通过；失败内容保持不可公开，用户可重新审核。
- Life Post 是用户生成内容，正文按作者输入展示，不进入 `entity_translations`。

API 暴露边界：

- Life Post 作者信息只返回 `id` 和 `displayName`。
- Life Post Category 只返回 `id` 和按当前语言解析后的 `name`。
- Life Post Game Version 只返回 `id`、展示用 `name` 和可展示 `changeLog`；未选择版本时返回 `null`。
- Life Post Rating 只返回 `ratingAverage`、`ratingCount` 和当前用户自己的 `myRating`；不返回其他用户的评分明细。
- Life Post 可返回面向用户展示所需的审核状态、审核语言区和是否可重审；不返回内部错误、AI prompt、模型响应或 retry 细节。
- Life Comment 作者信息只返回 `id` 和 `displayName`。
- Life Reaction 对外只返回按类型汇总的数量和当前用户自己的 Reaction，不返回其他用户的 Reaction 明细。
- Life Post 列表 API 返回分页结果：`items`、`nextCursor`、`hasMore`；`cursor` 是不透明分页令牌。每个 Life Post 的评论字段只包含已公开或当前用户可见评论的 `commentCount` 和 `commentPreview`，不内嵌完整评论列表。
- Life Comment 列表 API 返回分页结果：`items`、`nextCursor`、`hasMore`、`total`；`cursor` 是不透明分页令牌；普通访客只读取审核通过评论。
- API 不返回邮箱、token/hash、内部调试字段、AI prompt、模型原始响应、内部审核错误或不必要的审计 payload。
- API 不返回 Life Post 的 `deleted_at`、`deleted_by_user_id` 等内部软删除字段。
- 非作者只有拥有对应 `*-any` 管理权限时才能编辑或删除其他用户的 Life Post 或 Life Comment。

## 开发中入口

以下前台公开入口当前仅展示“正在开发中”占位页，不提供数据模型、后端 API、编辑表单、管理入口或排序能力：

- Automation：未来用于分享自动化基地（亦称工厂）创建方案、材料产出、所需 Pokemon、生产顺序和共同喜好物品。
- Dish
- Events
- Actions：游戏内快捷动作，例如挥手、跳舞等。
- Dream Island
- Clothes

这些开发中入口在主导航和占位页中显示状态 Badge，便于用户识别当前功能状态。

## 法律页面、版权与来源声明

- 前台提供公开静态法律页面：
  - `/privacy-policy`：隐私政策。
  - `/terms-of-service`：服务条款。
  - `/disclaimers`：免责声明、第三方来源和权利归属说明。
- 法律页面只展示站点政策、来源和版权相关文案，不提供编辑表单、后端 API、数据库模型、管理入口或用户提交流程。
- 全局 `AppShell` 页脚展示：
  - `Copyright {year} Tootaio Studio. All rights reserved.`
  - Privacy Policy、Terms of Service、Disclaimers 链接。
  - PokeAPI 数据与图片资源、社区贡献和 Pokemon 相关权利归属的简短说明。
- Pokopia Wiki 不是 Nintendo、The Pokemon Company、Game Freak、Creatures、PokeAPI 或 `pokopiawiki.com` 的官方、附属、赞助或背书项目。
- Pokopia Wiki 会使用或参考 PokeAPI 数据、PokeAPI 图片资源、`https://www.pokopiawiki.com/` 和其他公开资料；页面必须清楚说明引用来源不代表从属、赞助、背书或官方认可。
- Pokemon 相关名称、图片、标志、角色和游戏素材归其各自权利人所有。
- 法律页面和页脚文案必须通过系统级文案 catalog 管理，并支持现有语言回退机制。

## 前端交互与 UI

- UI 风格以 `DesignGuidelines.html` 为准。
- 页面结构以 `AppShell`、`PageHeader`、列表、详情区和管理区为核心。
- 全局主导航使用 `AppShell` 侧边栏；移动端通过导航按钮打开侧边栏抽屉。
- 管理入口在全局侧边栏中保持单一 Admin 入口，`/admin` 内部使用页面内二级菜单分组组织管理模块：
  - 配置：System config。
  - 内容：Daily CheckList、Pokemon、物品、材料单和栖息地的维护、排序或删除入口。
  - 本地化：Languages、System wordings。
  - 访问权限：Users、Roles、Permissions、Rate limits。
- 登录用户的侧边栏账号入口进入 `/profile`；User Profile 属于账号入口，不作为 Wiki 主内容导航项。
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
- 权限不足时前端可以隐藏或禁用对应操作；后端必须返回本地化 403，并且不得在 UI 暴露内部权限 key 作为普通用户提示。

## Technical SEO

- 前端发布基础 SEO 静态资源：
  - `favicon.ico`
  - 默认社交分享图
  - 品牌 Logo 素材
- `VITE_SITE_URL` 定义 canonical、Open Graph URL、robots sitemap 地址和 sitemap URL 的站点根地址；当前公开站点为 `https://pokopiawiki.tootaio.com`，本地前端端口默认使用 `http://localhost:20015`。
- 前端入口 `index.html` 提供默认 title、description、robots、canonical、Open Graph、Twitter card 和 favicon；客户端路由切换后根据当前路由更新页面 metadata。
- 主要公开浏览入口可索引：
  - `/pokemon`
  - `/habitats`
  - `/items`
  - `/recipes`
  - `/checklist`
  - `/life`
- `sitemap.xml` 当前只包含稳定的公开顶层浏览入口；实体详情页和公开 Profile 依赖运行时数据与站内链接可达性，当前不静态写入 sitemap。
- Pokemon、物品、材料单和栖息地详情页在公开详情数据加载完成后，用实体名称、公开展示图片和本地化 SEO 文案更新 title、description、canonical、Open Graph 和 Twitter card。
- 认证、管理、新建、编辑和开发中入口必须设置 `noindex`，避免搜索引擎索引受保护、低价值或临时流程页面。
- 新建页面 canonical 指向对应列表页；编辑 Modal 路由 canonical 指向对应实体详情页。
- SEO metadata 只能使用公开业务数据和系统文案；不得暴露邮箱、权限 key、token/hash、内部审计 payload、调试信息或实现说明。
- 多语言 metadata 使用当前前端语言和系统文案回退机制；当前没有语言专属 URL，因此暂不输出 `hreflang`。

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
- `GET /api/life-posts`：支持 `cursor` / `limit` 分页读取；支持 `search` 按 Life Post 正文搜索；支持 `categoryId` 按 Life Category 筛选；支持 `language` 按审核语言区筛选，`all` 表示全部语言区；支持 `gameVersionId` 按 Game Version 筛选；支持 `rateable` 按可评分 Category 筛选；支持 `sort` 为 `latest`、`oldest` 或 `top-rated`。
- `GET /api/life-posts/:postId/comments`：支持 `cursor` / `limit` 分页读取 Life Post 评论；支持 `language` 按审核语言区筛选。
- `GET /api/users/:id/profile`：读取公开用户 Profile 摘要、Wiki 贡献统计和公开社区统计。
- `GET /api/users/:id/life-posts`：分页读取该用户发布过且未删除的 Life Post。
- `GET /api/users/:id/reactions`：分页读取该用户设置过 Reaction 且目标未删除的 Life Post。
- `GET /api/users/:id/comments`：分页读取该用户未删除的 Life 评论和实体讨论评论。
- `GET /api/discussions/:entityType/:entityId/comments`：支持 `cursor` / `limit` 分页读取实体讨论；支持 `language` 按审核语言区筛选；`entityType` 支持 `pokemon`、`items`、`recipes`、`habitats`。

认证 API：

- `POST /api/auth/register`
- `POST /api/auth/verify-email`
- `POST /api/auth/login`
- `POST /api/auth/request-password-reset`
- `POST /api/auth/reset-password`
- `GET /api/auth/me`
- `PATCH /api/auth/me`：更新当前用户显示名；需要登录；只接收并返回当前用户必要字段。
- `GET /api/auth/referral`：读取当前用户 Referral 摘要；需要登录；返回 `referral`，其中只包含 `code`、`url`、`verifiedReferralCount`。
- `POST /api/auth/logout`

权限管理 API：

- `GET /api/admin/users`：需要 `admin.users.read`
- `PUT /api/admin/users/:id/roles`：需要 `admin.users.update`；分配或移除 `owner` 还需要调用者本身是 Owner 且拥有 `admin.users.assign-owner`；所有角色变更受 `roles.level` 层级限制
- `GET /api/admin/roles`：需要 `admin.roles.read`
- `POST /api/admin/roles`：需要 `admin.roles.create`
- `PUT /api/admin/roles/:id`：需要 `admin.roles.update`
- `DELETE /api/admin/roles/:id`：需要 `admin.roles.delete`
- `PUT /api/admin/roles/:id/permissions`：需要 `admin.roles.update`
- `GET /api/admin/permissions`：需要 `admin.permissions.read`
- `POST /api/admin/permissions`：需要 `admin.permissions.create`
- `PUT /api/admin/permissions/:id`：需要 `admin.permissions.update`
- `DELETE /api/admin/permissions/:id`：需要 `admin.permissions.delete`

受权限保护的编辑 API：

- Pokemon、栖息地、物品、材料单的创建、更新、删除分别需要对应实体的 `create`、`update`、`delete` 权限。
- `GET /api/pokemon/fetch-options`：按搜索词返回 Pokemon CSV data 搜索结果；需要 `pokemon.fetch`；只返回 `id`、`identifier`、`name`。
- `POST /api/pokemon/fetch`：按 data identifier 或 Pokemon ID 查询 CSV 资料并填充 Pokemon 编辑表单；需要 `pokemon.fetch`；不直接保存 Pokemon。
- `POST /api/pokemon/image-options`：按 data identifier 或 Pokemon ID 查询 pokesprite 可用图片候选；需要 `pokemon.fetch`；只返回 `id`、`identifier` 和图片候选列表。
- `POST /api/uploads/:entityType`：上传 Wiki 图片；需要对应实体上传权限；`entityType` 支持 `pokemon`、`items`、`habitats`；返回图片历史记录项和可展示 URL。
- Life Post 的创建，以及作者本人对 Life Post 的更新、删除，需要对应 `life.posts.*` 权限；管理他人内容需要对应 `*-any` 权限。
  - `POST /api/life-posts`
  - `PUT /api/life-posts/:id`
  - `DELETE /api/life-posts/:id`
  - `POST /api/life-posts/:id/moderation/retry`
- Life Comment 的创建，以及作者本人对 Life Comment 的删除，需要对应 `life.comments.*` 权限；管理他人内容需要对应 `*-any` 权限。
  - `POST /api/life-posts/:postId/comments`
  - `POST /api/life-posts/:postId/comments/:commentId/replies`
  - `DELETE /api/life-comments/:id`
  - `POST /api/life-comments/:id/moderation/retry`
- 实体讨论评论的创建、回复，以及作者本人对评论的删除，需要对应 `discussions.comments.*` 权限；管理他人内容需要对应 `*-any` 权限。
  - `POST /api/discussions/:entityType/:entityId/comments`
  - `POST /api/discussions/:entityType/:entityId/comments/:commentId/replies`
  - `DELETE /api/discussions/comments/:id`
  - `POST /api/discussions/comments/:id/moderation/retry`
- Life Reaction 的设置、替换和取消。
  - `PUT /api/life-posts/:id/reaction`
  - `DELETE /api/life-posts/:id/reaction`
- Life Rating 的设置、替换和取消。
  - `PUT /api/life-posts/:id/rating`
  - `DELETE /api/life-posts/:id/rating`
- 每日 CheckList 的创建、更新、删除、排序需要对应 `checklist.*` 权限。
- 全局配置项的查看、创建、更新、删除、排序需要对应 `admin.config.*` 权限。
- 限流设置的查看和更新通过 Access 权限控制：
  - `GET /api/admin/rate-limits`：需要 `admin.rate-limits.read`
  - `PUT /api/admin/rate-limits`：需要 `admin.rate-limits.update`
- 语言的查看、创建、更新、删除、排序需要对应 `admin.languages.*` 权限。
- 系统级文案的查看和更新需要对应 `admin.wordings.*` 权限。
- `GET /api/admin/system-wordings`
- AI 审核配置的查看和更新需要对应 `admin.ai-moderation.*` 权限。
  - `GET /api/admin/ai-moderation`
  - `PUT /api/admin/ai-moderation`
- `PUT /api/admin/system-wordings/:key`
- Pokemon、物品、材料单、栖息地的列表排序需要对应实体的 `order` 权限。

## 开发与验证

- 本项目在 WSL 中开发，运行验证主要通过 Docker。
- 常规轻量验证：
  - `pnpm lint`
  - `pnpm typecheck`
- 不在 WSL 中运行测试作为完成任务的前置条件。
- Docker 运行问题以用户提供的 `docker compose up --build` 输出为准进行后续修复。
