# hotword-kit

新词上站工具包：查域名 + 生成 SEO 静态站。用法见 `README.md`。

## 项目命令

- 安装：无（Node 18+，零依赖）
- 构建：`node site.mjs build <站点目录名>`，产物在 `sites/<站点>/dist/`（不入库）
- 预览：`npx serve sites/<站点>/dist`
- 查域名：`node check-domain.mjs "<关键词>"`

## 规则

- 仓库公开：真实域名、联系邮箱靠构建时环境变量 `SITE_DOMAIN`、`CONTACT_EMAIL` 覆盖，不写进仓库；不提交任何密钥。
- 推 main 会触发 Cloudflare Pages 自动部署上线。推送前先问 Alex。

## AI 协作（Alex 的跨工具接力协议摘要）

- 状态只在仓库里：`.ai/TASK.md`（当前任务）、`.ai/NOW.md`（项目现状）、Git 提交。不依赖任何工具的会话历史。
- 开工：读本文件和 `.ai/TASK.md`（没有就读 `.ai/NOW.md`），看 `git log -5 --oneline`、`git status`，用三行复述目标 / 进度 / 下一步。
- 干活：有 TASK.md 时一次只做第一个未勾选步骤：跑该步验证 → 打勾 → 进度日志记一行 → 提交。不删改已有步骤。
- 收尾：更新 `.ai/NOW.md` 并提交。提交可以直接做，推送前先问 Alex。
- 「交接」「接手」「接入」三个口令的完整定义在 alex-work-system 仓库 `templates/ai-handoff-protocol.md`（本机已装进各 AI 工具的全局规则）。
