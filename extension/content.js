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
    const sourceUrl = currentMarketplaceItemUrl() || findPermalink(container) || normalizePermalink(window.location.href);

    if (!text && images.length === 0) {
      throw new Error("No post text or images were detected. Open the post dialog, or select the post text and try again.");
    }
    if (isGenericFacebookUrl(sourceUrl)) {
      throw new Error(
        "Could not detect a specific Facebook post or Marketplace listing URL. Open the listing detail page or post dialog, then try again."
      );
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
    const currentItemId = marketplaceItemId(window.location.href);
    const anchors = [...container.querySelectorAll("a[href]")];
    const candidates = anchors
      .map((anchor) => normalizePermalink(anchor.href))
      .filter((href) => isConcreteFacebookUrl(href))
      .map((href) => ({
        href,
        score: permalinkScore(href, currentItemId)
      }))
      .sort((a, b) => b.score - a.score);
    return candidates[0]?.href || "";
  }

  function currentMarketplaceItemUrl() {
    return marketplaceItemUrl(window.location.href);
  }

  function permalinkScore(url, currentItemId) {
    const itemId = marketplaceItemId(url);
    if (currentItemId && itemId === currentItemId) return 100;
    if (itemId) return 40;
    if (/\/groups\/[^/]+\/posts\/[^/?#]+/i.test(url)) return 30;
    if (/permalink\.php/i.test(url)) return 20;
    if (/\/posts\/[^/?#]+/i.test(url)) return 15;
    return 1;
  }

  function normalizePermalink(url) {
    try {
      const parsed = new URL(url);
      const marketplaceUrl = marketplaceItemUrl(parsed.toString());
      if (marketplaceUrl) return marketplaceUrl;

      const multipermalink = parsed.searchParams.get("multi_permalinks");
      const groupMatch = parsed.pathname.match(/\/groups\/([^/?#]+)/i);
      if (groupMatch && multipermalink) {
        return `https://www.facebook.com/groups/${groupMatch[1]}/posts/${multipermalink}`;
      }

      [
        "__cft__",
        "__tn__",
        "comment_id",
        "reply_comment_id",
        "ref",
        "referral_code",
        "referral_story_type",
        "hoisted_section_header_type",
        "mibextid",
        "rdid",
        "share_url",
        "tracking"
      ].forEach((key) => parsed.searchParams.delete(key));
      parsed.hash = "";
      return parsed.toString().replace(/\/$/, "");
    } catch {
      return url;
    }
  }

  function marketplaceItemUrl(url) {
    const id = marketplaceItemId(url);
    return id ? `https://www.facebook.com/marketplace/item/${id}` : "";
  }

  function marketplaceItemId(url) {
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(/\/marketplace\/item\/(\d+)/i);
      return match?.[1] || parsed.searchParams.get("item_id") || "";
    } catch {
      const match = String(url).match(/\/marketplace\/item\/(\d+)/i);
      return match?.[1] || "";
    }
  }

  function isConcreteFacebookUrl(url) {
    try {
      const parsed = new URL(url);
      if (!/(^|\.)facebook\.com$/i.test(parsed.hostname)) return false;
      return (
        /\/marketplace\/item\/\d+/i.test(parsed.pathname) ||
        /\/groups\/[^/]+\/posts\/[^/?#]+/i.test(parsed.pathname) ||
        /\/groups\/[^/]+\/permalink\/[^/?#]+/i.test(parsed.pathname) ||
        /\/posts\/[^/?#]+/i.test(parsed.pathname) ||
        /\/share\/[^/?#]+/i.test(parsed.pathname) ||
        (parsed.pathname.endsWith("/permalink.php") &&
          (parsed.searchParams.has("story_fbid") || parsed.searchParams.has("multi_permalinks")))
      );
    } catch {
      return false;
    }
  }

  function isGenericFacebookUrl(url) {
    try {
      const parsed = new URL(url);
      if (!/(^|\.)facebook\.com$/i.test(parsed.hostname)) return false;
      return !isConcreteFacebookUrl(url);
    } catch {
      return false;
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
