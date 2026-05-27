import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CheckCircle2,
  Bike,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Circle,
  Copy,
  Footprints,
  ExternalLink,
  Home,
  Image,
  LayoutGrid,
  Loader2,
  MapPinned,
  MessageCircle,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Reply,
  Save,
  Search,
  Send,
  Settings,
  Star,
  Trash2,
  Wand2,
  X
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { aiProviderPresets, getProviderPreset, providerDisplayName } from "./aiProviders";
import { createT, type TFunction } from "./i18n";
import type {
  AiProviderConfig,
  AiProviderVendor,
  AppSettings,
  AppStore,
  Category,
  ContactEventType,
  ContactStatus,
  ContactTracking,
  DraftInput,
  InterestLevel,
  MoneyValue,
  RentalPost,
  SavedLocation
} from "./types";
import "./styles.css";

type WorkspaceMode = "detail" | "new" | "cards";
type CardSort = "updated_desc" | "created_desc" | "rent_asc" | "rent_desc" | "title_asc";
type RentFilter = "all" | "detected" | "missing";
type ContactMessageMode = "short" | "detailed" | "ref";

function App() {
  const [store, setStore] = useState<AppStore | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("detail");
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<DraftInput>({ sourceUrl: "", originalText: "", images: [] });
  const [imageText, setImageText] = useState("");
  const [notice, setNotice] = useState("");
  const [cityFilter, setCityFilter] = useState("");

  useEffect(() => {
    loadStore();
  }, []);

  const posts = store?.posts ?? [];
  const filteredPosts = useMemo(
    () => posts.filter((post) => !cityFilter || cityKey(post) === cityFilter),
    [posts, cityFilter]
  );
  const selected = filteredPosts.find((post) => post.id === selectedId) ?? filteredPosts[0] ?? posts[0];
  const t = createT(store?.settings.uiLocale ?? "en");
  const categories = store?.settings.categories ?? [];
  const cityOptions = useMemo(() => {
    const cities = [...new Set(posts.map(cityKey).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return cities;
  }, [posts]);

  useEffect(() => {
    if (workspaceMode !== "detail") return;
    if (!selectedId && selected) setSelectedId(selected.id);
    if (cityFilter && selectedId && !filteredPosts.some((post) => post.id === selectedId) && filteredPosts[0]) {
      setSelectedId(filteredPosts[0].id);
    }
  }, [filteredPosts, selected, selectedId, cityFilter, workspaceMode]);

  const grouped = useMemo(
    () =>
      categories.map((category) => ({
        category,
        posts: filteredPosts.filter((post) => post.categoryId === category.id)
      })),
    [categories, filteredPosts]
  );

  async function loadStore() {
    const response = await fetch("/api/store");
    setStore(await response.json());
  }

  async function scrape() {
    if (!draft.sourceUrl) return;
    setLoading(true);
    setNotice("");
    const response = await fetch("/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: draft.sourceUrl })
    });
    const data = await response.json();
    setDraft((current) => ({
      ...current,
      originalText: data.text || current.originalText,
      images: data.images?.length ? data.images : current.images
    }));
    setNotice(data.warning || t("scrapeDone"));
    setLoading(false);
  }

  async function addPost() {
    if (!draft.sourceUrl && !draft.originalText.trim()) return;
    setLoading(true);
    const images = [...draft.images, ...parseImages(imageText)];
    const response = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, images })
    });
    const post = await response.json();
    await loadStore();
    setSelectedId(post.id);
    setWorkspaceMode("detail");
    setDraft({ sourceUrl: "", originalText: "", images: [] });
    setImageText("");
    setLoading(false);
  }

  async function updatePost(id: string, patch: Partial<RentalPost>) {
    const response = await fetch(`/api/posts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    const post = await response.json();
    setStore((current) =>
      current
        ? {
            ...current,
            posts: current.posts.map((item) => (item.id === post.id ? post : item))
          }
        : current
    );
  }

  async function removePost(id: string) {
    await fetch(`/api/posts/${id}`, { method: "DELETE" });
    await loadStore();
    setSelectedId("");
    setWorkspaceMode("cards");
  }

  async function reanalyze(id: string) {
    setLoading(true);
    const response = await fetch(`/api/posts/${id}/reanalyze`, { method: "POST" });
    const post = await response.json();
    await loadStore();
    setSelectedId(post.id);
    setLoading(false);
  }

  async function saveSettings(settings: AppSettings) {
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });
    const next = await response.json();
    setStore((current) => (current ? { ...current, settings: next } : current));
    setNotice(t("savedSettings"));
  }

  async function dedupeNow() {
    const response = await fetch("/api/dedupe", { method: "POST" });
    const result = await response.json();
    await loadStore();
    setNotice(`${t("dedupeDone")}：${result.removed?.length ?? 0}`);
  }

  async function updateSettings(next: AppSettings) {
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next)
    });
    const settings = await response.json();
    setStore((current) => (current ? { ...current, settings } : current));
    return settings;
  }

  function renameCategory(id: string, name: string) {
    if (!store) return;
    const next = {
      ...store.settings,
      categories: store.settings.categories.map((category) => (category.id === id ? { ...category, name } : category))
    };
    void updateSettings(next);
  }

  function addCategory() {
    if (!store) return;
    const next = {
      ...store.settings,
      categories: [...store.settings.categories, { id: crypto.randomUUID(), name: t("newCategory") }]
    };
    void updateSettings(next);
  }

  if (!store) {
    return (
      <div className="loading-screen">
        <Loader2 className="spin" size={22} />
      </div>
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-icon">
              <Home size={18} />
            </div>
            <div>
              <h1>Rent Lens</h1>
              <p>{t("appSubtitle")}</p>
            </div>
          </div>

          <button
            className={`primary-button ${workspaceMode === "new" ? "active" : ""}`}
            onClick={() => {
              setWorkspaceMode("new");
              setSelectedId("");
            }}
          >
            <Plus size={16} />
            {t("addPost")}
          </button>

          <button
            className={`secondary-button nav-button ${workspaceMode === "cards" ? "active" : ""}`}
            onClick={() => setWorkspaceMode("cards")}
          >
            <LayoutGrid size={16} />
            {t("cards")}
          </button>

          {cityOptions.length ? (
            <div className="city-filter">
              <button className={`city-chip ${!cityFilter ? "active" : ""}`} onClick={() => setCityFilter("")}>
                {t("allCities")}
              </button>
              {cityOptions.map((city) => (
                <button
                  key={city}
                  className={`city-chip ${cityFilter === city ? "active" : ""}`}
                  onClick={() => setCityFilter(city)}
                >
                  {city === "__unknown__" ? t("unknownCity") : city}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="sidebar-scroll">
          <div className="group-list">
            {grouped.map(({ category, posts }) => (
              <PostGroup
                key={category.id}
                category={category}
                posts={posts}
                activeId={workspaceMode === "detail" ? selected?.id : undefined}
                t={t}
                onRename={renameCategory}
                onSelect={(id) => {
                  setWorkspaceMode("detail");
                  setSelectedId(id);
                }}
              />
            ))}
          </div>
        </div>

        <div className="sidebar-bottom">
          <button className="sidebar-tool-button" onClick={addCategory} title={t("addCategory")}>
            <Plus size={16} />
          </button>
          <button className="sidebar-tool-button" onClick={() => setShowSettings(true)} title={t("settings")}>
            <Settings size={16} />
          </button>
        </div>
      </aside>

      <main className="workspace">
        {workspaceMode === "new" ? (
          <NewPostPanel
            draft={draft}
            setDraft={setDraft}
            imageText={imageText}
            setImageText={setImageText}
            loading={loading}
            notice={notice}
            t={t}
            onScrape={scrape}
            onAdd={addPost}
          />
        ) : workspaceMode === "cards" ? (
          <CardOverview
            posts={filteredPosts}
            categories={categories}
            referenceCurrency={store.settings.referenceCurrency}
            cityFilter={cityFilter}
            t={t}
            onSelect={(id) => {
              setWorkspaceMode("detail");
              setSelectedId(id);
            }}
          />
        ) : selected ? (
          <PostDetail
            post={selected}
            loading={loading}
            referenceCurrency={store.settings.referenceCurrency}
            targetAddress={store.settings.targetAddress}
            targetLocation={store.settings.targetLocation}
            categories={categories}
            t={t}
            onUpdate={(patch) => updatePost(selected.id, patch)}
            onDelete={() => removePost(selected.id)}
            onReanalyze={() => reanalyze(selected.id)}
          />
        ) : null}
      </main>

      {showSettings ? (
        <SettingsModal
          settings={store.settings}
          t={t}
          onClose={() => setShowSettings(false)}
          onSave={saveSettings}
          onDedupe={dedupeNow}
        />
      ) : null}
    </div>
  );
}

function PostGroup({
  category,
  posts,
  activeId,
  t,
  onRename,
  onSelect
}: {
  category: Category;
  posts: RentalPost[];
  activeId?: string;
  t: TFunction;
  onRename: (id: string, name: string) => void;
  onSelect: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [name, setName] = useState(category.name);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setName(category.name);
  }, [category.name]);

  useEffect(() => {
    function closeMenu(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, [menuOpen]);

  function commitRename() {
    const next = name.trim() || category.name;
    setName(next);
    setEditing(false);
    if (next !== category.name) onRename(category.id, next);
  }

  return (
    <section className={`post-group ${menuOpen ? "menu-open" : ""}`}>
      <div className="group-title">
        <ChevronDown size={14} />
        {editing ? (
          <input
            className="category-name-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitRename();
              if (event.key === "Escape") {
                setName(category.name);
                setEditing(false);
              }
            }}
            autoFocus
          />
        ) : (
          <span className="category-name-text">{category.name}</span>
        )}
        <div className="category-actions" ref={menuRef}>
          <button className="category-menu-button" onClick={() => setMenuOpen((current) => !current)} title={t("settings")}>
            <MoreHorizontal size={15} />
          </button>
          {menuOpen ? (
            <div className="category-menu">
              <button
                onClick={() => {
                  setEditing(true);
                  setMenuOpen(false);
                }}
              >
                {t("rename")}
              </button>
            </div>
          ) : null}
        </div>
        <b>
          {posts.length} {t("postCount")}
        </b>
      </div>
      {posts.map((post) => (
        <button
          key={post.id}
          className={`post-item ${activeId === post.id ? "active" : ""}`}
          onClick={() => onSelect(post.id)}
        >
          <span>{post.title}</span>
          <small>{contactLabel(post.contactStatus, t)}</small>
        </button>
      ))}
    </section>
  );
}

function NewPostPanel({
  draft,
  setDraft,
  imageText,
  setImageText,
  loading,
  notice,
  t,
  onScrape,
  onAdd
}: {
  draft: DraftInput;
  setDraft: React.Dispatch<React.SetStateAction<DraftInput>>;
  imageText: string;
  setImageText: (value: string) => void;
  loading: boolean;
  notice: string;
  t: TFunction;
  onScrape: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="editor-page">
      <div className="page-header">
        <div>
          <h2>{t("addPostTitle")}</h2>
          <p>{t("addPostHint")}</p>
        </div>
      </div>

      <div className="entry-layout">
        <section className="panel">
          <label>{t("facebookUrl")}</label>
          <div className="inline-input">
            <input
              value={draft.sourceUrl}
              onChange={(event) => setDraft((current) => ({ ...current, sourceUrl: event.target.value }))}
              placeholder={t("sourceUrlPlaceholder")}
            />
            <button className="secondary-button" onClick={onScrape} disabled={loading || !draft.sourceUrl}>
              {loading ? <Loader2 className="spin" size={16} /> : <Wand2 size={16} />}
              {t("scrape")}
            </button>
          </div>
          {notice ? <p className="notice">{notice}</p> : null}

          <label>{t("postText")}</label>
          <textarea
            value={draft.originalText}
            onChange={(event) => setDraft((current) => ({ ...current, originalText: event.target.value }))}
            placeholder={t("textPlaceholder")}
          />

          <label>{t("imageLinks")}</label>
          <textarea
            className="small-textarea"
            value={imageText}
            onChange={(event) => setImageText(event.target.value)}
            placeholder={t("imagePlaceholder")}
          />

          <div className="actions">
            <button className="primary-button" onClick={onAdd} disabled={loading || !draft.originalText.trim()}>
              {loading ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
              {t("saveAnalyze")}
            </button>
          </div>
        </section>

        <section className="solution-panel">
          <h3>{t("solutionTitle")}</h3>
          <p>{t("solutionBody")}</p>
          <ul>
            <li>{t("solution1")}</li>
            <li>{t("solution2")}</li>
            <li>{t("solution3")}</li>
            <li>{t("solution4")}</li>
            <li>{t("solution5")}</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function CardOverview({
  posts,
  categories,
  referenceCurrency,
  cityFilter,
  t,
  onSelect
}: {
  posts: RentalPost[];
  categories: Category[];
  referenceCurrency: string;
  cityFilter: string;
  t: TFunction;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [contactStatus, setContactStatus] = useState<ContactStatus | "">("");
  const [rentFilter, setRentFilter] = useState<RentFilter>("all");
  const [sortBy, setSortBy] = useState<CardSort>("updated_desc");
  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);

  const visiblePosts = useMemo(() => {
    const search = query.trim().toLowerCase();
    return posts
      .filter((post) => {
        if (categoryId && post.categoryId !== categoryId) return false;
        if (contactStatus && post.contactStatus !== contactStatus) return false;
        const hasRent = Boolean(post.structured.rent?.amount);
        if (rentFilter === "detected" && !hasRent) return false;
        if (rentFilter === "missing" && hasRent) return false;
        if (!search) return true;
        return [
          post.title,
          post.structured.city,
          post.structured.address,
          post.structured.rooms,
          post.structured.availability,
          post.contactTracking.landlordName,
          post.contactTracking.messengerUrl,
          post.contactTracking.lastMessage,
          post.translatedText,
          post.originalText
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search);
      })
      .sort((a, b) => comparePosts(a, b, sortBy, categoryMap));
  }, [posts, categoryId, contactStatus, rentFilter, query, sortBy, categoryMap]);

  const rentDetectedCount = visiblePosts.filter((post) => post.structured.rent?.amount).length;

  return (
    <div className="overview-page">
      <div className="page-header overview-header">
        <div>
          <h2>{t("cards")}</h2>
          <p>
            {visiblePosts.length} / {posts.length} {t("postCount")}
            {cityFilter ? ` · ${cityFilter === "__unknown__" ? t("unknownCity") : cityFilter}` : ""}
          </p>
        </div>
      </div>

      <section className="overview-toolbar">
        <label className="search-field">
          <Search size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchPosts")} />
        </label>
        <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">{t("allCategories")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select value={contactStatus} onChange={(event) => setContactStatus(event.target.value as ContactStatus | "")}>
          <option value="">{t("allStatuses")}</option>
          <option value="not_contacted">{t("notContacted")}</option>
          <option value="contacted">{t("contacted")}</option>
          <option value="waiting">{t("waiting")}</option>
          <option value="replied">{t("replied")}</option>
          <option value="visited">{t("visited")}</option>
          <option value="rejected">{t("rejected")}</option>
        </select>
        <select value={rentFilter} onChange={(event) => setRentFilter(event.target.value as RentFilter)}>
          <option value="all">{t("allRent")}</option>
          <option value="detected">{t("rentDetected")}</option>
          <option value="missing">{t("rentMissing")}</option>
        </select>
        <select value={sortBy} onChange={(event) => setSortBy(event.target.value as CardSort)}>
          <option value="updated_desc">{t("updatedNewest")}</option>
          <option value="created_desc">{t("createdNewest")}</option>
          <option value="rent_asc">{t("rentLowHigh")}</option>
          <option value="rent_desc">{t("rentHighLow")}</option>
          <option value="title_asc">{t("titleAZ")}</option>
        </select>
      </section>

      <div className="overview-summary">
        <span>{t("rentDetected")}: {rentDetectedCount}</span>
        <span>{t("rentMissing")}: {visiblePosts.length - rentDetectedCount}</span>
      </div>

      {visiblePosts.length ? (
        <div className="post-card-grid">
          {visiblePosts.map((post) => (
            <RentalCard
              key={post.id}
              post={post}
              categoryName={categoryMap.get(post.categoryId) || t("unrecognized")}
              referenceCurrency={referenceCurrency}
              t={t}
              onClick={() => onSelect(post.id)}
            />
          ))}
        </div>
      ) : (
        <section className="empty-state">
          <p>{t("noMatchingPosts")}</p>
        </section>
      )}
    </div>
  );
}

function RentalCard({
  post,
  categoryName,
  referenceCurrency,
  t,
  onClick
}: {
  post: RentalPost;
  categoryName: string;
  referenceCurrency: string;
  t: TFunction;
  onClick: () => void;
}) {
  const image = post.images[0];
  const location = [post.structured.city, post.structured.address].filter(Boolean).join(" · ") || t("unrecognized");
  return (
    <button className="rental-card" onClick={onClick}>
      <div className="card-image">
        {image ? <img src={image} alt="" /> : <Image size={22} />}
      </div>
      <div className="card-body">
        <div className="card-title-row">
          <h3>{post.title}</h3>
          <span>{contactLabel(post.contactStatus, t)}</span>
        </div>
        <div className="card-rent">
          <strong>{moneyMain(post.structured.rent, t)}</strong>
          <small>{moneyReference(post.structured.rent, referenceCurrency)}</small>
        </div>
        <p className="card-location">{location}</p>
        <div className="card-meta">
          <span>{categoryName}</span>
          {post.contactTracking.lastContactedAt ? <span>{t("lastContactedShort")}: {shortDate(post.contactTracking.lastContactedAt)}</span> : null}
          {post.structured.rooms ? <span>{post.structured.rooms}</span> : null}
          {post.images.length ? <span>{post.images.length} {t("images")}</span> : null}
        </div>
      </div>
    </button>
  );
}

function PostDetail({
  post,
  loading,
  referenceCurrency,
  targetAddress,
  targetLocation,
  categories,
  t,
  onUpdate,
  onDelete,
  onReanalyze
}: {
  post: RentalPost;
  loading: boolean;
  referenceCurrency: string;
  targetAddress: string;
  targetLocation: SavedLocation | null;
  categories: Category[];
  t: TFunction;
  onUpdate: (patch: Partial<RentalPost>) => void;
  onDelete: () => void;
  onReanalyze: () => void;
}) {
  const mapQuery = post.structured.mapQuery || `${post.structured.address} ${post.structured.city}`.trim();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(post.title);
  const [textView, setTextView] = useState<"translation" | "original">("translation");
  const skipTitleCommitRef = useRef(false);

  useEffect(() => {
    skipTitleCommitRef.current = false;
    setTitleDraft(post.title);
    setEditingTitle(false);
  }, [post.id, post.title]);

  useEffect(() => {
    setTextView("translation");
  }, [post.id]);

  function commitTitle() {
    if (skipTitleCommitRef.current) {
      skipTitleCommitRef.current = false;
      setTitleDraft(post.title);
      setEditingTitle(false);
      return;
    }
    const nextTitle = titleDraft.trim() || post.title;
    setTitleDraft(nextTitle);
    setEditingTitle(false);
    if (nextTitle !== post.title) onUpdate({ title: nextTitle });
  }

  function cancelTitleEdit() {
    skipTitleCommitRef.current = true;
    setTitleDraft(post.title);
    setEditingTitle(false);
  }

  return (
    <div className="detail-grid">
      <section className="content-pane">
        <div className="page-header">
          <div className="page-title">
            {editingTitle ? (
              <input
                className="title-edit-input"
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={commitTitle}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitTitle();
                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelTitleEdit();
                  }
                }}
                autoFocus
              />
            ) : (
              <button
                className="editable-title-button"
                onClick={() => {
                  skipTitleCommitRef.current = false;
                  setTitleDraft(post.title);
                  setEditingTitle(true);
                }}
              >
                {post.title}
              </button>
            )}
            <p>{new Date(post.updatedAt).toLocaleString()}</p>
          </div>
          <div className="header-actions">
            <a className="icon-link" href={post.sourceUrl} target="_blank" rel="noreferrer" title="打开原帖">
              <ExternalLink size={16} />
            </a>
            <button className="icon-button" onClick={onReanalyze} title="重新分析">
              {loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
            </button>
            <button className="icon-button danger" onClick={onDelete} title="删除">
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="read-section text-switch-section">
          <div className="section-header">
            <h3>{textView === "translation" ? t("translation") : t("original")}</h3>
            <div className="segmented-control" aria-label={t("postText")}>
              <button
                className={textView === "translation" ? "active" : ""}
                onClick={() => setTextView("translation")}
                aria-pressed={textView === "translation"}
              >
                {t("translation")}
              </button>
              <button
                className={textView === "original" ? "active" : ""}
                onClick={() => setTextView("original")}
                aria-pressed={textView === "original"}
              >
                {t("original")}
              </button>
            </div>
          </div>
          <p className="long-text">{textView === "translation" ? post.translatedText || t("unrecognized") : post.originalText}</p>
        </div>

        <div className="media-section">
          <div className="section-title">
            <Image size={16} />
            <h3>{t("images")}</h3>
          </div>
          {post.images.length ? (
            <div className="image-grid">
              {post.images.map((src, index) => (
                <button className="image-thumb" key={src} onClick={() => setLightboxIndex(index)}>
                  <img src={src} alt="Rental post" />
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">{t("noImages")}</p>
          )}
        </div>

        <MapPanel post={post} mapQuery={mapQuery} targetAddress={targetAddress} targetLocation={targetLocation} t={t} />
      </section>

      <aside className="inspector">
        <section className="rent-summary">
          <div>
            <span>{t("rent")}</span>
            <strong>{moneyMain(post.structured.rent, t)}</strong>
            <small>{moneyReference(post.structured.rent, referenceCurrency)}</small>
          </div>
          {post.structured.deposit?.amount ? (
            <p>
              {t("deposit")}: {moneyMain(post.structured.deposit, t)}
            </p>
          ) : null}
        </section>

        <section className="status-panel">
          <div className="status-controls">
            <label>
              <span>{t("category")}</span>
              <select value={post.categoryId} onChange={(event) => onUpdate({ categoryId: event.target.value })}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
              </select>
            </label>
            <label>
              <span>{t("contactProgress")}</span>
              <select
                value={post.contactStatus}
                onChange={(event) => onUpdate({ contactStatus: event.target.value as ContactStatus })}
              >
                <option value="not_contacted">{t("notContacted")}</option>
                <option value="contacted">{t("contacted")}</option>
                <option value="waiting">{t("waiting")}</option>
                <option value="replied">{t("replied")}</option>
                <option value="visited">{t("visited")}</option>
                <option value="rejected">{t("rejected")}</option>
              </select>
            </label>
          </div>
        </section>

        <ContactFollowUpPanel post={post} t={t} onUpdate={onUpdate} />

        <section className="panel">
          <h3>{t("structuredInfo")}</h3>
          {post.structured.fees.length ? (
            <div className="fee-list">
              <label>{t("otherFees")}</label>
              {post.structured.fees.map((fee, index) => (
                <p key={`${fee.label}-${index}`}>{moneyText(fee, referenceCurrency, t)}</p>
              ))}
            </div>
          ) : null}
          <InfoRow label={t("city")} value={post.structured.city || t("unrecognized")} />
          <InfoRow label={t("address")} value={post.structured.address || t("unrecognized")} />
          <InfoRow label={t("rooms")} value={post.structured.rooms || t("unrecognized")} />
          <InfoRow label={t("availability")} value={post.structured.availability || t("unrecognized")} />
          <InfoRow icon={<MessageCircle size={15} />} label={t("contact")} value={post.structured.contact.join("\n") || t("unrecognized")} />
          {post.structured.important.length ? (
            <div className="important-list">
              <label>{t("importantInfo")}</label>
              {post.structured.important.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          ) : null}
        </section>

        <section className="panel">
          <h3>{t("notes")}</h3>
          <textarea
            className="notes"
            value={post.notes}
            onChange={(event) => onUpdate({ notes: event.target.value })}
            placeholder={t("notesPlaceholder")}
          />
        </section>
      </aside>
      {lightboxIndex !== null ? (
        <ImageLightbox
          images={post.images}
          index={lightboxIndex}
          onChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </div>
  );
}

function ContactFollowUpPanel({
  post,
  t,
  onUpdate
}: {
  post: RentalPost;
  t: TFunction;
  onUpdate: (patch: Partial<RentalPost>) => void;
}) {
  const tracking = post.contactTracking;
  const messages = useMemo(() => buildContactMessages(post), [post]);
  const [messageMode, setMessageMode] = useState<ContactMessageMode>("detailed");
  const [messageDraft, setMessageDraft] = useState(messages.detailed);
  const [landlordName, setLandlordName] = useState(tracking.landlordName);
  const [messengerUrl, setMessengerUrl] = useState(tracking.messengerUrl);
  const [noteDraft, setNoteDraft] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setMessageMode("detailed");
    setMessageDraft(messages.detailed);
    setLandlordName(tracking.landlordName);
    setMessengerUrl(tracking.messengerUrl);
    setNoteDraft("");
    setNotice("");
  }, [post.id, messages.detailed, tracking.landlordName, tracking.messengerUrl]);

  function switchMessageMode(mode: ContactMessageMode) {
    setMessageMode(mode);
    setMessageDraft(messages[mode]);
  }

  function saveTracking(patch: Partial<ContactTracking>) {
    onUpdate({
      contactTracking: {
        ...tracking,
        ...patch
      }
    });
  }

  async function copyMessage(markContacted = false) {
    const copied = await writeClipboard(messageDraft);
    setNotice(copied ? t("copied") : t("copyFailed"));
    if (markContacted) {
      addEvent("contacted", messageDraft, "contacted", copied ? t("contactRecorded") : t("contactRecordedCopyFailed"));
    }
  }

  function addEvent(type: ContactEventType, text: string, status?: ContactStatus, noticeText?: string) {
    const value = text.trim();
    if (!value) return;
    const now = new Date().toISOString();
    const event = {
      id: crypto.randomUUID(),
      type,
      at: now,
      text: value
    };
    onUpdate({
      contactStatus: status ?? post.contactStatus,
      contactTracking: {
        ...tracking,
        landlordName,
        messengerUrl,
        lastContactedAt: type === "contacted" ? now : tracking.lastContactedAt,
        lastReplyAt: type === "replied" ? now : tracking.lastReplyAt,
        lastMessage: type === "contacted" ? value : tracking.lastMessage,
        events: [event, ...tracking.events].slice(0, 60)
      }
    });
    if (type === "note") setNoteDraft("");
    setNotice(noticeText || (type === "replied" ? t("replyRecorded") : type === "contacted" ? t("contactRecorded") : t("noteRecorded")));
  }

  return (
    <section className="panel contact-panel">
      <div className="contact-panel-head">
        <div>
          <h3>{t("followUp")}</h3>
          <p>{t("followUpHint")}</p>
        </div>
        <span>{tracking.ref}</span>
      </div>

      <div className="contact-fields">
        <label>
          <span>{t("landlordName")}</span>
          <input
            value={landlordName}
            onChange={(event) => setLandlordName(event.target.value)}
            onBlur={() => saveTracking({ landlordName })}
            placeholder={t("landlordNamePlaceholder")}
          />
        </label>
        <label>
          <span>{t("messengerUrl")}</span>
          <div className="messenger-field">
            <input
              value={messengerUrl}
              onChange={(event) => setMessengerUrl(event.target.value)}
              onBlur={() => saveTracking({ messengerUrl })}
              placeholder={t("messengerUrlPlaceholder")}
            />
            {messengerUrl ? (
              <a className="icon-link" href={messengerUrl} target="_blank" rel="noreferrer" title={t("openChat")}>
                <ExternalLink size={15} />
              </a>
            ) : null}
          </div>
        </label>
      </div>

      <div className="contact-anchors">
        <label>{t("searchAnchors")}</label>
        <div>
          {messages.anchors.length ? messages.anchors.map((anchor) => <span key={anchor}>{anchor}</span>) : <span>{t("unrecognized")}</span>}
        </div>
      </div>

      <div className="message-builder">
        <div className="contact-message-switch" aria-label={t("suggestedMessage")}>
          <button className={messageMode === "short" ? "active" : ""} onClick={() => switchMessageMode("short")}>
            {t("shortMessage")}
          </button>
          <button className={messageMode === "detailed" ? "active" : ""} onClick={() => switchMessageMode("detailed")}>
            {t("detailedMessage")}
          </button>
          <button className={messageMode === "ref" ? "active" : ""} onClick={() => switchMessageMode("ref")}>
            {t("withPrivateRef")}
          </button>
        </div>
        <textarea
          className="contact-message-textarea"
          value={messageDraft}
          onChange={(event) => setMessageDraft(event.target.value)}
          aria-label={t("suggestedMessage")}
        />
        <p className="contact-ref-hint">{t("privateRefHint")}</p>
        <div className="contact-actions">
          <button className="secondary-button" onClick={() => void copyMessage(false)}>
            <Copy size={15} />
            {t("copyMessage")}
          </button>
          <button className="primary-button" onClick={() => void copyMessage(true)}>
            <Send size={15} />
            {t("copyMarkContacted")}
          </button>
        </div>
        {notice ? <p className="notice">{notice}</p> : null}
      </div>

      <div className="contact-quick-actions">
        <button className="secondary-button" onClick={() => addEvent("contacted", messageDraft, "contacted")}>
          <Send size={15} />
          {t("markContacted")}
        </button>
        <button className="secondary-button" onClick={() => addEvent("replied", t("landlordReplied"), "replied")}>
          <Reply size={15} />
          {t("markReplied")}
        </button>
      </div>

      <div className="contact-dates">
        <InfoRow label={t("lastContacted")} value={tracking.lastContactedAt ? new Date(tracking.lastContactedAt).toLocaleString() : t("unrecognized")} />
        <InfoRow label={t("lastReply")} value={tracking.lastReplyAt ? new Date(tracking.lastReplyAt).toLocaleString() : t("unrecognized")} />
      </div>

      <div className="followup-note">
        <label>{t("addFollowUpNote")}</label>
        <textarea
          value={noteDraft}
          onChange={(event) => setNoteDraft(event.target.value)}
          placeholder={t("followUpNotePlaceholder")}
        />
        <button className="secondary-button" onClick={() => addEvent("note", noteDraft)}>
          <Plus size={15} />
          {t("addNote")}
        </button>
      </div>

      <div className="contact-timeline">
        <label>{t("contactTimeline")}</label>
        {tracking.events.length ? (
          tracking.events.map((event) => (
            <div className="timeline-item" key={event.id}>
              <span>{contactEventLabel(event.type, t)}</span>
              <time>{new Date(event.at).toLocaleString()}</time>
              <p>{event.text}</p>
            </div>
          ))
        ) : (
          <p className="muted">{t("noContactEvents")}</p>
        )}
      </div>
    </section>
  );
}

function SettingsModal({
  settings,
  t,
  onClose,
  onSave,
  onDedupe
}: {
  settings: AppSettings;
  t: TFunction;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
  onDedupe: () => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [vendorToAdd, setVendorToAdd] = useState<AiProviderVendor>("openai");
  const [refreshingProviderId, setRefreshingProviderId] = useState("");
  const [modelNotice, setModelNotice] = useState("");
  const [activeTab, setActiveTab] = useState<"general" | "location" | "ai" | "maintenance">("general");

  function updateProvider(id: string, patch: Partial<AiProviderConfig>) {
    setDraft((current) => ({
      ...current,
      providers: current.providers.map((provider) => (provider.id === id ? { ...provider, ...patch } : provider))
    }));
  }

  function addProvider() {
    const preset = getProviderPreset(vendorToAdd);
    setDraft((current) => ({
      ...current,
      providers: [
        ...current.providers,
        {
          id: crypto.randomUUID(),
          vendor: preset.vendor,
          name: preset.name,
          type: preset.type,
          enabled: true,
          apiKey: "",
          baseUrl: "",
          model: "",
          availableModels: preset.model ? [preset.model] : []
        }
      ]
    }));
  }

  function removeProvider(id: string) {
    setDraft((current) => ({
      ...current,
      providers: current.providers.filter((provider) => provider.id !== id)
    }));
  }

  async function refreshProviderModels(provider: AiProviderConfig) {
    setRefreshingProviderId(provider.id);
    setModelNotice("");
    const response = await fetch("/api/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(provider)
    });
    const data = await response.json();
    updateProvider(provider.id, {
      availableModels: data.models ?? [],
      modelsRefreshedAt: data.refreshedAt,
      model: provider.model || ""
    });
    if (data.warning) setModelNotice(data.warning);
    setRefreshingProviderId("");
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="page-header">
          <div>
            <h2>{t("settings")}</h2>
            <p>{t("settingsHint")}</p>
          </div>
          <button className="ghost-button" onClick={onClose}>
            {t("close")}
          </button>
        </div>

        <div className="settings-tabs">
          <button className={activeTab === "general" ? "active" : ""} onClick={() => setActiveTab("general")}>
            {t("settingsGeneral")}
          </button>
          <button className={activeTab === "location" ? "active" : ""} onClick={() => setActiveTab("location")}>
            {t("settingsLocation")}
          </button>
          <button className={activeTab === "ai" ? "active" : ""} onClick={() => setActiveTab("ai")}>
            {t("settingsAi")}
          </button>
          <button className={activeTab === "maintenance" ? "active" : ""} onClick={() => setActiveTab("maintenance")}>
            {t("maintenance")}
          </button>
        </div>

        {activeTab === "general" ? (
        <div className="settings-grid">
          <label>{t("uiLanguage")}</label>
          <select
            value={draft.uiLocale}
            onChange={(event) => setDraft((current) => ({ ...current, uiLocale: event.target.value as "zh" | "en" }))}
          >
            <option value="zh">{t("chinese")}</option>
            <option value="en">{t("english")}</option>
          </select>

          <label>{t("targetLanguage")}</label>
          <select
            value={draft.targetLanguage}
            onChange={(event) => setDraft((current) => ({ ...current, targetLanguage: event.target.value as "zh" | "en" }))}
          >
            <option value="zh">{t("chinese")}</option>
            <option value="en">{t("english")}</option>
          </select>

          <label>{t("referenceCurrency")}</label>
          <select
            value={draft.referenceCurrency}
            onChange={(event) =>
              setDraft((current) => ({ ...current, referenceCurrency: event.target.value as AppSettings["referenceCurrency"] }))
            }
          >
            {currencyOptions(draft.uiLocale).map((currency) => (
              <option key={currency.value} value={currency.value}>
                {currency.label}
              </option>
            ))}
          </select>
        </div>
        ) : null}

        {activeTab === "location" ? (
          <TargetLocationPicker
            value={draft.targetLocation}
            query={draft.targetAddress}
            t={t}
            onChange={(location, query) =>
              setDraft((current) => ({
                ...current,
                targetAddress: query,
                targetLocation: location
              }))
            }
          />
        ) : null}

        {activeTab === "ai" ? (
        <>
        <div className="provider-toolbar">
          <div>
            <h3>{t("aiProviders")}</h3>
            <p>{t("aiProvidersHint")}</p>
          </div>
          <div className="provider-add">
            <select value={vendorToAdd} onChange={(event) => setVendorToAdd(event.target.value as AiProviderVendor)}>
              {aiProviderPresets.map((preset) => (
                <option key={preset.vendor} value={preset.vendor}>
                  {providerDisplayName(preset.vendor, draft.uiLocale)}
                </option>
              ))}
            </select>
            <button className="secondary-button" onClick={addProvider}>
              <Plus size={16} />
              {t("add")}
            </button>
          </div>
        </div>

        <div className="provider-list">
          {draft.providers.length === 0 ? (
            <section className="empty-provider">
              <p>{t("noProviders")}</p>
            </section>
          ) : null}

          {draft.providers.map((provider, index) => {
            const preset = getProviderPreset(provider.vendor);
            return (
              <section className="provider-row" key={provider.id}>
                <div className="provider-head">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={provider.enabled}
                      onChange={(event) => updateProvider(provider.id, { enabled: event.target.checked })}
                    />
                  <span>{providerLabel(provider, preset, draft.uiLocale)}</span>
                </label>
                <div className="provider-meta">
                  <small>
                    {t("priority")} {index + 1}
                  </small>
                    <button className="icon-button compact danger" onClick={() => removeProvider(provider.id)} title="移除">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <input
                  value={provider.apiKey}
                  onChange={(event) => updateProvider(provider.id, { apiKey: event.target.value })}
                  placeholder={preset.apiKeyLabel}
                  type="password"
                />
                <div className="provider-config-grid">
                  <input
                    value={provider.baseUrl}
                    onChange={(event) => updateProvider(provider.id, { baseUrl: event.target.value })}
                    placeholder={preset.baseUrl ? `Base URL 默认：${preset.baseUrl}` : "Base URL"}
                  />
                  <div className="model-picker">
                    <select value={provider.model} onChange={(event) => updateProvider(provider.id, { model: event.target.value })}>
                      {preset.model ? (
                        <option value="">
                          {t("defaultModel")}: {preset.model}
                        </option>
                      ) : null}
                      {modelOptions(provider, preset.model).map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                    <button
                      className="icon-button"
                      onClick={() => refreshProviderModels(provider)}
                      disabled={refreshingProviderId === provider.id || !provider.apiKey}
                      title={t("refreshModels")}
                    >
                      {refreshingProviderId === provider.id ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}
                    </button>
                  </div>
                </div>
              <p className="provider-hint">
                {preset.baseUrl || preset.model ? t("baseModelDefault") : t("customRequired")} {t("modelListHint")}
              </p>
              {modelNotice ? <p className="provider-warning">{modelNotice}</p> : null}
              <div className="provider-guide">
                <label>{t("setupSteps")}</label>
                <ol>
                  {preset.guide[draft.uiLocale].map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                {preset.docsUrl ? (
                  <a href={preset.docsUrl} target="_blank" rel="noreferrer">
                    {t("officialDocs")}
                  </a>
                ) : null}
              </div>
            </section>
            );
          })}
        </div>
        </>
        ) : null}

        {activeTab === "maintenance" ? (
          <section className="maintenance-panel">
            <div>
              <h3>{t("dedupePosts")}</h3>
              <p>{t("dedupeHint")}</p>
            </div>
            <button className="secondary-button" onClick={onDedupe}>
              <RefreshCw size={16} />
              {t("dedupePosts")}
            </button>
          </section>
        ) : null}

        <div className="actions right">
          <button
            className="primary-button"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            <CheckCircle2 size={16} />
            {t("saveSettings")}
          </button>
        </div>
      </div>
    </div>
  );
}

function TargetLocationPicker({
  value,
  query,
  t,
  onChange
}: {
  value: SavedLocation | null;
  query: string;
  t: TFunction;
  onChange: (location: SavedLocation | null, query: string) => void;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [searchText, setSearchText] = useState(query);
  const [results, setResults] = useState<GeoPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setSearchText(query);
  }, [query]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!leafletRef.current) {
      leafletRef.current = L.map(mapRef.current, {
        scrollWheelZoom: true,
        zoomControl: true
      }).setView(value ? [value.lat, value.lon] : [47.1625, 19.5033], value ? 15 : 7);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap"
      }).addTo(leafletRef.current);
    }
    setTimeout(() => leafletRef.current?.invalidateSize(), 80);
  }, []);

  useEffect(() => {
    const map = leafletRef.current;
    if (!map || !value) return;
    if (!markerRef.current) {
      markerRef.current = L.marker([value.lat, value.lon], {
        icon: mapIcon("#7a5a2f"),
        draggable: true
      }).addTo(map);
    } else {
      markerRef.current.setLatLng([value.lat, value.lon]);
    }
    markerRef.current.off("dragend");
    markerRef.current.on("dragend", () => {
      const latLng = markerRef.current?.getLatLng();
      if (!latLng) return;
      onChange(
        {
          lat: latLng.lat,
          lon: latLng.lng,
          label: value.label
        },
        searchText
      );
    });
    markerRef.current.bindPopup(value.label);
    map.setView([value.lat, value.lon], Math.max(map.getZoom(), 15));
    setTimeout(() => map.invalidateSize(), 80);
  }, [value, onChange, searchText]);

  async function searchLocation() {
    if (!searchText.trim()) return;
    setLoading(true);
    setNotice("");
    const response = await fetch("/api/geocode-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: searchText })
    });
    const data = (await response.json()) as { points: GeoPoint[]; warning?: string };
    setResults(data.points ?? []);
    setNotice(data.warning || (data.points?.length ? "" : t("noAddressResults")));
    if (data.points?.[0]) chooseLocation(data.points[0]);
    setLoading(false);
  }

  function chooseLocation(point: GeoPoint) {
    onChange({ lat: point.lat, lon: point.lon, label: point.label }, point.label);
    setSearchText(point.label);
  }

  return (
    <section className="location-settings">
      <div className="location-search">
        <label>{t("searchAddress")}</label>
        <div className="inline-input">
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void searchLocation();
            }}
            placeholder={t("targetAddressPlaceholder")}
          />
          <button className="secondary-button" onClick={searchLocation} disabled={loading || !searchText.trim()}>
            {loading ? <Loader2 className="spin" size={16} /> : <MapPinned size={16} />}
            {t("search")}
          </button>
        </div>
        {notice ? <p className="notice">{notice}</p> : null}
      </div>

      {results.length ? (
        <div className="address-results">
          {results.map((result) => (
            <button key={`${result.lat}-${result.lon}-${result.label}`} onClick={() => chooseLocation(result)}>
              {result.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="target-map-layout">
        <div className="target-map" ref={mapRef} />
        <div className="target-confirm">
          <label>{t("selectedLocation")}</label>
          <p>{value?.label || t("targetNotSet")}</p>
          {value ? (
            <small>
              {value.lat.toFixed(6)}, {value.lon.toFixed(6)}
            </small>
          ) : null}
          <span>{t("dragPinHint")}</span>
        </div>
      </div>
    </section>
  );
}

interface GeoPoint {
  lat: number;
  lon: number;
  label: string;
}

interface CommuteData {
  from: GeoPoint | null;
  to: GeoPoint | null;
  straightLineMeters: number | null;
  walking: { distanceMeters: number; durationSeconds: number } | null;
  cycling: { distanceMeters: number; durationSeconds: number } | null;
  warning?: string;
}

function MapPanel({
  post,
  mapQuery,
  targetAddress,
  targetLocation,
  t
}: {
  post: RentalPost;
  mapQuery: string;
  targetAddress: string;
  targetLocation: SavedLocation | null;
  t: TFunction;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const [commute, setCommute] = useState<CommuteData | null>(null);
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [loading, setLoading] = useState(false);
  const target = targetAddress.trim() || targetLocation?.label || "";

  useEffect(() => {
    let alive = true;
    async function loadLocation() {
      setLoading(Boolean(mapQuery));
      setCommute(null);
      setPoint(null);
      if (!mapQuery) {
        setLoading(false);
        return;
      }
      if (target) {
        const response = await fetch("/api/commute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from: mapQuery, to: target, toPoint: targetLocation })
        });
        const data = (await response.json()) as CommuteData;
        if (!alive) return;
        setCommute(data);
        setPoint(data.from);
      } else {
        const response = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: mapQuery })
        });
        const data = (await response.json()) as { point: GeoPoint | null };
        if (!alive) return;
        setPoint(data.point);
      }
      if (alive) setLoading(false);
    }
    void loadLocation();
    return () => {
      alive = false;
    };
  }, [mapQuery, target]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!leafletRef.current) {
      leafletRef.current = L.map(mapRef.current, {
        scrollWheelZoom: true,
        zoomControl: true,
        attributionControl: true
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap"
      }).addTo(leafletRef.current);
    }

    const map = leafletRef.current;
    map.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) map.removeLayer(layer);
    });

    if (!point) {
      map.setView([47.1625, 19.5033], 7);
      return;
    }

    const propertyMarker = L.marker([point.lat, point.lon], { icon: mapIcon("#2f3430") }).addTo(map);
    propertyMarker.bindPopup(post.title);

    if (commute?.to) {
      const targetMarker = L.marker([commute.to.lat, commute.to.lon], { icon: mapIcon("#7a5a2f") }).addTo(map);
      targetMarker.bindPopup(target);
      const line = L.polyline(
        [
          [point.lat, point.lon],
          [commute.to.lat, commute.to.lon]
        ],
        { color: "#3d5a48", weight: 3, opacity: 0.7, dashArray: "6 7" }
      ).addTo(map);
      map.fitBounds(line.getBounds(), { padding: [36, 36], maxZoom: 16 });
    } else {
      map.setView([point.lat, point.lon], mapZoom(post));
    }
  }, [point, commute, post, target]);

  useEffect(() => {
    setTimeout(() => leafletRef.current?.invalidateSize(), 80);
  }, [point, commute]);

  return (
    <div className="map-panel">
      <div className="map-strip">
        <MapPinned size={18} />
        <div>
          <strong>{t("mapTitle")}</strong>
          <span>{mapQuery || t("noMap")}</span>
        </div>
        {mapQuery ? (
          <a href={`https://www.google.com/maps/search/${encodeURIComponent(mapQuery)}`} target="_blank" rel="noreferrer">
            Google Maps
          </a>
        ) : null}
      </div>
      <div className="leaflet-map" ref={mapRef} />
      <div className="commute-panel">
        <div className="commute-title">
          <strong>{t("commute")}</strong>
          {loading ? <Loader2 className="spin" size={15} /> : null}
        </div>
        {target ? (
          <div className="commute-grid">
            <MetricCard icon={<MapPinned size={16} />} label={t("straightLine")} value={formatDistance(commute?.straightLineMeters)} />
            <MetricCard icon={<Footprints size={16} />} label={t("walking")} value={formatRoute(commute?.walking)} />
            <MetricCard icon={<Bike size={16} />} label={t("cycling")} value={formatRoute(commute?.cycling)} />
          </div>
        ) : (
          <p className="muted">{t("targetNotSet")}</p>
        )}
        {target && commute?.from && commute?.to ? (
          <a
            className="route-link"
            href={`https://www.google.com/maps/dir/${encodeURIComponent(mapQuery)}/${encodeURIComponent(
              targetLocation ? `${targetLocation.lat},${targetLocation.lon}` : target
            )}`}
            target="_blank"
            rel="noreferrer"
          >
            {t("openRoute")}
          </a>
        ) : null}
        {target && !loading && !commute?.from ? <p className="muted">{t("routeUnavailable")}</p> : null}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric-card">
      <div>
        {icon}
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function mapIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<span class="map-pin" style="background:${color}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
}

function ImageLightbox({
  images,
  index,
  onChange,
  onClose
}: {
  images: string[];
  index: number;
  onChange: (index: number) => void;
  onClose: () => void;
}) {
  const current = images[index];
  const hasPrevious = index > 0;
  const hasNext = index < images.length - 1;

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && hasPrevious) onChange(index - 1);
      if (event.key === "ArrowRight" && hasNext) onChange(index + 1);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [hasNext, hasPrevious, index, onChange, onClose]);

  return (
    <div className="lightbox" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}>
        <X size={20} />
      </button>
      <button
        className="lightbox-nav previous"
        onClick={(event) => {
          event.stopPropagation();
          if (hasPrevious) onChange(index - 1);
        }}
        disabled={!hasPrevious}
      >
        <ChevronLeft size={28} />
      </button>
      <img src={current} alt="Rental post preview" onClick={(event) => event.stopPropagation()} />
      <button
        className="lightbox-nav next"
        onClick={(event) => {
          event.stopPropagation();
          if (hasNext) onChange(index + 1);
        }}
        disabled={!hasNext}
      >
        <ChevronRight size={28} />
      </button>
      <div className="lightbox-count">
        {index + 1} / {images.length}
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="info-row">
      <div className="info-label">
        {icon}
        <span>{label}</span>
      </div>
      <p>{value}</p>
    </div>
  );
}

function buildContactMessages(post: RentalPost) {
  const location = contactLocation(post);
  const subject = contactSubject(post);
  const rent = contactMoney(post.structured.rent);
  const availability = safeContactAnchor(post.structured.availability);
  const rooms = safeContactAnchor(post.structured.rooms);
  const anchors = [location, rent, availability, rooms].filter(Boolean).slice(0, 5);
  const baseQuestion = location
    ? `hi, is the ${subject} in ${location} still available?`
    : `hi, is this ${subject} still available?`;
  const details = [rent ? `${rent} rent` : "", availability ? `${availability} availability` : "", rooms].filter(Boolean);
  const detailed = details.length
    ? `${baseQuestion}\ni saw the post mentioning ${joinNatural(details)}.`
    : `${baseQuestion}\ni saw your facebook rental post and wanted to ask about availability.`;
  return {
    short: baseQuestion,
    detailed,
    ref: `${detailed}\n\nfor my notes: ${post.contactTracking.ref}`,
    anchors
  };
}

function contactLocation(post: RentalPost) {
  const address = safeContactAnchor(post.structured.address);
  const city = safeContactAnchor(post.structured.city);
  if (address && city) return `${city}, ${address}`;
  return address || city;
}

function contactSubject(post: RentalPost) {
  const text = `${post.title} ${post.structured.rooms}`.toLowerCase();
  if (text.includes("room") || text.includes("szoba")) return "room";
  if (text.includes("apartment") || text.includes("flat") || text.includes("lakás")) return "apartment";
  return "place";
}

function contactMoney(value: MoneyValue | null) {
  if (!value?.amount) return "";
  return `${value.amount.toLocaleString()} ${value.currency}`;
}

function safeContactAnchor(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /[\u4e00-\u9fff]/.test(trimmed)) return "";
  return trimmed;
}

function joinNatural(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function contactEventLabel(type: ContactEventType, t: TFunction) {
  return {
    contacted: t("contactedEvent"),
    replied: t("replyEvent"),
    note: t("noteEvent")
  }[type];
}

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function moneyText(value: MoneyValue | null, referenceCurrency: string, t: TFunction) {
  if (!value?.amount) return t("unrecognized");
  const reference = value.referenceAmount ? ` ≈ ${value.referenceAmount.toLocaleString()} ${referenceCurrency}` : "";
  const cadence = value.cadence ? ` / ${value.cadence}` : "";
  return `${value.label}: ${value.amount.toLocaleString()} ${value.currency}${cadence}${reference}`;
}

function moneyMain(value: MoneyValue | null, t: TFunction) {
  if (!value?.amount) return t("unrecognized");
  const cadence = value.cadence ? ` / ${value.cadence}` : "";
  return `${value.amount.toLocaleString()} ${value.currency}${cadence}`;
}

function moneyReference(value: MoneyValue | null, referenceCurrency: string) {
  if (!value?.referenceAmount) return "";
  return `≈ ${value.referenceAmount.toLocaleString()} ${referenceCurrency}`;
}

function providerLabel(provider: AiProviderConfig, preset: ReturnType<typeof getProviderPreset>, locale: AppSettings["uiLocale"]) {
  const localized = providerDisplayName(provider.vendor, locale);
  const defaultNames = [preset.name, providerDisplayName(provider.vendor, "zh"), providerDisplayName(provider.vendor, "en")];
  return !provider.name || defaultNames.includes(provider.name) ? localized : provider.name;
}

function currencyOptions(locale: AppSettings["uiLocale"]): Array<{ value: AppSettings["referenceCurrency"]; label: string }> {
  if (locale === "zh") {
    return [
      { value: "USD", label: "USD 美元" },
      { value: "EUR", label: "EUR 欧元" },
      { value: "HUF", label: "HUF 福林" },
      { value: "CNY", label: "CNY 人民币" },
      { value: "GBP", label: "GBP 英镑" }
    ];
  }
  return [
    { value: "USD", label: "USD US dollar" },
    { value: "EUR", label: "EUR euro" },
    { value: "HUF", label: "HUF Hungarian forint" },
    { value: "CNY", label: "CNY Chinese yuan" },
    { value: "GBP", label: "GBP British pound" }
  ];
}

function comparePosts(a: RentalPost, b: RentalPost, sortBy: CardSort, categoryMap: Map<string, string>) {
  if (sortBy === "rent_asc") return compareRent(a, b, "asc");
  if (sortBy === "rent_desc") return compareRent(a, b, "desc");
  if (sortBy === "created_desc") return postTime(b.createdAt) - postTime(a.createdAt);
  if (sortBy === "title_asc") return a.title.localeCompare(b.title);
  const categoryA = categoryMap.get(a.categoryId) || "";
  const categoryB = categoryMap.get(b.categoryId) || "";
  if (sortBy === "updated_desc") return postTime(b.updatedAt) - postTime(a.updatedAt);
  return categoryA.localeCompare(categoryB) || postTime(b.updatedAt) - postTime(a.updatedAt);
}

function compareRent(a: RentalPost, b: RentalPost, direction: "asc" | "desc") {
  const rentA = a.structured.rent?.amount ?? null;
  const rentB = b.structured.rent?.amount ?? null;
  if (rentA === null && rentB === null) return postTime(b.updatedAt) - postTime(a.updatedAt);
  if (rentA === null) return 1;
  if (rentB === null) return -1;
  return direction === "asc" ? rentA - rentB : rentB - rentA;
}

function postTime(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function shortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

function modelOptions(provider: AiProviderConfig, defaultModel: string) {
  return [...new Set([provider.model, defaultModel, ...(provider.availableModels ?? [])].filter(Boolean))].filter(
    (model) => model !== defaultModel || provider.model === defaultModel
  );
}

function cityKey(post: RentalPost) {
  return post.structured.city?.trim() || "__unknown__";
}

function mapZoom(post: RentalPost) {
  if (post.structured.address && post.structured.city) return 16;
  if (post.structured.address) return 15;
  if (post.structured.city) return 12;
  return 10;
}

function formatDistance(meters?: number | null) {
  if (!meters) return "-";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}

function formatRoute(route?: { distanceMeters: number; durationSeconds: number } | null) {
  if (!route) return "-";
  const minutes = Math.max(1, Math.round(route.durationSeconds / 60));
  return `${minutes} min · ${formatDistance(route.distanceMeters)}`;
}

function parseImages(text: string) {
  return text
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter((item) => /^https?:\/\//.test(item));
}

function contactLabel(status: ContactStatus, t: TFunction) {
  return {
    not_contacted: t("notContacted"),
    contacted: t("contacted"),
    waiting: t("waiting"),
    replied: t("replied"),
    visited: t("visited"),
    rejected: t("rejected")
  }[status];
}

createRoot(document.getElementById("root")!).render(<App />);
