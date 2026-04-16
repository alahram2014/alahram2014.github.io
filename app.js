/* Alahram System – SMART B2B STORE
   منطق المتجر كله هنا: تحميل البيانات، التسعير، السلة، الدخول، وحفظ الطلبات محليًا. */

const SOURCES = {
  api: "https://script.google.com/macros/s/AKfycbxMS8WGi17SEIM72ymez1GUD9X8OLehJVXtKlwwTWtGIhKnTQnr_d-FnK5vdrAShGcf4Q/exec",
  products: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSkbig8ZQ9b3a4nPO9gZqVdWLPSUS_YDtfO7Jn74Td7EgGH1PIB02R4hH7fqq787kuz5GDD8ZqK91Yu/pub?gid=876724211&single=true&output=csv",
  categories: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSkbig8ZQ9b3a4nPO9gZqVdWLPSUS_YDtfO7Jn74Td7EgGH1PIB02R4hH7fqq787kuz5GDD8ZqK91Yu/pub?gid=88030026&single=true&output=csv",
  customers: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSkbig8ZQ9b3a4nPO9gZqVdWLPSUS_YDtfO7Jn74Td7EgGH1PIB02R4hH7fqq787kuz5GDD8ZqK91Yu/pub?gid=1309694873&single=true&output=csv",
  reps: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSkbig8ZQ9b3a4nPO9gZqVdWLPSUS_YDtfO7Jn74Td7EgGH1PIB02R4hH7fqq787kuz5GDD8ZqK91Yu/pub?gid=358488055&single=true&output=csv",
  orders: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSkbig8ZQ9b3a4nPO9gZqVdWLPSUS_YDtfO7Jn74Td7EgGH1PIB02R4hH7fqq787kuz5GDD8ZqK91Yu/pub?gid=41007407&single=true&output=csv",
  orderItems: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSkbig8ZQ9b3a4nPO9gZqVdWLPSUS_YDtfO7Jn74Td7EgGH1PIB02R4hH7fqq787kuz5GDD8ZqK91Yu/pub?gid=897522352&single=true&output=csv",
  offers: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSkbig8ZQ9b3a4nPO9gZqVdWLPSUS_YDtfO7Jn74Td7EgGH1PIB02R4hH7fqq787kuz5GDD8ZqK91Yu/pub?gid=863899727&single=true&output=csv",
  flashOffers: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSkbig8ZQ9b3a4nPO9gZqVdWLPSUS_YDtfO7Jn74Td7EgGH1PIB02R4hH7fqq787kuz5GDD8ZqK91Yu/pub?gid=1448598336&single=true&output=csv",
  tiers: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSkbig8ZQ9b3a4nPO9gZqVdWLPSUS_YDtfO7Jn74Td7EgGH1PIB02R4hH7fqq787kuz5GDD8ZqK91Yu/pub?gid=801156952&single=true&output=csv",
};

const STORAGE_KEYS = {
  cart: "alahram_cart_v1",
  tier: "alahram_tier_v1",
  user: "alahram_user_v1",
  orders: "alahram_orders_history_v1",
  lastMsg: "alahram_last_msg_v1",
};

const els = {
  homeView: document.getElementById("homeView"),
  productsView: document.getElementById("productsView"),
  companiesGrid: document.getElementById("companiesGrid"),
  companiesCount: document.getElementById("companiesCount"),
  productsGrid: document.getElementById("productsGrid"),
  currentCompanyName: document.getElementById("currentCompanyName"),
  currentCompanyMeta: document.getElementById("currentCompanyMeta"),
  categoryBar: document.getElementById("categoryBar"),
  searchInput: document.getElementById("searchInput"),
  clearSearch: document.getElementById("clearSearch"),
  smartMessage: document.getElementById("smartMessage"),
  cartButton: document.getElementById("cartButton"),
  cartCount: document.getElementById("cartCount"),
  cartDrawer: document.getElementById("cartDrawer"),
  closeCart: document.getElementById("closeCart"),
  cartItems: document.getElementById("cartItems"),
  cartTotal: document.getElementById("cartTotal"),
  cartHint: document.getElementById("cartHint"),
  checkoutButton: document.getElementById("checkoutButton"),
  checkoutFab: document.getElementById("checkoutFab"),
  overlay: document.getElementById("overlay"),
  backButton: document.getElementById("backButton"),
  loginModal: document.getElementById("loginModal"),
  tierModal: document.getElementById("tierModal"),
  tierButton: document.getElementById("tierButton"),
  tiersList: document.getElementById("tiersList"),
  customerLoginForm: document.getElementById("customerLoginForm"),
  repLoginForm: document.getElementById("repLoginForm"),
  toast: document.getElementById("toast"),
  loadingScreen: document.getElementById("loadingScreen"),
  offersSection: document.getElementById("homeOffersSection"),
  offersStrip: document.getElementById("offersStrip"),
  emptyProducts: document.getElementById("emptyProducts"),
  companyTitle: document.getElementById("companyTitle"),
};

const smartMessages = [
  "يلا نبدأ… اختار الشركة 👌",
  "اختار شركة ليها حركة عندك 🔥",
  "اضغط على الشركة، وبعدها نختار الأصناف بسرعة",
  "السوق محتاج سرعة… وإحنا مجهزينها لك",
  "اختار الوحدة والسعر يتظبط تلقائيًا",
  "كمل السلة، وإحنا هنقفلها معاك بسهولة",
  "خطوة واحدة وتبقى جاهز للطلب",
];

const state = {
  products: [],
  categories: [],
  customers: [],
  reps: [],
  orders: [],
  orderItems: [],
  offers: [],
  flashOffers: [],
  tiers: [],
  companies: [],
  activeCompany: null,
  activeCategory: "all",
  search: "",
  cart: [],
  selectedTier: null,
  user: null,
  units: {},
  smartIndex: 0,
  messageTimer: null,
  loading: true,
};

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .replace(/[_\-\/\\:]+/g, " ")
    .trim();
}

function compactKey(value) {
  return normalizeText(value).replace(/[^a-z0-9\u0600-\u06ff]+/g, "");
}

function pick(row, aliases) {
  if (!row) return "";
  const map = row._norm || buildNormMap(row);
  for (const alias of aliases) {
    const key = compactKey(alias);
    if (key in map && map[key] !== "") return map[key];
  }
  return "";
}

function buildNormMap(row) {
  const map = {};
  for (const [key, value] of Object.entries(row || {})) {
    map[compactKey(key)] = value;
  }
  row._norm = map;
  return map;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const clean = String(value).replace(/,/g, "").replace(/[^\d.-]/g, "").trim();
  const n = Number(clean);
  return Number.isFinite(n) ? n : 0;
}

function toInt(value) {
  const n = parseInt(String(value ?? "").replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function isTruthy(value) {
  const v = normalizeText(value);
  return ["1", "true", "yes", "y", "on", "active", "enabled", "نعم", "فعال", "مفعل"].includes(v);
}

function isVisibleRow(row) {
  const visible = pick(row, ["visible", "is_visible", "show", "active", "status_visible"]);
  if (visible === "") return true;
  if (["0", "false", "no", "hidden", "غير مرئي", "مخفي"].includes(normalizeText(visible))) return false;
  return isTruthy(visible) || toInt(visible) !== 0;
}

function isActiveStatus(row) {
  const status = pick(row, ["status", "active", "enabled", "state"]);
  if (status === "") return true;
  if (["0", "false", "no", "disabled", "inactive", "متوقف", "غير فعال"].includes(normalizeText(status))) return false;
  return isTruthy(status) || toInt(status) !== 0;
}

function safeText(value, fallback = "") {
  const v = String(value ?? "").trim();
  return v ? v : fallback;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      row.push(cur);
      cur = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      cur = "";
      continue;
    }
    cur += ch;
  }

  row.push(cur);
  if (row.some((cell) => cell !== "")) rows.push(row);
  if (!rows.length) return [];
  const headers = rows.shift().map((h) => h.trim());
  return rows
    .filter((r) => r.length && r.some((cell) => String(cell).trim() !== ""))
    .map((r) => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = (r[i] ?? "").trim();
      });
      return obj;
    });
}

async function fetchFlexible(url) {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch (_) {
      return [];
    }
  }
  return parseCSV(trimmed);
}

async function fetchData() {
  const tryApi = async () => {
    const res = await fetch(SOURCES.api, { cache: "no-store" });
    const text = await res.text();
    const trimmed = text.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) return JSON.parse(trimmed);
    return { raw: trimmed };
  };

  let apiData = null;
  try {
    apiData = await tryApi();
  } catch (_) {
    apiData = null;
  }

  const [products, categories, customers, reps, orders, orderItems, offers, flashOffers, tiers] = await Promise.all([
    apiData?.Products || apiData?.products || apiData?.data?.Products || fetchFlexible(SOURCES.products),
    apiData?.Categories || apiData?.categories || apiData?.data?.Categories || fetchFlexible(SOURCES.categories),
    apiData?.Customers || apiData?.customers || apiData?.data?.Customers || fetchFlexible(SOURCES.customers),
    apiData?.Reps || apiData?.reps || apiData?.data?.Reps || fetchFlexible(SOURCES.reps),
    apiData?.Orders || apiData?.orders || apiData?.data?.Orders || fetchFlexible(SOURCES.orders),
    apiData?.Order_Items || apiData?.order_items || apiData?.data?.Order_Items || fetchFlexible(SOURCES.orderItems),
    apiData?.Offers || apiData?.offers || apiData?.data?.Offers || fetchFlexible(SOURCES.offers),
    apiData?.Flash_Offers || apiData?.flash_offers || apiData?.data?.Flash_Offers || fetchFlexible(SOURCES.flashOffers),
    apiData?.Tiers || apiData?.tiers || apiData?.data?.Tiers || fetchFlexible(SOURCES.tiers),
  ]);

  return { products, categories, customers, reps, orders, orderItems, offers, flashOffers, tiers };
}

function mapRows(rows) {
  return Array.isArray(rows) ? rows.filter(Boolean).map((row) => {
    if (typeof row !== "object" || row === null) return {};
    buildNormMap(row);
    return row;
  }) : [];
}

function uniqueBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function productIdOf(product) {
  return safeText(
    pick(product, ["id", "product_id", "sku", "code", "كود", "رقم", "item_id"]),
    `${normalizeText(product.company)}-${normalizeText(product.name)}`
  );
}

function normalizeUnit(unit) {
  const u = normalizeText(unit);
  if (u.includes("carton") || u.includes("كرتون")) return "carton";
  if (u.includes("pack") || u.includes("دستة") || u.includes("دسته")) return "pack";
  if (u.includes("piece") || u.includes("قطعة") || u.includes("pc")) return "piece";
  return "";
}

function productUnitCandidates(unit) {
  if (unit === "carton") return ["base_carton", "carton", "carton_price", "price_carton", "سعر الكرتون", "كرتون"];
  if (unit === "pack") return ["base_pack", "pack", "pack_price", "price_pack", "سعر الدستة", "دستة"];
  if (unit === "piece") return ["base_piece", "piece", "piece_price", "price_piece", "سعر القطعه", "سعر القطعة", "قطعة"];
  return [];
}

function findPriceByKeys(row, keys) {
  const map = row._norm || buildNormMap(row);
  for (const key of keys) {
    const k = compactKey(key);
    if (k in map) {
      const n = toNumber(map[k]);
      if (n > 0) return n;
    }
  }
  return 0;
}

function tierKeyCandidates(tier) {
  const n = normalizeText(tier?.tier_name || "");
  const v = normalizeText(tier?.visible_label || "");
  const base = [n, v].filter(Boolean);
  const out = [];
  for (const item of base) {
    out.push(item);
    out.push(item.replace(/\s+/g, "_"));
    out.push(item.replace(/\s+/g, ""));
    out.push(`price_${item}`);
    out.push(`${item}_price`);
    out.push(`tier_${item}`);
    out.push(`${item}_tier`);
    out.push(`price ${item}`);
    out.push(`${item} price`);
    out.push(`سعر ${item}`);
    out.push(`${item} سعر`);
    ["carton", "pack", "piece"].forEach((unit) => {
      out.push(`${item}_${unit}`);
      out.push(`${unit}_${item}`);
      out.push(`price_${item}_${unit}`);
      out.push(`${item}_${unit}_price`);
      out.push(`${unit} ${item}`);
      out.push(`${item} ${unit}`);
      out.push(`سعر ${item} ${unit}`);
    });
  }
  return uniqueBy(out, (x) => compactKey(x));
}

function getTierObject(selectedTierKey) {
  return state.tiers.find((tier) => compactKey(tier.key) === compactKey(selectedTierKey)) || null;
}

function getProductBasePrice(product, unit) {
  const candidates = productUnitCandidates(unit);
  const price = findPriceByKeys(product, candidates);
  if (price > 0) return price;

  const fallback = findPriceByKeys(product, [
    unit,
    `base_${unit}`,
    `price_${unit}`,
    `${unit}_price`,
    "price",
    "سعر",
    "base_price",
  ]);
  return fallback > 0 ? fallback : 0;
}

function getTierPrice(product, unit, tier) {
  if (!tier) return 0;
  const candidates = tierKeyCandidates(tier);
  const map = product._norm || buildNormMap(product);
  for (const key of candidates) {
    const k = compactKey(key);
    if (k in map) {
      const n = toNumber(map[k]);
      if (n > 0) return n;
    }
  }
  // محاولة أخيرة: لو موجود سعر باسم الشريحة فقط بدون الوحدة
  const onlyTier = [tier.tier_name, tier.visible_label].filter(Boolean);
  for (const name of onlyTier) {
    const k = compactKey(name);
    if (k in map) {
      const n = toNumber(map[k]);
      if (n > 0) return n;
    }
  }
  return 0;
}

function tierEligibleForCart(tier, cartTotalBeforeTier) {
  const minTotal = toNumber(tier?.min_total);
  if (!tier) return false;
  if (!minTotal) return true;
  return cartTotalBeforeTier >= minTotal;
}

function calcItemPrice(product, unit, tier, cartTotalBeforeTier) {
  const base = getProductBasePrice(product, unit);
  const tierPrice = getTierPrice(product, unit, tier);
  if (tierPrice > 0 && tierEligibleForCart(tier, cartTotalBeforeTier)) return tierPrice;
  return base;
}

function loadStoredState() {
  try {
    const cart = JSON.parse(localStorage.getItem(STORAGE_KEYS.cart) || "[]");
    const selectedTier = JSON.parse(localStorage.getItem(STORAGE_KEYS.tier) || "null");
    const user = JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || "null");
    state.cart = Array.isArray(cart) ? cart : [];
    state.selectedTier = selectedTier && typeof selectedTier === "object" ? selectedTier : null;
    state.user = user && typeof user === "object" ? user : null;
  } catch (_) {
    state.cart = [];
    state.selectedTier = null;
    state.user = null;
  }
}

function saveStoredState() {
  localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(state.cart));
  localStorage.setItem(STORAGE_KEYS.tier, JSON.stringify(state.selectedTier));
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(state.user));
}

function unitLabel(unit) {
  if (unit === "carton") return "كرتون";
  if (unit === "pack") return "دستة";
  if (unit === "piece") return "قطعة";
  return unit;
}

function money(v) {
  const n = Number(v) || 0;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n) + " ج.م";
}

function setMessage(text, persist = false) {
  els.smartMessage.textContent = text;
  if (persist) localStorage.setItem(STORAGE_KEYS.lastMsg, text);
}

function cycleMessage() {
  if (!smartMessages.length) return;
  state.smartIndex = (state.smartIndex + 1) % smartMessages.length;
  setMessage(smartMessages[state.smartIndex]);
}

function flashMessage(text, duration = 2600) {
  setMessage(text, true);
  clearTimeout(state.messageTimer);
  state.messageTimer = setTimeout(() => {
    cycleMessage();
  }, duration);
}

function showToast(text) {
  els.toast.textContent = text;
  els.toast.classList.remove("hidden");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => els.toast.classList.add("hidden"), 2400);
}

function setView(view) {
  const home = view === "home";
  els.homeView.classList.toggle("active", home);
  els.productsView.classList.toggle("active", !home);
}

function updateCartCount() {
  const count = state.cart.reduce((sum, item) => sum + item.qty, 0);
  els.cartCount.textContent = String(count);
  els.checkoutFab.textContent = count ? `إتمام الطلب (${count})` : "إتمام الطلب";
}

function getSelectedUnit(productId) {
  return state.units[productId] || "";
}

function setSelectedUnit(productId, unit) {
  if (!unit) {
    delete state.units[productId];
  } else {
    state.units[productId] = unit;
  }
  renderActiveView();
}

function filterProductsByCompany() {
  if (!state.activeCompany) return [];
  return state.products.filter((p) => compactKey(p.company) === compactKey(state.activeCompany));
}

function getActiveCategoryList(products) {
  const categories = uniqueBy(
    products
      .map((p) => safeText(p.category, "بدون تصنيف"))
      .filter(Boolean)
      .map((name) => ({ name, key: compactKey(name) })),
    (item) => item.key
  );
  return categories.sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

function renderCompanies() {
  const query = normalizeText(state.search);
  const filtered = state.companies.filter((c) => {
    if (!query) return true;
    return normalizeText(c.name).includes(query);
  });

  els.companiesCount.textContent = `${filtered.length} شركة`;
  els.companiesGrid.innerHTML = filtered.map((company) => `
    <button class="company-card" data-company="${encodeURIComponent(company.name)}">
      ${company.image ? `<img class="avatar" src="${company.image}" alt="${company.name}" loading="lazy">` : `<div class="avatar" aria-hidden="true"></div>`}
      <div style="width:100%">
        <h4>${company.name}</h4>
        <div class="small-stack">
          <span class="badge">${company.count} صنف</span>
          <span class="meta">${company.hasOffers ? "عرض متاح" : " "}</span>
        </div>
      </div>
    </button>
  `).join("");

  els.offersSection.classList.toggle("hidden", !state.offers.length && !state.flashOffers.length);
  if (state.offers.length || state.flashOffers.length) {
    const merged = [...state.flashOffers, ...state.offers].slice(0, 8);
    els.offersStrip.innerHTML = merged.map((offer) => {
      const title = safeText(pick(offer, ["name", "title", "اسم", "اسم العرض"]), "عرض");
      const desc = safeText(pick(offer, ["description", "details", "الوصف", "تفاصيل"]), "");
      const img = safeText(pick(offer, ["image", "image_offer", "offer_image", "صورة", "image_product"]), "");
      return `
        <div class="offer-card">
          ${img ? `<img class="offer-image" src="${img}" alt="${title}" loading="lazy">` : `<div class="offer-image"></div>`}
          <h4>${title}</h4>
          <p>${desc || "متاح الآن داخل النظام"}</p>
        </div>
      `;
    }).join("");
  }
}

function renderCategories(products) {
  const cats = getActiveCategoryList(products);
  const buttons = [
    { name: "الكل", key: "all" },
    ...cats
  ];
  els.categoryBar.innerHTML = buttons.map((cat) => `
    <button class="chip ${state.activeCategory === cat.key ? "active" : ""}" data-category="${cat.key}">
      ${cat.name}
    </button>
  `).join("");
}

function getCompanyProducts() {
  const list = filterProductsByCompany().filter((p) => isVisibleRow(p));
  const query = normalizeText(state.search);
  const categoryKey = state.activeCategory;

  return list.filter((p) => {
    const matchesQuery = !query || [
      p.name, p.company, p.category, p.product_image, p.company_image
    ].some((value) => normalizeText(value).includes(query));
    const matchesCategory = categoryKey === "all" || compactKey(p.category) === categoryKey;
    return matchesQuery && matchesCategory;
  });
}

function renderProducts() {
  if (!state.activeCompany) return;
  const products = getCompanyProducts();

  els.currentCompanyName.textContent = state.activeCompany;
  els.currentCompanyMeta.textContent = `${products.length} صنف`;
  renderCategories(filterProductsByCompany());

  els.emptyProducts.classList.toggle("hidden", products.length !== 0);
  els.productsGrid.innerHTML = products.map((product) => {
    const id = product.id;
    const unit = getSelectedUnit(id);
    const price = unit ? calcItemPrice(product, unit, state.selectedTier, currentBaseCartTotal()) : 0;
    const disabled = !isActiveStatus(product) || (unit && price <= 0);
    const companyLogo = safeText(product.image_company, "");
    const productImg = safeText(product.image_product, "");
    return `
      <article class="card ${disabled ? "disabled" : ""}" data-product-id="${encodeURIComponent(id)}">
        ${productImg ? `<img class="product-image" src="${productImg}" alt="${product.name}" loading="lazy">` : `<div class="product-image"></div>`}
        <div class="card-top">
          <div class="info">
            <h4>${product.name}</h4>
            <div class="logo-row">
              ${companyLogo ? `<img class="logo-mini" src="${companyLogo}" alt="${product.company}" loading="lazy">` : `<div class="logo-mini"></div>`}
              <span class="meta">${product.company || "بدون شركة"}</span>
            </div>
          </div>
          <div class="price">${unit ? (price > 0 ? money(price) : "غير متاح") : "اختر الوحدة"}</div>
        </div>
        <div class="badge">${product.category || "بدون تصنيف"}</div>
        <div class="unit-tabs">
          <button class="unit-btn ${unit === "carton" ? "active" : ""}" data-unit="carton" data-product="${encodeURIComponent(id)}">كرتون</button>
          <button class="unit-btn ${unit === "pack" ? "active" : ""}" data-unit="pack" data-product="${encodeURIComponent(id)}">دستة</button>
          <button class="unit-btn ${unit === "piece" ? "active" : ""}" data-unit="piece" data-product="${encodeURIComponent(id)}">قطعة</button>
        </div>
        <button class="add-btn" data-add-product="${encodeURIComponent(id)}" ${unit && price > 0 ? "" : "disabled"}>أضف للسلة</button>
      </article>
    `;
  }).join("");

  updateViewPricingBadges();
}

function updateViewPricingBadges() {
  const cards = [...document.querySelectorAll("[data-product-id]")];
  for (const card of cards) {
    const id = decodeURIComponent(card.getAttribute("data-product-id") || "");
    const product = state.products.find((p) => productIdOf(p) === id);
    if (!product) continue;
    const unit = getSelectedUnit(id);
    const priceEl = card.querySelector(".price");
    const addBtn = card.querySelector(".add-btn");
    const unitButtons = card.querySelectorAll(".unit-btn");
    if (priceEl) priceEl.textContent = unit ? money(calcItemPrice(product, unit, state.selectedTier, currentBaseCartTotal())) : "اختر الوحدة";
    if (addBtn) addBtn.disabled = !unit || !isActiveStatus(product) || (unit && calcItemPrice(product, unit, state.selectedTier, currentBaseCartTotal()) <= 0);
    unitButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.unit === unit));
  }
}

function renderHomeOrProducts() {
  if (!state.activeCompany) {
    setView("home");
    renderCompanies();
  } else {
    setView("products");
    renderProducts();
  }
}

function renderActiveView() {
  updateCartCount();
  renderHomeOrProducts();
  renderCart();
  updateTierButton();
}

function currentBaseCartTotal() {
  return state.cart.reduce((sum, item) => {
    const product = state.products.find((p) => productIdOf(p) === item.productId);
    if (!product) return sum;
    const basePrice = product ? getProductBasePrice(product, item.unit) : 0;
    return sum + basePrice * item.qty;
  }, 0);
}

function computeCartTotal() {
  const baseTotal = currentBaseCartTotal();
  return state.cart.map((item) => {
    const product = state.products.find((p) => productIdOf(p) === item.productId);
    const unitPrice = product ? calcItemPrice(product, item.unit, state.selectedTier, baseTotal) : 0;
    const lineTotal = unitPrice * item.qty;
    return { ...item, product, unitPrice, lineTotal };
  });
}

function renderCart() {
  const items = computeCartTotal();
  const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
  els.cartTotal.textContent = money(total);

  if (!items.length) {
    els.cartHint.textContent = "السلة فاضية... نختار شوية";
    els.cartItems.innerHTML = `
      <div class="empty-state" style="margin-top:0">
        <div class="empty-icon">🧺</div>
        <h3>السلة فاضية</h3>
        <p>اضف أصناف من المنتجات لبدء الطلب.</p>
      </div>
    `;
    return;
  }

  els.cartHint.textContent = `${items.length} صنف داخل السلة`;
  els.cartItems.innerHTML = items.map((item) => `
    <div class="cart-item" data-cart-key="${encodeURIComponent(item.productId + "|" + item.unit)}">
      <div>
        <h4>${item.product?.name || "صنف"}</h4>
        <div class="sub">${unitLabel(item.unit)} • ${item.product?.company || ""} • ${money(item.unitPrice)}</div>
      </div>
      <div class="qty-controls">
        <button class="qty-btn" data-qty="-1">−</button>
        <strong>${item.qty}</strong>
        <button class="qty-btn" data-qty="1">+</button>
      </div>
      <div class="sub" style="grid-column:1/-1;text-align:left">${money(item.lineTotal)}</div>
    </div>
  `).join("");
}

function updateTierButton() {
  if (!state.selectedTier) {
    els.tierButton.textContent = "اختيار";
    return;
  }
  els.tierButton.textContent = state.selectedTier.visible_label || state.selectedTier.tier_name || "شريحة";
}

function saveCart() {
  saveStoredState();
  updateCartCount();
}

function addToCart(productId, unit) {
  const product = state.products.find((p) => productIdOf(p) === productId);
  if (!product) return;

  if (!unit) {
    showToast("اختار الوحدة أولًا");
    flashMessage("اختار الوحدة الأول");
    return;
  }

  if (!isActiveStatus(product)) {
    showToast("هذا الصنف غير متاح");
    return;
  }

  const priceCheck = calcItemPrice(product, unit, state.selectedTier, currentBaseCartTotal());
  if (priceCheck <= 0) {
    showToast("لا يوجد سعر متاح لهذه الوحدة");
    return;
  }

  const index = state.cart.findIndex((item) => item.productId === productId && item.unit === unit);
  if (index >= 0) {
    state.cart[index].qty += 1;
  } else {
    state.cart.push({ productId, unit, qty: 1 });
  }

  saveCart();
  renderCart();
  renderActiveView();
  showToast("تمت الإضافة للسلة");
  flashMessage("حلو كده 👌 كمل");
}

function changeQty(cartKey, delta) {
  const [productId, unit] = cartKey.split("|");
  const index = state.cart.findIndex((item) => item.productId === productId && item.unit === unit);
  if (index < 0) return;
  state.cart[index].qty += delta;
  if (state.cart[index].qty <= 0) state.cart.splice(index, 1);
  saveCart();
  renderCart();
  renderActiveView();
  if (!state.cart.length) flashMessage("السلة فاضية... نختار شوية");
}

function openDrawer() {
  els.overlay.classList.remove("hidden");
  els.cartDrawer.classList.add("open");
}

function closeDrawer() {
  els.overlay.classList.add("hidden");
  els.cartDrawer.classList.remove("open");
}

function openModal(modalEl) {
  els.overlay.classList.remove("hidden");
  modalEl.classList.remove("hidden");
}

function closeModal(modalEl) {
  modalEl.classList.add("hidden");
  if (!els.cartDrawer.classList.contains("open")) {
    els.overlay.classList.add("hidden");
  }
}

function getFilteredProductsForCompany(companyName) {
  return state.products.filter((p) => compactKey(p.company) === compactKey(companyName) && isVisibleRow(p));
}

function selectCompany(companyName) {
  state.activeCompany = companyName;
  state.activeCategory = "all";
  const products = getFilteredProductsForCompany(companyName);
  const company = state.companies.find((c) => normalizeText(c.name) === normalizeText(companyName));
  els.currentCompanyName.textContent = companyName;
  els.currentCompanyMeta.textContent = `${products.length} صنف`;
  flashMessage("اختار صنفك بسرعة");
  renderActiveView();
  setView("products");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function goHome() {
  state.activeCompany = null;
  state.activeCategory = "all";
  setView("home");
  renderActiveView();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function buildCompanies() {
  const visibleProducts = state.products.filter((p) => isVisibleRow(p));
  const companies = uniqueBy(
    visibleProducts
      .map((p) => ({
        name: safeText(p.company, ""),
        image: safeText(p.image_company, "") || safeText(p.company_image, ""),
      }))
      .filter((x) => x.name),
    (x) => compactKey(x.name)
  ).map((company) => ({
    ...company,
    products: visibleProducts.filter((p) => normalizeText(p.company) === normalizeText(company.name)),
  }));

  state.companies = companies.map((company) => ({
    name: company.name,
    image: company.image,
    count: company.products.length,
    hasOffers: false,
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ar"));
}

function buildTierRecord(row, index) {
  const tierName = safeText(pick(row, ["tier_name", "tier", "name", "اسم الشريحة"]), `Tier ${index + 1}`);
  const visibleLabel = safeText(pick(row, ["visible_label", "label", "display_name", "الاسم الظاهر"]), tierName);
  const password = safeText(pick(row, ["password", "tier_password", "tier pass", "كلمة المرور"]), "");
  const minTotal = toNumber(pick(row, ["min_total", "minimum_total", "min order", "حد ادنى", "min_price"]));
  const description = safeText(pick(row, ["description", "desc", "الوصف"]), "");
  const conditions = safeText(pick(row, ["conditions", "condition", "الشروط"]), "");
  const status = isActiveStatus(row);
  return {
    key: compactKey(`${tierName}|${visibleLabel}|${index}`),
    tier_name: tierName,
    visible_label: visibleLabel,
    password,
    min_total: minTotal,
    description,
    conditions,
    status,
  };
}

function buildProductRecord(row, index) {
  buildNormMap(row);
  const name = safeText(pick(row, ["name", "اسم الصنف", "product_name", "item_name", "اسم المنتج", "الصنف"]), `صنف ${index + 1}`);
  const company = safeText(pick(row, ["company", "brand", "brand_name", "company_name", "الشركة", "الماركة"]), "");
  const category = safeText(pick(row, ["category", "category_name", "section", "type", "الفئة", "التصنيف", "القسم"]), "");
  const image_product = safeText(pick(row, ["image_product", "product_image", "image", "img", "صورة", "صورة المنتج"]), "");
  const image_company = safeText(pick(row, ["image_company", "company_logo", "brand_logo", "logo", "صورة الشركة", "شعار الشركة"]), "");
  const visible = isVisibleRow(row);
  const status = isActiveStatus(row);
  const base_carton = toNumber(pick(row, ["base_carton", "carton_price", "price_carton", "carton", "سعر الكرتون", "سعر كرتون"]));
  const base_pack = toNumber(pick(row, ["base_pack", "pack_price", "price_pack", "pack", "سعر الدستة", "سعر دستة"]));
  const base_piece = toNumber(pick(row, ["base_piece", "piece_price", "price_piece", "piece", "سعر القطعة", "سعر القطعه"]));

  return {
    ...row,
    id: safeText(pick(row, ["id", "product_id", "sku", "code", "كود", "رقم", "item_id"]), `${compactKey(company)}-${compactKey(name)}-${index}`),
    name,
    company,
    category,
    image_product,
    image_company,
    visible,
    status,
    base_carton,
    base_pack,
    base_piece,
  };
}

function buildCustomerRecord(row, index) {
  buildNormMap(row);
  return {
    ...row,
    name: safeText(pick(row, ["name", "customer_name", "اسم العميل", "الاسم"]), `Customer ${index + 1}`),
    phone: safeText(pick(row, ["phone", "mobile", "tel", "رقم الموبايل", "رقم الهاتف"]), ""),
    password: safeText(pick(row, ["password", "pass", "كلمة المرور"]), ""),
    tier_name: safeText(pick(row, ["tier_name", "tier", "الشريحة"]), ""),
    active: isActiveStatus(row),
  };
}

function buildRepRecord(row, index) {
  buildNormMap(row);
  return {
    ...row,
    name: safeText(pick(row, ["name", "rep_name", "اسم المندوب", "الاسم"]), `Rep ${index + 1}`),
    rep_id: safeText(pick(row, ["rep_id", "id", "code", "login_code", "كود", "الكود"]), ""),
    login_code: safeText(pick(row, ["login_code", "code", "rep_code", "كود الدخول", "كود"]), ""),
    password: safeText(pick(row, ["password", "pass", "كلمة المرور"]), ""),
    tier_name: safeText(pick(row, ["tier_name", "tier", "الشريحة"]), ""),
    active: isActiveStatus(row),
  };
}

function buildOfferRecord(row, index) {
  buildNormMap(row);
  return {
    ...row,
    id: safeText(pick(row, ["id", "offer_id", "code"]), `offer-${index + 1}`),
    name: safeText(pick(row, ["name", "title", "offer_name", "اسم", "اسم العرض"]), `Offer ${index + 1}`),
    description: safeText(pick(row, ["description", "details", "الوصف"]), ""),
    image: safeText(pick(row, ["image", "offer_image", "image_offer", "صورة", "image_product"]), ""),
    active: isActiveStatus(row),
  };
}

function prepareData(data) {
  state.products = mapRows((data.products || []).map(buildProductRecord).filter((p) => p.name && p.company && p.visible));
  state.categories = mapRows(data.categories || []);
  state.customers = mapRows((data.customers || []).map(buildCustomerRecord));
  state.reps = mapRows((data.reps || []).map(buildRepRecord));
  state.orders = mapRows(data.orders || []);
  state.orderItems = mapRows(data.orderItems || []);
  state.offers = mapRows((data.offers || []).map(buildOfferRecord));
  state.flashOffers = mapRows((data.flashOffers || []).map(buildOfferRecord));
  state.tiers = mapRows(data.tiers || []).map(buildTierRecord).filter((tier) => tier.status);

  buildCompanies();
  loadStoredState();

  if (!state.selectedTier && state.tiers.length) {
    const stored = null;
    state.selectedTier = stored;
  }

  if (!state.products.length) {
    els.companyTitle.textContent = "البيانات غير متاحة";
  }
}

function findTierByKey(key) {
  const k = compactKey(key);
  return state.tiers.find((tier) => tier.key === k || compactKey(tier.tier_name) === k || compactKey(tier.visible_label) === k) || null;
}

function renderTierModal() {
  if (!state.tiers.length) {
    els.tiersList.innerHTML = `
      <div class="empty-state" style="margin-top:0">
        <div class="empty-icon">🏷️</div>
        <h3>لا توجد شرائح متاحة</h3>
        <p>سيتم استخدام السعر الأساسي.</p>
      </div>
    `;
    return;
  }

  els.tiersList.innerHTML = state.tiers.map((tier) => {
    const active = state.selectedTier && compactKey(state.selectedTier.key) === compactKey(tier.key);
    const needsPassword = !!tier.password;
    return `
      <div class="tier-card ${active ? "active" : ""}" data-tier-key="${tier.key}">
        <div style="flex:1">
          <h4>${tier.visible_label}</h4>
          <p>${tier.description || "شريحة أسعار"}</p>
          ${tier.conditions ? `<p>${tier.conditions}</p>` : ""}
          ${tier.min_total ? `<p>حد أدنى: ${money(tier.min_total)}</p>` : ""}
          ${needsPassword ? `<input class="tier-pass" data-tier-pass="${tier.key}" type="password" placeholder="كلمة مرور الشريحة" style="margin-top:8px;width:100%;height:44px;border:1px solid #e2e8f0;border-radius:14px;padding:0 12px">` : ""}
        </div>
        <button data-tier-select="${tier.key}">${active ? "مفعلة" : "اختيار"}</button>
      </div>
    `;
  }).join("");
}

function updateTierSelection(key, password = "") {
  const tier = findTierByKey(key);
  if (!tier) return false;
  if (tier.password && normalizeText(password) !== normalizeText(tier.password)) {
    showToast("كلمة مرور الشريحة غير صحيحة");
    return false;
  }
  state.selectedTier = tier;
  saveStoredState();
  updateTierButton();
  renderActiveView();
  showToast(`تم تفعيل ${tier.visible_label}`);
  return true;
}

function getUserByLogin(type, loginValue, password) {
  if (type === "customer") {
    return state.customers.find((c) => normalizeText(c.phone) === normalizeText(loginValue) && normalizeText(c.password) === normalizeText(password) && c.active) || null;
  }
  return state.reps.find((r) => (
    normalizeText(r.login_code || r.rep_id) === normalizeText(loginValue) &&
    normalizeText(r.password) === normalizeText(password) &&
    r.active
  )) || null;
}

function openLoginModal() {
  openModal(els.loginModal);
  document.querySelector('[data-login-tab="customer"]').classList.add("active");
  document.querySelector('[data-login-tab="rep"]').classList.remove("active");
  els.customerLoginForm.classList.add("active");
  els.repLoginForm.classList.remove("active");
}

function finalizeOrder() {
  const items = computeCartTotal().map((item) => ({
    product_id: item.productId,
    product_name: item.product?.name || "",
    company: item.product?.company || "",
    category: item.product?.category || "",
    unit: item.unit,
    qty: item.qty,
    unit_price: item.unitPrice,
    total: item.lineTotal,
  }));

  const total = items.reduce((sum, item) => sum + item.total, 0);

  const payload = {
    phone: state.user?.phone || "",
    rep_id: state.user?.rep_id || "",
    items,
    total,
  };

  const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.orders) || "[]");
  history.push(payload);
  localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(history));
  localStorage.setItem("alahram_last_order_v1", JSON.stringify(payload));

  state.cart = [];
  saveCart();
  renderCart();
  renderActiveView();
  closeDrawer();
  closeModal(els.loginModal);
  flashMessage("تم تجهيز الطلب وحفظه محليًا");
  showToast("تم حفظ الطلب محليًا");
  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).catch(() => {});
  }
}

function handleCheckout() {
  if (!state.cart.length) {
    flashMessage("السلة فاضية... نختار شوية");
    showToast("السلة فاضية");
    return;
  }
  flashMessage("فاضلك خطوة وتقفلها 🔥");
  if (state.user) {
    finalizeOrder();
    return;
  }
  openLoginModal();
}

function addHomeListeners() {
  els.cartButton.addEventListener("click", () => {
    renderCart();
    openDrawer();
  });
  els.closeCart.addEventListener("click", closeDrawer);
  els.overlay.addEventListener("click", () => {
    closeDrawer();
    closeModal(els.loginModal);
    closeModal(els.tierModal);
  });
  els.backButton.addEventListener("click", goHome);

  els.checkoutButton.addEventListener("click", handleCheckout);
  els.checkoutFab.addEventListener("click", handleCheckout);

  els.searchInput.addEventListener("input", (e) => {
    state.search = e.target.value;
    if (!state.activeCompany) renderCompanies(); else renderProducts();
  });
  els.clearSearch.addEventListener("click", () => {
    state.search = "";
    els.searchInput.value = "";
    if (!state.activeCompany) renderCompanies(); else renderProducts();
  });

  document.body.addEventListener("click", (e) => {
    const companyBtn = e.target.closest("[data-company]");
    if (companyBtn) {
      const companyName = decodeURIComponent(companyBtn.dataset.company || "");
      selectCompany(companyName);
      return;
    }

    const categoryBtn = e.target.closest("[data-category]");
    if (categoryBtn) {
      state.activeCategory = categoryBtn.dataset.category || "all";
      renderProducts();
      return;
    }

    const unitBtn = e.target.closest("[data-unit]");
    if (unitBtn) {
      const productId = decodeURIComponent(unitBtn.dataset.product || "");
      const unit = normalizeUnit(unitBtn.dataset.unit || "");
      setSelectedUnit(productId, unit);
      return;
    }

    const addBtn = e.target.closest("[data-add-product]");
    if (addBtn) {
      const productId = decodeURIComponent(addBtn.dataset.addProduct || "");
      const unit = getSelectedUnit(productId);
      addToCart(productId, unit);
      return;
    }

    const qtyBtn = e.target.closest("[data-qty]");
    if (qtyBtn) {
      const item = e.target.closest("[data-cart-key]");
      if (!item) return;
      changeQty(decodeURIComponent(item.dataset.cartKey || ""), toInt(qtyBtn.dataset.qty));
      return;
    }

    const closeBtn = e.target.closest("[data-close]");
    if (closeBtn) {
      const id = closeBtn.dataset.close;
      if (id === "loginModal") closeModal(els.loginModal);
      if (id === "tierModal") closeModal(els.tierModal);
      return;
    }

    const tierSelectBtn = e.target.closest("[data-tier-select]");
    if (tierSelectBtn) {
      const tierKey = tierSelectBtn.dataset.tierSelect || "";
      const card = tierSelectBtn.closest(".tier-card");
      const passInput = card?.querySelector(`[data-tier-pass="${tierKey}"]`);
      const password = passInput ? passInput.value : "";
      const ok = updateTierSelection(tierKey, password);
      if (ok) closeModal(els.tierModal);
      return;
    }
  });

  els.tierButton.addEventListener("click", () => {
    renderTierModal();
    openModal(els.tierModal);
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      tab.classList.add("active");
      const isCustomer = tab.dataset.loginTab === "customer";
      els.customerLoginForm.classList.toggle("active", isCustomer);
      els.repLoginForm.classList.toggle("active", !isCustomer);
    });
  });

  els.customerLoginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = new FormData(els.customerLoginForm);
    const phone = String(form.get("phone") || "").trim();
    const password = String(form.get("password") || "").trim();
    const user = getUserByLogin("customer", phone, password);
    if (!user) {
      showToast("بيانات العميل غير صحيحة");
      return;
    }
    state.user = { type: "customer", phone: user.phone, name: user.name, tier_name: user.tier_name || "" };
    saveStoredState();
    closeModal(els.loginModal);
    finalizeOrder();
  });

  els.repLoginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = new FormData(els.repLoginForm);
    const login_code = String(form.get("login_code") || "").trim();
    const password = String(form.get("password") || "").trim();
    const rep = getUserByLogin("rep", login_code, password);
    if (!rep) {
      showToast("بيانات المندوب غير صحيحة");
      return;
    }
    state.user = { type: "rep", phone: rep.phone || "", rep_id: rep.rep_id || rep.login_code || "", name: rep.name, tier_name: rep.tier_name || "" };
    saveStoredState();
    closeModal(els.loginModal);
    finalizeOrder();
  });
}

function applyRememberedTier() {
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.tier) || "null");
  if (stored && typeof stored === "object" && stored.key) {
    const tier = findTierByKey(stored.key);
    state.selectedTier = tier || null;
  } else {
    state.selectedTier = null;
  }
}

async function init() {
  loadStoredState();
  try {
    const data = await fetchData();
    prepareData({
      products: mapRows(data.products),
      categories: mapRows(data.categories),
      customers: mapRows(data.customers),
      reps: mapRows(data.reps),
      orders: mapRows(data.orders),
      orderItems: mapRows(data.orderItems),
      offers: mapRows(data.offers),
      flashOffers: mapRows(data.flashOffers),
      tiers: mapRows(data.tiers),
    });
    applyRememberedTier();
    state.loading = false;
    els.loadingScreen.classList.add("hidden");
    renderTierModal();
    renderActiveView();
    addHomeListeners();
    setMessage(localStorage.getItem(STORAGE_KEYS.lastMsg) || smartMessages[0], true);
    setInterval(cycleMessage, 4500);
    if (!state.activeCompany) {
      renderCompanies();
      setView("home");
    }
  } catch (error) {
    console.error(error);
    els.loadingScreen.innerHTML = `
      <div class="empty-state" style="background:transparent;border:none;box-shadow:none">
        <div class="empty-icon">⚠️</div>
        <h3>تعذر تحميل البيانات</h3>
        <p>راجع روابط الشيت/API ثم أعد فتح الصفحة.</p>
      </div>
    `;
  }
}

window.addEventListener("DOMContentLoaded", init);

window.addEventListener("storage", (e) => {
  if ([STORAGE_KEYS.cart, STORAGE_KEYS.tier, STORAGE_KEYS.user].includes(e.key)) {
    loadStoredState();
    renderActiveView();
  }
});
