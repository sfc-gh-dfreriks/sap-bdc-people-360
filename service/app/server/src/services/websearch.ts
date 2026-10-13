import { runQuery } from "./snowflake.js";

// Live alternative-sourcing search.
//   1. Web search for the required spec: Tavily when TAVILY_API_KEY is set in .env, otherwise a keyless
//      DuckDuckGo search whose top result pages are fetched so prices on the page can be read.
//   2. Cortex AI_COMPLETE extracts structured offers (vendor, model, price,
//      lead time, URL) from the returned snippets.
// Nothing is fabricated: offers without a price in the source text are dropped.

export class SearchNotConfiguredError extends Error {}

export interface RawResult { title: string; url: string; content: string; }

export interface Offer {
  vendor: string;
  model: string;
  channel: string;          // e.g. "New - alternate OEM", "Reseller in stock", "Refurbished", "Lease"
  price: number;
  currency: string;
  leadDays: number | null;  // null when the page gives no ship time
  specMatch: "full" | "partial" | "exceeds";
  specNotes: string;
  url: string;
}

const TAVILY_URL = "https://api.tavily.com/search";

async function tavily(query: string, apiKey: string): Promise<RawResult[]> {
  const res = await fetch(TAVILY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, search_depth: "advanced", max_results: 6, include_answer: false }),
  });
  if (!res.ok) throw new Error(`Tavily search failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { results?: RawResult[] };
  return (data.results ?? []).map((r) => ({ title: r.title, url: r.url, content: (r.content ?? "").slice(0, 1500) }));
}

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const decode = (t: string) => t.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
const strip = (h: string) => decode(h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

async function fetchText(url: string, ms = 8000): Promise<string> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: ctl.signal, redirect: "follow" });
    return r.ok ? await r.text() : "";
  } catch { return ""; } finally { clearTimeout(t); }
}

// Keyless fallback: DuckDuckGo HTML results, then the result pages themselves (snippets rarely carry prices).
async function duckduckgo(query: string): Promise<RawResult[]> {
  const html = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
  const hits: RawResult[] = [];
  const rx = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  for (let m; (m = rx.exec(html)) && hits.length < 5; ) {
    let url = decode(m[1]);
    const u = url.match(/[?&]uddg=([^&]+)/); if (u) url = decodeURIComponent(u[1]);
    if (!/^https?:/.test(url) || /duckduckgo\.com\/y\.js|bing\.com\/aclick/.test(url)) continue;   // skip ads
    hits.push({ title: strip(m[2]), url, content: strip(m[3]) });
  }
  const pages = await Promise.all(hits.map((h) => fetchText(h.url)));
  return hits.map((h, i) => {
    const body = strip(pages[i] || "");
    const priced = body.match(/.{0,200}(?:[$€£]|USD|EUR|GBP|AUD|CAD)\s?\d[\d,.]*.{0,200}/g)?.slice(0, 6).join(" … ") ?? "";
    return { ...h, content: `${h.content} ${priced || body.slice(0, 1200)}`.slice(0, 2500) };
  });
}

function queriesFor(spec: string, region: string): string[] {
  return [
    `buy business laptop ${spec} in stock price ${region}`,
    `${spec} laptop alternative Dell Lenovo HP ships in days ${region}`,
    `refurbished business laptop ${spec} price ${region}`,
  ];
}

const OFFER_SCHEMA = {
  type: "object",
  properties: {
    offers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          vendor: { type: "string" }, model: { type: "string" }, channel: { type: "string" },
          price: { type: "number" }, currency: { type: "string" },
          leadDays: { type: "number" }, specMatch: { type: "string", enum: ["full", "partial", "exceeds"] },
          specNotes: { type: "string" }, url: { type: "string" },
        },
        required: ["vendor", "model", "channel", "price", "currency", "specMatch", "specNotes", "url"],
      },
    },
  },
  required: ["offers"],
};

export async function searchAlternatives(spec: string, region: string, currency: string): Promise<{ offers: Offer[]; sources: RawResult[]; queries: string[] }> {
  const apiKey = process.env.TAVILY_API_KEY;
  const queries = queriesFor(spec, region);
  const batches = await Promise.all(queries.map((q) => (apiKey ? tavily(q, apiKey) : duckduckgo(q))));
  if (!apiKey && !batches.some((b) => b.length))
    throw new SearchNotConfiguredError("Live web search returned nothing (no TAVILY_API_KEY set and the keyless search was unreachable)");
  const seen = new Set<string>();
  const sources = batches.flat().filter((r) => (seen.has(r.url) ? false : (seen.add(r.url), true)));
  if (!sources.length) return { offers: [], sources, queries };

  const prompt =
    `You are a procurement analyst. Required laptop spec: "${spec}". Buyer region: ${region}, currency ${currency}.\n` +
    `From the web search results below, extract concrete purchasable laptop offers that could replace the required spec.\n` +
    `Rules: only include an offer if a numeric price for that product appears in its result text. Use that result's URL. ` +
    `Never invent prices, models or URLs. leadDays = stated shipping/delivery time in days if given (in stock / ships today = 2), otherwise omit it. ` +
    `channel is one of: "New - alternate OEM", "Reseller in stock", "Refurbished", "Lease". ` +
    `specMatch compares CPU class, RAM, storage and screen size to the required spec. Report price in the currency shown on the page.\n\n` +
    sources.map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.content}`).join("\n\n");

  const rows = await runQuery(
    `SELECT AI_COMPLETE(model => 'claude-sonnet-4-5', prompt => ?, response_format => PARSE_JSON(?)) AS r`,
    [prompt, JSON.stringify({ type: "json", schema: OFFER_SCHEMA })]
  );
  const raw = rows[0]?.r;
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  const urls = new Set(sources.map((s) => s.url));
  const offers: Offer[] = ((parsed?.offers ?? []) as Offer[])
    .filter((o) => o.price > 0 && urls.has(o.url))   // must cite a real search result
    .map((o) => ({ ...o, leadDays: typeof o.leadDays === "number" ? o.leadDays : null }));
  return { offers, sources, queries };
}
