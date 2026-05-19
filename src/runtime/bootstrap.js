import { readConfig } from '../core/config.js';
import { dom } from '../core/dom.js';
import { parseRoute, navigate } from '../core/router.js';
import { createEmitter, createRenderLoop } from '../core/events.js';
import { createStore } from '../state/store.js';
import { createInitialState } from '../state/defaultState.js';
import { computeCartTotals, getSelectedTier } from '../state/selectors.js';
import { createApiClient } from '../services/apiClient.js';
import { loadHomeCatalog, loadCompanyCatalog, loadProductsByIds, aggregateRuntimeProducts, projectRuntimeProducts } from '../services/catalogService.js';
import { restoreAuthRuntimeState } from './modules/authRuntime.js';
import { buildPriceBook, persistSelectedTier, resolveProductUnit, syncCartPrices, normalizeTierName } from '../services/pricingService.js';
import { addProductToCart, clearCart, computeTotals, hydrateCart, persistCart, recalcCart, removeItem, toggleOfferInCart, updateQty } from '../services/cartService.js';
import { login, logout, registerCustomer, normalizeUserType, normalizeSessionRecord, getOwnershipActorId, hasCapability, persistSessionRecord, readPersistedSession, canAccessCustomerManagement, canAccessOperationalDashboard, refreshSessionProjection, isSalesRepSession, isAdminOnlySession } from '../services/authService.js';
import { createCustomer, persistSelectedCustomer } from '../services/customerService.js';
import { loadManagerScopeIntoState, hasOperationalAccess, getDefaultOperationalModule, isOperationalModuleReady } from '../services/managerService.js';
import { canOpenOpsWorkspace } from '../services/opsDashboardService.js';
import { renderOpsNavigation } from '../layout/opsNavigation.js';
import { loadWorkflowRuntime, applyWorkflowTransition, resolveWorkflowActions } from '../services/workflowService.js';
import { computeFlashState } from '../services/offerService.js';
import { validateCheckout, submitOrder } from '../services/orderService.js';
import { buildWhatsAppInvoice, formatMoney, formatStatus, persistInvoices } from '../services/invoiceService.js';
import { appendBehaviorEvent, writeUiEvent } from '../services/analyticsService.js';
import { shellTemplate, minimalShellTemplate, repShellTemplate } from '../layout/shell.js';
import { adminShellTemplate } from '../layout/adminShell.js';
import { renderAdminHeader, renderAdminSidebar } from '../layout/adminNavigation.js';
import { renderAdminDashboardPage } from '../pages/adminDashboardPage.js';
import { renderHeader } from '../layout/header.js';
import { renderSearchBar } from '../layout/searchBar.js';
import { renderBanner } from '../layout/banner.js';
import { renderThemeSwitcher, AVAILABLE_THEMES } from '../layout/themeSwitcher.js';
import { renderHero } from '../layout/hero.js';
import { renderFooter } from '../layout/footer.js';
import { renderFloatingExecutionBar, shouldRenderFloatingExecutionBar } from '../layout/floatingExecutionBar.js';
import { renderLoginModal, renderCustomerModal, renderProductModal, renderInvoiceModal } from '../layout/modals.js';
import { renderDrawer, renderToasts } from '../layout/overlays.js';
import { renderHomePage } from '../pages/homePage.js';
import { renderOpsDashboardPage } from '../pages/opsDashboardPage.js';
import { renderRepDashboardPage } from '../pages/repDashboardPage.js';
import { renderRepCustomersPage } from '../pages/repCustomersPage.js';
import { renderRepOrdersPage } from '../pages/repOrdersPage.js';
import { renderRepInvoicesPage } from '../pages/repInvoicesPage.js';
import { renderRepNavigation } from '../layout/repNavigation.js';
import { loadRepCustomers, loadRepOrders } from '../services/repService.js';
import { renderSearchPage } from '../pages/searchPage.js';
import { renderCompaniesPage, renderCompanyPage } from '../pages/companiesPage.js';
import { renderOffersPage } from '../pages/offersPage.js';
import { renderTiersPage } from '../pages/tiersPage.js';
import { renderCartPage, renderCheckoutPage, renderInvoicePage } from '../pages/cartCheckoutPages.js';
import { renderLoginPage, renderRegisterPage } from '../pages/authPages.js';
import { renderCustomersPage, renderInvoicesPage, renderAccountPage } from '../pages/customerPages.js';
import { loadOpsProducts, createOpsProduct, updateOpsProduct, deleteOpsProduct, toggleOpsProductActive, toggleOpsProductVisibility, updateOpsProductUnitStock, updateOpsProductUnitPrice } from '../services/productOpsService.js';
import { storageKeys, removeValue, purgeLegacyStorage, loadJSON } from '../core/storage.js';

function createInitialData() {
  return createInitialState();
}

function createEmptyCatalog() {
  return {
    companies: [],
    products: [],
    productIndex: {},
    offers: { daily: [], flash: [] },
    tiers: [],
    settings: [],
    settingsMap: {},
    top: { products: [], companies: [] },
    counters: { companies: 0, tiers: 0, deals: 0, flash: 0 },
    catalogProducts: [],
    invoiceItemsById: {},
  };
}

const SEARCH_DEBOUNCE_MS = 900;

const RUNTIME_PHASES = {
  BOOTING: 'booting',
  RESTORING_SESSION: 'restoring_session',
  RESOLVING_AUTHORITY: 'resolving_authority',
  HYDRATING_RUNTIME: 'hydrating_runtime',
  SYNCING_CART: 'syncing_cart',
  READY: 'runtime_ready',
  FAILED: 'runtime_failed',
};

const companyHydrationTokens = new Map();

function isNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function isNonEmptyObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
}

function cloneCatalogSnapshot(catalog) {
  const safe = catalog && typeof catalog === 'object' ? catalog : {};
  return {
    ...createEmptyCatalog(),
    ...safe,
    offers: {
      daily: Array.isArray(safe.offers?.daily) ? safe.offers.daily : [],
      flash: Array.isArray(safe.offers?.flash) ? safe.offers.flash : [],
    },
    top: {
      products: Array.isArray(safe.top?.products) ? safe.top.products : [],
      companies: Array.isArray(safe.top?.companies) ? safe.top.companies : [],
    },
  };
}

function mergeCatalogSnapshots(cachedCatalog, liveCatalog) {
  const cached = cloneCatalogSnapshot(cachedCatalog);
  const live = cloneCatalogSnapshot(liveCatalog);
  const mergedCompanies = isNonEmptyArray(live.companies) ? live.companies : cached.companies;
  const mergedProducts = isNonEmptyArray(live.products) ? live.products : cached.products;
  const mergedProductIndex = isNonEmptyObject(live.productIndex) ? live.productIndex : cached.productIndex;
  const mergedDaily = isNonEmptyArray(live.offers.daily) ? live.offers.daily : cached.offers.daily;
  const mergedFlash = isNonEmptyArray(live.offers.flash) ? live.offers.flash : cached.offers.flash;
  const mergedTiers = isNonEmptyArray(live.tiers) ? live.tiers : cached.tiers;
  const mergedSettings = isNonEmptyArray(live.settings) ? live.settings : cached.settings;
  const mergedSettingsMap = isNonEmptyObject(live.settingsMap) ? live.settingsMap : cached.settingsMap;
  const mergedTopProducts = isNonEmptyArray(live.top.products) ? live.top.products : cached.top.products;
  const mergedTopCompanies = isNonEmptyArray(live.top.companies) ? live.top.companies : cached.top.companies;
  const mergedCatalogProducts = isNonEmptyArray(live.catalogProducts) ? live.catalogProducts : cached.catalogProducts;

  return {
    companies: mergedCompanies,
    products: mergedProducts,
    productIndex: mergedProductIndex,
    offers: { daily: mergedDaily, flash: mergedFlash },
    tiers: mergedTiers,
    settings: mergedSettings,
    settingsMap: mergedSettingsMap,
    top: { products: mergedTopProducts, companies: mergedTopCompanies },
    counters: {
      companies: mergedCompanies.length,
      tiers: mergedTiers.length,
      deals: mergedDaily.length,
      flash: mergedFlash.length,
    },
    catalogProducts: mergedCatalogProducts,
    invoiceItemsById: {},
  };
}

function catalogHasMeaningfulData(catalog) {
  return Boolean(catalog)
    && (
      isNonEmptyArray(catalog.products)
      || isNonEmptyArray(catalog.companies)
      || isNonEmptyArray(catalog.tiers)
      || isNonEmptyArray(catalog.catalogProducts)
      || isNonEmptyArray(catalog.top?.products)
      || isNonEmptyArray(catalog.top?.companies)
      || isNonEmptyArray(catalog.settings)
      || isNonEmptyArray(catalog.offers?.daily)
      || isNonEmptyArray(catalog.offers?.flash)
    );
}

function isRuntimeInteractive(state) {
  return [RUNTIME_PHASES.READY, RUNTIME_PHASES.FAILED].includes(state?.runtime?.lifecycle?.phase);
}

function setRuntimeLifecycle(store, patch) {
  const current = store.getState();
  store.patch({
    runtime: {
      ...current.runtime,
      lifecycle: {
        ...current.runtime.lifecycle,
        ...patch,
      },
    },
  }, { silent: true });
}

function setRuntimePhase(store, phase, extras = {}) {
  const current = store.getState();
  store.patch({
    runtime: {
      ...current.runtime,
      lifecycle: {
        ...current.runtime.lifecycle,
        phase,
        ...extras,
      },
    },
  }, { silent: true });
}

function findCartProductItem(cart, productId) {
  return (cart || []).find((item) => item.type === 'product' && String(item.id) === String(productId));
}

function captureSearchFocus() {
  const active = document.activeElement;
  if (!active) return null;
  if (active.id === 'searchInput' || active.classList?.contains('searchbar-input')) {
    return {
      id: active.id || (active.classList?.contains('searchbar-input') ? 'searchInput' : null),
      selectionStart: Number.isInteger(active.selectionStart) ? active.selectionStart : null,
      selectionEnd: Number.isInteger(active.selectionEnd) ? active.selectionEnd : null,
      value: active.value,
    };
  }
  return null;
}

function restoreSearchFocus(snapshot) {
  if (!snapshot?.id) return;
  const input = document.getElementById(snapshot.id);
  if (!input) return;
  try {
    input.focus({ preventScroll: true });
    if (Number.isInteger(snapshot.selectionStart) && Number.isInteger(snapshot.selectionEnd) && typeof input.setSelectionRange === 'function') {
      input.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
    }
  } catch {
    // ignore focus restoration failures
  }
}

const toastTimers = new Map();
let schedulerRef = null;
let searchTypingTimer = null;

function notify(store, type, title, message, options = {}) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
  const queue = store.getState().ui.toastQueue.slice();
  queue.push({ id, type, title, message, icon: options.icon || { success: '✓', warning: '!', error: '×', info: 'i' }[type] || '•', action: options.action || null });
  while (queue.length > 4) queue.shift();
  store.patch({ ui: { ...store.getState().ui, toastQueue: queue } });
  if (schedulerRef) schedulerRef.schedule('toast');
  const duration = Math.max(1800, Number(options.duration || 3400));
  clearTimeout(toastTimers.get(id));
  toastTimers.set(id, setTimeout(() => {
    const next = store.getState().ui.toastQueue.filter((item) => item.id !== id);
    store.patch({ ui: { ...store.getState().ui, toastQueue: next } });
    if (schedulerRef) schedulerRef.schedule('toast');
    toastTimers.delete(id);
  }, duration));
}

const DEFAULT_THEME = 'vip-light-theme';
const THEME_NAMES = new Set([DEFAULT_THEME, ...AVAILABLE_THEMES.map((theme) => theme.name)]);

function setTheme(theme) {
  const next = THEME_NAMES.has(theme) ? theme : DEFAULT_THEME;
  document.body.dataset.theme = next;
}

function applyDesktopMode(enabled) {
  document.body.classList.toggle('body--desktop', enabled);
}

const DESKTOP_STYLE_ID = 'desktop-runtime-css';
function ensureDesktopCSS() {
  if (document.getElementById(DESKTOP_STYLE_ID)) return;
  const link = document.createElement('link');
  link.id = DESKTOP_STYLE_ID;
  link.rel = 'stylesheet';
  link.href = 'styles/desktop.css';
  document.head.appendChild(link);
}

function closeTransientSurfaces(store, { keepDrawer = false } = {}) {
  const current = store.getState();
  store.patch({
    ui: {
      ...current.ui,
      accountMenuOpen: false,
      activeModal: null,
      selectedInvoiceId: null,
      drawerOpen: keepDrawer ? current.ui.drawerOpen : false,
    },
  });
}

function setPendingFlow(store, flow = null) {
  const current = store.getState();
  store.patch({ ui: { ...current.ui, pendingFlow: flow } });
}

function clearPendingFlow(store) {
  setPendingFlow(store, null);
}

function navigateAuthority(store, routeName, params = {}, options = {}) {
  closeTransientSurfaces(store, { keepDrawer: Boolean(options.keepDrawer) });
  navigate(routeName, params);
}

function setCheckoutBusy(store, value) {
  const current = store.getState();
  store.patch({ ui: { ...current.ui, checkoutBusy: Boolean(value) } });
}

function resetCustomerLocationDraft(store) {
  const current = store.getState();
  store.patch({
    ui: {
      ...current.ui,
      customerLocationBusy: false,
      customerLocationError: null,
      customerLocationDraft: { text: '', lat: null, lng: null },
    },
  });
}

function commitCustomerLocationDraft(store, draft = {}) {
  const current = store.getState();
  store.patch({
    ui: {
      ...current.ui,
      customerLocationBusy: false,
      customerLocationError: null,
      customerLocationDraft: {
        text: String(draft.text || '').trim(),
        lat: draft.lat === null || draft.lat === undefined || draft.lat === '' ? null : Number(draft.lat),
        lng: draft.lng === null || draft.lng === undefined || draft.lng === '' ? null : Number(draft.lng),
      },
    },
  });
}

function rebuildLoadedCompanyCatalog(store, selectedTierOverride = null) {
  const state = store.getState();
  const selectedTier = normalizeTierName(selectedTierOverride ?? state.commerce.selectedTier);
  const caches = state.runtime.companyRowsCache || {};
  const nextIndex = { ...(state.commerce.catalog.productIndex || {}) };
  for (const rows of Object.values(caches)) {
    const aggregated = aggregateRuntimeProducts(rows);
    const projected = projectRuntimeProducts(aggregated, selectedTier);
    Object.assign(nextIndex, projected);
  }
  const products = Object.values(nextIndex).sort((a, b) => {
    const left = Number(a.units?.[a.defaultUnit]?.display_order ?? Number.POSITIVE_INFINITY);
    const right = Number(b.units?.[b.defaultUnit]?.display_order ?? Number.POSITIVE_INFINITY);
    if (left !== right) return left - right;
    return String(a.product_name).localeCompare(String(b.product_name), 'ar');
  });
  return { productIndex: nextIndex, products, priceBook: buildPriceBook(products, state.commerce.catalog.tiers || [], selectedTier) };
}

function sortLoadedProducts(productIndex) {
  return Object.values(productIndex || {}).filter((row) => row && row.visible !== false).sort((a, b) => {
    const left = Number(a.units?.[a.defaultUnit]?.display_order ?? Number.POSITIVE_INFINITY);
    const right = Number(b.units?.[b.defaultUnit]?.display_order ?? Number.POSITIVE_INFINITY);
    if (left !== right) return left - right;
    return String(a.product_name).localeCompare(String(b.product_name), 'ar');
  });
}

function buildLoadedProductSnapshot(productIndex, tiers, selectedTier) {
  const products = sortLoadedProducts(productIndex);
  return {
    productIndex: { ...(productIndex || {}) },
    products,
    priceBook: buildPriceBook(products, tiers || [], selectedTier),
  };
}

function mergeProductIndexes(...parts) {
  return Object.assign({}, ...parts.filter(Boolean));
}

async function ensureCompanyCatalogLoaded(store, api, companyId) {
  const trimmed = String(companyId ?? '').trim();
  if (!trimmed) return;
  const requestToken = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  companyHydrationTokens.set(trimmed, requestToken);
  store.update((draft) => {
    draft.runtime.loading.company = trimmed;
    draft.runtime.companyErrors[trimmed] = null;
    draft.runtime.lifecycle.companyProductsLoading = true;
    draft.runtime.lifecycle.companyProductsReady = false;
    draft.runtime.lifecycle.companyProductsFailed = false;
  }, { dirty: ['page'] });

  const cachedRows = store.getState().runtime.companyRowsCache?.[trimmed];
  if (Array.isArray(cachedRows) && cachedRows.length > 0) {
    store.update((draft) => {
      draft.runtime.companyRowsCache[trimmed] = cachedRows;
      const rebuilt = rebuildLoadedCompanyCatalog({ getState: () => draft });
      draft.commerce.catalog.productIndex = rebuilt.productIndex;
      draft.commerce.catalog.products = rebuilt.products;
      draft.commerce.priceBook = rebuilt.priceBook;
      draft.runtime.lifecycle.companyProductsReady = true;
      draft.runtime.lifecycle.companyProductsLoading = true;
      draft.runtime.lifecycle.companyProductsFailed = false;
      draft.runtime.companyErrors[trimmed] = null;
      draft.commerce.cart = syncCartPrices(draft.commerce.cart, draft.commerce.catalog.productIndex);
    }, { dirty: ['page', 'drawer', 'modals', 'header'] });
    persistCart(store.getState().commerce.cart);
  }

  try {
    const companyCatalog = await loadCompanyCatalog(api, trimmed, store.getState().commerce.selectedTier || null);
    if (companyHydrationTokens.get(trimmed) !== requestToken) return;
    const rows = Array.isArray(companyCatalog.rows) ? companyCatalog.rows : [];
    if (rows.length > 0) {
      store.update((draft) => {
        draft.runtime.companyRowsCache[trimmed] = rows;
        const rebuilt = rebuildLoadedCompanyCatalog({ getState: () => draft });
        draft.commerce.catalog.productIndex = rebuilt.productIndex;
        draft.commerce.catalog.products = rebuilt.products;
        draft.commerce.priceBook = rebuilt.priceBook;
        draft.runtime.companyErrors[trimmed] = null;
        draft.runtime.lifecycle.companyProductsReady = true;
        draft.runtime.lifecycle.companyProductsLoading = false;
        draft.runtime.lifecycle.companyProductsFailed = false;
        draft.commerce.cart = syncCartPrices(draft.commerce.cart, draft.commerce.catalog.productIndex);
      }, { dirty: ['page', 'drawer', 'modals', 'header'] });
      persistCart(store.getState().commerce.cart);
      return;
    }

    store.update((draft) => {
      draft.runtime.loading.company = null;
      draft.runtime.companyErrors[trimmed] = null;
      draft.runtime.lifecycle.companyProductsReady = Boolean(cachedRows && cachedRows.length > 0);
      draft.runtime.lifecycle.companyProductsLoading = false;
      draft.runtime.lifecycle.companyProductsFailed = false;
    }, { dirty: ['page'] });
    return;
  } catch (error) {
    if (companyHydrationTokens.get(trimmed) !== requestToken) return;
    const fallbackRows = Array.isArray(cachedRows) ? cachedRows : [];
    if (fallbackRows.length) {
      store.update((draft) => {
        draft.runtime.companyRowsCache[trimmed] = fallbackRows;
        const rebuilt = rebuildLoadedCompanyCatalog({ getState: () => draft });
        draft.commerce.catalog.productIndex = rebuilt.productIndex;
        draft.commerce.catalog.products = rebuilt.products;
        draft.commerce.priceBook = rebuilt.priceBook;
        draft.runtime.loading.company = null;
        draft.runtime.companyErrors[trimmed] = null;
        draft.runtime.lifecycle.companyProductsReady = true;
        draft.runtime.lifecycle.companyProductsLoading = false;
        draft.runtime.lifecycle.companyProductsFailed = false;
        draft.commerce.cart = syncCartPrices(draft.commerce.cart, draft.commerce.catalog.productIndex);
      }, { dirty: ['page', 'drawer', 'modals', 'header'] });
      persistCart(store.getState().commerce.cart);
      return;
    }
    store.update((draft) => {
      draft.runtime.loading.company = null;
      draft.runtime.companyErrors[trimmed] = error?.message || 'تعذر تحميل منتجات الشركة';
      draft.runtime.lifecycle.companyProductsReady = false;
      draft.runtime.lifecycle.companyProductsLoading = false;
      draft.runtime.lifecycle.companyProductsFailed = true;
    }, { dirty: ['page'] });
    return;
  }
}

function bootstrapShell(root, routeName) {
  if (routeName === 'admin') { root.innerHTML = adminShellTemplate(); return; }
  if (routeName === 'rep') { root.innerHTML = repShellTemplate(); return; }
  if (routeName === 'ops' || routeName === 'sales-manager') { root.innerHTML = minimalShellTemplate(); return; }
  root.innerHTML = shellTemplate();
}

function getNodes() {
  return {
    header: dom.q('#appHeader'),
    search: dom.q('#appSearch'),
    banner: dom.q('#appBanner'),
    theme: dom.q('#appTheme'),
    hero: dom.q('#appHero'),
    page: dom.q('#appPage'),
    footer: dom.q('#appFooter'),
    floating: dom.q('#appFloatingExecutionBar'),
    opsNav: dom.q('#appOpsNav'),
    repNav: dom.q('#appRepNav'),
    drawerHost: dom.q('#appDrawerHost'),
    modalHost: dom.q('#appModalHost'),
    toastHost: dom.q('#appToastHost'),
    adminHeader: dom.q('#adminHeader'),
    adminSidebar: dom.q('#adminSidebar'),
    adminPage: dom.q('#adminPage'),
  };
}

function isOperationalRoute(routeName) {
  return routeName === 'ops' || routeName === 'sales-manager' || routeName === 'rep';
}

function renderPage(state, nodes) {
  const route = state.app.route;
  const operationalRoute = isOperationalRoute(route.name);
  const tier = getSelectedTier(state);

  renderHeader(nodes.header, state);

  if (operationalRoute) {
    nodes.opsNav.innerHTML = renderOpsNavigation(state);
    nodes.banner.innerHTML = '';
    nodes.theme.innerHTML = '';
    nodes.hero.innerHTML = '';
    nodes.search.innerHTML = '';
    nodes.footer.innerHTML = '';
  } else {
    nodes.opsNav.innerHTML = '';
    renderBanner(nodes.banner, state);
    renderThemeSwitcher(nodes.theme, state);
    renderHero(nodes.hero, state, { mode: route.name === 'home' ? 'home' : 'none' });
    renderSearchBar(nodes.search, state, { routeName: route.name, show: false });
    renderFooter(nodes.footer, state);
  }

  let pageHtml = '';
  switch (route.name) {
    case 'home': pageHtml = renderHomePage(state); break;
    case 'companies': pageHtml = renderCompaniesPage(state); break;
    case 'company': pageHtml = renderCompanyPage(state); break;
    case 'offers': pageHtml = renderOffersPage(state); break;
    case 'tiers': pageHtml = renderTiersPage(state); break;
    case 'cart': pageHtml = renderCartPage(state); break;
    case 'checkout': pageHtml = renderCheckoutPage(state); break;
    case 'login': pageHtml = renderLoginPage(state); break;
    case 'register': pageHtml = renderRegisterPage(state); break;
    case 'customers': pageHtml = renderCustomersPage(state); break;
    case 'invoices': pageHtml = renderInvoicesPage(state); break;
    case 'invoice': pageHtml = renderInvoicePage(state); break;
    case 'account': pageHtml = renderAccountPage(state); break;
    case 'search': pageHtml = renderSearchPage(state); break;
    case 'ops':
    case 'sales-manager': pageHtml = renderOpsDashboardPage(state); break;
    case 'rep': {
      const subModule = route.params?.module || 'dashboard';
      if (subModule === 'customers') pageHtml = renderRepCustomersPage(state);
      else if (subModule === 'orders') pageHtml = renderRepOrdersPage(state);
      else if (subModule === 'invoices') pageHtml = renderRepInvoicesPage(state);
      else pageHtml = renderRepDashboardPage(state);
      break;
    }
    default: pageHtml = renderHomePage(state); break;
  }
  nodes.page.innerHTML = pageHtml;

  if (nodes.repNav) nodes.repNav.innerHTML = renderRepNavigation(state);
  if (nodes.opsNav) nodes.opsNav.innerHTML = renderOpsNavigation(state);

  const activeProduct = state.ui.activeProduct ? state.commerce.catalog.productIndex[state.ui.activeProduct] : null;
  nodes.modalHost.innerHTML = [renderLoginModal(state), renderCustomerModal(state), renderProductModal(state, activeProduct)].join('');
  nodes.drawerHost.innerHTML = renderDrawer(state);
  nodes.toastHost.innerHTML = renderToasts(state);

  applyShellVisibility(route, nodes);
  syncBodyShellHeight();
}

function applyShellVisibility(route, nodes) {
  const operationalRoute = isOperationalRoute(route.name);
  nodes.banner.classList.toggle('is-hidden', operationalRoute);
  nodes.search.classList.toggle('is-hidden', operationalRoute || route.name !== 'search');
  nodes.hero.classList.toggle('is-hidden', operationalRoute || route.name !== 'home');
  nodes.footer.classList.toggle('is-hidden', operationalRoute);
  if (nodes.repNav) nodes.repNav.classList.toggle('is-hidden', route.name !== 'rep');
  if (nodes.opsNav) nodes.opsNav.classList.toggle('is-hidden', !operationalRoute);
}

function syncBodyShellHeight() {
  const footer = dom.q('#appFooter');
  const floating = dom.q('#appFloatingExecutionBar');
  const footerHeight = footer ? Math.ceil(footer.getBoundingClientRect().height || 0) : 0;
  const floatingHeight = floating && floating.classList.contains('is-visible') ? Math.ceil(floating.getBoundingClientRect().height || 0) : 0;
  document.documentElement.style.setProperty('--footer-height', `${footerHeight}px`);
  document.documentElement.style.setProperty('--floating-execution-height', `${floatingHeight}px`);
}

function bindInteractions(store, api, schedule) {
  document.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-action], [data-modal], [data-close]');
    if (!target) return;
    const action = target.getAttribute('data-action');
    const state = store.getState();
    const tier = getSelectedTier(state);

    if (action === 'navigate-home') return navigateAuthority(store, 'home');
    if (action === 'go-companies') return navigateAuthority(store, 'companies');
    if (action === 'go-offers') return navigateAuthority(store, 'offers');
    if (action === 'go-tiers') return navigateAuthority(store, 'tiers');
    if (action === 'go-search') {
      const resultsEl = document.getElementById('globalSearchResults');
      if (resultsEl) { resultsEl.classList.add('is-hidden'); resultsEl.innerHTML = ''; }
      return navigateAuthority(store, 'search');
    }
    if (action === 'global-search-select') {
      const productId = target.getAttribute('data-product-id');
      if (productId) {
        store.patch({ ui: { ...store.getState().ui, selectedProductId: productId, activeModal: 'product', search: '' } });
        const resultsEl = document.getElementById('globalSearchResults');
        if (resultsEl) { resultsEl.classList.add('is-hidden'); resultsEl.innerHTML = ''; }
        schedule('modals', 'header', 'searchResults');
      }
      return;
    }
    if (action === 'go-back') { if (history.length > 1) history.back(); else navigateAuthority(store, 'home'); return; }
    if (action === 'go-cart') { store.patch({ ui: { ...store.getState().ui, drawerOpen: false } }); schedule('drawer', 'header', 'page'); return; }
    if (action === 'go-order-submission') return navigateAuthority(store, 'checkout');
    if (action === 'go-checkout') {
      const requiresCustomerSelection = isSalesRepSession(state.auth.session);
      if (requiresCustomerSelection && !state.auth.selectedCustomer) {
        setPendingFlow(store, { name: 'checkout', resumeRoute: 'checkout', resumeMessage: 'يرجى مراجعة تفاصيل الطلب قبل الإرسال' });
        notify(store, 'warning', 'يجب اختيار العميل أولًا', 'اختر العميل ثم ستنتقل مباشرة إلى مراجعة الطلب');
        return navigateAuthority(store, 'customers');
      }
      return navigateAuthority(store, 'checkout');
    }
    if (action === 'go-login') return navigateAuthority(store, 'login');
    if (action === 'go-register') return navigateAuthority(store, 'register');
    if (action === 'go-customers') return navigateAuthority(store, 'customers');
    if (action === 'go-invoices') return navigateAuthority(store, 'invoices');
    if (action === 'go-account') return navigateAuthority(store, 'account');
    if (action === 'go-ops') {
      const session = state.auth.session;
      if (!canOpenOpsWorkspace(session)) {
        notify(store, 'warning', 'غير مصرح', 'هذه اللوحة متاحة للحسابات التشغيلية فقط');
        return;
      }
      if (isSalesRepSession(session) && !isAdminOnlySession(session)) {
        return navigateAuthority(store, 'rep');
      }
      return navigateAuthority(store, 'ops', { module: getDefaultOperationalModule(session) });
    }
    if (action === 'go-rep') {
      return navigateAuthority(store, 'rep');
    }
    if (action === 'go-rep-customers') {
      return navigateAuthority(store, 'rep', { module: 'customers' });
    }
    if (action === 'go-rep-orders') {
      return navigateAuthority(store, 'rep', { module: 'orders' });
    }
    if (action === 'go-rep-invoices') {
      return navigateAuthority(store, 'rep', { module: 'invoices' });
    }
    if (action === 'go-rep-customer-invoices') {
      const customerId = target.getAttribute('data-customer-id');
      const customerName = target.getAttribute('data-customer-name') || '';
      if (!customerId) return;
      const customers = Array.isArray(store.getState().runtime.rep.customers) ? store.getState().runtime.rep.customers : [];
      const customer = customers.find((c) => String(c.id) === String(customerId));
      if (customer) {
        store.patch({ auth: { ...store.getState().auth, selectedCustomer: customer } });
      }
      notify(store, 'info', 'فواتير العميل', customerName);
      return navigateAuthority(store, 'rep', { module: 'invoices' });
    }
    if (action === 'select-customer') {
      const customerId = target.getAttribute('data-customer-id');
      if (!customerId) return;
      const customers = Array.isArray(store.getState().runtime.rep.customers) ? store.getState().runtime.rep.customers : [];
      const customer = customers.find((c) => String(c.id) === String(customerId));
      if (customer) {
        store.patch({ auth: { ...store.getState().auth, selectedCustomer: customer } });
        notify(store, 'success', 'تم اختيار العميل', customer.name || '');
        const pendingFlow = store.getState().ui.pendingFlow;
        if (pendingFlow?.name === 'checkout') {
          clearPendingFlow(store);
          navigateAuthority(store, 'checkout');
        }
      }
      return;
    }
    if (action === 'admin-go-module') {
      event.preventDefault();
      const module = String(target.getAttribute('data-module') || '').trim() || 'products';
      navigateAuthority(store, 'admin', { module });
      if (module === 'products') void loadOpsProductsIntoState(store, api);
      if (module === 'orders' || module === 'customers' || module === 'reps') void loadManagerScopeIntoState(store, api, state.auth.session);
      return;
    }

    if (action === 'admin-logout') {
      logout();
      persistSelectedCustomer(null);
      store.patch({ auth: { ...state.auth, session: null, selectedCustomer: null }, ui: { ...state.ui, activeModal: null } });
      notify(store, 'info', 'تم الخروج', '');
      const appEl = document.getElementById('app');
      if (appEl) { appEl.innerHTML = ''; bootstrapShell(appEl, 'home'); Object.assign(nodes, getNodes()); }
      navigateAuthority(store, 'home');
      return;
    }

    if (action === 'admin-back-store') {
      const appEl = document.getElementById('app');
      if (appEl) { appEl.innerHTML = ''; bootstrapShell(appEl, 'home'); Object.assign(nodes, getNodes()); }
      navigateAuthority(store, 'home');
      return;
    }

    if (action === 'go-ops-module') {
      const module = String(target.getAttribute('data-module') || '').trim() || getDefaultOperationalModule(state.auth.session);
      if (!canOpenOpsWorkspace(state.auth.session)) {
        notify(store, 'warning', 'غير مصرح', 'هذه اللوحة متاحة للحسابات التشغيلية فقط');
        return;
      }
      if (!isOperationalModuleReady(module)) {
        notify(store, 'info', 'قريبًا', 'هذه الوحدة لم تُفعَّل بعد');
        return;
      }
      navigateAuthority(store, 'ops', { module });
      if (module === 'products' || module === 'catalog') {
        void loadOpsProductsIntoState(store, api);
      }
      return;
    }

    if (action === 'ops-company-toggle-visibility') {
      const companyId = target.getAttribute('data-company-id');
      const currentVisible = target.getAttribute('data-current-visible') === 'true';
      if (!companyId) return;
      try {
        await api.patch('companies', { visible: !currentVisible }, { company_id: `eq.${companyId}` });
        notify(store, 'success', 'تم التحديث', '');
        store.update((draft) => {
          const list = draft.commerce.catalog.companies;
          const idx = list.findIndex((c) => String(c.company_id) === String(companyId));
          if (idx >= 0) list[idx] = { ...list[idx], visible: !currentVisible };
        }, { dirty: ['page', 'header'] });
        schedule('page', 'header');
      } catch {
        notify(store, 'error', 'تعذر التحديث', '');
      }
      return;
    }

    if (action === 'ops-product-toggle-status') {
      const productId = target.getAttribute('data-product-id');
      const currentStatus = target.getAttribute('data-current-status') || 'active';
      const product = state.runtime?.opsProducts?.products?.find((p) => String(p.product_id) === String(productId));
      if (!productId) return;
      try {
        await toggleOpsProductActive(api, productId, currentStatus);
        notify(store, 'success', currentStatus === 'inactive' ? 'تم التفعيل' : 'تم الإيقاف', '');
        void loadOpsProductsIntoState(store, api);
      } catch {
        notify(store, 'error', 'تعذر التحديث', '');
      }
      return;
    }

    if (action === 'ops-product-toggle-visibility') {
      const productId = target.getAttribute('data-product-id');
      const currentVisible = target.getAttribute('data-current-visible') === 'true';
      if (!productId) return;
      try {
        await toggleOpsProductVisibility(api, productId, currentVisible);
        notify(store, 'success', currentVisible ? 'تم الإخفاء' : 'تم الإظهار', '');
        void loadOpsProductsIntoState(store, api);
      } catch {
        notify(store, 'error', 'تعذر التحديث', '');
      }
      return;
    }

    if (action === 'ops-product-create') {
      const modal = document.getElementById('opsProductModal');
      if (!modal) return;
      document.getElementById('opsProductModalTitle').textContent = 'إضافة منتج';
      document.getElementById('opsProductId').value = '';
      document.getElementById('opsProductName').value = '';
      document.getElementById('opsProductCompanyId').value = '';
      document.getElementById('opsProductCategory').value = '';
      document.getElementById('opsProductImage').value = '';
      document.getElementById('opsProductVisible').checked = true;
      document.getElementById('opsProductActive').checked = true;
      modal.style.display = 'flex';
      return;
    }

    if (action === 'ops-product-edit') {
      const modal = document.getElementById('opsProductModal');
      if (!modal) return;
      const productId = target.getAttribute('data-product-id') || '';
      document.getElementById('opsProductModalTitle').textContent = 'تعديل المنتج';
      document.getElementById('opsProductId').value = productId;
      document.getElementById('opsProductName').value = target.getAttribute('data-product-name') || '';
      document.getElementById('opsProductCompanyId').value = target.getAttribute('data-company-id') || '';
      document.getElementById('opsProductCategory').value = target.getAttribute('data-product-category') || '';
      document.getElementById('opsProductImage').value = target.getAttribute('data-product-image') || '';
      document.getElementById('opsProductVisible').checked = target.getAttribute('data-product-visible') !== 'false';
      document.getElementById('opsProductActive').checked = target.getAttribute('data-product-status') !== 'inactive';
      const preview = document.getElementById('opsImagePreview');
      const img = target.getAttribute('data-product-image') || '';
      if (preview) { preview.style.display = img ? 'flex' : 'none'; if (img) document.getElementById('opsImagePreviewImg').src = img; }
      const unitPricesEl = document.getElementById('opsProductUnitPrices');
      if (unitPricesEl && productId) {
        const products = store.getState().runtime.opsProducts?.products || [];
        const product = products.find((p) => String(p.product_id) === String(productId));
        if (product && product.unitOrder) {
          const tierSet = new Set();
          product.unitOrder.forEach((uc) => { const u = product.units[uc]; if (u) Object.keys(u.prices || {}).forEach((t) => tierSet.add(t)); });
          const tierNames = Array.from(tierSet);
          unitPricesEl.innerHTML = product.unitOrder.map((uc) => {
            const u = product.units[uc];
            if (!u) return '';
            return `<div class="ops-modal-unit"><strong>${unitBadge(uc)}</strong>${tierNames.map((t) => {
              const price = u.prices?.[t] || 0;
              return `<label class="ops-field ops-field--inline"><span>${dom.escape(t)}</span><input type="number" min="0" step="0.01" value="${Number(price).toFixed(2)}" data-tier="${dom.escape(t)}" data-unit="${dom.escape(uc)}" data-product="${dom.escape(productId)}" class="ops-inline-input ops-inline-input--price"></label>`;
            }).join('')}</div>`;
          }).join('');
        }
      }
      modal.style.display = 'flex';
      return;
    }

    if (action === 'ops-product-modal-close') {
      const modal = document.getElementById('opsProductModal');
      if (modal) modal.style.display = 'none';
      return;
    }

    if (action === 'ops-product-image-preview') {
      const url = target.value.trim();
      const preview = document.getElementById('opsImagePreview');
      if (preview) { preview.style.display = url ? 'flex' : 'none'; if (url) document.getElementById('opsImagePreviewImg').src = url; }
      return;
    }

    if (action === 'ops-product-save-stock') {
      const productId = target.getAttribute('data-product-id');
      const unitCode = target.getAttribute('data-unit-code');
      if (!productId || !unitCode) return;
      const input = document.querySelector(`[data-ops-stock="${CSS.escape(productId)}:${CSS.escape(unitCode)}"]`);
      const value = input ? parseInt(input.value, 10) : 0;
      try {
        await updateOpsProductUnitStock(api, productId, unitCode, value);
        notify(store, 'success', 'تم تحديث المخزون', `${unitCode}: ${value}`);
        void loadOpsProductsIntoState(store, api);
      } catch { notify(store, 'error', 'تعذر تحديث المخزون', ''); }
      return;
    }

    if (action === 'ops-product-save-price') {
      const productId = target.getAttribute('data-product-id');
      const unitCode = target.getAttribute('data-unit-code');
      const tierName = target.getAttribute('data-tier-name');
      if (!productId || !unitCode || !tierName) return;
      const input = document.querySelector(`[data-ops-price="${CSS.escape(productId)}:${CSS.escape(unitCode)}:${CSS.escape(tierName)}"]`);
      const value = input ? parseFloat(input.value) : 0;
      try {
        await updateOpsProductUnitPrice(api, productId, unitCode, tierName, value);
        notify(store, 'success', 'تم تحديث السعر', `${unitCode} / ${tierName}: ${value.toFixed(2)}`);
        void loadOpsProductsIntoState(store, api);
      } catch { notify(store, 'error', 'تعذر تحديث السعر', ''); }
      return;
    }

    if (action === 'ops-product-delete') {
      const productId = target.getAttribute('data-product-id');
      const productName = target.getAttribute('data-product-name') || 'هذا المنتج';
      if (!productId) return;
      if (!confirm(`هل أنت متأكد من حذف "${productName}"؟`)) return;
      try {
        await deleteOpsProduct(api, productId);
        notify(store, 'success', 'تم الحذف', productName);
        void loadOpsProductsIntoState(store, api);
      } catch {
        notify(store, 'error', 'تعذر حذف المنتج', '');
      }
      return;
    }
    if (action === 'admin-order-view') {
      const orderId = target.getAttribute('data-order-id');
      if (!orderId) return;
      notify(store, 'info', 'عرض الطلب', `الطلب #${orderId} — التفاصيل الكاملة قيد التطوير`);
      return;
    }
    if (action === 'admin-order-transition') {
      const orderId = target.getAttribute('data-order-id');
      if (!orderId) return;
      notify(store, 'info', 'تغيير الحالة', `الطلب #${orderId} — واجهة تغيير الحالة قيد التطوير`);
      return;
    }
    if (action === 'admin-customer-view') {
      const customerId = target.getAttribute('data-customer-id');
      if (!customerId) return;
      notify(store, 'info', 'عرض العميل', 'تفاصيل العميل الكاملة قيد التطوير');
      return;
    }
    if (action === 'admin-customer-orders') {
      const customerId = target.getAttribute('data-customer-id');
      if (!customerId) return;
      notify(store, 'info', 'طلبات العميل', 'تصفية الطلبات حسب العميل قيد التطوير');
      return;
    }
    if (action === 'admin-rep-view') {
      const repId = target.getAttribute('data-rep-id');
      if (!repId) return;
      notify(store, 'info', 'عرض المندوب', 'تفاصيل المندوب الكاملة قيد التطوير');
      return;
    }
    if (action === 'admin-rep-customers') {
      const repId = target.getAttribute('data-rep-id');
      if (!repId) return;
      notify(store, 'info', 'عملاء المندوب', 'تصفية العملاء حسب المندوب قيد التطوير');
      return;
    }
    if (action === 'admin-pricing-view') {
      const tierName = target.getAttribute('data-tier-name');
      notify(store, 'info', 'التسعير', `شريحة "${tierName || ''}" — تفاصيل التسعير الكاملة قيد التطوير`);
      return;
    }
    if (action === 'pwa-install') {
      closeTransientSurfaces(store, { keepDrawer: false });
      const pwa = window.__ALAHRAM_PWA__ || {};
      if (pwa.installed) {
        notify(store, 'info', 'التطبيق مثبت بالفعل', 'يمكنك استخدامه من الشاشة الرئيسية أو المتصفح');
        return;
      }
      if (pwa.deferredPrompt && typeof pwa.deferredPrompt.prompt === 'function') {
        const promptEvent = pwa.deferredPrompt;
        pwa.deferredPrompt = null;
        pwa.installAvailable = false;
        try {
          promptEvent.prompt();
          const choice = await promptEvent.userChoice;
          if (choice?.outcome === 'accepted') {
            pwa.installed = true;
            notify(store, 'success', 'تم تثبيت التطبيق', 'يمكنك الآن استخدامه كتطبيق مستقل');
          } else {
            notify(store, 'info', 'تم إلغاء التثبيت', '');
          }
        } catch (error) {
          console.error(error);
          notify(store, 'warning', 'تعذر تثبيت التطبيق', 'حاول مرة أخرى من قائمة المتصفح');
        }
        return;
      }
      notify(store, 'info', 'تثبيت التطبيق', 'استخدم قائمة المتصفح أو افتح التطبيق من الشاشة الرئيسية');
      return;
    }

    if (action === 'go-flash') return navigateAuthority(store, 'offers');
    if (action === 'clear-search') { store.patch({ ui: { ...state.ui, search: '' } }); clearTimeout(searchTypingTimer); schedule('header', 'theme', 'banner', 'hero', 'page', 'search'); return; }
    if (action === 'toggle-desktop-mode') {
      const next = !(state.ui.desktopMode === true);
      store.patch({ ui: { ...state.ui, desktopMode: next } });
      saveJSON(storageKeys.desktopMode, next);
      applyDesktopMode(next);
      schedule('header');
      return;
    }
    if (action === 'set-theme') {
      const nextTheme = String(target.getAttribute('data-theme') || '').trim();
      if (!THEME_NAMES.has(nextTheme)) return;
      store.patch({ ui: { ...state.ui, theme: nextTheme } });
      saveJSON(storageKeys.theme, nextTheme);
      setTheme(nextTheme);
      scheduler.schedule('theme', 'header', 'banner', 'search', 'hero', 'page', 'footer');
      return;
    }
    if (action === 'toggle-account-menu') { store.patch({ ui: { ...state.ui, accountMenuOpen: !state.ui.accountMenuOpen, activeModal: null } }); schedule('header', 'modals'); return; }
    if (action === 'open-cart-drawer') { closeTransientSurfaces(store, { keepDrawer: false }); store.patch({ ui: { ...store.getState().ui, drawerOpen: true } }); schedule('drawer', 'header', 'modals'); return; }
    if (action === 'close-cart-drawer') { store.patch({ ui: { ...state.ui, drawerOpen: false } }); schedule('drawer'); return; }
    if (action === 'open-customer-modal') { closeTransientSurfaces(store, { keepDrawer: false }); resetCustomerLocationDraft(store); store.patch({ ui: { ...store.getState().ui, activeModal: 'customer' } }); schedule('modals', 'header'); return; }
    if (action === 'close-modal') { store.patch({ ui: { ...state.ui, activeModal: null, selectedInvoiceId: null, customerLocationBusy: false, customerLocationError: null, customerLocationDraft: { text: '', lat: null, lng: null } } }); schedule('modals'); return; }
    if (action === 'workflow-transition') {
      const orderId = String(target.getAttribute('data-order-id') || '').trim();
      const nextStateKey = String(target.getAttribute('data-next-state-key') || '').trim();
      const session = state.auth.session;
      const managerOrders = state.runtime?.manager?.teamOrders || [];
      const invoiceOrders = state.commerce?.invoices || [];
      const order = [...managerOrders, ...invoiceOrders].find((item) => String(item.id) === orderId);
      if (!order) {
        notify(store, 'warning', 'الطلب غير متاح', '');
        return;
      }
      const workflow = resolveWorkflowActions(order, session);
      const transition = workflow.executableTransitions.find((item) => item.to_state_key === nextStateKey);
      if (!transition) {
        notify(store, 'warning', 'لا توجد صلاحية كافية', '');
        return;
      }
      try {
        const updated = await applyWorkflowTransition(api, orderId, nextStateKey);
        const nextOrder = updated && updated.id ? updated : { ...order, workflow_state_key: nextStateKey };
        store.update((draft) => {
          if (Array.isArray(draft.runtime?.manager?.teamOrders)) {
            draft.runtime.manager.teamOrders = draft.runtime.manager.teamOrders.map((item) => String(item.id) === orderId ? { ...item, workflow_state_key: nextStateKey } : item);
            draft.runtime.manager.summary = draft.runtime.manager.summary || {};
          }
          if (Array.isArray(draft.commerce?.invoices)) {
            draft.commerce.invoices = draft.commerce.invoices.map((item) => String(item.id) === orderId ? { ...item, workflow_state_key: nextStateKey } : item);
          }
        }, { dirty: ['page', 'header', 'opsNav', 'drawer', 'modals'] });
        notify(store, 'success', 'تم تحديث الحالة', `${workflow.currentStateLabel} → ${transition.to_state_label || nextStateKey}`);
        schedule('page', 'header', 'opsNav', 'drawer', 'modals', 'toast');
        return nextOrder;
      } catch (error) {
        console.error(error);
        notify(store, 'error', 'تعذر تحديث الحالة', '');
      }
      return;
    }
    if (action === 'capture-customer-location') {
      const form = target.closest('form');
      const currentUi = store.getState().ui;
      if (!form) return;
      if (!navigator.geolocation) {
        commitCustomerLocationDraft(store, { text: currentUi.customerLocationDraft?.text || '', lat: currentUi.customerLocationDraft?.lat ?? null, lng: currentUi.customerLocationDraft?.lng ?? null });
        store.patch({ ui: { ...store.getState().ui, customerLocationBusy: false, customerLocationError: 'المتصفح لا يدعم تحديد الموقع' } });
        notify(store, 'warning', 'تعذر تحديد الموقع', 'المتصفح لا يدعم geolocation');
        schedule('modals');
        return;
      }
      store.patch({ ui: { ...store.getState().ui, customerLocationBusy: true, customerLocationError: null } });
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = Number(position?.coords?.latitude);
          const lng = Number(position?.coords?.longitude);
          const text = Number.isFinite(lat) && Number.isFinite(lng)
            ? `${lat.toFixed(6)}, ${lng.toFixed(6)}`
            : '';
          commitCustomerLocationDraft(store, { text, lat, lng });
          const formNode = form;
          if (formNode?.location) formNode.location.value = text;
          if (formNode?.location_lat) formNode.location_lat.value = Number.isFinite(lat) ? String(lat) : '';
          if (formNode?.location_lng) formNode.location_lng.value = Number.isFinite(lng) ? String(lng) : '';
          schedule('modals');
        },
        (error) => {
          const message = error?.code === 1
            ? 'تم رفض إذن الموقع'
            : error?.code === 2
              ? 'تعذر الوصول إلى الموقع'
              : error?.code === 3
                ? 'انتهت مهلة تحديد الموقع'
                : 'تعذر تحديد الموقع الحالي';
          store.patch({ ui: { ...store.getState().ui, customerLocationBusy: false, customerLocationError: message } });
          notify(store, 'warning', 'تعذر تحديد الموقع', message);
          schedule('modals');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
      );
      return;
    }

    if (action === 'open-company') {
      const companyId = target.getAttribute('data-company-id');
      navigateAuthority(store, 'company', { companyId });
      void ensureCompanyCatalogLoaded(store, api, companyId);
      return;
    }

    if (action === 'select-customer') {
      const customerId = target.getAttribute('data-customer-id');
      const customer = (state.commerce.customers || []).find((item) => String(item.id) === String(customerId));
      if (!customer) return;
      store.update((draft) => {
        draft.auth.selectedCustomer = customer;
        draft.ui.activeModal = null;
        draft.ui.accountMenuOpen = false;
      }, { action: 'customer-select', dirty: ['page', 'header', 'modals'] });
      persistSelectedCustomer(customer);
      notify(store, 'success', 'تم اختيار العميل', customer.name || '');
      const pendingFlow = store.getState().ui.pendingFlow;
      if (pendingFlow?.name === 'checkout') {
        clearPendingFlow(store);
        notify(store, 'info', 'يرجى مراجعة تفاصيل الطلب قبل الإرسال', '');
        return navigateAuthority(store, 'checkout');
      }
      schedule('page', 'header', 'modals');
      return;
    }

    if (action === 'set-unit') {
      const productId = target.getAttribute('data-product-id');
      const unit = target.getAttribute('data-unit');
      store.update((draft) => { draft.commerce.unitPrefs[productId] = unit; draft.commerce.cart = syncCartPrices(draft.commerce.cart, draft.commerce.catalog.productIndex); }, { action: 'set-unit' });
      schedule('page', 'header', 'drawer');
      return;
    }

    if (action === 'toggle-product') {
      const productId = target.getAttribute('data-product-id');
      const product = state.commerce.catalog.productIndex[productId];
      if (!product) return;
      const quantity = Number(document.querySelector(`[data-role="product-qty"][data-product-id="${CSS.escape(productId)}"]`)?.value || state.commerce.qtyPrefs[productId] || 1);
      const result = addProductToCart(state.commerce.cart, product, tier, state.commerce.unitPrefs[productId], quantity);
      store.update((draft) => {
        draft.commerce.cart = result.cart;
        draft.commerce.qtyPrefs[productId] = Math.max(1, Number(quantity || 1));
      }, { action: 'cart-toggle' });
      persistCart(result.cart);
      notify(store, result.added ? 'success' : 'info', result.added ? 'تمت الإضافة' : 'تمت الإزالة', product.product_name);
      appendBehaviorEvent(result.added ? 'cart.add' : 'cart.remove', { productId });
      schedule('header', 'banner', 'opsNav', 'page', 'drawer');
      return;
    }

    if (action === 'toggle-deal' || action === 'toggle-flash') {
      const id = Number(target.getAttribute('data-id'));
      const offers = action === 'toggle-deal' ? state.commerce.catalog.offers.daily : state.commerce.catalog.offers.flash;
      const offer = offers.find((item) => Number(item.id) === id);
      if (!offer) return;
      if (action === 'toggle-flash' && String(offer.runtime_status || offer.status || '').trim().toLowerCase() !== 'active') {
        notify(store, 'warning', 'انتهى العرض', 'لا يمكن الشراء بعد انتهاء الوقت');
        return;
      }
      const result = toggleOfferInCart(state.commerce.cart, offer, action === 'toggle-deal' ? 'deal' : 'flash');
      if (result.reason === 'OFFER_EXPIRED') {
        notify(store, 'warning', 'انتهى العرض', 'لا يمكن الشراء بعد انتهاء الوقت');
        return;
      }
      store.patch({ commerce: { ...state.commerce, cart: result.cart } });
      persistCart(result.cart);
      notify(store, result.added ? 'success' : 'info', result.added ? 'تمت الإضافة' : 'تمت الإزالة', offer.title);
      schedule('header', 'banner', 'page', 'drawer');
      return;
    }

    if (action === 'remove-item') {
      const key = target.getAttribute('data-key');
      const next = removeItem(state.commerce.cart, key);
      store.patch({ commerce: { ...state.commerce, cart: next } });
      persistCart(next);
      schedule('header', 'banner', 'page', 'drawer');
      return;
    }

    if (action === 'qty-up' || action === 'qty-down') {
      const key = target.getAttribute('data-key');
      const delta = action === 'qty-up' ? 1 : -1;
      const item = state.commerce.cart.find((row) => row.key === key);
      if (!item) return;
      const next = updateQty(state.commerce.cart, key, Number(item.qty || 1) + delta);
      store.patch({ commerce: { ...state.commerce, cart: next } });
      persistCart(next);
      schedule('header', 'banner', 'page', 'drawer');
      return;
    }

    if (action === 'product-qty-up' || action === 'product-qty-down') {
      const productId = target.getAttribute('data-product-id');
      const delta = action === 'product-qty-up' ? 1 : -1;
      const currentQty = Number(state.commerce.qtyPrefs[productId] || findCartProductItem(state.commerce.cart, productId)?.qty || 1);
      const nextQty = Math.max(1, currentQty + delta);
      const item = findCartProductItem(state.commerce.cart, productId);
      if (item) {
        const nextCart = updateQty(state.commerce.cart, item.key, nextQty);
        store.update((draft) => {
          draft.commerce.cart = nextCart;
          draft.commerce.qtyPrefs[productId] = nextQty;
        }, { action: 'product-qty-sync', dirty: ['page', 'drawer', 'header', 'modals'] });
        persistCart(nextCart);
      } else {
        store.update((draft) => {
          draft.commerce.qtyPrefs[productId] = nextQty;
        }, { action: 'product-qty-pref', silent: true });
      }
      schedule('page', 'drawer', 'header', 'modals');
      return;
    }

    if (action === 'select-tier') {
      const tierName = normalizeTierName(target.getAttribute('data-tier-name'));
      const current = getSelectedTier(state);
      const nextTier = normalizeTierName(current.tier_name) === tierName
        ? state.commerce.catalog.tiers.find((tier) => tier.is_default) || state.commerce.catalog.tiers[0]
        : state.commerce.catalog.tiers.find((tier) => normalizeTierName(tier.tier_name) === tierName);
      const selectedTier = normalizeTierName(nextTier?.tier_name || null) || null;
      const currentState = store.getState();
      const summary = await loadHomeCatalog(api, selectedTier);
      const topIds = Array.isArray(summary.top?.products) ? summary.top.products.map((row) => row?.product_id).filter(Boolean) : [];
      const topCatalog = topIds.length ? await loadProductsByIds(api, topIds, selectedTier).catch(() => ({ productIndex: {}, products: [], priceBook: buildPriceBook([], summary.tiers || [], selectedTier) })) : { productIndex: {}, products: [], priceBook: buildPriceBook([], summary.tiers || [], selectedTier) };
      const rebuiltState = { ...currentState, commerce: { ...currentState.commerce, catalog: { ...summary, productIndex: topCatalog.productIndex, products: topCatalog.products } }, runtime: currentState.runtime };
      const rebuilt = rebuildLoadedCompanyCatalog({ getState: () => rebuiltState }, selectedTier);
      const refreshedCart = recalcCart(currentState.commerce.cart, rebuilt.productIndex);
      store.update((draft) => {
        draft.commerce.selectedTier = selectedTier;
        draft.commerce.catalog = { ...draft.commerce.catalog, ...summary, top: summary.top, catalogProducts: [] };
        draft.commerce.catalog.productIndex = rebuilt.productIndex;
        draft.commerce.catalog.products = rebuilt.products;
        draft.commerce.priceBook = rebuilt.priceBook;
        draft.commerce.cart = refreshedCart;
        draft.runtime.flashState = computeFlashState((summary.offers && summary.offers.flash) || []);
        draft.runtime.lifecycle.catalogReady = true;
        draft.runtime.lifecycle.offersReady = true;
        draft.runtime.lifecycle.flashOffersReady = Boolean((summary.offers?.flash || []).length);
        draft.runtime.lifecycle.companiesReady = Boolean((summary.companies || []).length);
        draft.runtime.lifecycle.pricingReady = true;
      }, { action: 'select-tier', dirty: ['header', 'page', 'drawer', 'hero'] });
      persistSelectedTier(selectedTier);
      persistCart(refreshedCart);
      notify(store, 'success', 'تمت الشريحة', nextTier?.visible_label || 'الشريحة الرئيسية');
      schedule('header', 'banner', 'page', 'drawer', 'hero');
      return;
    }

    if (action === 'submit-checkout') {
      const validation = validateCheckout(store.getState(), getSelectedTier(store.getState()), computeCartTotals(store.getState()));
      if (!validation.ok) {
        if (validation.code === 'NO_SESSION') {
          setPendingFlow(store, { name: 'checkout', resumeRoute: 'checkout', resumeMessage: 'يرجى مراجعة تفاصيل الطلب قبل الإرسال' });
          notify(store, 'warning', 'يجب تسجيل الدخول أولًا', 'سجل الدخول ثم ستعود مباشرة إلى إتمام الطلب');
          navigateAuthority(store, 'login');
          return;
        }
        if (validation.code === 'NO_CUSTOMER') {
          setPendingFlow(store, { name: 'checkout', resumeRoute: 'checkout', resumeMessage: 'يرجى مراجعة تفاصيل الطلب قبل الإرسال' });
          notify(store, 'warning', 'يجب اختيار العميل أولًا', 'اختر العميل ثم ستعود مباشرة إلى إتمام الطلب');
          navigateAuthority(store, 'customers');
          return;
        }
        notify(store, 'warning', 'تعذر الإرسال', validation.message);
        return;
      }
      const next = await performCheckout(store, api, schedule);
      if (next) schedule('header', 'banner', 'page', 'drawer', 'modals');
      return;
    }

    if (action === 'refresh-catalog') {
      notify(store, 'info', 'جارٍ التحديث', 'تم إيقاف زر الإصلاح اليدوي');
      return;
    }

    if (action === 'refresh-invoices') {
      loadInvoicesIntoState(store, api).catch(console.error);
      schedule('page');
      return;
    }

    if (action === 'logout') {
      logout();
      persistSelectedCustomer(null);
      store.patch({
        auth: { ...state.auth, session: null, selectedCustomer: null },
        runtime: {
          ...state.runtime,
          manager: {
            loaded: false,
            loading: false,
            error: null,
            loadedAt: null,
            ownerId: null,
            module: 'sales-manager',
            modules: [],
            teamCustomers: [],
            teamReps: [],
            teamOrders: [],
            summary: {
              customers: 0,
              reps: 0,
              orders: 0,
              pending: 0,
              reviewing: 0,
              preparing: 0,
              dispatched: 0,
              delivered: 0,
              collected: 0,
              returned: 0,
              cancelled: 0,
            },
          },
        },
        ui: { ...state.ui, accountMenuOpen: false, activeModal: null, selectedInvoiceId: null, pendingFlow: null },
      });
      notify(store, 'info', 'تم الخروج', '');
      schedule('header', 'banner', 'page', 'drawer');
      navigateAuthority(store, 'home');
      return;
    }

    if (action === 'open-product') {
      const productId = target.getAttribute('data-product-id');
      closeTransientSurfaces(store, { keepDrawer: false });
      store.patch({ ui: { ...store.getState().ui, activeModal: 'product', selectedProductId: productId } });
      schedule('modals');
      return;
    }

    if (action === 'view-invoice') {
      const invoiceId = target.getAttribute('data-invoice-id');
      const invoice = (store.getState().commerce.invoices || []).find((item) => String(item.id) === String(invoiceId));
      if (!invoice) return;
      let items = store.getState().commerce.invoiceItemsById?.[String(invoiceId)] || [];
      if (!items.length) {
        items = await api.get('order_items', {
          select: 'id,order_id,product_id,type,qty,price,unit,created_at',
          order_id: `eq.${invoiceId}`,
          order: 'created_at.asc',
        }).catch(() => []);
        items = Array.isArray(items) ? items : [];
        const names = new Map(Object.values(store.getState().commerce.catalog.productIndex || {}).map((row) => [String(row.product_id), row.product_name || '']));
        items = items.map((item) => ({
          ...item,
          title: item.title || names.get(String(item.product_id)) || item.product_id,
        }));
      }
      store.update((draft) => {
        draft.ui.selectedInvoiceId = invoiceId;
        if (!draft.commerce.invoiceItemsById) draft.commerce.invoiceItemsById = {};
        draft.commerce.invoiceItemsById[String(invoiceId)] = items;
      }, { dirty: ['page', 'header', 'footer', 'modals'] });
      navigateAuthority(store, 'invoice', { invoiceId });
      schedule('page', 'header', 'footer', 'modals');
      return;
    }

    if (action === 'open-offer') {
      navigateAuthority(store, 'offers');
      return;
    }

    if (action === 'toast-action') {
      return;
    }

    if (action === 'navigate-back-home') {
      return navigateAuthority(store, 'home');
    }
  });

  document.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const state = store.getState();
    if (target.id === 'searchInput' || target.id === 'globalSearchInput') {
      store.patch({ ui: { ...state.ui, search: target.value } }, { silent: true });
      appendBehaviorEvent('search.query', { query: target.value.slice(0, 64) });
      clearTimeout(searchTypingTimer);
      const isGlobal = target.id === 'globalSearchInput';
      searchTypingTimer = setTimeout(() => schedule(isGlobal ? 'searchResults' : 'page', 'searchResults', 'search'), SEARCH_DEBOUNCE_MS);
      return;
    }
    if (target.getAttribute('data-role') === 'product-qty') {
      const cleaned = String(target.value || '').replace(/[^0-9]/g, '');
      if (cleaned !== target.value) target.value = cleaned;
      return;
    }
    if (target.getAttribute('data-role') === 'cart-qty') {
      const key = target.getAttribute('data-key');
      const qty = Math.max(1, Number(target.value || 1));
      store.update((draft) => { draft.commerce.cart = updateQty(draft.commerce.cart, key, qty); }, { action: 'cart-qty-update', dirty: ['page', 'drawer', 'header'] });
      persistCart(store.getState().commerce.cart);
      schedule('header', 'banner', 'page', 'drawer');
      return;
    }
  });

  document.addEventListener('click', (event) => {
    const resultsEl = document.getElementById('globalSearchResults');
    if (resultsEl && !resultsEl.classList.contains('is-hidden')) {
      const searchEl = document.querySelector('.header-search');
      if (searchEl && !searchEl.contains(event.target) && !resultsEl.contains(event.target)) {
        resultsEl.classList.add('is-hidden');
      }
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.id === 'globalSearchInput') {
      event.preventDefault();
      const state = store.getState();
      const q = String(state.ui.search || '').trim();
      if (q) {
        const resultsEl = document.getElementById('globalSearchResults');
        if (resultsEl) { resultsEl.classList.add('is-hidden'); resultsEl.innerHTML = ''; }
        navigateAuthority(store, 'search');
      }
      return;
    }
  });

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.getAttribute('data-role') !== 'product-qty') return;
    const productId = target.getAttribute('data-product-id');
    const raw = String(target.value || '').replace(/[^0-9]/g, '');
    const qty = Math.max(1, Number(raw || 1));
    store.update((draft) => {
      draft.commerce.qtyPrefs[productId] = qty;
    }, { action: 'qty-update', silent: true });
  });

  document.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const formType = form.getAttribute('data-form');
    if (!formType) return;
    event.preventDefault();

    if (formType === 'login') {
      const identifier = String(form.identifier?.value || '').trim();
      const password = String(form.password?.value || '').trim();
      if (!identifier || !password) {
        notify(store, 'warning', 'بيانات ناقصة', 'أدخل بيانات الدخول كاملة');
        return;
      }

      const pendingFlow = store.getState().ui.pendingFlow;
      store.patch({
        auth: {
          ...store.getState().auth,
          loginBusy: true,
        },
        ui: {
          ...store.getState().ui,
          loginFeedback: null,
          activeModal: 'login',
        },
      });

      let loginSucceeded = false;
      try {
        const session = normalizeSessionRecord(await login(api, identifier, password));
        store.patch({
          auth: {
            ...store.getState().auth,
            session,
            selectedCustomer: null,
            loginBusy: false,
          },
          runtime: {
            ...store.getState().runtime,
            manager: {
              loaded: false,
              loading: false,
              error: null,
              loadedAt: null,
              ownerId: null,
              module: getDefaultOperationalModule(session),
              modules: [],
              teamCustomers: [],
              teamReps: [],
              teamOrders: [],
              summary: {
                customers: 0,
                reps: 0,
                orders: 0,
                pending: 0,
                reviewing: 0,
                preparing: 0,
                dispatched: 0,
                delivered: 0,
                collected: 0,
                returned: 0,
                cancelled: 0,
              },
            },
          },
          ui: {
            ...store.getState().ui,
            activeModal: null,
            accountMenuOpen: false,
            loginFeedback: null,
          },
        });
        persistSessionRecord(session);
        persistSelectedCustomer(null);
        notify(store, 'success', 'تم الدخول', session.name || session.username || '');
        if (isAdminOnlySession(session)) {
          void loadManagerScopeIntoState(store, api, session)
            .then(() => {
              loadCustomersIntoState(store, api, session).catch(console.error);
              loadInvoicesIntoState(store, api).catch(console.error);
            })
            .catch(console.error);
        } else {
          if (isSalesRepSession(session)) {
            loadCustomersIntoState(store, api, session).catch(console.error);
          }
          loadInvoicesIntoState(store, api).catch(console.error);
        }
        if (pendingFlow?.name === 'checkout') {
          if (hasOperationalAccess(session) && !state.auth.selectedCustomer) {
            setPendingFlow(store, pendingFlow);
            notify(store, 'info', 'يجب اختيار العميل أولًا', 'اختر العميل ثم ستعود مباشرة إلى إتمام الطلب');
            navigateAuthority(store, 'customers');
          } else {
            clearPendingFlow(store);
            notify(store, 'info', 'يرجى مراجعة تفاصيل الطلب قبل الإرسال', '');
            navigateAuthority(store, 'checkout');
          }
        } else {
          clearPendingFlow(store);
          if (isSalesRepSession(session) && !isAdminOnlySession(session)) {
            navigateAuthority(store, 'rep');
          } else {
            navigateAuthority(store, 'home');
          }
        }
        loginSucceeded = true;
        schedule('header', 'banner', 'page', 'drawer', 'search', 'hero');
      } catch (error) {
        const persistedSession = readPersistedSession();
        if (loginSucceeded || persistedSession) {
          const recoveredSession = persistedSession || store.getState().auth.session;
          if (recoveredSession) {
            store.patch({
              auth: {
                ...store.getState().auth,
                session: recoveredSession,
                selectedCustomer: null,
                loginBusy: false,
              },
              ui: {
                ...store.getState().ui,
                activeModal: null,
                accountMenuOpen: false,
                loginFeedback: null,
              },
            });
            persistSelectedCustomer(null);
            clearPendingFlow(store);
            navigateAuthority(store, 'home');
            schedule('header', 'banner', 'page', 'drawer', 'search', 'hero', 'modals');
            return;
          }
        }
        store.patch({
          auth: {
            ...store.getState().auth,
            loginBusy: false,
          },
        });
        notify(store, 'error', 'يرجى التحقق من اسم المستخدم وكلمة المرور', '');
      }
      return;
    }

    if (formType === 'register') {
      const payload = {
        name: String(form.name?.value || '').trim(),
        phone: String(form.phone?.value || '').trim(),
        password: String(form.password?.value || '').trim(),
        address: String(form.address?.value || '').trim(),
        business_name: String(form.businessName?.value || '').trim(),
        location: String(form.location?.value || '').trim(),
      };
      if (payload.name.split(/\s+/).filter(Boolean).length < 2) return notify(store, 'warning', 'الاسم غير مكتمل', 'اكتب الاسم بالكامل');
      if (!/^01\d{9}$/.test(payload.phone)) return notify(store, 'warning', 'رقم الهاتف غير صحيح', '');
      if (payload.password.length < 4) return notify(store, 'warning', 'كلمة المرور قصيرة', '');
      if (!payload.address) return notify(store, 'warning', 'العنوان مطلوب', '');
      try {
        const pendingFlow = store.getState().ui.pendingFlow;
        const session = normalizeSessionRecord(await registerCustomer(api, payload));
        store.patch({ auth: { ...store.getState().auth, session, selectedCustomer: null }, ui: { ...store.getState().ui, activeModal: null } });
        persistSelectedCustomer(null);
        notify(store, 'success', 'تم التسجيل', session.name || '');
        if (pendingFlow?.name === 'checkout') {
          clearPendingFlow(store);
          notify(store, 'info', 'يرجى مراجعة تفاصيل الطلب قبل الإرسال', '');
          navigateAuthority(store, 'checkout');
        } else {
          clearPendingFlow(store);
          navigateAuthority(store, 'home');
        }
        schedule('header', 'banner', 'page', 'drawer', 'search', 'hero');
      } catch (error) {
        notify(store, 'error', error.message === 'DUPLICATE_PHONE' ? 'الرقم مسجل بالفعل' : 'تعذر التسجيل');
      }
      return;
    }

    if (formType === 'ops-product') {
      const productId = String(form.product_id?.value || '').trim();
      const payload = {
        product_name: String(form.product_name?.value || '').trim(),
        company_id: String(form.company_id?.value || '').trim(),
        category: String(form.category?.value || '').trim(),
        product_image: String(form.product_image?.value || '').trim(),
        visible: form.visible?.checked !== false,
        status: form.status_active?.checked !== false ? 'active' : 'inactive',
      };
      if (!payload.product_name) return notify(store, 'warning', 'اسم المنتج مطلوب', '');
      if (!payload.company_id) return notify(store, 'warning', 'معرف الشركة مطلوب', '');
      try {
        if (productId) {
          await updateOpsProduct(api, productId, payload);
          const priceInputs = document.querySelectorAll('#opsProductUnitPrices .ops-inline-input--price');
          for (const input of priceInputs) {
            const tier = input.getAttribute('data-tier');
            const unit = input.getAttribute('data-unit');
            if (!tier || !unit) continue;
            const val = parseFloat(input.value);
            if (!isNaN(val)) await updateOpsProductUnitPrice(api, productId, unit, tier, val);
          }
          notify(store, 'success', 'تم التحديث', payload.product_name);
        } else {
          await createOpsProduct(api, payload);
          notify(store, 'success', 'تمت الإضافة', payload.product_name);
        }
        const modal = document.getElementById('opsProductModal');
        if (modal) modal.style.display = 'none';
        void loadOpsProductsIntoState(store, api);
        schedule('page');
      } catch (error) {
        notify(store, 'error', 'تعذر حفظ المنتج', error?.message || '');
      }
      return;
    }

    if (formType === 'customer-create') {
      const session = store.getState().auth.session;
      const rawLat = String(form.location_lat?.value || '').trim();
      const rawLng = String(form.location_lng?.value || '').trim();
      const ownershipActorId = getOwnershipActorId(session) || session?.id || '';
      const payload = {
        name: String(form.name?.value || '').trim(),
        phone: String(form.phone?.value || '').trim() || null,
        password: String(form.password?.value || '').trim() || null,
        address: String(form.address?.value || '').trim() || null,
        location: String(form.location?.value || '').trim() || null,
        location_lat: rawLat ? Number(rawLat) : null,
        location_lng: rawLng ? Number(rawLng) : null,
        customer_type: isSalesRepSession(session) ? 'managed' : 'direct',
        sales_rep_id: isSalesRepSession(session) ? ownershipActorId : null,
        created_by: session.id,
        created_by_rep_id: isSalesRepSession(session) ? ownershipActorId : null,
        is_active: true,
      };
      if (!payload.name) return notify(store, 'warning', 'اسم العميل مطلوب', '');
      try {
        const customer = await createCustomer(api, payload);
        store.update((draft) => {
          draft.commerce.customers = [customer, ...(draft.commerce.customers || [])];
          draft.auth.selectedCustomer = customer;
          draft.ui.activeModal = null;
          draft.ui.accountMenuOpen = false;
          draft.ui.customerLocationBusy = false;
          draft.ui.customerLocationError = null;
          draft.ui.customerLocationDraft = { text: '', lat: null, lng: null };
        });
        persistSelectedCustomer(customer);
        notify(store, 'success', 'تمت الإضافة', customer.name || '');
        const pendingFlow = store.getState().ui.pendingFlow;
        if (pendingFlow?.name === 'checkout') {
          clearPendingFlow(store);
          notify(store, 'info', 'يرجى مراجعة تفاصيل الطلب قبل الإرسال', '');
          navigateAuthority(store, 'checkout');
        } else {
          schedule('page', 'header', 'modals');
        }
      } catch {
        notify(store, 'error', 'تعذر إضافة العميل', '');
      }
      return;
    }
  });
}

async function loadInvoicesIntoState(store, api) {
  const state = store.getState();
  const session = normalizeSessionRecord(state.auth.session);
  if (!session) {
    store.update((draft) => { draft.commerce.invoices = []; draft.runtime.loading.invoices = false; });
    return;
  }

  let rows = [];
  if (hasOperationalAccess(session)) {
    const managerOrders = Array.isArray(state.runtime?.manager?.teamOrders) ? state.runtime.manager.teamOrders : [];
    const managerCustomers = Array.isArray(state.runtime?.manager?.teamCustomers) ? state.runtime.manager.teamCustomers : [];
    const customerNames = new Map(managerCustomers.map((customer) => [String(customer.id), customer.name || customer.phone || '']));
    rows = managerOrders.map((row) => ({
      ...row,
      customer_name: customerNames.get(String(row.customer_id)) || row.customer_name || '',
    }));
    if (!rows.length) {
      rows = await api.get('orders', {
        select: '*',
        order: 'created_at.desc',
      }).catch(() => []);
      rows = Array.isArray(rows) ? rows.map((row) => ({ ...row, customer_name: row.customer_name || '' })) : [];
    }
  } else if (isSalesRepSession(session)) {
    const ownershipActorId = getOwnershipActorId(session) || session.id;
    const customers = state.commerce.customers?.length ? state.commerce.customers : await loadRepCustomers(api, session).catch(() => []);
    const customerIds = Array.from(new Set((customers || []).map((customer) => String(customer.id || '').trim()).filter(Boolean)));
    const filters = [`sales_rep_id.eq.${ownershipActorId}`, `rep_id.eq.${ownershipActorId}`];
    if (customerIds.length) filters.push(`customer_id.in.(${customerIds.join(',')})`);
    rows = await api.get('orders', {
      select: '*',
      or: `(${filters.join(',')})`,
      order: 'created_at.desc',
    }).catch(() => []);

    const customerNames = new Map((customers || []).map((customer) => [String(customer.id), customer.name || customer.phone || '']));
    rows = Array.isArray(rows) ? rows.map((row) => ({
      ...row,
      customer_name: customerNames.get(String(row.customer_id)) || row.customer_name || '',
    })) : [];
  } else {
    rows = await api.get('orders', {
      select: '*',
      or: `(customer_id.eq.${session.id})`,
      order: 'created_at.desc',
    }).catch(() => []);
    rows = Array.isArray(rows) ? rows.map((row) => ({ ...row, customer_name: session.name || session.username || '' })) : [];
  }

  store.update((draft) => { draft.commerce.invoices = rows; draft.runtime.loading.invoices = false; });
  persistInvoices(rows);
}

async function loadOpsProductsIntoState(store, api) {
  const current = store.getState().runtime.opsProducts;
  if (current.loading) return;
  store.update((draft) => {
    draft.runtime.opsProducts.loading = true;
    draft.runtime.opsProducts.error = null;
  }, { silent: true });
  try {
    const products = await loadOpsProducts(api);
    store.update((draft) => {
      draft.runtime.opsProducts = { loaded: true, loading: false, error: null, products };
    }, { dirty: ['page'] });
  } catch (error) {
    store.update((draft) => {
      draft.runtime.opsProducts = { loaded: false, loading: false, error: error?.message || 'LOAD_FAILED', products: [] };
    }, { dirty: ['page'] });
  }
}

async function loadRepIntoState(store, api) {
  const state = store.getState();
  const session = state.auth.session;
  if (!isSalesRepSession(session)) return;
  if (state.runtime.rep.loading) return;
  store.update((draft) => { draft.runtime.rep.loading = true; }, { silent: true });
  try {
    const [customers, orders] = await Promise.all([
      loadRepCustomers(api, session),
      loadRepOrders(api, session),
    ]);
    store.update((draft) => {
      draft.runtime.rep = { loaded: true, loading: false, error: null, customers: Array.isArray(customers) ? customers : [], orders: Array.isArray(orders) ? orders : [] };
    }, { dirty: ['page'] });
  } catch (error) {
    store.update((draft) => {
      draft.runtime.rep = { loaded: false, loading: false, error: error?.message || 'LOAD_FAILED', customers: [], orders: [] };
    }, { dirty: ['page'] });
  }
}

async function loadCustomersIntoState(store, api, session = null) {
  const state = store.getState();
  const rep = session || state.auth.session;
  if (hasOperationalAccess(rep)) {
    const managerCustomers = Array.isArray(state.runtime?.manager?.teamCustomers) ? state.runtime.manager.teamCustomers : [];
    if (managerCustomers.length) {
      store.update((draft) => { draft.commerce.customers = managerCustomers; draft.runtime.loading.customers = false; });
      return;
    }
    const rows = await api.get('customers', {
      select: '*',
      order: 'created_at.desc',
      limit: '100',
    }).catch(() => []);
    store.update((draft) => { draft.commerce.customers = Array.isArray(rows) ? rows : []; draft.runtime.loading.customers = false; });
    return;
  }
  if (!isSalesRepSession(rep)) {
    store.update((draft) => { draft.commerce.customers = []; draft.runtime.loading.customers = false; });
    return;
  }
  const rows = await loadRepCustomers(api, rep);
  store.update((draft) => { draft.commerce.customers = rows; draft.runtime.loading.customers = false; });
}

async function performCheckout(store, api, schedule) {
  const state = store.getState();
  const tier = getSelectedTier(state);
  const totals = computeCartTotals(state);
  const validation = validateCheckout(state, tier, totals);
  if (!validation.ok) {
    notify(store, 'warning', 'تعذر الإرسال', validation.message);
    return false;
  }

  setCheckoutBusy(store, true);
  try {
    const result = await submitOrder(api, state, tier, totals);
    const invoice = {
      id: result.order.id,
      order_number: result.order.order_number,
      invoice_number: result.order.invoice_number,
      created_at: result.order.created_at || new Date().toISOString(),
      total_amount: result.order.total_amount,
      status: result.order.status,
      workflow_state_key: result.order.workflow_state_key || 'pending',
      user_type: result.order.user_type,
      customer_id: result.order.customer_id,
      user_id: result.order.user_id,
      sales_rep_id: result.order.sales_rep_id,
      customer_name: result.customer?.name || state.auth.selectedCustomer?.name || state.auth.session?.name || '',
    };
    const whatsappUrl = buildWhatsAppInvoice({
      order: result.order,
      items: state.commerce.cart,
      session: state.auth.session,
      customer: result.customer,
      tierLabel: tier.visible_label || tier.tier_name,
      supportWhatsapp: api.config.supportWhatsapp,
    });
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    store.update((draft) => {
      draft.commerce.cart = [];
      draft.commerce.invoices = [invoice, ...(draft.commerce.invoices || [])];
      draft.ui.drawerOpen = false;
      draft.ui.activeModal = null;
      draft.ui.accountMenuOpen = false;
      draft.ui.pendingFlow = null;
    });
    clearCart();
    persistInvoices([invoice, ...(state.commerce.invoices || [])]);
    notify(store, 'success', 'تم إرسال الطلب', `فاتورة ${invoice.order_number || invoice.invoice_number || invoice.id}`);
    appendBehaviorEvent('checkout.submit', { orderId: invoice.id, total: totals.grand });
    schedule('header', 'banner', 'page', 'drawer');
    navigateAuthority(store, 'invoices');
    return true;
  } catch (error) {
    console.error(error);
    notify(store, 'error', 'فشل إرسال الطلب', '');
    return false;
  } finally {
    setCheckoutBusy(store, false);
  }
}

export async function bootstrapApp() {
  const config = readConfig();
  const api = createApiClient(config);
  const store = createStore(createInitialData());
  store.patch({
    commerce: { ...store.getState().commerce, catalog: createEmptyCatalog() },
    runtime: { ...store.getState().runtime, companyRowsCache: {} },
  }, { silent: true });
  setTheme(store.getState().ui.theme);

  const bootState = store.getState();
  const bootId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  setRuntimePhase(store, RUNTIME_PHASES.RESTORING_SESSION, { bootId, locked: true, error: null, sessionRestored: false, authorityResolved: false, pricingReady: false, cartSynced: false });
  const restoredAuth = restoreAuthRuntimeState(bootState.auth);
  const authoritativeSession = normalizeSessionRecord(restoredAuth.session);
  store.patch({ auth: { ...bootState.auth, session: authoritativeSession, selectedCustomer: restoredAuth.selectedCustomer } });
  setRuntimePhase(store, RUNTIME_PHASES.RESOLVING_AUTHORITY, { sessionRestored: true, authorityResolved: true });

  const app = document.getElementById('app');
  const initialRouteName = parseRoute(location.hash || '#home').name;
  bootstrapShell(app, initialRouteName);
  const nodes = getNodes();
  const scheduler = createRenderLoop({
    header: () => { if (!isRuntimeInteractive(store.getState())) return; if (!nodes.header) return; return renderHeader(nodes.header, store.getState()); },
    theme: () => { if (!isRuntimeInteractive(store.getState())) return; if (nodes.theme) { nodes.theme.innerHTML = renderThemeSwitcher(store.getState()); setTheme(store.getState().ui.theme); } },
    banner: () => { if (!isRuntimeInteractive(store.getState())) return; if (!nodes.banner) return; return renderBanner(nodes.banner, store.getState()); },
    search: () => { if (!isRuntimeInteractive(store.getState())) return; if (!nodes.search) return; return renderSearchBar(nodes.search, store.getState(), { routeName: store.getState().app.route.name, show: false }); },
    hero: () => { if (!isRuntimeInteractive(store.getState())) return; if (!nodes.hero) return; return renderHero(nodes.hero, store.getState(), { mode: store.getState().app.route.name === 'home' ? 'home' : 'none' }); },
    page: () => renderContent(),
    footer: () => { if (!isRuntimeInteractive(store.getState())) return; if (!nodes.footer) return; return renderFooter(nodes.footer, store.getState()); },
    floating: () => { if (!isRuntimeInteractive(store.getState())) return; if (nodes.floating) nodes.floating.innerHTML = renderFloatingExecutionBar(store.getState()); },
    drawer: () => { if (!isRuntimeInteractive(store.getState())) return; if (nodes.drawerHost) nodes.drawerHost.innerHTML = renderDrawer(store.getState()); },
    modals: () => {
      if (!isRuntimeInteractive(store.getState())) return;
      if (!nodes.modalHost) return;
      const activeProduct = store.getState().ui.activeModal === 'product' && store.getState().ui.selectedProductId ? store.getState().commerce.catalog.productIndex[store.getState().ui.selectedProductId] : null;
      nodes.modalHost.innerHTML = [renderLoginModal(store.getState()), renderCustomerModal(store.getState()), renderProductModal(store.getState(), activeProduct), renderInvoiceModal(store.getState())].join('');
    },
    toast: () => { if (!isRuntimeInteractive(store.getState())) return; if (nodes.toastHost) nodes.toastHost.innerHTML = renderToasts(store.getState()); },
    searchResults: () => renderGlobalSearchResults(store, nodes),
  });
  function renderGlobalSearchResults(store, nodes) {
    if (!isRuntimeInteractive(store.getState())) return;
    const el = document.getElementById('globalSearchResults');
    if (!el) return;
    const state = store.getState();
    const q = String(state.ui.search || '').trim();
    if (!q) { el.classList.add('is-hidden'); el.innerHTML = ''; return; }
    const products = Object.values(state.commerce.catalog.productIndex || {});
    const matched = products.filter((p) => {
      const name = String(p.product_name || '').toLowerCase();
      const id = String(p.product_id || '').toLowerCase();
      const ql = q.toLowerCase();
      return name.includes(ql) || id.includes(ql);
    }).slice(0, 5);
    if (!matched.length) { el.classList.add('is-hidden'); el.innerHTML = ''; return; }
    el.classList.remove('is-hidden');
    el.innerHTML = matched.map((p) => `
      <div class="header-search__result-item" data-action="global-search-select" data-product-id="${dom.escape(String(p.product_id))}">
        ${p.product_image ? `<img class="header-search__result-thumb" src="${dom.escape(p.product_image)}" alt="" loading="lazy" />` : '<span class="header-search__result-thumb"></span>'}
        <span class="header-search__result-name">${dom.escape(p.product_name || '—')}</span>
        <span class="header-search__result-meta">${dom.escape(p.company_name || '')}</span>
      </div>
    `).join('') + `<div class="header-search__result-item" data-action="go-search" style="justify-content:center;color:var(--primary,#0052cc);font-weight:600;">عرض الكل (${products.filter((p) => String(p.product_name || '').toLowerCase().includes(q.toLowerCase()) || String(p.product_id || '').toLowerCase().includes(q.toLowerCase())).length})</div>`;
  }

  function renderContent() {
    const state = store.getState();
    const phase = state.runtime?.lifecycle?.phase || RUNTIME_PHASES.BOOTING;
    const focusSnapshot = state.app.route.name === 'search' ? captureSearchFocus() : null;
    const booting = !isRuntimeInteractive(state);

    if (state.app.route.name === 'admin') {
      if (nodes.adminHeader) nodes.adminHeader.innerHTML = renderAdminHeader(state);
      if (nodes.adminSidebar) nodes.adminSidebar.innerHTML = renderAdminSidebar(state);
      if (nodes.adminPage) nodes.adminPage.innerHTML = renderAdminDashboardPage(state);
      if (nodes.modalHost) nodes.modalHost.innerHTML = '';
      if (nodes.toastHost) nodes.toastHost.innerHTML = renderToasts(state);
      return;
    }

    if (booting) {
      const message = phase === RUNTIME_PHASES.FAILED
        ? (state.app.lastError || state.runtime?.lifecycle?.error || 'تعذر تهيئة النظام')
        : 'جارٍ تهيئة البيانات…';
      if (nodes.page) nodes.page.innerHTML = `<section class="page-section"><div class="empty-state">${message}</div></section>`;
      if (nodes.modalHost) nodes.modalHost.innerHTML = '';
      if (nodes.drawerHost) nodes.drawerHost.innerHTML = '';
      if (nodes.toastHost) nodes.toastHost.innerHTML = '';
      if (nodes.opsNav) nodes.opsNav.innerHTML = '';
      setTheme(state.ui.theme);
      syncBodyShellHeight();
      applyBodyFlags();
      return;
    }

    if (state.app.route.name === 'rep') {
      if (nodes.page) nodes.page.innerHTML = renderRepDashboardPage(state);
      if (nodes.opsNav) nodes.opsNav.innerHTML = renderOpsNavigation(state);
      if (nodes.drawerHost) nodes.drawerHost.innerHTML = renderDrawer(state);
      if (nodes.toastHost) nodes.toastHost.innerHTML = renderToasts(state);
      setTheme(state.ui.theme);
      syncBodyShellHeight();
      applyBodyFlags();
      return;
    }

    if (state.app.route.name === 'ops' || state.app.route.name === 'sales-manager') {
      if (nodes.page) nodes.page.innerHTML = renderOpsDashboardPage(state);
      if (nodes.opsNav) nodes.opsNav.innerHTML = renderOpsNavigation(state);
      if (nodes.drawerHost) nodes.drawerHost.innerHTML = renderDrawer(state);
      if (nodes.toastHost) nodes.toastHost.innerHTML = renderToasts(state);
      setTheme(state.ui.theme);
      syncBodyShellHeight();
      applyBodyFlags();
      return;
    }
    const route = state.app.route.name;
    let html = '';
    if (route === 'home') html = renderHomePage(state);
    else if (route === 'companies') html = renderCompaniesPage(state);
    else if (route === 'company') html = renderCompanyPage(state);
    else if (route === 'offers') html = renderOffersPage(state);
    else if (route === 'tiers') html = renderTiersPage(state);
    else if (route === 'cart') html = renderCartPage(state);
    else if (route === 'checkout') html = renderCheckoutPage(state);
    else if (route === 'login') html = renderLoginPage(state);
    else if (route === 'register') html = renderRegisterPage(state);
    else if (route === 'customers') html = renderCustomersPage(state);
    else if (route === 'invoices') html = renderInvoicesPage(state);
    else if (route === 'invoice') html = renderInvoicePage(state);
    else if (route === 'account') html = renderAccountPage(state);
    else if (route === 'search') html = renderSearchPage(state);
    else if (route === 'ops' || route === 'sales-manager') html = renderOpsDashboardPage(state);
    else html = renderHomePage(state);
    nodes.page.innerHTML = html;
    nodes.opsNav.innerHTML = renderOpsNavigation(state);
    nodes.floating.innerHTML = renderFloatingExecutionBar(state);
    nodes.modalHost.innerHTML = [renderLoginModal(state), renderCustomerModal(state), renderProductModal(state, state.ui.selectedProductId ? state.commerce.catalog.productIndex[state.ui.selectedProductId] : null)].join('');
    nodes.drawerHost.innerHTML = renderDrawer(state);
    nodes.toastHost.innerHTML = renderToasts(state);
    nodes.theme.innerHTML = renderThemeSwitcher(state);
    scheduleFloatingExecutionBarVisibility();
    setTheme(state.ui.theme);
    syncBodyShellHeight();
    applyBodyFlags();
    if (focusSnapshot) restoreSearchFocus(focusSnapshot);
  }

  function applyBodyFlags() {
    const state = store.getState();
    const route = state.app.route.name;
    const drawerOpen = Boolean(state.ui.drawerOpen);
    const modalOpen = Boolean(state.ui.activeModal);
    const checkoutRoute = route === 'checkout';
    const shellRoute = route === 'admin' || route === 'rep' || route === 'ops' || route === 'sales-manager';
    const operationalRoute = isOperationalRoute(route);
    if (nodes.search) nodes.search.classList.toggle('is-hidden', operationalRoute || route !== 'search');
    if (nodes.theme) nodes.theme.classList.toggle('is-hidden', shellRoute || route !== 'home' || checkoutRoute);
    if (nodes.hero) nodes.hero.classList.toggle('is-hidden', shellRoute || route !== 'home' || checkoutRoute);
    if (nodes.banner) nodes.banner.classList.toggle('is-hidden', shellRoute);
    if (nodes.footer) nodes.footer.classList.toggle('is-hidden', shellRoute || checkoutRoute);
    if (nodes.opsNav) nodes.opsNav.classList.toggle('is-hidden', !operationalRoute);
    if (nodes.floating) nodes.floating.classList.toggle('is-hidden', shellRoute || checkoutRoute || ['login', 'register', 'invoice'].includes(route));
    document.body.classList.toggle('body--overlay', ['login', 'register'].includes(route));
    document.body.classList.toggle('body--checkout', checkoutRoute);
    document.body.classList.toggle('body--ops', operationalRoute);
    document.body.classList.toggle('body--drawer-open', drawerOpen);
    document.body.classList.toggle('body--modal-open', modalOpen);
  }

  function updateFloatingExecutionBarVisibility() {
    const state = store.getState();
    const route = state?.app?.route?.name || 'home';
    const eligible = shouldRenderFloatingExecutionBar(state);
    const floating = nodes.floating;
    if (!floating) return;
    if (!eligible) {
      floating.classList.remove('is-visible');
      return;
    }
    const header = nodes.header;
    const rect = header?.getBoundingClientRect?.();
    const headerVisible = Boolean(rect && rect.bottom > 0 && rect.height > 0);
    floating.classList.toggle('is-visible', !headerVisible);
  }

  let floatingBarFrame = null;
  function scheduleFloatingExecutionBarVisibility() {
    if (floatingBarFrame !== null) return;
    floatingBarFrame = window.requestAnimationFrame(() => {
      floatingBarFrame = null;
      updateFloatingExecutionBarVisibility();
      syncBodyShellHeight();
    });
  }

  schedulerRef = scheduler;
  store.subscribe((_, meta = {}) => {
    const dirty = Array.isArray(meta.dirty) && meta.dirty.length ? meta.dirty : ['header', 'theme', 'search', 'hero', 'footer', 'floating', 'opsNav', 'page', 'drawer', 'modals', 'toast'];
    scheduler.schedule(...dirty);
  });

  bindInteractions(store, api, (...keys) => scheduler.schedule(...keys));

  window.addEventListener('hashchange', () => {
    const current = store.getState();
    let nextRoute = parseRoute(location.hash);
    const session = normalizeSessionRecord(current.auth.session);
    if (isSalesRepSession(session) && (nextRoute.name === 'admin' || nextRoute.name === 'ops')) {
      nextRoute = { name: 'rep', params: { module: 'dashboard' } };
      location.hash = '#rep';
      return;
    }
    const prevRoute = current.app.route;
    function isShelledRoute(name) { return name === 'admin' || name === 'rep' || name === 'ops' || name === 'sales-manager'; }
    const shellChanged = isShelledRoute(prevRoute.name) !== isShelledRoute(nextRoute.name);
    store.patch({
      app: { ...current.app, route: nextRoute },
      ui: { ...current.ui, accountMenuOpen: false, activeModal: null, drawerOpen: false },
    });
    if (shellChanged) {
      const appEl = document.getElementById('app');
      if (appEl) {
        appEl.innerHTML = '';
        bootstrapShell(appEl, nextRoute.name);
        Object.assign(nodes, getNodes());
      }
    }
    if (nextRoute.name === 'company' && nextRoute.params?.companyId) {
      void ensureCompanyCatalogLoaded(store, api, nextRoute.params.companyId);
    }
    if ((nextRoute.name === 'ops' || nextRoute.name === 'admin') && (nextRoute.params?.module === 'products' || nextRoute.params?.module === 'catalog')) {
      void loadOpsProductsIntoState(store, api);
    }
    if ((nextRoute.name === 'ops' || nextRoute.name === 'admin') && (nextRoute.params?.module === 'orders' || nextRoute.params?.module === 'customers' || nextRoute.params?.module === 'reps')) {
      void loadManagerScopeIntoState(store, api, current.auth.session);
    }
    if (nextRoute.name === 'rep') {
      void loadRepIntoState(store, api);
    }
    scheduler.schedule('page', 'header', 'opsNav', 'repNav', 'adminHeader', 'adminSidebar', 'adminPage');
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      store.patch({ ui: { ...store.getState().ui, drawerOpen: false, activeModal: null, accountMenuOpen: false } });
      scheduler.schedule('drawer', 'modals', 'header');
    }
  });

  window.addEventListener('resize', () => {
    syncBodyShellHeight();
    scheduleFloatingExecutionBarVisibility();
  }, { passive: true });
  window.addEventListener('scroll', () => scheduleFloatingExecutionBarVisibility(), { passive: true });

  if (nodes.floating) {
    nodes.floating.addEventListener('click', (event) => {
      const target = event.target.closest('[data-action="go-checkout"]');
      if (!target) return;
    });
  }

  const bootRoute = parseRoute(location.hash || '#home');
  store.patch({ app: { ...store.getState().app, route: bootRoute } });
  if (bootRoute.name === 'admin' || bootRoute.name === 'rep' || bootRoute.name === 'ops' || bootRoute.name === 'sales-manager') {
    const appEl = document.getElementById('app');
    if (appEl) { appEl.innerHTML = ''; bootstrapShell(appEl, bootRoute.name); Object.assign(nodes, getNodes()); }
    scheduler.schedule('page', 'header', 'opsNav', 'adminHeader', 'adminSidebar');
  }

  // Hydrate catalog and dependent runtime in the background after first paint.
  const initialRoute = store.getState().app.route;
  const initialCompanyId = initialRoute.name === 'company' ? String(initialRoute.params?.companyId || '').trim() : '';
  if ((initialRoute.name === 'ops' || initialRoute.name === 'admin') && (initialRoute.params?.module === 'products' || initialRoute.params?.module === 'catalog')) {
    store.update((draft) => { draft.runtime.opsProducts.loading = true; }, { silent: true });
    void loadOpsProductsIntoState(store, api);
  }
  if ((initialRoute.name === 'ops' || initialRoute.name === 'admin') && (initialRoute.params?.module === 'orders' || initialRoute.params?.module === 'customers' || initialRoute.params?.module === 'reps')) {
    store.update((draft) => { draft.runtime.loading.manager = true; }, { silent: true });
    void loadManagerScopeIntoState(store, api, store.getState().auth.session);
  }
  if (initialRoute.name === 'rep') {
    void loadRepIntoState(store, api);
  }
  store.update((draft) => {
    draft.runtime.loading.catalog = true;
    draft.runtime.loading.session = false;
    draft.runtime.loading.authority = false;
    draft.runtime.loading.pricing = true;
    draft.runtime.loading.customers = false;
    draft.runtime.loading.invoices = false;
    if (initialCompanyId) {
      draft.runtime.loading.company = initialCompanyId;
      draft.runtime.lifecycle.companyProductsLoading = true;
      draft.runtime.lifecycle.companyProductsReady = false;
      draft.runtime.lifecycle.companyProductsFailed = false;
    }
  }, { silent: true });
  setRuntimePhase(store, RUNTIME_PHASES.READY, {
    locked: false,
    catalogReady: false,
    offersReady: false,
    flashOffersReady: false,
    companiesReady: false,
    pricingReady: false,
    cartSynced: false,
    companyProductsReady: Boolean(initialCompanyId ? false : store.getState().runtime.lifecycle?.companyProductsReady),
    companyProductsLoading: Boolean(initialCompanyId),
    companyProductsFailed: false,
  });

  store.update((draft) => {
    draft.runtime.loading.workflow = true;
    draft.runtime.lifecycle.workflowLoading = true;
    draft.runtime.lifecycle.workflowReady = false;
  }, { silent: true });

  void loadWorkflowRuntime(api).then((snapshot) => {
    const nextSnapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};
    store.update((draft) => {
      draft.runtime.workflow = {
        ...draft.runtime.workflow,
        ...nextSnapshot,
      };
      draft.runtime.loading.workflow = false;
      draft.runtime.lifecycle.workflowLoading = false;
      draft.runtime.lifecycle.workflowReady = Boolean(nextSnapshot.loaded);
    }, { dirty: ['opsNav', 'page', 'header'] });
    scheduler.schedule('opsNav', 'page', 'header');
  }).catch((error) => {
    console.error(error);
    store.update((draft) => {
      draft.runtime.loading.workflow = false;
      draft.runtime.lifecycle.workflowLoading = false;
      draft.runtime.lifecycle.workflowReady = false;
    }, { silent: true });
  });
  store.patch({ app: { ...store.getState().app, ready: true } });
  ensureDesktopCSS();
  applyDesktopMode(store.getState().ui.desktopMode === true);
  renderContent();
  scheduleFloatingExecutionBarVisibility();
  scheduler.schedule('header', 'theme', 'banner', 'search', 'hero', 'opsNav', 'page', 'footer', 'floating', 'drawer', 'modals', 'toast');
  purgeLegacyStorage();

  void (async () => {
    await new Promise((resolve) => {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
      else setTimeout(resolve, 0);
    });

    const currentSession = normalizeSessionRecord(store.getState().auth.session);
    if (currentSession) {
      try {
        const projectedSession = await refreshSessionProjection(api, currentSession, { persist: true });
        if (projectedSession) {
          const activeState = store.getState();
          const activeSession = normalizeSessionRecord(activeState.auth.session);
          const nextSession = normalizeSessionRecord(projectedSession);
          const userChanged = activeSession?.id !== nextSession?.id || activeSession?.userType !== nextSession?.userType;
          if (userChanged) {
            store.patch({
              auth: {
                ...activeState.auth,
                session: nextSession,
                selectedCustomer: normalizeUserType(nextSession.userType || nextSession.user_type || nextSession.role || null, null) === 'sales_rep' ? activeState.auth.selectedCustomer : null,
              },
            });
            if (isAdminOnlySession(nextSession)) {
              void loadManagerScopeIntoState(store, api, nextSession, { force: true }).catch(console.error);
            }
            scheduler.schedule('header', 'opsNav', 'page', 'drawer', 'modals', 'searchResults');
          }
        }
      } catch (error) {
        console.error(error);
      }
    }
    let summary = null;
    let selectedTier = normalizeTierName(store.getState().commerce.selectedTier) || null;
    try {
      summary = await loadHomeCatalog(api, selectedTier);
      const currentState = store.getState();
      const tierFromSummary = normalizeTierName(currentState.commerce.selectedTier)
        || normalizeTierName(summary.tiers?.find((tier) => tier.is_default)?.tier_name)
        || normalizeTierName(summary.tiers?.[0]?.tier_name)
        || 'base';
      selectedTier = tierFromSummary;
      const flashState = computeFlashState((summary.offers && summary.offers.flash) || []);
      store.update((draft) => {
        draft.commerce.catalog = {
          ...draft.commerce.catalog,
          ...summary,
          products: [],
          productIndex: {},
          catalogProducts: [],
        };
        draft.commerce.selectedTier = selectedTier;
        draft.commerce.priceBook = { tierName: selectedTier, products: {} };
        draft.runtime.loading.catalog = false;
        draft.runtime.loading.pricing = true;
        draft.runtime.flashState = flashState;
        draft.runtime.lifecycle.catalogReady = true;
        draft.runtime.lifecycle.offersReady = true;
        draft.runtime.lifecycle.flashOffersReady = Boolean((summary.offers?.flash || []).length);
        draft.runtime.lifecycle.companiesReady = Boolean((summary.companies || []).length);
        draft.runtime.lifecycle.pricingReady = true;
        draft.app.lastError = null;
      }, { dirty: ['header', 'banner', 'page', 'hero', 'footer', 'search'] });
      persistSelectedTier(selectedTier);
      scheduler.schedule('header', 'theme', 'banner', 'search', 'hero', 'opsNav', 'page', 'footer', 'floating', 'drawer', 'modals', 'toast');
    } catch (error) {
      console.error(error);
      summary = { companies: [], products: [], productIndex: {}, offers: { daily: [], flash: [] }, tiers: [], settings: [], settingsMap: {}, top: { products: [], companies: [] }, counters: { companies: 0, tiers: 0, deals: 0, flash: 0 }, catalogProducts: [] };
      store.update((draft) => {
        draft.commerce.catalog = { ...draft.commerce.catalog, ...summary };
        draft.runtime.loading.catalog = false;
        draft.runtime.loading.pricing = true;
        draft.runtime.lifecycle.catalogReady = true;
        draft.runtime.lifecycle.offersReady = true;
        draft.runtime.lifecycle.flashOffersReady = true;
        draft.runtime.lifecycle.companiesReady = true;
        draft.runtime.lifecycle.pricingReady = true;
        draft.app.lastError = null;
      }, { dirty: ['header', 'banner', 'page', 'hero', 'footer', 'search'] });
      scheduler.schedule('header', 'theme', 'banner', 'search', 'hero', 'opsNav', 'page', 'footer', 'floating', 'drawer', 'modals', 'toast');
    }

    const tierName = normalizeTierName(selectedTier) || 'base';
    const topProductIds = Array.isArray(summary?.top?.products) ? summary.top.products.map((row) => row?.product_id).filter(Boolean) : [];
    const homeTopProducts = topProductIds.length ? await loadProductsByIds(api, topProductIds, tierName).catch(() => ({ productIndex: {}, products: [], priceBook: buildPriceBook([], summary?.tiers || [], tierName) })) : { productIndex: {}, products: [], priceBook: buildPriceBook([], summary?.tiers || [], tierName) };
    const mergedTopProducts = buildLoadedProductSnapshot(homeTopProducts.productIndex, summary?.tiers || [], tierName);

    store.update((draft) => {
      draft.commerce.catalog.productIndex = mergeProductIndexes(draft.commerce.catalog.productIndex, mergedTopProducts.productIndex);
      draft.commerce.catalog.products = sortLoadedProducts(draft.commerce.catalog.productIndex);
      draft.commerce.priceBook = buildPriceBook(draft.commerce.catalog.products, draft.commerce.catalog.tiers || [], tierName);
      draft.runtime.loading.pricing = false;
      draft.runtime.lifecycle.pricingReady = true;
    }, { dirty: ['page', 'header', 'drawer', 'modals'] });
    const currentLoadedProducts = store.getState().commerce.catalog.productIndex || {};
    const cart = hydrateCart();
    const reconciledCart = Object.keys(currentLoadedProducts).length ? recalcCart(cart, currentLoadedProducts) : cart;
    store.patch({ commerce: { ...store.getState().commerce, cart: reconciledCart } }, { silent: true });
    setRuntimeLifecycle(store, { cartSynced: true });
    persistCart(reconciledCart);
    scheduler.schedule('header', 'banner', 'opsNav', 'page', 'drawer', 'modals', 'toast');

    if (initialCompanyId) {
      void ensureCompanyCatalogLoaded(store, api, initialCompanyId).then(() => {
        const state = store.getState();
        setRuntimePhase(store, state.runtime.lifecycle.phase, {
          companyProductsReady: Boolean(state.runtime.lifecycle?.companyProductsReady),
          companyProductsLoading: false,
          companyProductsFailed: Boolean(state.runtime.lifecycle?.companyProductsFailed),
        });
      });
    }

    const session = store.getState().auth.session;
    if (isAdminOnlySession(session)) {
      store.update((draft) => { draft.runtime.loading.manager = true; }, { silent: true });
      void loadManagerScopeIntoState(store, api, session)
        .then(() => {
          store.update((draft) => { draft.runtime.loading.customers = true; }, { silent: true });
          void loadCustomersIntoState(store, api, session);
          store.update((draft) => { draft.runtime.loading.invoices = true; }, { silent: true });
          void loadInvoicesIntoState(store, api);
        })
        .catch(console.error);
    } else {
      if (isSalesRepSession(session)) {
        store.update((draft) => { draft.runtime.loading.customers = true; }, { silent: true });
        void loadCustomersIntoState(store, api, session);
      }
      store.update((draft) => { draft.runtime.loading.invoices = true; }, { silent: true });
      void loadInvoicesIntoState(store, api);
    }
    if (isSalesRepSession(session) && !isAdminOnlySession(session)) {
      const currentRoute = store.getState().app.route;
      if (currentRoute.name === 'home' || currentRoute.name === 'ops') {
        navigateAuthority(store, 'rep');
      }
      void loadRepIntoState(store, api);
    }
  })();

  setInterval(() => {
    const state = store.getState();
    const offers = state.commerce.catalog.offers.flash || [];
    const flashState = computeFlashState(offers);
    store.patch({ runtime: { ...state.runtime, flashState, flashTick: Date.now() } }, { dirty: ['hero', 'header'] });
    if (state.app.route.name === 'home') scheduler.schedule('hero', 'header');
  }, 1000);

  return { store, api, scheduler };
}
