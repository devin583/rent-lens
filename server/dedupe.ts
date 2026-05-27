import type { DraftInput, RentalPost } from "../src/types";

export interface DuplicateMatch {
  post: RentalPost;
  reason: "url" | "text";
  score: number;
}

export function findDuplicatePost(posts: RentalPost[], draft: DraftInput | RentalPost): DuplicateMatch | null {
  const incomingUrl = canonicalUrl(draft.sourceUrl);
  const incomingText = textFingerprint(draft.originalText);
  let best: DuplicateMatch | null = null;

  for (const post of posts) {
    if (incomingUrl && canonicalUrl(post.sourceUrl) === incomingUrl) {
      return { post, reason: "url", score: 1 };
    }
    if (!incomingText || !post.originalText) continue;
    const score = similarity(incomingText, textFingerprint(post.originalText));
    if (score >= 0.92 && (!best || score > best.score)) {
      best = { post, reason: "text", score };
    }
  }

  return best;
}

export function dedupePosts(posts: RentalPost[]) {
  const kept: RentalPost[] = [];
  const removed: Array<{ removedId: string; keptId: string; reason: DuplicateMatch["reason"]; score: number }> = [];

  for (const post of posts) {
    const duplicate = findDuplicatePost(kept, post);
    if (!duplicate) {
      kept.push(post);
      continue;
    }
    removed.push({
      removedId: post.id,
      keptId: duplicate.post.id,
      reason: duplicate.reason,
      score: duplicate.score
    });
    mergePostData(duplicate.post, post);
  }

  return { posts: kept, removed };
}

export function mergePostData(target: RentalPost, duplicate: RentalPost) {
  target.images = [...new Set([...target.images, ...duplicate.images])];
  target.notes = [target.notes, duplicate.notes].filter(Boolean).join("\n\n");
  if (!target.contactTracking.landlordName && duplicate.contactTracking?.landlordName) {
    target.contactTracking.landlordName = duplicate.contactTracking.landlordName;
  }
  if (!target.contactTracking.messengerUrl && duplicate.contactTracking?.messengerUrl) {
    target.contactTracking.messengerUrl = duplicate.contactTracking.messengerUrl;
  }
  if (!target.contactTracking.lastContactedAt && duplicate.contactTracking?.lastContactedAt) {
    target.contactTracking.lastContactedAt = duplicate.contactTracking.lastContactedAt;
  }
  if (!target.contactTracking.lastReplyAt && duplicate.contactTracking?.lastReplyAt) {
    target.contactTracking.lastReplyAt = duplicate.contactTracking.lastReplyAt;
  }
  if (!target.contactTracking.lastMessage && duplicate.contactTracking?.lastMessage) {
    target.contactTracking.lastMessage = duplicate.contactTracking.lastMessage;
  }
  target.contactTracking.events = mergeEvents(target.contactTracking.events, duplicate.contactTracking?.events ?? []);
  if (!target.translatedText && duplicate.translatedText) target.translatedText = duplicate.translatedText;
  if (!target.structured.mapQuery && duplicate.structured.mapQuery) target.structured.mapQuery = duplicate.structured.mapQuery;
  if (!target.structured.city && duplicate.structured.city) target.structured.city = duplicate.structured.city;
  if (!target.structured.address && duplicate.structured.address) target.structured.address = duplicate.structured.address;
  target.updatedAt = new Date().toISOString();
}

function mergeEvents(targetEvents: RentalPost["contactTracking"]["events"], duplicateEvents: RentalPost["contactTracking"]["events"]) {
  const seen = new Set<string>();
  return [...targetEvents, ...duplicateEvents]
    .filter((event) => {
      const key = `${event.type}-${event.at}-${event.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export function canonicalUrl(url: string) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    [
      "__cft__",
      "__tn__",
      "comment_id",
      "reply_comment_id",
      "ref",
      "mibextid",
      "rdid",
      "share_url",
      "tracking"
    ].forEach((key) => parsed.searchParams.delete(key));
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.trim();
  }
}

function textFingerprint(text: string) {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim()
    .slice(0, 2500);
}

function similarity(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const short = a.length < b.length ? a : b;
  const long = a.length < b.length ? b : a;
  if (long.includes(short) && short.length > 180) return short.length / long.length;
  return jaccard(tokenSet(a), tokenSet(b));
}

function tokenSet(text: string) {
  return new Set(text.split(/\s+/).filter((token) => token.length > 2));
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  return intersection / (a.size + b.size - intersection);
}
