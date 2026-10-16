# hotword-kit NOW

更新时间：2026-10-16

> 本仓库公开。这里只写工程状态，不写密钥、账号细节或个人信息。

## 这是什么

新词上站工具包：`check-domain.mjs` 查域名，`site.mjs` 生成带 SEO 结构、隐私 / 条款页、sitemap 的静态站。线上实例是 lab.alexai.top（用 `sites/example.com` 的配置构建）。

## 技术栈

Node 18+，零依赖。构建产物 `sites/*/dist/` 不入库。

## 怎么构建和预览（2026-10-16 实测，Node 22）

```bash
node site.mjs build example.com          # 生成 sites/example.com/dist/（9 个文件，含 ads.txt）
npx serve sites/example.com/dist         # 本地预览
SITE_DOMAIN=lab.alexai.top node site.mjs build example.com   # 线上用的域名
```

没有测试套件；验证方式是 build 成功并检查 `dist/` 里的页面。

## 部署

Cloudflare Pages 项目连了 Git：推 main 自动构建，约 40 秒上线。不需要本地 `wrangler pages deploy`。
线上 `CONTACT_EMAIL` 在 Pages 环境变量里覆盖；**改成本地构建直传时必须手动传 `CONTACT_EMAIL`**，否则 `site.json` 里的占位邮箱会上线。

## 当前状态

- 2026-10-15 接入 AdSense（`59d00fc`），已部署并核验：`/ads.txt` 200，脚本进了各页，页面不含占位邮箱。
- 收入 $0，AdSense 审核中。

## 下一步

- 【本人】Search Console 提交 `https://lab.alexai.top/sitemap.xml` 并请求编入索引。
- 可选：Pages 环境变量 `CONTACT_EMAIL` 设一个能收信的地址，about / privacy / terms 现在没有联系邮箱。

## 建议

**维护**：工具包能跑，lab 站随新词实验偶尔更新。
