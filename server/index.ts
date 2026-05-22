import express from "express";
import * as cheerio from "cheerio";
import type { DraftInput, RentalPost } from "../src/types";
import { analyzeWithAi } from "./ai";
import { geocodeAddress, geocodeAddresses, routeBetween, straightLineDistance } from "./geo";
import { fallbackModels, listProviderModels } from "./models";
import { compactDuplicates, deletePost, findDuplicateForDraft, readStore, saveSettings, upsertPost } from "./store";

const app = express();
app.use((request, response, next) => {
  const origin = request.headers.origin ?? "";
  if (origin.startsWith("chrome-extension://") || origin.startsWith("moz-extension://")) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  if (request.method === "OPTIONS") return response.status(204).end();
  next();
});
app.use(express.json({ limit: "8mb" }));

app.get("/api/store", async (_request, response) => {
  response.json(await readStore());
});

app.put("/api/settings", async (request, response) => {
  response.json(await saveSettings(request.body));
});

app.post("/api/models", async (request, response) => {
  try {
    const models = await listProviderModels(request.body);
    response.json({ models, refreshedAt: new Date().toISOString() });
  } catch (error) {
    response.status(200).json({
      models: fallbackModels(request.body),
      warning: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post("/api/commute", async (request, response) => {
  const fromQuery = String(request.body?.from ?? "");
  const toQuery = String(request.body?.to ?? "");
  const toPoint = request.body?.toPoint;
  if (!fromQuery || (!toQuery && !toPoint)) return response.status(400).json({ message: "from and to are required" });

  try {
    const [from, resolvedTo] = await Promise.all([geocodeAddress(fromQuery), toPoint ? Promise.resolve(toPoint) : geocodeAddress(toQuery)]);
    const to = resolvedTo
      ? {
          lat: Number(resolvedTo.lat),
          lon: Number(resolvedTo.lon),
          label: String(resolvedTo.label || toQuery)
        }
      : null;
    if (!from || !to) return response.json({ from, to, straightLineMeters: null, walking: null, cycling: null });
    const [walking, cycling] = await Promise.all([
      routeBetween("foot", from, to).catch(() => null),
      routeBetween("bike", from, to).catch(() => null)
    ]);
    response.json({
      from,
      to,
      straightLineMeters: straightLineDistance(from, to),
      walking,
      cycling
    });
  } catch (error) {
    response.status(200).json({
      warning: error instanceof Error ? error.message : String(error),
      from: null,
      to: null,
      straightLineMeters: null,
      walking: null,
      cycling: null
    });
  }
});

app.post("/api/geocode", async (request, response) => {
  const query = String(request.body?.query ?? "");
  if (!query) return response.status(400).json({ message: "query is required" });
  try {
    response.json({ point: await geocodeAddress(query) });
  } catch (error) {
    response.status(200).json({
      point: null,
      warning: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post("/api/geocode-search", async (request, response) => {
  const query = String(request.body?.query ?? "");
  if (!query) return response.status(400).json({ message: "query is required" });
  try {
    response.json({ points: await geocodeAddresses(query, 6) });
  } catch (error) {
    response.status(200).json({
      points: [],
      warning: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post("/api/posts", async (request, response) => {
  const store = await readStore();
  const draft = request.body as DraftInput;
  const duplicate = await findDuplicateForDraft(draft.sourceUrl, draft.originalText);
  if (duplicate) {
    return response.json({
      ...duplicate.post,
      duplicate: true,
      duplicateReason: duplicate.reason,
      duplicateScore: duplicate.score
    });
  }
  const post = await analyzeWithAi(draft, store.settings);
  response.json(await upsertPost(post));
});

app.post("/api/dedupe", async (_request, response) => {
  response.json(await compactDuplicates());
});

app.put("/api/posts/:id", async (request, response) => {
  const store = await readStore();
  const current = store.posts.find((post) => post.id === request.params.id);
  if (!current) return response.status(404).json({ message: "Post not found" });
  const next: RentalPost = {
    ...current,
    ...request.body,
    id: current.id,
    updatedAt: new Date().toISOString()
  };
  response.json(await upsertPost(next));
});

app.post("/api/posts/:id/reanalyze", async (request, response) => {
  const store = await readStore();
  const current = store.posts.find((post) => post.id === request.params.id);
  if (!current) return response.status(404).json({ message: "Post not found" });
  const analyzed = await analyzeWithAi(
    {
      sourceUrl: current.sourceUrl,
      originalText: current.originalText,
      images: current.images
    },
    store.settings
  );
  const next = {
    ...current,
    ...analyzed,
    id: current.id,
    interest: current.interest,
    contactStatus: current.contactStatus,
    notes: current.notes,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString()
  };
  response.json(await upsertPost(next));
});

app.delete("/api/posts/:id", async (request, response) => {
  await deletePost(request.params.id);
  response.status(204).end();
});

app.post("/api/scrape", async (request, response) => {
  const url = String(request.body?.url ?? "");
  if (!/^https?:\/\//.test(url)) return response.status(400).json({ message: "URL is invalid" });

  try {
    const result = await scrapeUrl(url);
    response.json(result);
  } catch (error) {
    response.status(200).json({
      text: "",
      images: [],
      warning:
        error instanceof Error
          ? `自动抓取失败：${error.message}。Facebook 经常需要登录或阻止服务器抓取，请手动复制正文和图片链接。`
          : "自动抓取失败，请手动复制正文和图片链接。"
    });
  }
});

async function scrapeUrl(url: string) {
  const page = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
      accept: "text/html,application/xhtml+xml"
    }
  });
  if (!page.ok) throw new Error(`HTTP ${page.status}`);
  const html = await page.text();
  const $ = cheerio.load(html);
  const text =
    $("meta[property='og:description']").attr("content") ||
    $("meta[name='description']").attr("content") ||
    $("article").text().replace(/\s+/g, " ").trim() ||
    $("body").text().replace(/\s+/g, " ").trim().slice(0, 3000);

  const images = new Set<string>();
  $("meta[property='og:image']").each((_index, element) => {
    const content = $(element).attr("content");
    if (content) images.add(content);
  });
  $("img").each((_index, element) => {
    const src = $(element).attr("src");
    if (src?.startsWith("http")) images.add(src);
  });

  if (!text && images.size === 0) throw new Error("没有读取到公开内容");
  return { text, images: [...images].slice(0, 12), warning: "" };
}

app.listen(8787, "127.0.0.1", () => {
  console.log("Rent Lens API running at http://127.0.0.1:8787");
});
