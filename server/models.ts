import { getProviderPreset, resolveProviderConfig } from "../src/aiProviders";
import type { AiProviderConfig } from "../src/types";

export async function listProviderModels(provider: AiProviderConfig) {
  const resolved = resolveProviderConfig(provider);
  if (!resolved.apiKey) throw new Error("API Key is required to refresh models.");

  if (resolved.type === "gemini") return listGeminiModels(resolved);
  if (resolved.type === "anthropic") return listAnthropicModels(resolved);
  return listOpenAiCompatibleModels(resolved);
}

export function fallbackModels(provider: AiProviderConfig) {
  const preset = getProviderPreset(provider.vendor);
  return unique([provider.model, preset.model, ...(provider.availableModels ?? [])]);
}

async function listOpenAiCompatibleModels(provider: AiProviderConfig) {
  const response = await fetch(`${trimSlash(provider.baseUrl)}/models`, {
    headers: {
      Authorization: `Bearer ${provider.apiKey}`
    }
  });
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  return unique((data.data ?? []).map((model: { id?: string }) => model.id).filter(Boolean));
}

async function listAnthropicModels(provider: AiProviderConfig) {
  const response = await fetch(`${trimSlash(provider.baseUrl)}/models?limit=1000`, {
    headers: {
      "x-api-key": provider.apiKey,
      "anthropic-version": "2023-06-01"
    }
  });
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  return unique((data.data ?? []).map((model: { id?: string }) => model.id).filter(Boolean));
}

async function listGeminiModels(provider: AiProviderConfig) {
  const response = await fetch(`${trimSlash(provider.baseUrl)}/models?key=${provider.apiKey}`);
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  return unique(
    (data.models ?? [])
      .filter((model: { supportedGenerationMethods?: string[] }) =>
        model.supportedGenerationMethods?.includes("generateContent")
      )
      .map((model: { name?: string }) => model.name?.replace(/^models\//, ""))
      .filter(Boolean)
  );
}

function unique(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function trimSlash(url: string) {
  return url.replace(/\/+$/, "");
}
