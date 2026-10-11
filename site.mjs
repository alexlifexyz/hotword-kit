#!/usr/bin/env node
// 新词站点生成器
//   node site.mjs new "Sora 2" sora2ai.com     新建站点配置（sites/sora2ai.com/）
//   node site.mjs build sora2ai.com            生成静态站到 sites/sora2ai.com/dist/
// 需要 Node 18+，无第三方依赖。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SITES = path.join(ROOT, "sites");
const TEMPLATE = path.join(ROOT, "template");

// ---------- 工具函数 ----------
export const esc = (s = "") => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const titleCase = (s) => s.trim().split(/\s+/).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

function render(tpl, vars) {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => {
    if (!(k in vars)) throw new Error(`模板变量没有定义：${k}`);
    return vars[k];
  });
}

const read = (f) => fs.readFileSync(path.join(TEMPLATE, f), "utf8");

// ---------- new：生成配置 ----------
export function defaultConfig(keyword, domain) {
  const kw = titleCase(keyword);
  return {
    keyword: kw,
    domain,
    siteName: kw,
    lang: "en",
    accentColor: "#2563eb",
    title: `${kw} – Free Online ${kw} Tool`,
    description: `Use ${kw} online for free. TODO: one sentence on what ${kw} does and who it is for (150–160 characters).`,
    h1: `${kw} Online`,
    intro: `TODO: 2–3 sentences explaining what ${kw} is and what this page lets the visitor do right away.`,
    features: [
      { title: "TODO feature one", text: "TODO: one sentence." },
      { title: "TODO feature two", text: "TODO: one sentence." },
      { title: "TODO feature three", text: "TODO: one sentence." },
    ],
    howTo: [
      "TODO: step one",
      "TODO: step two",
      "TODO: step three",
    ],
    faq: [
      { q: `What is ${kw}?`, a: `TODO: answer in 2–3 sentences.` },
      { q: `Is ${kw} free?`, a: "TODO" },
      { q: `How do I use ${kw}?`, a: "TODO" },
      { q: `Is ${kw} safe to use?`, a: "TODO" },
    ],
    contactEmail: `hello@${domain}`,
    gaId: "",
    adsenseClient: "",
    updated: new Date().toISOString().slice(0, 10),
  };
}

function cmdNew(keyword, domain) {
  if (!keyword || !domain) die('用法：node site.mjs new "关键词" 域名.com');
  domain = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) die(`域名格式不对：${domain}`);
  const dir = path.join(SITES, domain);
  if (fs.existsSync(dir)) die(`已经存在：${path.relative(ROOT, dir)}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "site.json"), JSON.stringify(defaultConfig(keyword, domain), null, 2) + "\n");
  fs.copyFileSync(path.join(TEMPLATE, "tool.example.html"), path.join(dir, "tool.html"));
  console.log(`✅ 已创建 sites/${domain}/
   1. 改 site.json：把所有 TODO 换成真实内容
   2. 改 tool.html：放真正的工具（这是用户来的原因，也是排名的关键）
   3. 运行：node site.mjs build ${domain}`);
}

// ---------- build：生成静态站 ----------
export function buildSite(dir) {
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, "site.json"), "utf8"));
  // 环境变量可以覆盖配置：真实域名、邮箱、统计和广告 ID 不必写进公开仓库，
  // 在 Cloudflare Pages / Vercel 的环境变量里设置即可
  const overrides = { SITE_DOMAIN: "domain", CONTACT_EMAIL: "contactEmail", GA_ID: "gaId", ADSENSE_CLIENT: "adsenseClient" };
  for (const [env, key] of Object.entries(overrides)) if (process.env[env]) cfg[key] = process.env[env].trim();
  const toolFile = path.join(dir, "tool.html");
  const tool = fs.existsSync(toolFile) ? fs.readFileSync(toolFile, "utf8") : "";
  const out = path.join(dir, "dist");
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  const base = `https://${cfg.domain}`;
  const year = new Date().getFullYear();

  const analytics = [
    cfg.gaId ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(cfg.gaId)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(cfg.gaId)}');</script>` : "",
    cfg.adsenseClient ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(cfg.adsenseClient)}" crossorigin="anonymous"></script>` : "",
  ].filter(Boolean).join("\n");

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: cfg.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  const siteLd = { "@context": "https://schema.org", "@type": "WebSite", name: cfg.siteName, url: base + "/" };
  const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;

  const common = {
    lang: esc(cfg.lang),
    siteName: esc(cfg.siteName),
    domain: esc(cfg.domain),
    accent: esc(cfg.accentColor),
    year: String(year),
    analytics,
    contactEmail: esc(cfg.contactEmail),
    updated: esc(cfg.updated),
  };

  const layout = read("layout.html");
  const page = (file, { title, description, urlPath, body, extraHead = "" }) => {
    const html = render(layout, {
      ...common,
      title: esc(title),
      description: esc(description),
      canonical: esc(base + urlPath),
      extraHead,
      body,
    });
    fs.writeFileSync(path.join(out, file), html);
  };

  // 首页
  const home = render(read("home.html"), {
    ...common,
    h1: esc(cfg.h1),
    intro: esc(cfg.intro),
    keyword: esc(cfg.keyword),
    tool,
    features: cfg.features.map((f) => `<div class="card"><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p></div>`).join("\n"),
    howTo: cfg.howTo.map((s) => `<li>${esc(s)}</li>`).join("\n"),
    faq: cfg.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("\n"),
  });
  page("index.html", { title: cfg.title, description: cfg.description, urlPath: "/", body: home, extraHead: ld(siteLd) + "\n" + ld(faqLd) });

  // 关于、隐私、条款（申请 AdSense 基本都要有）
  for (const [name, label] of [["about", "About"], ["privacy", "Privacy Policy"], ["terms", "Terms of Service"]]) {
    page(`${name}.html`, {
      title: `${label} – ${cfg.siteName}`,
      description: `${label} for ${cfg.siteName}.`,
      urlPath: `/${name}`,
      body: render(read(`${name}.html`), { ...common, keyword: esc(cfg.keyword) }),
    });
  }

  page("404.html", { title: `Page not found – ${cfg.siteName}`, description: "Page not found.", urlPath: "/404", body: read("404.html"), extraHead: '<meta name="robots" content="noindex">' });

  // sitemap / robots / ads.txt / favicon / vercel.json
  const urls = ["/", "/about", "/privacy", "/terms"];
  fs.writeFileSync(path.join(out, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${base}${u}</loc><lastmod>${cfg.updated}</lastmod></url>`).join("\n") + "\n</urlset>\n");
  fs.writeFileSync(path.join(out, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`);
  if (cfg.adsenseClient) {
    const pub = cfg.adsenseClient.replace(/^ca-/, "");
    fs.writeFileSync(path.join(out, "ads.txt"), `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`);
  }
  const letter = esc((cfg.siteName.match(/[A-Za-z0-9]/) || ["S"])[0].toUpperCase());
  fs.writeFileSync(path.join(out, "favicon.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${esc(cfg.accentColor)}"/><text x="32" y="44" font-family="Arial,sans-serif" font-size="36" font-weight="700" fill="#fff" text-anchor="middle">${letter}</text></svg>\n`);
  fs.writeFileSync(path.join(out, "vercel.json"), JSON.stringify({ cleanUrls: true, trailingSlash: false }, null, 2) + "\n");

  // 检查：还有没填的 TODO 就提醒
  const todos = [];
  const scan = (v, p) => {
    if (typeof v === "string" && /TODO/.test(v)) todos.push(p);
    else if (Array.isArray(v)) v.forEach((x, i) => scan(x, `${p}[${i}]`));
    else if (v && typeof v === "object") for (const k in v) scan(v[k], p ? `${p}.${k}` : k);
  };
  scan(cfg, "");
  if (/TODO/.test(tool)) todos.push("tool.html");
  return { out, todos, cfg };
}

function cmdBuild(domain) {
  if (!domain) die("用法：node site.mjs build 域名.com");
  const dir = path.join(SITES, domain);
  if (!fs.existsSync(path.join(dir, "site.json"))) die(`找不到 sites/${domain}/site.json，先运行 new`);
  const { out, todos, cfg } = buildSite(dir);
  console.log(`✅ 已生成 ${path.relative(ROOT, out)}/`);
  if (cfg.title.length > 60) console.log(`⚠️  title 有 ${cfg.title.length} 个字符，建议 60 以内`);
  if (cfg.description.length > 160) console.log(`⚠️  description 有 ${cfg.description.length} 个字符，建议 160 以内`);
  if (todos.length) {
    console.log(`⚠️  还有 ${todos.length} 处 TODO 没填，上线前一定要改掉（空壳内容很难排上去）：`);
    for (const t of todos) console.log(`   - ${t}`);
  }
  console.log(`\n本地预览：npx serve ${path.relative(ROOT, out)}\n部署：见 README「部署上线」`);
}

function die(msg) { console.error(msg); process.exit(1); }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "new") cmdNew(rest[0], rest[1]);
  else if (cmd === "build") cmdBuild(rest[0]);
  else die(`用法：
  node site.mjs new "关键词" 域名.com    新建站点
  node site.mjs build 域名.com           生成静态文件`);
}
