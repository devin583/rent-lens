(() => {
  const MIN_TEXT_LENGTH = 40;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "RENT_LENS_CAPTURE") return false;

    try {
      sendResponse({ ok: true, payload: capturePost() });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    return true;
  });

  function capturePost() {
    const selectionText = cleanText(window.getSelection()?.toString() || "");
    const container = findBestContainer();
    const text = cleanText(selectionText.length >= MIN_TEXT_LENGTH ? selectionText : container?.innerText || "");
    const images = container ? collectImages(container) : [];
    const sourceUrl = findPermalink(container) || window.location.href;

    if (!text && images.length === 0) {
      throw new Error("No post text or images were detected. Open the post dialog, or select the post text and try again.");
    }

    return {
      sourceUrl,
      originalText: text,
      images,
      pageTitle: document.title
    };
  }

  function findBestContainer() {
    const dialog = largestVisible([...document.querySelectorAll('[role="dialog"]')]);
    if (dialog && cleanText(dialog.innerText).length >= MIN_TEXT_LENGTH) return dialog;

    const articles = [...document.querySelectorAll("article")].filter((item) => isVisible(item));
    const centered = articles
      .map((item) => ({ item, score: viewportScore(item) + cleanText(item.innerText).length / 60 }))
      .sort((a, b) => b.score - a.score)[0]?.item;
    if (centered && cleanText(centered.innerText).length >= MIN_TEXT_LENGTH) return centered;

    return largestVisible([...document.querySelectorAll('[data-pagelet*="FeedUnit"], [role="main"] div')]);
  }

  function largestVisible(elements) {
    return elements
      .filter((item) => isVisible(item))
      .map((item) => {
        const rect = item.getBoundingClientRect();
        const textLength = cleanText(item.innerText || "").length;
        return { item, score: rect.width * rect.height + textLength * 200 };
      })
      .sort((a, b) => b.score - a.score)[0]?.item;
  }

  function viewportScore(element) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = Math.abs(centerX - window.innerWidth / 2);
    const dy = Math.abs(centerY - window.innerHeight / 2);
    return Math.max(0, 1000 - dx - dy);
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return (
      rect.width > 120 &&
      rect.height > 80 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth &&
      style.visibility !== "hidden" &&
      style.display !== "none"
    );
  }

  function collectImages(container) {
    const urls = new Set();
    container.querySelectorAll("img").forEach((image) => {
      const rect = image.getBoundingClientRect();
      const src = image.currentSrc || image.src;
      if (!src || !src.startsWith("http")) return;
      if (rect.width < 120 || rect.height < 90) return;
      if (/emoji|static|profile|scontent.*\/v\/t39\.30808-1/i.test(src)) return;
      urls.add(src);
    });
    return [...urls].slice(0, 16);
  }

  function findPermalink(container) {
    if (!container) return "";
    const anchors = [...container.querySelectorAll("a[href]")];
    const candidates = anchors
      .map((anchor) => anchor.href)
      .filter((href) =>
        /\/posts\/|\/permalink\/|permalink\.php|\/groups\/.+\/posts\/|\/marketplace\/item\//i.test(href)
      )
      .map((href) => stripTracking(href));
    return candidates[0] || "";
  }

  function stripTracking(url) {
    try {
      const parsed = new URL(url);
      ["__cft__", "__tn__", "comment_id", "reply_comment_id", "ref"].forEach((key) => parsed.searchParams.delete(key));
      return parsed.toString();
    } catch {
      return url;
    }
  }

  function cleanText(text) {
    return text
      .replace(/\u00a0/g, " ")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^(Like|Comment|Share|Send|Follow|See more|查看更多|赞|评论|分享)$/.test(line))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
})();
