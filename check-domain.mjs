#!/usr/bin/env node
// 新词域名查询：关键词 → 候选域名 → 查是否可注册
// 用法：node check-domain.mjs "sora 2" [--tlds com,ai,io] [--no-variants] [--json]
// 需要 Node 18+，无第三方依赖。

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const execFileP = promisify(execFile);

// ---------- 配置 ----------
// 后缀按推荐优先级排列：.com 最好，其次是 Google 当作通用后缀处理的 .ai/.io/.co
const DEFAULT_TLDS = ["com", "ai", "io", "co", "org", "net", "app"];
// 变体只在 .com 上查，避免请求太多
const VARIANT_PATTERNS = [
  "{kw}ai", "{kw}app", "{kw}online", "{kw}tool", "{kw}hub",
  "get{kw}", "try{kw}", "use{kw}", "{kw}free", "{kw}-ai",
];
// 没有 RDAP 的后缀用 whois 兜底
const WHOIS_SERVERS = { io: "whois.nic.io", co: "whois.registry.co" };
const WHOIS_NOT_FOUND = /no match|not found|no data found|no entries found|status:\s*free|is available|domain not found/i;
const TIMEOUT_MS = 8000;
const CONCURRENCY = 4;

// ---------- 参数 ----------
function parseArgs(argv) {
  const args = { keyword: "", tlds: DEFAULT_TLDS, variants: true, json: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tlds") args.tlds = argv[++i].split(",").map((t) => t.trim().replace(/^\./, "").toLowerCase()).filter(Boolean);
    else if (a === "--no-variants") args.variants = false;
    else if (a === "--json") args.json = true;
    else if (a === "-h" || a === "--help") args.help = true;
    else rest.push(a);
  }
  args.keyword = rest.join(" ");
  return args;
}

// "Sora 2" → ["sora2", "sora-2"]
export function slugs(keyword) {
  const base = keyword.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ").trim().split(/[\s-]+/).filter(Boolean);
  if (!base.length) return [];
  const joined = base.join("");
  const hyphen = base.join("-");
  return [...new Set([joined, hyphen])].filter((s) => s.length >= 2 && s.length <= 63);
}

export function candidates(keyword, tlds, withVariants) {
  const list = [];
  for (const s of slugs(keyword)) {
    for (const t of tlds) list.push({ domain: `${s}.${t}`, kind: s.includes("-") ? "带连字符" : "完全匹配" });
  }
  if (withVariants) {
    const s = slugs(keyword)[0];
    for (const p of VARIANT_PATTERNS) list.push({ domain: `${p.replace("{kw}", s)}.com`, kind: "变体" });
  }
  return list;
}

// ---------- RDAP ----------
let bootstrapCache = null;
async function rdapBase(tld) {
  if (!bootstrapCache) {
    const res = await fetchWithTimeout("https://data.iana.org/rdap/dns.json");
    const data = await res.json();
    bootstrapCache = new Map();
    for (const [tlds, urls] of data.services) for (const t of tlds) bootstrapCache.set(t, urls[0]);
  }
  return bootstrapCache.get(tld) || null;
}

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, headers: { accept: "application/rdap+json" } });
  } finally {
    clearTimeout(timer);
  }
}

async function checkRdap(domain, base) {
  const url = `${base.replace(/\/$/, "")}/domain/${domain}`;
  const res = await fetchWithTimeout(url);
  if (res.status === 404) return { status: "available", via: "RDAP" };
  if (res.ok) {
    const j = await res.json().catch(() => ({}));
    const reg = (j.events || []).find((e) => e.eventAction === "registration");
    const exp = (j.events || []).find((e) => e.eventAction === "expiration");
    return { status: "taken", via: "RDAP", registered: reg?.eventDate?.slice(0, 10), expires: exp?.eventDate?.slice(0, 10) };
  }
  if (res.status === 429) return { status: "unknown", via: "RDAP", note: "查询太频繁，稍后重试" };
  return { status: "unknown", via: "RDAP", note: `HTTP ${res.status}` };
}

async function checkWhois(domain, server) {
  try {
    const { stdout } = await execFileP("whois", ["-h", server, domain], { timeout: TIMEOUT_MS });
    return WHOIS_NOT_FOUND.test(stdout) ? { status: "available", via: "whois" } : { status: "taken", via: "whois" };
  } catch (e) {
    if (e.code === "ENOENT") return { status: "unknown", via: "whois", note: "本机没有 whois 命令" };
    if (e.stdout && WHOIS_NOT_FOUND.test(e.stdout)) return { status: "available", via: "whois" };
    return { status: "unknown", via: "whois", note: "whois 查询失败" };
  }
}

export async function checkDomain(domain) {
  const tld = domain.split(".").pop();
  try {
    const base = await rdapBase(tld);
    if (base) {
      let r = await checkRdap(domain, base);
      if (r.status === "unknown" && r.note !== "查询太频繁，稍后重试") r = await checkRdap(domain, base); // 重试一次
      return r;
    }
    if (WHOIS_SERVERS[tld]) return await checkWhois(domain, WHOIS_SERVERS[tld]);
    return { status: "unknown", via: "-", note: "这个后缀没有公开查询接口，请去注册商手动查" };
  } catch (e) {
    return { status: "unknown", via: "-", note: e.name === "AbortError" ? "超时" : e.message };
  }
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

// 推荐排序：完全匹配 .com > 完全匹配 .ai/.io/.co > 变体 .com > 完全匹配其他后缀 > 带连字符
const TOP_GENERIC = ["ai", "io", "co"];
export function score(row, tlds) {
  const tld = row.domain.split(".").pop();
  const pos = Math.max(tlds.indexOf(tld), 0);
  if (row.kind === "变体") return 50 + pos;
  const base = row.kind === "带连字符" ? 200 : 0;
  if (tld === "com") return base;
  if (TOP_GENERIC.includes(tld)) return base + 1 + TOP_GENERIC.indexOf(tld);
  return base + 100 + pos;
}

// ---------- 主程序 ----------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.keyword) {
    console.log(`用法：node check-domain.mjs "关键词" [--tlds com,ai,io] [--no-variants] [--json]

  --tlds         要查的后缀，默认 ${DEFAULT_TLDS.join(",")}
  --no-variants  不查 .com 变体（默认会查 getxxx、xxxai、xxxapp 等）
  --json         输出 JSON，方便接其他脚本`);
    process.exit(args.keyword ? 0 : 1);
  }

  const list = candidates(args.keyword, args.tlds, args.variants);
  if (!list.length) { console.error("关键词里没有可用的英文字母或数字"); process.exit(1); }
  if (!args.json) console.log(`\n查询 "${args.keyword}"，共 ${list.length} 个候选域名…\n`);

  const results = await pool(list, CONCURRENCY, async (c) => ({ ...c, ...(await checkDomain(c.domain)) }));

  if (args.json) { console.log(JSON.stringify(results, null, 2)); return; }

  const icon = { available: "✅ 可注册", taken: "❌ 已注册", unknown: "⚠️  未知" };
  const w = Math.max(...results.map((r) => r.domain.length)) + 2;
  for (const r of results) {
    const extra = r.status === "taken" ? `注册于 ${r.registered ?? "?"}，到期 ${r.expires ?? "?"}` : r.note ?? "";
    console.log(`${r.domain.padEnd(w)}${icon[r.status]}   ${r.kind.padEnd(5)} ${extra}`);
  }

  const free = results.filter((r) => r.status === "available").sort((a, b) => score(a, args.tlds) - score(b, args.tlds));
  console.log("");
  if (free.length) {
    console.log(`👉 推荐：${free[0].domain}`);
    if (free.length > 1) console.log(`   备选：${free.slice(1, 4).map((r) => r.domain).join("、")}`);
    console.log("   注：查不到记录不等于一定能注册（可能是溢价词或保留词），以注册商结账页为准。");
  } else {
    console.log("候选域名都被注册了。换个说法，或用 --tlds 加更多后缀再查。");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
