import type { AiProviderConfig, AppSettings, DraftInput, RentalPost, StructuredInfo } from "../src/types";
import { resolveProviderConfig } from "../src/aiProviders";

const exchangeRates: Record<string, number> = {
  HUF: 1,
  EUR: 388,
  USD: 358,
  CNY: 49.5,
  GBP: 452
};

export function buildFallbackPost(input: DraftInput, settings: AppSettings): RentalPost {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const text = input.originalText.trim();
  const title = inferTitle(text, input.sourceUrl);
  const structured = inferStructured(text, settings.referenceCurrency);
  return {
    id,
    title,
    sourceUrl: input.sourceUrl,
    originalText: text,
    translatedText: fallbackMessage(settings.targetLanguage, "no-ai"),
    detectedLanguage: "unknown",
    images: input.images.filter(Boolean),
    notes: "",
    interest: "medium",
    categoryId: settings.categories[0]?.id ?? "medium",
    contactStatus: "not_contacted",
    contactTracking: {
      ref: makeContactRef(id),
      landlordName: "",
      messengerUrl: "",
      lastContactedAt: "",
      lastReplyAt: "",
      lastMessage: "",
      events: []
    },
    structured,
    createdAt: now,
    updatedAt: now
  };
}

function makeContactRef(id: string) {
  return `RL-${id.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase()}`;
}

export async function analyzeWithAi(input: DraftInput, settings: AppSettings): Promise<RentalPost> {
  const providers = settings.providers
    .map((provider) => resolveProviderConfig(provider))
    .filter((provider) => provider.enabled && provider.apiKey && provider.model && provider.baseUrl);
  const fallback = buildFallbackPost(input, settings);
  if (!providers.length) return fallback;

  const prompt = buildPrompt(input, settings);
  const failures: string[] = [];

  for (const provider of providers) {
    try {
      const content = await callProvider(provider, prompt);
      const parsed = parseJson(content);
      const now = new Date().toISOString();
      const structured = normalizeStructured(
        parsed.structured,
        settings.referenceCurrency,
        input.originalText,
        fallback.createdAt,
        settings.targetLanguage
      );
      return {
        ...fallback,
        title: parsed.title || fallback.title,
        translatedText: parsed.translatedText || fallback.translatedText,
        detectedLanguage: parsed.detectedLanguage || "unknown",
        structured,
        createdAt: now,
        updatedAt: now
      };
    } catch (error) {
      failures.push(`${provider.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    ...fallback,
    translatedText: `${fallback.translatedText}\n\n${fallbackMessage(settings.targetLanguage, "ai-failed")}: ${failures.join("；")}`
  };
}

function buildPrompt(input: DraftInput, settings: AppSettings) {
  const languageName = settings.targetLanguage === "zh" ? "简体中文" : "English";
  const fieldLanguageNote =
    settings.targetLanguage === "zh"
      ? "Return title, translatedText, fee labels, important notes, and natural-language structured strings in Simplified Chinese."
      : "Return title, translatedText, fee labels, important notes, and natural-language structured strings in English.";
  const currentDate = new Date().toISOString().slice(0, 10);
  return `You are helping a Chinese expat evaluate rental posts in Hungary.
Return only valid JSON. Translate the post into ${languageName}. Extract structured rental information.
${fieldLanguageNote}
Reference currency: ${settings.referenceCurrency}. When money is present, calculate approximate referenceAmount using current common-sense exchange rates if you can.
Current date: ${currentDate}.

Date interpretation rules:
- Facebook rental posts often omit the year. If a date/month has no explicit year, infer it relative to the current date and the post context.
- Prefer the nearest future date for rental availability. Example: if current date is 2026-05-22, "July 4", "Julius 4", "7月4日", and "Aug 24" mean 2026-07-04 and 2026-08-24, not a past year.
- If the text says "8 hours ago", "today", "yesterday", or similar, treat the post as recent.
- Never invent a past year such as 2024 unless the original post explicitly contains that year.
- In structured.availability, include the inferred year when possible.

JSON schema:
{
  "title": "short useful title",
  "detectedLanguage": "Hungarian/English/etc",
  "translatedText": "translated full text",
  "structured": {
    "rent": {"label":"rent","amount":123,"currency":"HUF","cadence":"monthly","referenceAmount":123,"referenceCurrency":"CNY"},
    "fees": [{"label":"utilities/common cost/etc","amount":123,"currency":"HUF","cadence":"monthly","referenceAmount":123,"referenceCurrency":"CNY"}],
    "contact": ["phone/email/name/facebook profile"],
    "address": "specific address or neighborhood",
    "city": "city",
    "rooms": "rooms / size",
    "availability": "available date",
    "deposit": {"label":"deposit","amount":123,"currency":"HUF","cadence":"one-time","referenceAmount":123,"referenceCurrency":"CNY"},
    "important": ["short important facts"],
    "mapQuery": "best Google Maps search query"
  }
}

Post URL: ${input.sourceUrl}
Post text:
${input.originalText}`;
}

async function callProvider(provider: AiProviderConfig, prompt: string) {
  if (provider.type === "anthropic") return callAnthropic(provider, prompt);
  if (provider.type === "gemini") return callGemini(provider, prompt);
  return callOpenAiCompatible(provider, prompt);
}

async function callOpenAiCompatible(provider: AiProviderConfig, prompt: string) {
  const response = await fetch(`${trimSlash(provider.baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" }
    })
  });
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(provider: AiProviderConfig, prompt: string) {
  const response = await fetch(`${trimSlash(provider.baseUrl)}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": provider.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: 2500,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  return data.content?.map((part: { text?: string }) => part.text ?? "").join("") ?? "";
}

async function callGemini(provider: AiProviderConfig, prompt: string) {
  const response = await fetch(
    `${trimSlash(provider.baseUrl)}/models/${provider.model}:generateContent?key=${provider.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
      })
    }
  );
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("") ?? "";
}

function normalizeStructured(
  raw: Partial<StructuredInfo> | undefined,
  referenceCurrency: string,
  text: string,
  createdAt = new Date().toISOString(),
  targetLanguage: AppSettings["targetLanguage"] = "en"
): StructuredInfo {
  const fallback = inferStructured(text, referenceCurrency);
  const availability = normalizeAvailability(raw?.availability ?? fallback.availability, text, createdAt);
  return {
    rent: normalizeMoney(raw?.rent ?? fallback.rent, referenceCurrency, targetLanguage),
    fees: (raw?.fees ?? fallback.fees ?? [])
      .map((item) => normalizeMoney(item, referenceCurrency, targetLanguage))
      .filter((item): item is NonNullable<ReturnType<typeof normalizeMoney>> => Boolean(item)),
    contact: raw?.contact ?? fallback.contact,
    address: raw?.address ?? fallback.address,
    city: raw?.city ?? fallback.city,
    rooms: raw?.rooms ?? fallback.rooms,
    availability,
    deposit: normalizeMoney(raw?.deposit ?? fallback.deposit, referenceCurrency, targetLanguage),
    important: raw?.important ?? fallback.important,
    mapQuery: raw?.mapQuery || fallback.mapQuery
  };
}

function normalizeMoney(value: unknown, referenceCurrency: string, targetLanguage: AppSettings["targetLanguage"] = "en") {
  if (!value || typeof value !== "object") return null;
  const money = value as Record<string, unknown>;
  const amount = typeof money.amount === "number" ? money.amount : numberFromText(String(money.amount ?? ""));
  const currency = String(money.currency || "HUF").toUpperCase();
  return {
    label: String(money.label || (targetLanguage === "zh" ? "费用" : "Cost")),
    amount,
    currency,
    cadence: String(money.cadence || ""),
    referenceAmount:
      typeof money.referenceAmount === "number" ? money.referenceAmount : convert(amount, currency, referenceCurrency),
    referenceCurrency
  };
}

function parseJson(content: string) {
  const cleaned = content.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("AI did not return JSON");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function inferTitle(text: string, url: string) {
  const firstLine = text.split(/\n+/).find((line) => line.trim().length > 8)?.trim();
  if (firstLine) return firstLine.slice(0, 60);
  return url ? "Facebook rental post" : "Untitled rental";
}

function inferStructured(text: string, referenceCurrency: string): StructuredInfo {
  const rentMatch = text.match(/(?:rent|rental|bérleti díj|kiadó|price|ár)[^\d]{0,20}([\d\s.,]{3,})\s?(HUF|Ft|EUR|€|USD|\$|CNY|RMB)?/i)
    ?? text.match(/([\d\s.,]{3,})\s?(HUF|Ft|EUR|€|USD|\$|CNY|RMB)/i);
  const amount = rentMatch ? numberFromText(rentMatch[1]) : null;
  const currency = normalizeCurrency(rentMatch?.[2] ?? "HUF");
  const rent = amount
    ? {
        label: "Rent",
        amount,
        currency,
        cadence: "monthly",
        referenceAmount: convert(amount, currency, referenceCurrency),
        referenceCurrency
      }
    : null;
  const city = /budapest/i.test(text) ? "Budapest" : "";
  const inferredCity = extractCity(text) || city;
  const address = extractAddress(text);
  const mapQuery = [address, inferredCity].filter(Boolean).join(", ");
  return {
    rent,
    fees: [],
    contact: extractContacts(text),
    address,
    city: inferredCity,
    rooms: extractRooms(text),
    availability: "",
    deposit: null,
    important: [],
    mapQuery: mapQuery || inferredCity || address || ""
  };
}

function normalizeAvailability(value: unknown, text: string, createdAt: string) {
  const availability = typeof value === "string" ? value.trim() : "";
  const inferred = inferAvailability(text, createdAt);
  if (!availability) return inferred;

  const postYear = new Date(createdAt).getFullYear();
  const years = [...availability.matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1]));
  const hasExplicitYearInText = years.some((year) => new RegExp(`\\b${year}\\b`).test(text));
  if (inferred && years.some((year) => year < postYear) && !hasExplicitYearInText) return inferred;
  return availability;
}

function inferAvailability(text: string, createdAt: string) {
  const baseDate = new Date(createdAt);
  if (Number.isNaN(baseDate.getTime())) return "";
  const ranges = extractDateMentions(text);
  if (!ranges.length) return "";
  const normalized = ranges.slice(0, 2).map((item) => inferDateWithYear(item.month, item.day, baseDate));
  if (normalized.length === 1) return normalized[0];
  return `${normalized[0]} - ${normalized[1]}`;
}

function extractDateMentions(text: string) {
  const mentions: Array<{ month: number; day: number }> = [];
  const monthNames: Record<string, number> = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    julius: 7,
    július: 7,
    aug: 8,
    august: 8,
    augusztus: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12
  };

  for (const match of text.matchAll(/\b([A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]+)\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi)) {
    const month = monthNames[match[1].toLowerCase()];
    const day = Number(match[2]);
    if (month && day >= 1 && day <= 31) mentions.push({ month, day });
  }

  for (const match of text.matchAll(/\b(\d{1,2})\s*(?:月|\.|\/|-)\s*(\d{1,2})(?:日|\.)?/g)) {
    const month = Number(match[1]);
    const day = Number(match[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) mentions.push({ month, day });
  }

  return dedupeDates(mentions);
}

function inferDateWithYear(month: number, day: number, baseDate: Date) {
  let year = baseDate.getFullYear();
  const candidate = new Date(Date.UTC(year, month - 1, day));
  const base = new Date(Date.UTC(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate()));
  if (candidate.getTime() < base.getTime() - 1000 * 60 * 60 * 24 * 45) year += 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dedupeDates(dates: Array<{ month: number; day: number }>) {
  const seen = new Set<string>();
  return dates.filter((date) => {
    const key = `${date.month}-${date.day}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function numberFromText(text: string) {
  const cleaned = text.replace(/\s/g, "").replace(",", ".");
  const match = cleaned.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function normalizeCurrency(value: string) {
  const normalized = value.toUpperCase();
  if (normalized === "FT") return "HUF";
  if (normalized === "€") return "EUR";
  if (normalized === "$") return "USD";
  if (normalized === "RMB") return "CNY";
  return normalized || "HUF";
}

function convert(amount: number | null, from: string, to: string) {
  if (!amount || !exchangeRates[from] || !exchangeRates[to]) return null;
  const huf = amount * exchangeRates[from];
  return Math.round(huf / exchangeRates[to]);
}

function fallbackMessage(language: AppSettings["targetLanguage"], key: "no-ai" | "ai-failed") {
  const messages = {
    zh: {
      "no-ai": "未调用 AI。请在设置中启用至少一个可用供应商，或稍后点击“重新分析”。",
      "ai-failed": "AI 调用失败"
    },
    en: {
      "no-ai": "AI was not called. Enable at least one available provider in Settings, or click Reanalyze later.",
      "ai-failed": "AI call failed"
    }
  };
  return messages[language][key];
}

function extractContacts(text: string) {
  const contacts = new Set<string>();
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  const phone = text.match(/(?:\+36|06)?[\s-]?\d{1,2}[\s-]?\d{3}[\s-]?\d{3,4}/g);
  email?.forEach((item) => contacts.add(item));
  phone?.forEach((item) => contacts.add(item.trim()));
  return [...contacts];
}

function extractAddress(text: string) {
  const district = text.match(/\b(?:district|kerület|ker\.|[IVXLCDM]{1,5}\.)\s?(\d{1,2}|[IVXLCDM]{1,5})/i);
  if (district) return `Budapest ${district[0]}`;
  const street = text.match(
    /([A-ZÁÉÍÓÖŐÚÜŰ][A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű.'-]*(?:\s+[A-ZÁÉÍÓÖŐÚÜŰ]?[A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű.'-]*){0,3})\s+(utcában|utcai|utca|u\.|út|úton|körút|krt\.|tér|téren|sugárút)/i
  );
  if (street) return `${cleanStreetName(street[1])} ${normalizeStreetType(street[2])}`;
  return "";
}

function extractCity(text: string) {
  const cities = [
    ["Budapest", /\bBudapest(?:en|i)?\b/i],
    ["Szeged", /\bSzeged(?:en|i)?\b/i],
    ["Debrecen", /\bDebrecen(?:ben|i)?\b/i],
    ["Pécs", /\bPécs(?:en|i)?\b/i],
    ["Győr", /\bGyőr(?:ben|i)?\b/i],
    ["Miskolc", /\bMiskolc(?:on|i)?\b/i],
    ["Sopron", /\bSopron(?:ban|i)?\b/i],
    ["Kecskemét", /\bKecskemét(?:en|i)?\b/i],
    ["Nyíregyháza", /\bNyíregyháza(?:n|i)?\b/i],
    ["Székesfehérvár", /\bSzékesfehérvár(?:on|i)?\b/i]
  ] as const;
  return cities.find(([, pattern]) => pattern.test(text))?.[0] ?? "";
}

function normalizeStreetType(type: string) {
  const value = type.toLowerCase();
  if (value.startsWith("utc")) return "utca";
  if (value === "u.") return "utca";
  if (value.startsWith("ú")) return "út";
  if (value.startsWith("k")) return "körút";
  if (value.startsWith("t")) return "tér";
  return type;
}

function cleanStreetName(name: string) {
  return name
    .replace(/\b(?:Budapesten|Budapest|Szegeden|Szeged|Debrecenben|Debrecen|Pécsen|Pécs|Győrben|Győr)\b/gi, "")
    .replace(/\b(?:a|az)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractRooms(text: string) {
  const match = text.match(/(\d+(?:\.\d+)?)\s?(?:room|rooms|szoba|bedroom|bedrooms)/i);
  return match ? match[0] : "";
}

function trimSlash(url: string) {
  return url.replace(/\/+$/, "");
}
