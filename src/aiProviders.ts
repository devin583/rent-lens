import type { AiProviderConfig, AiProviderVendor } from "./types";

export interface AiProviderPreset {
  vendor: AiProviderVendor;
  name: string;
  type: AiProviderConfig["type"];
  baseUrl: string;
  model: string;
  apiKeyLabel: string;
  baseUrlRequired?: boolean;
  docsUrl: string;
  guide: {
    zh: string[];
    en: string[];
  };
}

export const aiProviderPresets: AiProviderPreset[] = [
  {
    vendor: "openai",
    name: "OpenAI",
    type: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    apiKeyLabel: "OpenAI API Key",
    docsUrl: "https://platform.openai.com/api-keys",
    guide: {
      zh: ["打开 OpenAI Platform 并进入 API Keys。", "选择项目后创建新的 secret key。", "这里只需要填 API Key；Base URL 和模型可留空使用默认值。"],
      en: ["Open OpenAI Platform and go to API Keys.", "Choose a project and create a new secret key.", "Enter only the API key here; Base URL and model can use defaults."]
    }
  },
  {
    vendor: "gemini",
    name: "Gemini",
    type: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-flash-lite",
    apiKeyLabel: "Gemini API Key",
    docsUrl: "https://ai.google.dev/gemini-api/docs/api-key",
    guide: {
      zh: ["打开 Google AI Studio 的 API key 页面。", "创建或复制 Gemini API Key。", "这里只需要填 API Key；Base URL 和模型可留空使用默认值。"],
      en: ["Open the API key page in Google AI Studio.", "Create or copy a Gemini API key.", "Enter only the API key here; Base URL and model can use defaults."]
    }
  },
  {
    vendor: "anthropic",
    name: "Claude",
    type: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-3-5-haiku-latest",
    apiKeyLabel: "Anthropic API Key",
    docsUrl: "https://console.anthropic.com/settings/keys",
    guide: {
      zh: ["打开 Anthropic Console。", "在 Account Settings / API Keys 创建 Key。", "这里只需要填 API Key；Base URL 和模型可留空使用默认值。"],
      en: ["Open Anthropic Console.", "Create a key in Account Settings / API Keys.", "Enter only the API key here; Base URL and model can use defaults."]
    }
  },
  {
    vendor: "deepseek",
    name: "DeepSeek",
    type: "openai-compatible",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    apiKeyLabel: "DeepSeek API Key",
    docsUrl: "https://api-docs.deepseek.com/",
    guide: {
      zh: ["登录 DeepSeek 开放平台。", "在 API Keys 创建或复制 Key。", "DeepSeek 兼容 OpenAI Chat Completions；这里只需要填 API Key，必要时再覆盖模型。"],
      en: ["Sign in to the DeepSeek platform.", "Create or copy an API key.", "DeepSeek is OpenAI-compatible; enter the API key and override the model only if needed."]
    }
  },
  {
    vendor: "kimi",
    name: "Kimi",
    type: "openai-compatible",
    baseUrl: "https://api.moonshot.ai/v1",
    model: "moonshot-v1-8k",
    apiKeyLabel: "Moonshot API Key",
    docsUrl: "https://platform.kimi.ai/docs/api/overview",
    guide: {
      zh: ["打开 Kimi / Moonshot API Platform。", "在控制台创建 API Key。", "Kimi 兼容 OpenAI；Base URL 默认使用 Moonshot 官方接口。"],
      en: ["Open the Kimi / Moonshot API Platform.", "Create an API key in the console.", "Kimi is OpenAI-compatible; the default Base URL points to Moonshot."]
    }
  },
  {
    vendor: "qwen",
    name: "通义千问",
    type: "openai-compatible",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    apiKeyLabel: "DashScope API Key",
    docsUrl: "https://www.alibabacloud.com/help/doc-detail/2840915.html",
    guide: {
      zh: ["打开阿里云百炼 / Model Studio。", "创建或复制 DashScope API Key。", "通义千问兼容 OpenAI；Base URL 和模型可先用默认值。"],
      en: ["Open Alibaba Cloud Model Studio.", "Create or copy a DashScope API key.", "Qwen supports OpenAI-compatible calls; defaults are usually enough."]
    }
  },
  {
    vendor: "glm",
    name: "智谱 GLM",
    type: "openai-compatible",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4.7-flash",
    apiKeyLabel: "智谱 API Key",
    docsUrl: "https://docs.bigmodel.cn/api-reference",
    guide: {
      zh: ["打开智谱 BigModel 开放平台。", "在 API Key 管理页创建项目 Key。", "默认使用 OpenAI 兼容的 /api/paas/v4 路径和 glm-4.7-flash。"],
      en: ["Open the Zhipu BigModel platform.", "Create a project API key in API key management.", "Defaults use the OpenAI-compatible /api/paas/v4 path and glm-4.7-flash."]
    }
  },
  {
    vendor: "nvidia",
    name: "NVIDIA AI",
    type: "openai-compatible",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    model: "meta/llama-3.1-70b-instruct",
    apiKeyLabel: "NVIDIA API Key",
    docsUrl: "https://docs.api.nvidia.com/nim/reference/llm-apis",
    guide: {
      zh: ["打开 NVIDIA API Catalog / Build 页面。", "选择可用模型并创建 API Key。", "NVIDIA NIM 暴露 OpenAI 兼容接口；如果你换模型，需要同步修改模型名。"],
      en: ["Open NVIDIA API Catalog / Build.", "Choose an available model and create an API key.", "NVIDIA NIM exposes OpenAI-compatible APIs; update the model name if you choose another model."]
    }
  },
  {
    vendor: "minimax",
    name: "MiniMax",
    type: "openai-compatible",
    baseUrl: "https://api.minimax.io/v1",
    model: "MiniMax-M2.5",
    apiKeyLabel: "MiniMax API Key",
    baseUrlRequired: false,
    docsUrl: "https://platform.minimax.io/docs/guides/quickstart-preparation",
    guide: {
      zh: ["打开 MiniMax API Platform。", "注册或登录后获取 API Key。", "国际区默认 Base URL 为 https://api.minimax.io/v1；中国区可能需要改为官方给出的区域地址。"],
      en: ["Open MiniMax API Platform.", "Register or sign in and obtain an API key.", "The international default Base URL is https://api.minimax.io/v1; use the regional URL if your account requires it."]
    }
  },
  {
    vendor: "custom",
    name: "自定义兼容接口",
    type: "openai-compatible",
    baseUrl: "",
    model: "",
    apiKeyLabel: "API Key",
    baseUrlRequired: true,
    docsUrl: "",
    guide: {
      zh: ["选择这个选项用于 OpenAI 兼容网关。", "填写网关提供的 API Key、Base URL 和模型名。", "Base URL 通常以 /v1 结尾，并由本应用自动追加 /chat/completions。"],
      en: ["Use this for any OpenAI-compatible gateway.", "Enter the gateway API key, Base URL, and model name.", "Base URL usually ends with /v1; this app appends /chat/completions."]
    }
  }
];

export function getProviderPreset(vendor: AiProviderVendor) {
  return aiProviderPresets.find((preset) => preset.vendor === vendor) ?? aiProviderPresets[0];
}

export function resolveProviderConfig(provider: AiProviderConfig): AiProviderConfig {
  const preset = getProviderPreset(provider.vendor);
  return {
    ...provider,
    name: provider.name || preset.name,
    type: provider.type || preset.type,
    baseUrl: provider.baseUrl || preset.baseUrl,
    model: provider.model || preset.model
  };
}
