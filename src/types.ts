export type TargetLanguage = "zh" | "en";
export type UiLocale = "zh" | "en";
export type CurrencyCode = "HUF" | "EUR" | "USD" | "CNY" | "GBP";
export type InterestLevel = "high" | "medium" | "low" | "archived";
export type ContactStatus = "not_contacted" | "contacted" | "waiting" | "replied" | "visited" | "rejected";
export type ContactEventType = "contacted" | "replied" | "note";

export type AiProviderType =
  | "openai"
  | "anthropic"
  | "gemini"
  | "openai-compatible";

export type AiProviderVendor =
  | "openai"
  | "anthropic"
  | "gemini"
  | "deepseek"
  | "kimi"
  | "qwen"
  | "glm"
  | "nvidia"
  | "minimax"
  | "custom";

export interface MoneyValue {
  label: string;
  amount: number | null;
  currency: string;
  cadence?: string;
  referenceAmount?: number | null;
  referenceCurrency?: string;
}

export interface StructuredInfo {
  rent: MoneyValue | null;
  fees: MoneyValue[];
  contact: string[];
  address: string;
  city: string;
  rooms: string;
  availability: string;
  deposit: MoneyValue | null;
  important: string[];
  mapQuery: string;
}

export interface RentalPost {
  id: string;
  title: string;
  sourceUrl: string;
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  images: string[];
  notes: string;
  interest: InterestLevel;
  categoryId: string;
  contactStatus: ContactStatus;
  contactTracking: ContactTracking;
  structured: StructuredInfo;
  createdAt: string;
  updatedAt: string;
}

export interface ContactTracking {
  ref: string;
  landlordName: string;
  messengerUrl: string;
  lastContactedAt: string;
  lastReplyAt: string;
  lastMessage: string;
  events: ContactEvent[];
}

export interface ContactEvent {
  id: string;
  type: ContactEventType;
  at: string;
  text: string;
}

export interface AiProviderConfig {
  id: string;
  vendor: AiProviderVendor;
  name: string;
  type: AiProviderType;
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
  availableModels?: string[];
  modelsRefreshedAt?: string;
}

export interface AppSettings {
  uiLocale: UiLocale;
  targetLanguage: TargetLanguage;
  referenceCurrency: CurrencyCode;
  targetAddress: string;
  targetLocation: SavedLocation | null;
  categories: Category[];
  providers: AiProviderConfig[];
}

export interface Category {
  id: string;
  name: string;
}

export interface SavedLocation {
  lat: number;
  lon: number;
  label: string;
}

export interface AppStore {
  posts: RentalPost[];
  settings: AppSettings;
}

export interface DraftInput {
  sourceUrl: string;
  originalText: string;
  images: string[];
}
