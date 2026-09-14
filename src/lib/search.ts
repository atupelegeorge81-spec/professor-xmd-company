import * as cheerio from "cheerio";
import { Client, Databases, Query } from "node-appwrite";
import type { AgentEvent } from "./types";

export interface SearchResult { title: string; url: string; content: string; }

const client = new Client();
if (process.env.APPWRITE_ENDPOINT && process.env.APPWRITE_PROJECT_ID && process.env.APPWRITE_API_KEY) {
  client.setEndpoint(process.env.APPWRITE_ENDPOINT).setProject(process.env.APPWRITE_PROJECT_ID).setKey(process.env.APPWRITE_API_KEY);
}
const databases = new Databases(client);
const CACHE_COLLECTION = process.env.APPWRITE_COLLECTION_ID || "";
const CACHE_TTL_SECONDS = 900;
const SIMILARITY_THRESHOLD = 0.80;
const SEARXNG_URL = process.env.SEARXNG_URL || "https://searxng-northflank.onrender.com";

// Engines ambazo agent atatumia moja kwa moja.
// ! syntax inaiambia SearXNG engines hizi zitumike.
const SEARXNG_ENGINES =
  "!bing !google !yandex !naver !seznam !github !stackoverflow";
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const HF_MODEL = "intfloat/multilingual-e5-large";
const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
const MAX_SEARCH_RETRIES = 2;
const SEARCH_RETRY_DELAY_MS = 2000;
const MAX_SEARCH_QUERY_CHARS = 160;
const MAX_SEARCH_TERMS = 12;

function normalizeSearchQuery(input: string): string {
  let q = String(input || "")
    .replace(/\[SEARCH\]/gi, " ")
    .replace(/\[\/SEARCH\]/gi, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Remove obvious prompt/instruction tails that are not search terms.
  q = q
    .replace(
      /\b(current|latest|best|official)\s+(technical\s+)?documentation\s+best\s+practices\b.*$/i,
      ""
    )
    .replace(/\bfor\s+(the\s+)?(project|agent|optimus|board\s*room)\b.*$/i, "")
    .trim();

  // If an agent accidentally sends a whole sentence/question,
  // keep the informative front portion instead of shipping the essay.
  if (q.length > MAX_SEARCH_QUERY_CHARS) {
    q = q
      .replace(/[?!.]+/g, " ")
      .replace(
        /\b(please|discuss|decide|create|give me|tell me|explain|describe|after your discussion|the ceo request|original request)\b/gi,
        " "
      )
      .replace(/\s+/g, " ")
      .trim();
  }

  // Search queries should be terms, not prose.
  const tokens = q
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, MAX_SEARCH_TERMS);

  q = tokens.join(" ").slice(0, MAX_SEARCH_QUERY_CHARS).trim();

  return q;
}


function emitLog(onEvent: ((e: AgentEvent) => void) | undefined, type: "info" | "success" | "warning" | "error" | "search", message: string) {
  if (onEvent) onEvent({ type: "log", entry: { id: Math.random().toString(36).slice(2, 9), timestamp: new Date().toLocaleTimeString("en-GB"), type, message } });
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) { dotProduct += vecA[i] * vecB[i]; normA += vecA[i] * vecA[i]; normB += vecB[i] * vecB[i]; }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function getEmbedding(text: string, isQuery: boolean = false): Promise<number[]> {
  if (!HF_API_KEY) throw new Error("HUGGINGFACE_API_KEY haipo");
  const prefix = isQuery ? "query: " : "passage: ";
  const response = await fetch(`https://router.huggingface.co/hf-inference/models/${HF_MODEL}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${HF_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: `${prefix}${text}` }),
  });
  if (!response.ok) throw new Error(`HF API Error: ${response.status}`);
  const result = await response.json();
  return Array.isArray(result[0]) ? result[0] : result;
}

export async function searchWeb(query: string, onEvent?: (e: AgentEvent) => void, agentName = "Agent"): Promise<SearchResult[]> {
  const searchQuery = normalizeSearchQuery(query);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  emitLog(onEvent, "info", `🔍 ${agentName} anakagua Appwrite cache kwanza (Semantic Search)...`);
  const cachedMatch = await getCachedResultsSemantic(normalizedQuery, onEvent, agentName);
  if (cachedMatch) {
    emitLog(onEvent, "success", `✅ ${agentName} KAPATA kwenye Appwrite! Similarity: ${(cachedMatch.similarity * 100).toFixed(1)}% — data za zamani zinatosha, HAKUNA search mpya.`);
    emitLog(onEvent, "info", `📄 ${agentName}: swali la zamani lililomatch: "${cachedMatch.matchedQuery}"`);
    await incrementCacheHits(cachedMatch.docId, cachedMatch.currentHits);
    return cachedMatch.results;
  }
  return await doFreshSearch(query, normalizedQuery, onEvent, agentName);
}

export async function searchWebDirect(query: string, onEvent?: (e: AgentEvent) => void, agentName = "Agent"): Promise<SearchResult[]> {
  emitLog(onEvent, "info", `🔄 [VERIFY] ${agentName} anarudi SearXNG MOJA KWA MOJA (hakuna Appwrite check — memory ya mjadala inatosha).`);
  const searchQuery = normalizeSearchQuery(query);
  return await doFreshSearch(searchQuery, searchQuery.trim().toLowerCase(), onEvent, agentName);
}

async function doFreshSearch(
  query: string,
  normalizedQuery: string,
  onEvent?: (e: AgentEvent) => void,
  agentName = "Agent"
): Promise<SearchResult[]> {
  const base = SEARXNG_URL.replace(/\/+$/, "");
  const searchQuery = `${SEARXNG_ENGINES} ${query}`;
    const url = `${base}/search?q=${encodeURIComponent(searchQuery)}`;

  let lastError: Error | null = null;

  for (let retry = 0; retry <= MAX_SEARCH_RETRIES; retry++) {
    const attempt = retry + 1;

    emitLog(
      onEvent,
      "search",
      `🌐 ${agentName} anawasha SearXNG engine... (attempt ${attempt}/${MAX_SEARCH_RETRIES + 1})`
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": BROWSER_UA,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: controller.signal,
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Search request failed (HTTP ${res.status})`);
      }

      const html = await res.text();
      const results = parseHtml(html);

      emitLog(
        onEvent,
        "success",
        `📥 ${agentName}: matokeo ${results.length} KUTOKA SEARCH ENGINE.`
      );

      emitLog(
        onEvent,
        "info",
        `💾 ${agentName} anasave vector + results kwenye Appwrite...`
      );

      await saveToCacheSemantic(
        normalizedQuery,
        results,
        onEvent,
        agentName
      );

      return results;
    } catch (error) {
      lastError = error instanceof Error
        ? error
        : new Error(String(error));

      emitLog(
        onEvent,
        "warning",
        `⚠️ ${agentName}: SearXNG attempt ${attempt}/${MAX_SEARCH_RETRIES + 1} imefeli — ${lastError.message.slice(0, 120)}`
      );

      if (retry < MAX_SEARCH_RETRIES) {
        emitLog(
          onEvent,
          "info",
          `⏳ ${agentName}: inasubiri ${SEARCH_RETRY_DELAY_MS / 1000}s kabla ya retry #${retry + 1}...`
        );

        await new Promise((resolve) =>
          setTimeout(resolve, SEARCH_RETRY_DELAY_MS)
        );
      }
    } finally {
      clearTimeout(timer);
    }
  }

  emitLog(
    onEvent,
    "error",
    `❌ ${agentName}: SearXNG imeshindwa baada ya retries ${MAX_SEARCH_RETRIES}.`
  );

  throw lastError || new Error("Search failed after retries");
}

async function getCachedResultsSemantic(query: string, onEvent?: (e: AgentEvent) => void, agentName = "Agent"): Promise<{ results: SearchResult[]; docId: string; matchedQuery: string; currentHits: number; similarity: number } | null> {
  if (!CACHE_COLLECTION) return null;
  try {
    emitLog(onEvent, "search", `🧠 ${agentName} anatuma swali kwenye Embedding Engine (HF API)...`);
    const queryVector = await getEmbedding(query, true);
    const response = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID!, CACHE_COLLECTION, [Query.limit(100)]);
    let bestMatch: any = null;
    let highestSimilarity = 0;
    const nowSeconds = Math.floor(Date.now() / 1000);
    for (const doc of response.documents) {
      const docAny = doc as any;
      const createdAtSeconds = Math.floor(new Date(docAny.created_at).getTime() / 1000);
      const ttlSeconds = Number(docAny.ttl) || CACHE_TTL_SECONDS;
      if (nowSeconds - createdAtSeconds > ttlSeconds) continue;
      const cachedVector = JSON.parse(docAny.vector);
      const similarity = cosineSimilarity(queryVector, cachedVector);
      if (similarity > highestSimilarity) highestSimilarity = similarity;
      if (similarity >= SIMILARITY_THRESHOLD && similarity > (bestMatch ? cosineSimilarity(queryVector, JSON.parse(bestMatch.vector)) : 0)) bestMatch = docAny;
    }
    if (bestMatch) {
      return { results: JSON.parse(bestMatch.results), docId: bestMatch.$id, matchedQuery: bestMatch.query, currentHits: Number(bestMatch.hits) || 1, similarity: highestSimilarity };
    }
    emitLog(onEvent, "warning", `❌ ${agentName} KAKOSA kwenye Appwrite — similarity ya juu: ${(highestSimilarity * 100).toFixed(1)}% (threshold 80%). Analazimika kuwasha engine.`);
    return null;
  } catch (error) {
    console.error("❌ Appwrite Cache Error:", error);
    emitLog(onEvent, "error", `❌ ${agentName}: Appwrite cache error — ${String(error).slice(0, 120)}`);
    return null;
  }
}

async function saveToCacheSemantic(query: string, results: SearchResult[], onEvent?: (e: AgentEvent) => void, agentName = "Agent"): Promise<void> {
  if (!CACHE_COLLECTION || results.length === 0) return;
  try {
    const combinedText = `${query} | ${results.map(r => r.content).join(" ")}`;
    const vectorArray = await getEmbedding(combinedText, false);
    await databases.createDocument(process.env.APPWRITE_DATABASE_ID!, CACHE_COLLECTION, "unique()", {
      query, results: JSON.stringify(results), vector: JSON.stringify(vectorArray),
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), hits: 1, ttl: CACHE_TTL_SECONDS,
    });
    emitLog(onEvent, "success", `✅ ${agentName}: SAVE SUCCESS — vector + results zimehifadhiwa Appwrite.`);
  } catch (error) {
    console.error("❌ Appwrite Save Error:", error);
    emitLog(onEvent, "error", `❌ ${agentName}: Appwrite save error — ${String(error).slice(0, 120)}`);
  }
}

async function incrementCacheHits(docId: string, currentHits: number): Promise<void> {
  if (!CACHE_COLLECTION) return;
  try {
    await databases.updateDocument(process.env.APPWRITE_DATABASE_ID!, CACHE_COLLECTION, docId, { hits: currentHits + 1, updated_at: new Date().toISOString() });
  } catch (error) { console.error("❌ Cache Increment Error:", error); }
}

function parseHtml(html: string): SearchResult[] {
  const $ = cheerio.load(html);
  const results: SearchResult[] = [];
  const seen = new Set<string>();
  $("article.result").each((_, el) => {
    const link = $(el).find("h3 a").first();
    let url = (link.attr("href") || "").trim();
    if (!url) return;
    if (url.startsWith("//")) url = "https:" + url;
    else if (url.startsWith("/")) url = SEARXNG_URL.replace(/\/+$/, "") + url;
    if (!/^https?:\/\//i.test(url)) return;
    if (seen.has(url)) return;
    seen.add(url);
    const title = $(el).find("h3 a").first().text().replace(/\s+/g, " ").trim();
    let content = $(el).find("p.content").first().text().replace(/\s+/g, " ").trim();
    if (!content) content = $(el).find(".content").first().text().replace(/\s+/g, " ").trim();
    results.push({ title: title || url, url, content });
  });
  return results.slice(0, 8);
}
