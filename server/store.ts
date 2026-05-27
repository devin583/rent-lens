import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getProviderPreset } from "../src/aiProviders";
import type { AiProviderConfig, AiProviderVendor, AppSettings, AppStore, Category, ContactEvent, RentalPost } from "../src/types";
import { dedupePosts, findDuplicatePost, mergePostData } from "./dedupe";

const storePath = join(process.cwd(), "data", "store.json");

export const defaultCategories: Category[] = [
  { id: "high", name: "High interest" },
  { id: "medium", name: "Watching" },
  { id: "low", name: "Low interest" },
  { id: "archived", name: "Archived" }
];

const defaultCategoryNames: Record<string, string> = Object.fromEntries(defaultCategories.map((category) => [category.id, category.name]));
const legacyDefaultCategoryNames: Record<string, string> = {
  high: "高倾向",
  medium: "观察中",
  low: "低倾向",
  archived: "已归档"
};

export const defaultSettings: AppSettings = {
  uiLocale: "en",
  targetLanguage: "en",
  referenceCurrency: "USD",
  targetAddress: "",
  targetLocation: null,
  categories: defaultCategories,
  providers: []
};

const emptyStore = (): AppStore => ({
  posts: [],
  settings: defaultSettings
});

export async function readStore(): Promise<AppStore> {
  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as AppStore;
    return {
      posts: normalizePosts(parsed.posts ?? [], parsed.settings?.categories ?? []),
      settings: {
        ...defaultSettings,
        ...parsed.settings,
        uiLocale: parsed.settings?.uiLocale ?? defaultSettings.uiLocale,
        targetLanguage: parsed.settings?.targetLanguage ?? defaultSettings.targetLanguage,
        categories: normalizeCategories(parsed.settings?.categories ?? []),
        providers: normalizeProviders(parsed.settings?.providers ?? [])
      }
    };
  } catch {
    const store = emptyStore();
    await writeStore(store);
    return store;
  }
}

export async function writeStore(store: AppStore) {
  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

export async function saveSettings(settings: AppSettings) {
  const store = await readStore();
  store.settings = {
    ...settings,
    categories: normalizeCategories(settings.categories)
  };
  const categoryIds = new Set(store.settings.categories.map((category) => category.id));
  const fallbackCategoryId = store.settings.categories[0]?.id ?? "medium";
  store.posts = store.posts.map((post) => ({
    ...post,
    categoryId: categoryIds.has(post.categoryId) ? post.categoryId : fallbackCategoryId
  }));
  await writeStore(store);
  return store.settings;
}

export async function upsertPost(post: RentalPost) {
  const store = await readStore();
  const index = store.posts.findIndex((item) => item.id === post.id);
  if (index >= 0) store.posts[index] = post;
  else {
    const duplicate = findDuplicatePost(store.posts, post);
    if (duplicate) {
      mergePostData(duplicate.post, post);
      await writeStore(store);
      return duplicate.post;
    }
    store.posts.unshift(post);
  }
  await writeStore(store);
  return post;
}

export async function findDuplicateForDraft(sourceUrl: string, originalText: string) {
  const store = await readStore();
  return findDuplicatePost(store.posts, { sourceUrl, originalText, images: [] });
}

export async function compactDuplicates() {
  const store = await readStore();
  const result = dedupePosts(store.posts);
  store.posts = result.posts;
  await writeStore(store);
  return result;
}

export async function deletePost(id: string) {
  const store = await readStore();
  store.posts = store.posts.filter((post) => post.id !== id);
  await writeStore(store);
}

function normalizeProviders(existing: AppSettings["providers"]) {
  return existing
    .filter((provider) => provider.apiKey || provider.enabled)
    .map((provider) => {
      const vendor = inferVendor(provider);
      const preset = getProviderPreset(vendor);
      return {
        id: provider.id || crypto.randomUUID(),
        vendor,
        name: provider.name || preset.name,
        type: provider.type || preset.type,
        enabled: Boolean(provider.enabled),
        apiKey: provider.apiKey ?? "",
        baseUrl: provider.baseUrl && provider.baseUrl !== preset.baseUrl ? provider.baseUrl : "",
        model: normalizeModel(vendor, provider.model && provider.model !== preset.model ? provider.model : ""),
        availableModels: provider.availableModels ?? [],
        modelsRefreshedAt: provider.modelsRefreshedAt
      };
    });
}

function inferVendor(provider: Partial<AiProviderConfig> & { id?: string }): AiProviderVendor {
  const value = String(provider.vendor || provider.id || "").toLowerCase();
  if (value.includes("anthropic") || value.includes("claude")) return "anthropic";
  if (value.includes("gemini")) return "gemini";
  if (value.includes("deepseek")) return "deepseek";
  if (value.includes("kimi") || value.includes("moonshot")) return "kimi";
  if (value.includes("qwen") || value.includes("dashscope") || value.includes("千问")) return "qwen";
  if (value.includes("glm") || value.includes("zhipu") || value.includes("智谱")) return "glm";
  if (value.includes("nvidia")) return "nvidia";
  if (value.includes("minimax") || value.includes("小米")) return "minimax";
  if (value.includes("custom")) return "custom";
  return "openai";
}

function normalizeModel(vendor: AiProviderVendor, model: string) {
  if (vendor === "gemini" && model === "gemini-1.5-flash") return "";
  return model;
}

function normalizeCategories(categories: Category[]) {
  const cleaned = categories
    .map((category) => ({
      id: category.id || crypto.randomUUID(),
      name: normalizeCategoryName(category)
    }))
    .filter((category) => category.name);
  return cleaned.length ? cleaned : defaultCategories;
}

function normalizeCategoryName(category: Category) {
  const name = String(category.name || "").trim();
  if (legacyDefaultCategoryNames[category.id] && name === legacyDefaultCategoryNames[category.id]) {
    return defaultCategoryNames[category.id];
  }
  return name;
}

function normalizePosts(posts: RentalPost[], categories: Category[]) {
  const normalizedCategories = normalizeCategories(categories);
  const categoryIds = new Set(normalizedCategories.map((category) => category.id));
  return posts.map((post) => {
    const migratedCategoryId = post.categoryId || post.interest || "medium";
    return {
      ...post,
      categoryId: categoryIds.has(migratedCategoryId) ? migratedCategoryId : normalizedCategories[0].id,
      contactStatus: normalizeContactStatus(post.contactStatus),
      contactTracking: normalizeContactTracking(post)
    };
  });
}

function normalizeContactStatus(status: RentalPost["contactStatus"]) {
  return ["not_contacted", "contacted", "waiting", "replied", "visited", "rejected"].includes(status)
    ? status
    : "not_contacted";
}

function normalizeContactTracking(post: RentalPost) {
  const tracking = post.contactTracking;
  return {
    ref: tracking?.ref || makeContactRef(post.id),
    landlordName: String(tracking?.landlordName ?? ""),
    messengerUrl: String(tracking?.messengerUrl ?? ""),
    lastContactedAt: String(tracking?.lastContactedAt ?? ""),
    lastReplyAt: String(tracking?.lastReplyAt ?? ""),
    lastMessage: String(tracking?.lastMessage ?? ""),
    events: normalizeContactEvents(tracking?.events ?? [])
  };
}

function normalizeContactEvents(events: ContactEvent[]) {
  return events
    .map((event) => ({
      id: event.id || crypto.randomUUID(),
      type: ["contacted", "replied", "note"].includes(event.type) ? event.type : "note",
      at: event.at || new Date().toISOString(),
      text: String(event.text ?? "")
    }))
    .filter((event) => event.text || event.type !== "note");
}

function makeContactRef(id: string) {
  return `RL-${id.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase()}`;
}
