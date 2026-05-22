const API_BASE = "http://127.0.0.1:8787";
const APP_URL = "http://127.0.0.1:5173";

const captureButton = document.getElementById("capture");
const previewButton = document.getElementById("preview");
const openAppButton = document.getElementById("openApp");
const statusBox = document.getElementById("status");
const previewBox = document.getElementById("previewBox");
const subtitle = document.getElementById("subtitle");

let locale = "en";

const messages = {
  en: {
    subtitle: "Save the visible Facebook rental post.",
    capture: "Save current post",
    preview: "Preview capture",
    openApp: "Open Rent Lens",
    initial: "Open a Facebook post or post dialog first.",
    saving: "Capturing and saving...",
    detecting: "Capturing...",
    saved: "Saved",
    duplicate: "Already exists, not saved again",
    link: "Link",
    images: "Images",
    previewReady: "Preview ready. Save when it looks correct.",
    noTab: "No active tab found.",
    notFacebook: "Switch to Facebook first, then click the extension.",
    captureFailed: "Capture failed."
  },
  zh: {
    subtitle: "保存当前可见的 Facebook 房源帖子。",
    capture: "保存当前帖子",
    preview: "预览识别内容",
    openApp: "打开 Rent Lens",
    initial: "请先打开 Facebook 帖子或帖子弹窗。",
    saving: "正在识别并保存...",
    detecting: "正在识别...",
    saved: "已保存",
    duplicate: "已存在，未重复保存",
    link: "链接",
    images: "图片",
    previewReady: "已生成预览。确认后可以保存。",
    noTab: "没有找到当前标签页。",
    notFacebook: "请先切换到 Facebook 页面，再点击插件。",
    captureFailed: "识别失败。"
  }
};

initLocale();

captureButton.addEventListener("click", async () => {
  await runWithStatus(t("saving"), async () => {
    const payload = await captureCurrentTab();
    const response = await fetch(`${API_BASE}/api/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(await response.text());
    const post = await response.json();
    statusBox.className = "status ok";
    statusBox.textContent = post.duplicate ? `${t("duplicate")}: ${post.title}` : `${t("saved")}: ${post.title}`;
  });
});

previewButton.addEventListener("click", async () => {
  await runWithStatus(t("detecting"), async () => {
    const payload = await captureCurrentTab();
    previewBox.hidden = false;
    previewBox.textContent = [
      `${t("link")}: ${payload.sourceUrl}`,
      `${t("images")}: ${payload.images.length}`,
      "",
      payload.originalText.slice(0, 1600)
    ].join("\n");
    statusBox.className = "status ok";
    statusBox.textContent = t("previewReady");
  });
});

openAppButton.addEventListener("click", () => {
  chrome.tabs.create({ url: APP_URL });
});

async function runWithStatus(message, task) {
  try {
    setBusy(true, message);
    await task();
  } catch (error) {
    statusBox.className = "status error";
    statusBox.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    setBusy(false);
  }
}

async function captureCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error(t("noTab"));
  if (!/^https:\/\/(www\.)?facebook\.com\//.test(tab.url || "")) {
    throw new Error(t("notFacebook"));
  }

  try {
    return await sendCaptureMessage(tab.id);
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    return sendCaptureMessage(tab.id);
  }
}

function sendCaptureMessage(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: "RENT_LENS_CAPTURE" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || t("captureFailed")));
        return;
      }
      resolve(response.payload);
    });
  });
}

async function initLocale() {
  try {
    const response = await fetch(`${API_BASE}/api/store`);
    const store = await response.json();
    locale = store.settings?.uiLocale === "zh" ? "zh" : "en";
  } catch {
    locale = "en";
  }
  applyLocale();
}

function applyLocale() {
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  subtitle.textContent = t("subtitle");
  captureButton.textContent = t("capture");
  previewButton.textContent = t("preview");
  openAppButton.textContent = t("openApp");
  statusBox.textContent = t("initial");
}

function t(key) {
  return messages[locale]?.[key] || messages.en[key] || key;
}

function setBusy(isBusy, message) {
  captureButton.disabled = isBusy;
  previewButton.disabled = isBusy;
  if (message) {
    statusBox.className = "status";
    statusBox.textContent = message;
  }
}
