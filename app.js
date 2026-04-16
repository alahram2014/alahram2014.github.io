// ==============================
// Alahram System - Full Professional Build
// ==============================

const CONFIG = {
  apiUrl: "https://script.google.com/macros/s/AKfycbxMS8WGi17SEIM72ymez1GUD9X8OLehJVXtKlwwTWtGIhKnTQnr_d-FnK5vdrAShGcf4Q/exec",
  csv: {
    products: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSkbig8ZQ9b3a4nPO9gZqVdWLPSUS_YDtfO7Jn74Td7EgGH1PIB02R4hH7fqq787kuz5GDD8ZqK91Yu/pub?gid=876724211&single=true&output=csv",
    categories: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSkbig8ZQ9b3a4nPO9gZqVdWLPSUS_YDtfO7Jn74Td7EgGH1PIB02R4hH7fqq787kuz5GDD8ZqK91Yu/pub?gid=88030026&single=true&output=csv",
    customers: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSkbig8ZQ9b3a4nPO9gZqVdWLPSUS_YDtfO7Jn74Td7EgGH1PIB02R4hH7fqq787kuz5GDD8ZqK91Yu/pub?gid=1309694873&single=true&output=csv",
    reps: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSkbig8ZQ9b3a4nPO9gZqVdWLPSUS_YDtfO7Jn74Td7EgGH1PIB02R4hH7fqq787kuz5GDD8ZqK91Yu/pub?gid=358488055&single=true&output=csv",
    orders: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSkbig8ZQ9b3a4nPO9gZqVdWLPSUS_YDtfO7Jn74Td7EgGH1PIB02R4hH7fqq787kuz5GDD8ZqK91Yu/pub?gid=41007407&single=true&output=csv",
    order_items: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSkbig8ZQ9b3a4nPO9gZqVdWLPSUS_YDtfO7Jn74Td7EgGH1PIB02R4hH7fqq787kuz5GDD8ZqK91Yu/pub?gid=897522352&single=true&output=csv",
    offers: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSkbig8ZQ9b3a4nPO9gZqVdWLPSUS_YDtfO7Jn74Td7EgGH1PIB02R4hH7fqq787kuz5GDD8ZqK91Yu/pub?gid=863899727&single=true&output=csv",
    flash_offers: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSkbig8ZQ9b3a4nPO9gZqVdWLPSUS_YDtfO7Jn74Td7EgGH1PIB02R4hH7fqq787kuz5GDD8ZqK91Yu/pub?gid=1448598336&single=true&output=csv",
    tiers: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSkbig8ZQ9b3a4nPO9gZqVdWLPSUS_YDtfO7Jn74Td7EgGH1PIB02R4hH7fqq787kuz5GDD8ZqK91Yu/pub?gid=801156952&single=true&output=csv"
  }
};

const STORAGE = {
  session: "alahram_session",
  cart: "alahram_cart",
  tier: "alahram_selected_tier",
  pendingOrders: "alahram_pending_orders"
};

const state = {
  view: "login",
  loginMode: "customer",
  search: "",
  selectedCompany: "",
  selectedCategory: "all",
  selectedTierId: "",
  user: null,
  rep: null
};

const DATA = {
  products: [],
  categories: [],
  customers: [],
  reps: [],
  orders: [],
  orderItems: [],
  offers: [],
  flashOffers: [],
  tiers: [],
  tierPrices: []
};

let cart = loadJSON(STORAGE.cart, []);
let pendingOrders = loadJSON(STORAGE.pendingOrders, []);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function cleanText(value) {
  return String(value ?? "").replace(/\u200f|\u200e/g, "").trim();
}

function digitsToLatin(str) {
  const map = { "٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9" };
  return String(str || "").replace(/[٠-٩]/g, m => map[m] ?? m);
}

function cleanNumber(value) {
  const s = digitsToLatin(String(value ?? ""));
  const n = Number(s.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return [];
    try {
      const parsed = JSON.parse(t);
      return Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
    } catch {
      if (t.includes(",") && t.includes("\n")) return parseCSV(t);
      return [];
    }
  }
  if (typeof v === "object") return [v];
  return [];
}

function normalizeRowKeys(row) {
  const out = {};
  for (const [k, val] of Object.entries(row || {})) {
    out[cleanText(k).toLowerCase()] = val;
  }
  return out;
}

function pick(row, keys) {
  const src = normalizeRowKeys(row);
  for (const key of keys) {
    const v = src[key.toLowerCase()];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some(v => String(v).trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    cell += ch;
  }

  row.push(cell);
  if (row.some(v => String(v).trim() !== "")) rows.push(row);

  if (!rows.length) return [];

  const headers = rows[0].map(h => cleanText(h));
  return rows.slice(1).filter(r => r.some(v => String(v).trim() !== "")).map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = r[i] ?? "");
    return obj;
  });
}

function driveToDirect(url) {
  const raw = cleanText(url);
  if (!raw) return "";
  if (raw.startsWith("data:") || raw.startsWith("http")) {
    if (raw.includes("drive.google.com")) {
      const match = raw.match(/[-\w]{25,}/);
      if (match) return `https://drive.google.com/uc?export=view&id=${match[0]}`;
    }
    return raw;
  }
  return raw;
}

function placeholderImage(text, bg = "#1e3a8a", fg = "#ffffff") {
  const safe = cleanText(text || "?").slice(0, 12);
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
    <defs>
      <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="${bg}"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>
    </defs>
    <rect width="800" height="800" rx="110" fill="url(#g)"/>
    <circle cx="400" cy="310" r="130" fill="rgba(255,255,255,.12)"/>
    <text x="400" y="450" text-anchor="middle" fill="${fg}" font-family="Tahoma, Arial, sans-serif" font-size="72" font-weight="800">${safe}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function safeImage(url, fallbackLabel = "") {
  const cleaned = cleanText(url);
  if (!cleaned) return placeholderImage(fallbackLabel || "A");
  return driveToDirect(cleaned);
}

async function fetchText(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

async function fetchJsonMaybe(url) {
  try {
    const txt = await fetchText(url);
    const trimmed = txt.trim();
    if (!trimmed) return null;
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function normalizeTableFromPossible(payload, tableName) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const variants = [
    tableName,
    tableName.toLowerCase(),
    tableName.toUpperCase(),
    tableName.replace(/_/g, ""),
    tableName.replace(/_/g, " "),
    tableName.replace(/_/g, "-"),
    tableName.replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase()) // camel-ish
  ];
  for (const key of variants) {
    if (payload[key] !== undefined) return asArray(payload[key]);
  }
  return [];
}

function normalizeProduct(row) {
  const obj = normalizeRowKeys(row);
  return {
    code: cleanText(pick(obj, ["code", "product_code", "productid", "id"])),
    name: cleanText(pick(obj, ["name", "product_name", "productname"])),
    company: cleanText(pick(obj, ["company", "company_name", "brand"])),
    category: cleanText(pick(obj, ["category", "category_name"])),
    image_product: driveToDirect(pick(obj, ["image_product", "image", "product_image"])),
    image_company: driveToDirect(pick(obj, ["image_company", "brand_image", "company_image", "logo"])),
    base_carton: cleanNumber(pick(obj, ["base_carton", "carton_price", "price_carton", "price"])),
    base_pack: cleanNumber(pick(obj, ["base_pack", "pack_price"])),
    base_piece: cleanNumber(pick(obj, ["base_piece", "piece_price"])),
    visible: cleanText(pick(obj, ["visible", "show", "display"])) || "1",
    status: cleanText(pick(obj, ["status"])) || "1"
  };
}

function normalizeCustomer(row) {
  const obj = normalizeRowKeys(row);
  return {
    phone: cleanText(pick(obj, ["phone", "mobile"])),
    name: cleanText(pick(obj, ["name", "customer_name"])),
    password: cleanText(pick(obj, ["password", "pass"])),
    region: cleanText(pick(obj, ["region"])),
    assigned_rep: cleanText(pick(obj, ["assigned_rep", "rep_id"])),
    level: cleanText(pick(obj, ["level"])) || "L1",
    total_spent: cleanNumber(pick(obj, ["total_spent"])),
    orders_count: cleanNumber(pick(obj, ["orders_count"])),
    status: cleanText(pick(obj, ["status"])) || "1"
  };
}

function normalizeRep(row) {
  const obj = normalizeRowKeys(row);
  return {
    rep_id: cleanText(pick(obj, ["rep_id", "id"])),
    name: cleanText(pick(obj, ["name", "rep_name"])),
    phone: cleanText(pick(obj, ["phone", "mobile"])),
    login_code: cleanText(pick(obj, ["login_code", "code"])),
    password: cleanText(pick(obj, ["password", "pass"])),
    region: cleanText(pick(obj, ["region"])),
    status: cleanText(pick(obj, ["status"])) || "1"
  };
}

function normalizeTier(row) {
  const obj = normalizeRowKeys(row);
  return {
    tier_id: cleanText(pick(obj, ["tier_id", "id"])),
    tier_name: cleanText(pick(obj, ["tier_name", "name"])),
    visible_label: cleanText(pick(obj, ["visible_label", "label"])) || cleanText(pick(obj, ["tier_name", "name"])),
    password: cleanText(pick(obj, ["password", "pass"])),
    min_total: cleanNumber(pick(obj, ["min_total", "min_amount"])),
    description: cleanText(pick(obj, ["description", "desc"])),
    conditions: cleanText(pick(obj, ["conditions", "condition", "rules"])),
    status: cleanText(pick(obj, ["status"])) || "1"
  };
}

function normalizeCategory(row) {
  const obj = normalizeRowKeys(row);
  return {
    category_id: cleanText(pick(obj, ["category_id", "id"])),
    category_name: cleanText(pick(obj, ["category_name", "name"])),
    company: cleanText(pick(obj, ["company"])),
    status: cleanText(pick(obj, ["status"])) || "1"
  };
}

function normalizeOrder(row) {
  const obj = normalizeRowKeys(row);
  return {
    order_id: cleanText(pick(obj, ["order_id", "id"])),
    phone: cleanText(pick(obj, ["phone"])),
    rep_id: cleanText(pick(obj, ["rep_id"])),
    total: cleanNumber(pick(obj, ["total"])),
    status: cleanText(pick(obj, ["status"])) || "pending",
    date: cleanText(pick(obj, ["date", "created_at"])),
    tier_id: cleanText(pick(obj, ["tier_id"])),
    source: cleanText(pick(obj, ["source"])) || "api"
  };
}

function normalizeOrderItem(row) {
  const obj = normalizeRowKeys(row);
  return {
    order_id: cleanText(pick(obj, ["order_id"])),
    product_code: cleanText(pick(obj, ["product_code", "code"])),
    qty: cleanNumber(pick(obj, ["qty", "quantity"])),
    price: cleanNumber(pick(obj, ["price"])),
    unit: cleanText(pick(obj, ["unit"])),
    name: cleanText(pick(obj, ["name", "product_name"]))
  };
}

function normalizeOffer(row) {
  const obj = normalizeRowKeys(row);
  return {
    offer_id: cleanText(pick(obj, ["offer_id", "id"])),
    title: cleanText(pick(obj, ["title", "name"])),
    description: cleanText(pick(obj, ["description", "desc"])),
    price: cleanNumber(pick(obj, ["price"])),
    image: driveToDirect(pick(obj, ["image", "offer_image"])),
    status: cleanText(pick(obj, ["status"])) || "active"
  };
}

function normalizeFlashOffer(row) {
  const obj = normalizeRowKeys(row);
  return {
    offer_id: cleanText(pick(obj, ["offer_id", "id"])),
    title: cleanText(pick(obj, ["title", "name"])),
    description: cleanText(pick(obj, ["description", "desc"])),
    price: cleanNumber(pick(obj, ["price"])),
    start_date: cleanText(pick(obj, ["start_date"])),
    start_time: cleanText(pick(obj, ["start_time"])),
    duration_minutes: cleanNumber(pick(obj, ["duration_minutes"])),
    image: driveToDirect(pick(obj, ["image", "offer_image"])),
    status: cleanText(pick(obj, ["status"])) || "upcoming"
  };
}

function normalizeTierPrice(row) {
  const obj = normalizeRowKeys(row);
  return {
    product_code: cleanText(pick(obj, ["product_code", "code"])),
    tier_id: cleanText(pick(obj, ["tier_id"])),
    price: cleanNumber(pick(obj, ["price"])),
    min_qty: cleanNumber(pick(obj, ["min_qty"]))
  };
}

function normalizeFromApi(apiData) {
  const tables = {};
  const names = ["products", "categories", "customers", "reps", "orders", "order_items", "offers", "flash_offers", "tiers", "tier_prices"];
  names.forEach(name => {
    const arr = normalizeTableFromPossible(apiData, name);
    if (arr.length) tables[name] = arr;
  });
  return tables;
}

async function loadTableFallback(url, normalizer) {
  try {
    const txt = await fetchText(url);
    const parsed = parseCSV(txt);
    return parsed.map(normalizer);
  } catch {
    return [];
  }
}

async function loadData() {
  const apiData = await fetchJsonMaybe(CONFIG.apiUrl);
  const extracted = apiData ? normalizeFromApi(apiData) : {};

  DATA.products = (extracted.products || []).map(normalizeProduct);
  DATA.categories = (extracted.categories || []).map(normalizeCategory);
  DATA.customers = (extracted.customers || []).map(normalizeCustomer);
  DATA.reps = (extracted.reps || []).map(normalizeRep);
  DATA.orders = (extracted.orders || []).map(normalizeOrder);
  DATA.orderItems = (extracted.order_items || []).map(normalizeOrderItem);
  DATA.offers = (extracted.offers || []).map(normalizeOffer);
  DATA.flashOffers = (extracted.flash_offers || []).map(normalizeFlashOffer);
  DATA.tiers = (extracted.tiers || []).map(normalizeTier);
  DATA.tierPrices = (extracted.tier_prices || []).map(normalizeTierPrice);

  const fallbacks = [
    ["products", CONFIG.csv.products, normalizeProduct],
    ["categories", CONFIG.csv.categories, normalizeCategory],
    ["customers", CONFIG.csv.customers, normalizeCustomer],
    ["reps", CONFIG.csv.reps, normalizeRep],
    ["orders", CONFIG.csv.orders, normalizeOrder],
    ["orderItems", CONFIG.csv.order_items, normalizeOrderItem],
    ["offers", CONFIG.csv.offers, normalizeOffer],
    ["flashOffers", CONFIG.csv.flash_offers, normalizeFlashOffer],
    ["tiers", CONFIG.csv.tiers, normalizeTier]
  ];

  await Promise.all(fallbacks.map(async ([key, url, normalizer]) => {
    if (DATA[key] && DATA[key].length) return;
    const rows = await loadTableFallback(url, normalizer);
    if (rows.length) DATA[key] = rows;
  }));

  DATA.products = DATA.products.map(normalizeProduct);
  DATA.customers = DATA.customers.map(normalizeCustomer);
  DATA.reps = DATA.reps.map(normalizeRep);
  DATA.tiers = DATA.tiers.map(normalizeTier);
  DATA.categories = DATA.categories.map(normalizeCategory);
  DATA.orders = DATA.orders.map(normalizeOrder);
  DATA.orderItems = DATA.orderItems.map(normalizeOrderItem);
  DATA.offers = DATA.offers.map(normalizeOffer);
  DATA.flashOffers = DATA.flashOffers.map(normalizeFlashOffer);
  DATA.tierPrices = DATA.tierPrices.map(normalizeTierPrice);

  if (!DATA.categories.length) {
    const map = new Map();
    DATA.products.forEach(p => {
      const key = `${cleanText(p.company)}__${cleanText(p.category)}`.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          category_id: key,
          category_name: p.category || "بدون تصنيف",
          company: p.company || "",
          status: "1"
        });
      }
    });
    DATA.categories = [...map.values()];
  }

  renderSessionBadge();
  hydrateSession();
  renderAll();
}

function getUniqueCompanies() {
  const map = new Map();
  DATA.products.forEach(p => {
    if (cleanText(p.visible) !== "1") return;
    const key = cleanText(p.company).toLowerCase();
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, {
        name: p.company,
        logo: p.image_company || p.image_product || "",
        key
      });
    } else {
      const current = map.get(key);
      if (!current.logo && (p.image_company || p.image_product)) current.logo = p.image_company || p.image_product;
    }
  });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

function getVisibleProducts() {
  return DATA.products.filter(p => cleanText(p.visible) === "1");
}

function getCompanyProducts(companyName) {
  return getVisibleProducts().filter(p => cleanText(p.company) === cleanText(companyName));
}

function getCategoriesForCompany(companyName) {
  const productCats = getCompanyProducts(companyName).map(p => cleanText(p.category)).filter(Boolean);
  const sheetCats = DATA.categories
    .filter(c => !cleanText(c.company) || cleanText(c.company) === cleanText(companyName))
    .map(c => cleanText(c.category_name))
    .filter(Boolean);

  const unique = [...new Set(["الكل", ...productCats, ...sheetCats])];
  return unique;
}

function getSelectedTier() {
  return DATA.tiers.find(t => cleanText(t.tier_id) === cleanText(state.selectedTierId)) || null;
}

function getTierPrice(productCode) {
  const tier = getSelectedTier();
  if (!tier) return null;
  const match = DATA.tierPrices.find(x =>
    cleanText(x.product_code) === cleanText(productCode) &&
    cleanText(x.tier_id) === cleanText(tier.tier_id)
  );
  if (!match) return null;
  return cleanNumber(match.price);
}

function getBaseUnitPrice(product, unit) {
  if (unit === "carton") return cleanNumber(product.base_carton);
  if (unit === "pack") return cleanNumber(product.base_pack);
  if (unit === "piece") return cleanNumber(product.base_piece);
  return cleanNumber(product.base_carton);
}

function getUnitPrice(product, unit) {
  const tierPrice = getTierPrice(product.code);
  if (tierPrice !== null && tierPrice !== undefined && tierPrice !== "") {
    if (unit === "carton") return tierPrice;
    const baseCarton = cleanNumber(product.base_carton);
    const packRatio = baseCarton ? (cleanNumber(product.base_pack) / baseCarton) : 0.5;
    const pieceRatio = baseCarton ? (cleanNumber(product.base_piece) / baseCarton) : 0.1;
    if (unit === "pack") return Math.max(0, Math.round(tierPrice * (packRatio || 0.5)));
    if (unit === "piece") return Math.max(0, Math.round(tierPrice * (pieceRatio || 0.1)));
  }
  return getBaseUnitPrice(product, unit);
}

function getCartItem(code, unit) {
  return cart.find(i => i.code === code && i.unit === unit) || null;
}

function getCartTotal() {
  return cart.reduce((sum, item) => {
    const product = DATA.products.find(p => cleanText(p.code) === cleanText(item.code));
    if (!product) return sum;
    return sum + (getUnitPrice(product, item.unit) * cleanNumber(item.qty));
  }, 0);
}

function getCurrentUserPhone() {
  if (state.loginMode === "customer" && state.user) return cleanText(state.user.phone);
  if (state.loginMode === "rep" && state.rep) return cleanText(state.rep.phone);
  return "";
}

function getCurrentRepId() {
  if (state.rep) return cleanText(state.rep.rep_id);
  if (state.user && state.user.assigned_rep) return cleanText(state.user.assigned_rep);
  return "";
}

function renderSessionBadge() {
  const mark = $("#brandMark");
  const label = $("#sessionLabel");
  const logoutBtn = $("#logoutBtn");
  if (!mark || !label || !logoutBtn) return;

  if (state.user) {
    mark.textContent = (state.user.name || "C").slice(0, 1);
    label.textContent = `عميل: ${state.user.name || state.user.phone || ""} · ${state.user.level || ""}`;
    logoutBtn.classList.remove("hidden");
  } else if (state.rep) {
    mark.textContent = (state.rep.name || "R").slice(0, 1);
    label.textContent = `مندوب: ${state.rep.name || state.rep.rep_id || ""} · ${state.rep.region || ""}`;
    logoutBtn.classList.remove("hidden");
  } else {
    mark.textContent = "A";
    label.textContent = "مرحبًا بك";
    logoutBtn.classList.add("hidden");
  }
}

function setSearchPlaceholder() {
  const input = $("#globalSearch");
  if (!input) return;
  if (state.view === "home") input.placeholder = "ابحث عن شركة...";
  else if (state.view === "products") input.placeholder = "ابحث في المنتجات أو التصنيفات...";
  else if (state.view === "tiers") input.placeholder = "ابحث عن شريحة...";
  else if (state.view === "orders") input.placeholder = "ابحث في الطلبات...";
  else input.placeholder = "ابحث...";
}

function showToast(message, type = "success") {
  const toast = $("#toast");
  if (!toast) return;
  toast.className = `toast show ${type}`;
  toast.textContent = message;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.className = "toast";
    toast.textContent = "";
  }, 2600);
}

function setSmartMessage(text, tone = "advisor") {
  const box = $("#smartMessage");
  if (!box) return;
  box.dataset.tone = tone;
  box.textContent = text;
}

function setView(view, push = true) {
  state.view = view;
  $$(".view").forEach(v => v.classList.remove("active"));
  const viewEl = $(`#${view}View`);
  if (viewEl) viewEl.classList.add("active");

  if (push) history.pushState({ view }, "", "");

  setSearchPlaceholder();

  if (view === "home") renderHome();
  if (view === "products") renderProducts();
  if (view === "cart") renderCart();
  if (view === "tiers") renderTiers();
  if (view === "orders") renderOrders();

  updateFooter();
}

function goBack() {
  if (state.view === "home") {
    showToast("أنت في الصفحة الرئيسية", "warn");
    return;
  }
  history.back();
}

function requireLogin() {
  if (!state.user && !state.rep) {
    showToast("سجل الدخول أولًا", "warn");
    setView("login");
    return false;
  }
  return true;
}

function hydrateSession() {
  const session = loadJSON(STORAGE.session, null);
  const savedTier = cleanText(localStorage.getItem(STORAGE.tier));
  if (savedTier) state.selectedTierId = savedTier;

  if (session && session.role === "customer" && session.user) {
    state.user = session.user;
    state.rep = null;
    state.loginMode = "customer";
  } else if (session && session.role === "rep" && session.rep) {
    state.rep = session.rep;
    state.user = null;
    state.loginMode = "rep";
  }

  if (state.user || state.rep) {
    $("#topbar").classList.remove("hidden");
    $("#footerBar").classList.remove("hidden");
    $("#loginView").classList.remove("active");
    setView("home", false);
  } else {
    $("#topbar").classList.add("hidden");
    $("#footerBar").classList.add("hidden");
    setView("login", false);
  }
  renderLoginMode();
}

function saveSession() {
  if (state.user) saveJSON(STORAGE.session, { role: "customer", user: state.user });
  else if (state.rep) saveJSON(STORAGE.session, { role: "rep", rep: state.rep });
  else localStorage.removeItem(STORAGE.session);
}

function login() {
  const primary = cleanText($("#loginPrimary").value);
  const secret = cleanText($("#loginSecret").value);

  if (state.loginMode === "customer") {
    const user = DATA.customers.find(c =>
      cleanText(c.phone) === primary &&
      cleanText(c.password) === secret &&
      cleanText(c.status) !== "0"
    );

    if (!user) {
      showToast("بيانات الدخول غير صحيحة", "error");
      return;
    }

    state.user = user;
    state.rep = null;
  } else {
    const rep = DATA.reps.find(r =>
      cleanText(r.login_code) === primary &&
      cleanText(r.password) === secret &&
      cleanText(r.status) !== "0"
    );

    if (!rep) {
      showToast("بيانات المندوب غير صحيحة", "error");
      return;
    }

    state.rep = rep;
    state.user = null;
  }

  saveSession();
  renderSessionBadge();
  $("#topbar").classList.remove("hidden");
  $("#footerBar").classList.remove("hidden");
  setSmartMessage("أهلًا وسهلًا… يلا نبدأ مع بعض 👌", "buddy");
  setView("home");
  showToast("تم تسجيل الدخول", "success");
}

function logout() {
  state.user = null;
  state.rep = null;
  state.selectedCompany = "";
  state.selectedCategory = "all";
  state.selectedTierId = "";
  localStorage.removeItem(STORAGE.session);
  localStorage.removeItem(STORAGE.tier);
  $("#topbar").classList.add("hidden");
  $("#footerBar").classList.add("hidden");
  setView("login", false);
  renderLoginMode();
}

function renderLoginMode() {
  const primaryLabel = $("#primaryLabel");
  const secretLabel = $("#secretLabel");
  const primaryInput = $("#loginPrimary");
  const secretInput = $("#loginSecret");

  if (state.loginMode === "customer") {
    primaryLabel.textContent = "رقم الهاتف";
    primaryInput.placeholder = "أدخل رقم الهاتف";
    primaryInput.inputMode = "numeric";
    secretLabel.textContent = "الباسورد";
    secretInput.placeholder = "أدخل الباسورد";
  } else {
    primaryLabel.textContent = "كود الدخول";
    primaryInput.placeholder = "أدخل كود الدخول";
    primaryInput.inputMode = "numeric";
    secretLabel.textContent = "الباسورد";
    secretInput.placeholder = "أدخل الباسورد";
  }

  $$(".mode-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.loginMode === state.loginMode);
  });
}

function renderHome() {
  $("#homeMeta").textContent = state.selectedTierId ? `الشريحة الحالية: ${getSelectedTier()?.visible_label || getSelectedTier()?.tier_name || ""}` : "اختر شركة لعرض الأصناف";
  setSmartMessage(state.selectedTierId ? "الشريحة مفعلة وجاهزة... اختار الشركة وابدأ الطلب 👌" : "اختار شركة وأنا أوجّهك للأصناف المناسبة 🔥", state.selectedTierId ? "boss" : "advisor");
  renderCompanies();
}

function renderCompanies() {
  const root = $("#companiesGrid");
  root.innerHTML = "";

  const query = cleanText(state.search).toLowerCase();
  const companies = getUniqueCompanies().filter(c => !query || cleanText(c.name).toLowerCase().includes(query));

  if (!companies.length) {
    const empty = $("#emptyTemplate").content.cloneNode(true);
    empty.querySelector(".empty-state").textContent = "لا توجد شركات متاحة";
    root.appendChild(empty);
    return;
  }

  companies.forEach(company => {
    const tpl = $("#companyTemplate").content.cloneNode(true);
    const card = tpl.querySelector(".company-card");
    const img = tpl.querySelector(".company-logo");
    const name = tpl.querySelector(".company-name");

    img.src = safeImage(company.logo, company.name);
    img.alt = company.name;
    name.textContent = company.name;

    card.addEventListener("click", () => {
      state.selectedCompany = company.name;
      state.selectedCategory = "all";
      state.search = "";
      $("#globalSearch").value = "";
      setView("products");
    });

    root.appendChild(tpl);
  });
}

function renderProducts() {
  const root = $("#productsGrid");
  const chipsRoot = $("#categoryChips");
  root.innerHTML = "";
  chipsRoot.innerHTML = "";

  const allProducts = getVisibleProducts();
  const companyName = state.selectedCompany;
  const companyProducts = companyName ? getCompanyProducts(companyName) : allProducts;

  $("#productsTitle").textContent = companyName ? companyName : "جميع المنتجات";
  $("#productsSub").textContent = companyName ? `شركة: ${companyName}` : `${companyProducts.length} صنف متاح`;

  const categories = companyName ? getCategoriesForCompany(companyName) : ["الكل", ...new Set(allProducts.map(p => cleanText(p.category)).filter(Boolean))];

  categories.forEach((cat, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `category-chip ${state.selectedCategory === (idx === 0 ? "all" : cat) ? "active" : ""}`;
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      state.selectedCategory = idx === 0 ? "all" : cat;
      renderProducts();
    });
    chipsRoot.appendChild(btn);
  });

  let list = companyProducts;
  if (state.selectedCategory !== "all") list = list.filter(p => cleanText(p.category) === cleanText(state.selectedCategory));

  const query = cleanText(state.search).toLowerCase();
  if (query) {
    list = list.filter(p => {
      const fields = [p.name, p.company, p.category, p.code].map(x => cleanText(x).toLowerCase());
      return fields.some(f => f.includes(query));
    });
  }

  setSmartMessage("اختار الوحدة أولًا وبعدها الكمية وأنا أكمل معاك 👌", "advisor");

  if (!list.length) {
    const empty = $("#emptyTemplate").content.cloneNode(true);
    empty.querySelector(".empty-state").textContent = "لا توجد أصناف مطابقة";
    root.appendChild(empty);
    return;
  }

  list.forEach(product => {
    const tpl = $("#productTemplate").content.cloneNode(true);
    const card = tpl.querySelector(".product-card");
    const img = tpl.querySelector(".product-image");
    const stock = tpl.querySelector(".product-stock");
    const name = tpl.querySelector(".product-name");
    const company = tpl.querySelector(".product-company");
    const companyLogo = tpl.querySelector(".product-company-logo");
    const category = tpl.querySelector(".product-category");
    const price = tpl.querySelector(".product-price");
    const unitRow = tpl.querySelector(".unit-row");
    const qtyInput = tpl.querySelector(".qty-input");
    const minusBtn = tpl.querySelector(".minus");
    const plusBtn = tpl.querySelector(".plus");
    const addBtn = tpl.querySelector(".add-btn");

    const isVisible = cleanText(product.visible) === "1";
    const isAvailable = cleanText(product.status) !== "0";

    img.src = safeImage(product.image_product || product.image_company, product.name);
    img.alt = product.name || "صنف";
    name.textContent = product.name || "بدون اسم";
    company.textContent = product.company || "";
    companyLogo.src = safeImage(product.image_company || product.image_product, product.company || product.name);
    companyLogo.alt = product.company || "";
    category.textContent = product.category || "بدون تصنيف";

    stock.textContent = isAvailable ? "متوفر" : "نفذت الكمية";
    stock.className = `product-stock ${isAvailable ? "in" : "out"}`;

    const units = [
      { key: "carton", label: "كرتونة" },
      { key: "pack", label: "دستة" },
      { key: "piece", label: "قطعة" }
    ];

    let selectedUnit = "";
    let selectedQty = 1;

    function refreshPrice() {
      if (!selectedUnit) {
        price.textContent = "السعر: اختر الوحدة";
        return;
      }
      const unitPrice = getUnitPrice(product, selectedUnit);
      price.textContent = `السعر: ${unitPrice.toLocaleString("en-US")} جنيه`;
    }

    units.forEach(u => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "unit-chip";
      chip.textContent = u.label;
      chip.addEventListener("click", () => {
        selectedUnit = u.key;
        qtyInput.disabled = false;
        qtyInput.value = selectedQty;
        $$(".unit-chip", unitRow).forEach(btn => btn.classList.remove("active"));
        chip.classList.add("active");
        refreshPrice();
      });
      unitRow.appendChild(chip);
    });

    qtyInput.disabled = true;
    qtyInput.value = 1;

    qtyInput.addEventListener("input", () => {
      selectedQty = Math.max(1, cleanNumber(qtyInput.value));
      qtyInput.value = selectedQty;
    });

    minusBtn.addEventListener("click", () => {
      if (!selectedUnit) return showToast("اختار الوحدة أولًا", "warn");
      selectedQty = Math.max(1, cleanNumber(qtyInput.value) - 1);
      qtyInput.value = selectedQty;
    });

    plusBtn.addEventListener("click", () => {
      if (!selectedUnit) return showToast("اختار الوحدة أولًا", "warn");
      selectedQty = Math.max(1, cleanNumber(qtyInput.value) + 1);
      qtyInput.value = selectedQty;
    });

    addBtn.disabled = !isAvailable;
    addBtn.textContent = isAvailable ? "إضافة" : "نفذت الكمية";

    addBtn.addEventListener("click", () => {
      if (!selectedUnit) {
        showToast("اختار الوحدة أولًا", "warn");
        return;
      }
      if (!isAvailable) {
        showToast("الصنف غير متوفر", "error");
        return;
      }

      const qty = Math.max(1, cleanNumber(qtyInput.value));
      const existing = getCartItem(product.code, selectedUnit);

      if (existing) existing.qty = qty;
      else cart.push({ code: product.code, unit: selectedUnit, qty });

      saveJSON(STORAGE.cart, cart);
      renderFooter();
      setSmartMessage("حلو أوي كده 👌 كمل معايا", "buddy");
      showToast("تمت الإضافة للسلة", "success");
    });

    if (!isVisible) card.classList.add("hidden");
    if (!isAvailable) card.classList.add("product-disabled");

    refreshPrice();
    root.appendChild(tpl);
  });
}

function renderCart() {
  const root = $("#cartList");
  root.innerHTML = "";

  setSmartMessage(cart.length ? "راجع السلة بسرعة وكمل الأوردر 🔥" : "السلة فاضية... نختار شوية أصناف ونكمل 👌", cart.length ? "closer" : "advisor");

  if (!cart.length) {
    const empty = $("#emptyTemplate").content.cloneNode(true);
    empty.querySelector(".empty-state").textContent = "السلة فارغة";
    root.appendChild(empty);
    $("#cartSub").textContent = "0 عنصر";
    return;
  }

  $("#cartSub").textContent = `${cart.length} عنصر`;

  cart.forEach(item => {
    const product = getProductByCode(item.code);
    if (!product) return;

    const tpl = $("#cartTemplate").content.cloneNode(true);
    const name = tpl.querySelector(".cart-name");
    const meta = tpl.querySelector(".cart-meta");
    const priceEl = tpl.querySelector(".cart-price");
    const qtyInput = tpl.querySelector(".qty-input");
    const minusBtn = tpl.querySelector(".minus");
    const plusBtn = tpl.querySelector(".plus");
    const removeBtn = tpl.querySelector(".remove-btn");

    const unitPrice = getUnitPrice(product, item.unit);
    const total = unitPrice * cleanNumber(item.qty);

    name.textContent = product.name;
    meta.textContent = `${product.company} · ${product.category} · ${item.unit}`;
    priceEl.textContent = `${total.toLocaleString("en-US")} جنيه`;

    qtyInput.value = item.qty;

    qtyInput.addEventListener("input", () => {
      item.qty = Math.max(1, cleanNumber(qtyInput.value));
      qtyInput.value = item.qty;
      saveJSON(STORAGE.cart, cart);
      renderFooter();
      renderCart();
    });

    minusBtn.addEventListener("click", () => {
      item.qty = Math.max(1, cleanNumber(item.qty) - 1);
      saveJSON(STORAGE.cart, cart);
      renderFooter();
      renderCart();
    });

    plusBtn.addEventListener("click", () => {
      item.qty = Math.max(1, cleanNumber(item.qty) + 1);
      saveJSON(STORAGE.cart, cart);
      renderFooter();
      renderCart();
    });

    removeBtn.addEventListener("click", () => {
      cart = cart.filter(x => !(x.code === item.code && x.unit === item.unit));
      saveJSON(STORAGE.cart, cart);
      renderFooter();
      renderCart();
      showToast("تمت الإزالة", "success");
    });

    root.appendChild(tpl);
  });
}

function getOrderItemsFor(order) {
  if (Array.isArray(order.items) && order.items.length) return order.items;

  const fromSheet = DATA.orderItems.filter(x => cleanText(x.order_id) === cleanText(order.order_id));
  if (fromSheet.length) {
    return fromSheet.map(x => ({
      product_code: x.product_code,
      name: x.name || (getProductByCode(x.product_code)?.name || x.product_code),
      qty: cleanNumber(x.qty),
      unit: x.unit || "carton",
      price: cleanNumber(x.price)
    }));
  }

  return [];
}

function renderTiers() {
  const root = $("#tiersGrid");
  root.innerHTML = "";

  let tiers = DATA.tiers.filter(t => cleanText(t.status) !== "0");
  const q = cleanText(state.search).toLowerCase();
  if (q) tiers = tiers.filter(t => {
    const text = [t.tier_name, t.visible_label, t.description, t.conditions, t.tier_id].map(x => cleanText(x).toLowerCase()).join(" ");
    return text.includes(q);
  });

  setSmartMessage("اختار الشريحة المناسبة وأنا أضبط لك التسعير فورًا 🟢", "boss");

  if (!tiers.length) {
    const empty = $("#emptyTemplate").content.cloneNode(true);
    empty.querySelector(".empty-state").textContent = "لا توجد شرائح";
    root.appendChild(empty);
    return;
  }

  tiers.forEach(tier => {
    const tpl = $("#tierTemplate").content.cloneNode(true);
    const card = tpl.querySelector(".tier-card");
    const name = tpl.querySelector(".tier-name");
    const badge = tpl.querySelector(".tier-badge");
    const desc = tpl.querySelector(".tier-desc");
    const conditions = tpl.querySelector(".tier-conditions");
    const min = tpl.querySelector(".tier-min");
    const passWrap = tpl.querySelector(".tier-pass-wrap");
    const passInput = tpl.querySelector(".tier-pass");
    const selectBtn = tpl.querySelector(".tier-select");

    const selected = cleanText(state.selectedTierId) === cleanText(tier.tier_id);
    name.textContent = tier.visible_label || tier.tier_name || "شريحة";
    badge.textContent = selected ? "مفعلة" : "جاهزة";
    desc.textContent = tier.description ? `الوصف: ${tier.description}` : "الوصف: —";
    conditions.textContent = tier.conditions ? `الشروط: ${tier.conditions}` : "الشروط: —";
    min.textContent = `الحد الأدنى: ${cleanNumber(tier.min_total).toLocaleString("en-US")} جنيه`;

    if (cleanText(tier.password)) passWrap.classList.remove("hidden");
    if (selected) card.classList.add("tier-selected");

    selectBtn.textContent = selected ? "الشريحة الحالية" : "اختيار الشريحة";
    selectBtn.disabled = cleanText(tier.status) === "0";

    selectBtn.addEventListener("click", () => {
      if (cleanText(tier.password)) {
        if (cleanText(passInput.value) !== cleanText(tier.password)) {
          showToast("باسورد الشريحة غير صحيح", "error");
          return;
        }
      }

      state.selectedTierId = tier.tier_id;
      saveJSON(STORAGE.tier, state.selectedTierId);
      showToast(`تم تفعيل ${tier.visible_label || tier.tier_name}`, "success");
      setSmartMessage("الشريحة متفعلة... كمل اختيار الأصناف 🔥", "boss");
      renderTiers();
      renderFooter();
      if (state.view === "products") renderProducts();
    });

    root.appendChild(tpl);
  });
}

function buildCurrentOrder() {
  const phone = getCurrentUserPhone();
  const repId = getCurrentRepId();
  if (!cart.length) return null;

  const items = cart.map(item => {
    const product = getProductByCode(item.code);
    const unitPrice = product ? getUnitPrice(product, item.unit) : 0;
    return {
      product_code: item.code,
      unit: item.unit,
      qty: cleanNumber(item.qty),
      price: unitPrice,
      name: product ? product.name : ""
    };
  });

  const total = items.reduce((sum, x) => sum + cleanNumber(x.price) * cleanNumber(x.qty), 0);

  return {
    order_id: `L${Date.now()}`,
    phone,
    rep_id: repId,
    tier_id: cleanText(state.selectedTierId),
    items,
    total,
    status: "pending",
    date: new Date().toISOString(),
    source: "local"
  };
}

function checkout() {
  if (!state.user && !state.rep) {
    showToast("سجل الدخول أولًا", "error");
    setView("login");
    return;
  }

  if (!cart.length) {
    showToast("السلة فارغة", "warn");
    return;
  }

  const order = buildCurrentOrder();
  if (!order) return;

  pendingOrders.unshift(order);
  saveJSON(STORAGE.pendingOrders, pendingOrders);
  cart = [];
  saveJSON(STORAGE.cart, cart);

  setSmartMessage("تم حفظ الطلب بنجاح... وهنكمّل معاك لو فيه أي تعديل 🔥", "closer");
  showToast("تم حفظ الطلب", "success");
  renderFooter();
  setView("orders");
}

function getCustomerOrders() {
  const phone = state.user ? cleanText(state.user.phone) : "";
  const apiOrders = DATA.orders.filter(o => cleanText(o.phone) === phone);
  const localOrders = pendingOrders.filter(o => cleanText(o.phone) === phone);
  return [...localOrders, ...apiOrders];
}

function getRepOrders() {
  const repId = state.rep ? cleanText(state.rep.rep_id) : "";
  const apiOrders = DATA.orders.filter(o => cleanText(o.rep_id) === repId);
  const localOrders = pendingOrders.filter(o => cleanText(o.rep_id) === repId);
  return [...localOrders, ...apiOrders];
}

function renderOrders() {
  const root = $("#ordersPanel");
  root.innerHTML = "";

  const isRep = !!state.rep;
  $("#ordersTitle").textContent = isRep ? "تقارير المندوب" : "طلباتي";
  $("#ordersSub").textContent = isRep ? "إحصاءات الطلبات والعملاء" : "متابعة طلباتك السابقة";
  setSmartMessage(isRep ? "هنا تتابع الطلبات والمبيعات... شغل نظيف ومباشر 🧠" : "هنا كل طلباتك السابقة تحت إيدك 👌", isRep ? "analyst" : "advisor");

  const orders = isRep ? getRepOrders() : getCustomerOrders();
  const stats = document.createElement("div");
  stats.className = "orders-stats";

  const totalSales = orders.reduce((s, o) => s + cleanNumber(o.total), 0);
  const uniqueCustomers = [...new Set(orders.map(o => cleanText(o.phone)).filter(Boolean))].length;

  const statData = isRep ? [
    { label: "عدد الطلبات", value: orders.length },
    { label: "إجمالي المبيعات", value: totalSales.toLocaleString("en-US") },
    { label: "عدد العملاء", value: uniqueCustomers }
  ] : [
    { label: "عدد الطلبات", value: orders.length },
    { label: "إجمالي الشراء", value: totalSales.toLocaleString("en-US") },
    { label: "آخر حالة", value: orders[0] ? (orders[0].status || "—") : "—" }
  ];

  statData.forEach(s => {
    const tpl = $("#ordersStatTemplate").content.cloneNode(true);
    tpl.querySelector(".stat-label").textContent = s.label;
    tpl.querySelector(".stat-value").textContent = s.value;
    stats.appendChild(tpl);
  });

  root.appendChild(stats);

  if (!orders.length) {
    const empty = $("#emptyTemplate").content.cloneNode(true);
    empty.querySelector(".empty-state").textContent = "لا توجد طلبات حتى الآن";
    root.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "orders-list";

  orders
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .forEach(order => {
      const tpl = $("#orderTemplate").content.cloneNode(true);
      tpl.querySelector(".order-id").textContent = `#${order.order_id || "طلب"}`;
      tpl.querySelector(".order-status").textContent = order.status || "pending";
      tpl.querySelector(".order-meta").textContent = `الهاتف: ${order.phone || "—"} · المندوب: ${order.rep_id || "—"} · التاريخ: ${order.date || "—"}`;

      const items = getOrderItemsFor(order);
      const itemsHtml = items.length
        ? items.map(i => `${i.name || i.product_code} × ${i.qty} (${i.unit || "—"})`).join("<br>")
        : "بدون تفاصيل";

      tpl.querySelector(".order-items").innerHTML = itemsHtml;
      tpl.querySelector(".order-total").textContent = `الإجمالي: ${cleanNumber(order.total).toLocaleString("en-US")} جنيه`;

      list.appendChild(tpl);
    });

  root.appendChild(list);
}

function renderFooter() {
  const total = getCartTotal();
  $("#footerTotalBtn").textContent = total ? total.toLocaleString("en-US") : "0";
  $("#checkoutBtn").textContent = cart.length ? `إتمام الشراء (${cart.length})` : "إتمام الشراء";
}

function updateFooter() {
  renderFooter();
}

function clearSearchAndRender() {
  state.search = cleanText($("#globalSearch").value);
  if (state.view === "home") renderHome();
  else if (state.view === "products") renderProducts();
  else if (state.view === "tiers") renderTiers();
  else if (state.view === "orders") renderOrders();
}

function wireEvents() {
  $("#loginBtn").addEventListener("click", login);

  $$(".mode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.loginMode = btn.dataset.loginMode;
      renderLoginMode();
    });
  });

  $("#logoutBtn").addEventListener("click", logout);

  $("#globalSearch").addEventListener("input", clearSearchAndRender);

  $$("[data-back]").forEach(btn => btn.addEventListener("click", goBack));

  $$("[data-nav]").forEach(btn => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.nav;
      if (view === "cart" && !requireLogin()) return;
      if (view === "tiers" && !requireLogin()) return;
      if (view === "orders" && !requireLogin()) return;
      if (view === "products") {
        state.selectedCompany = "";
        state.selectedCategory = "all";
      }
      setView(view);
    });
  });

  $("#checkoutBtn").addEventListener("click", checkout);
  $("#footerTotalBtn").addEventListener("click", () => {
    if (!requireLogin()) return;
    setView("cart");
  });

  window.addEventListener("popstate", e => {
    const view = e.state?.view || (state.user || state.rep ? "home" : "login");
    state.view = view;
    $$(".view").forEach(v => v.classList.remove("active"));
    const el = $(`#${view}View`);
    if (el) el.classList.add("active");

    if (view !== "login") {
      $("#topbar").classList.remove("hidden");
      $("#footerBar").classList.remove("hidden");
    }
    setSearchPlaceholder();

    if (view === "home") renderHome();
    if (view === "products") renderProducts();
    if (view === "cart") renderCart();
    if (view === "tiers") renderTiers();
    if (view === "orders") renderOrders();
    updateFooter();
  });
}

function initShell() {
  $("#topbar").classList.toggle("hidden", !(state.user || state.rep));
  $("#footerBar").classList.toggle("hidden", !(state.user || state.rep));
  renderLoginMode();
  setSearchPlaceholder();
  wireEvents();
  setSmartMessage("اختار شركة وانا أوصلك لأفضل صنف بسرعة 👌", "advisor");
}

function renderAll() {
  renderSessionBadge();
  renderLoginMode();
  setSearchPlaceholder();
  renderFooter();

  if (state.user || state.rep) {
    $("#topbar").classList.remove("hidden");
    $("#footerBar").classList.remove("hidden");
    setView("home", false);
  } else {
    $("#topbar").classList.add("hidden");
    $("#footerBar").classList.add("hidden");
    setView("login", false);
  }

  renderHome();
  renderProducts();
  renderCart();
  renderTiers();
  renderOrders();
}

document.addEventListener("DOMContentLoaded", async () => {
  initShell();
  history.replaceState({ view: state.view }, "", "");
  await loadData();
  renderFooter();

  if (state.user || state.rep) setView("home", false);
  else setView("login", false);
});
