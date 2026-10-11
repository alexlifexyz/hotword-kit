# 新词上站工具包（hotword-kit）

从"发现一个新词"到"站点上线、提交 Google"的最短流程。两个脚本，零依赖，只需要 Node 18+。

```
check-domain.mjs   查域名：关键词 → 候选域名 → 是否可注册 → 推荐
site.mjs           建站：生成配置 → 生成静态站（SEO 结构、隐私/条款页、sitemap 都自带）
template/          页面模板（一般不用改）
sites/             你的每个站一个文件夹
```

---

## 完整流程（目标：1 小时内上线）

### 1. 找新词

- 来源：Google Trends（看"飙升"）、新 AI 产品发布、Product Hunt、X 上的热帖、哥飞社群里大家分享的词。
- 判断标准（哥飞的建议）：Ahrefs 关键词难度 KD < 10、引用域名 < 10。新词刚出现时竞争少，搜索量高低不是第一位的。
- 先确认这是一个**英文**搜索词，目标是 Google 的全球流量。

### 2. 查域名

```bash
node check-domain.mjs "sora 2"
```

会查这些组合，并按推荐顺序给出结果：

| 优先级 | 类型 | 例子 |
|---|---|---|
| 1 | 完全匹配 .com | sora2.com |
| 2 | 完全匹配 .ai / .io / .co | sora2.ai |
| 3 | .com 变体 | sora2ai.com、getsora2.com、sora2online.com |
| 4 | 完全匹配其他后缀 | sora2.org、sora2.app |
| 5 | 带连字符 | sora-2.com |

常用参数：

```bash
node check-domain.mjs "nano banana" --tlds com,ai      # 只查这两个后缀
node check-domain.mjs "nano banana" --no-variants      # 不查 .com 变体
node check-domain.mjs "nano banana" --json             # 输出 JSON
```

说明：
- 走的是各注册局的官方 RDAP 接口，结果是实时的。
- .io 和 .co 没有公开 RDAP，用本机的 `whois` 命令兜底。macOS 自带；Linux 用 `sudo apt install whois` 装；Windows 没有，这两个后缀去注册商页面手动查。
- **查不到记录不等于一定能注册**（可能是溢价词或保留词），以注册商结账页为准。

### 3. 注册域名

推荐 Cloudflare Registrar（按成本价，后面部署到 Cloudflare Pages 也方便）或 Namecheap，.com 大约 10 美元一年。

### 4. 生成站点

```bash
node site.mjs new "sora 2" sora2ai.com
```

会生成 `sites/sora2ai.com/`，里面两个文件要改：

- **site.json**：标题、描述、介绍、特性、使用步骤、FAQ。所有写着 `TODO` 的地方都要换成真实内容。
- **tool.html**：放真正的工具。用户是冲着"能直接用"来的，这块决定了排名和留存，别留占位。

改完生成：

```bash
node site.mjs build sora2ai.com
```

build 会检查还有没有没填的 TODO、标题和描述长度是否超标，有问题会提示。

本地预览：

```bash
npx serve sites/sora2ai.com/dist
```

`sites/example.com/` 是一个填好的完整示例（一个能用的字数统计工具），可以照着改。

**不想把域名、邮箱写进仓库？** build 时可以用环境变量覆盖 site.json 里的对应字段，适合仓库公开的情况：

| 环境变量 | 覆盖字段 |
|---|---|
| `SITE_DOMAIN` | `domain`（影响 canonical、sitemap、robots） |
| `CONTACT_EMAIL` | `contactEmail` |
| `GA_ID` | `gaId` |
| `ADSENSE_CLIENT` | `adsenseClient` |

```bash
SITE_DOMAIN=yourdomain.com CONTACT_EMAIL=you@yourdomain.com node site.mjs build example.com
```

在 Cloudflare Pages 或 Vercel 上，把这些写进项目的环境变量里就行。

生成的站点自带：
- title、description、canonical、Open Graph 标签
- WebSite 和 FAQPage 结构化数据（有机会在搜索结果里显示 FAQ）
- sitemap.xml、robots.txt、404 页（noindex）
- About、Privacy Policy、Terms 页（申请 AdSense 基本都需要）
- 自动深色模式、手机适配、favicon
- 纯静态 HTML，打开速度快

### 5. 部署上线

**方式 A：Cloudflare Pages（推荐，域名也在 Cloudflare 时最省事）**

```bash
npx wrangler pages deploy sites/sora2ai.com/dist --project-name sora2ai
```

第一次会让你登录 Cloudflare。部署完在 Cloudflare 后台 → Workers & Pages → 这个项目 → Custom domains，绑定 `sora2ai.com`。

**方式 B：Vercel（哥飞常用）**

```bash
npx vercel deploy sites/sora2ai.com/dist --prod
```

然后在 Vercel 后台 → Project → Settings → Domains 绑定域名，按提示去注册商改 DNS。

两种方式都免费，都会自动处理 `/about` 这种不带 `.html` 的地址。

### 6. 提交 Google

1. 打开 [Google Search Console](https://search.google.com/search-console)，添加"网域"资源，按提示加一条 DNS TXT 记录验证。
2. 左侧"站点地图"，提交 `sitemap.xml`。
3. 左侧"网址检查"，输入首页地址，点"请求编入索引"。
4. 去 Google 经常抓取的地方发一下链接（比如 V2EX、Reddit 相关版块、X），加快收录。哥飞的经验是有了外链后大约一周能进前 10。

### 7. 变现

- **AdSense**：审核通过后，把 `ca-pub-xxxxxxxx` 填进 site.json 的 `adsenseClient`，重新 build 和部署。会自动加广告代码和 `ads.txt`，在 AdSense 后台开"自动广告"即可。
- **Google Analytics**：把 `G-XXXXXXX` 填进 `gaId`。
- AI 工具类站点，付费订阅通常比纯广告收入高，有用户基础后可以考虑。

---

## 几条原则

- **快速上、多上**。不是每个站都会有流量，靠数量提高命中率。
- **内容要真**。只换标题的空壳页很难排上去，至少把工具、介绍和 FAQ 写实。
- **别冒充官方**。新词经常是别人的产品名，About 页默认写了"非官方、无关联"的声明，不要用对方的 logo，标题里也别写 "Official"。
- **隐私和条款页是通用模板**，不构成法律意见。站点涉及收集用户数据、付费等情况时，按实际情况修改。
