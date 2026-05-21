import { dom } from '../../core/dom.js';
import { performAiSearch } from '../../services/aiSearchService.js';
import { normalizeSessionRecord } from '../../services/authService.js';
import { formatMoney } from '../../services/invoiceService.js';

export const SEARCH_DEBOUNCE_MS = 900;

let searchTypingTimer = null;

export function cancelSearch() {
  clearTimeout(searchTypingTimer);
}

export function scheduleSearch(schedule, isGlobal) {
  clearTimeout(searchTypingTimer);
  searchTypingTimer = setTimeout(() => schedule(isGlobal ? 'searchResults' : 'page', 'searchResults', 'search'), SEARCH_DEBOUNCE_MS);
}

export function clearSearchResults() {
  clearTimeout(searchTypingTimer);
  const el = document.getElementById('globalSearchResults');
  if (el) { el.classList.add('is-hidden'); el.innerHTML = ''; }
}

export function renderGlobalSearchResults(store, api, isRuntimeInteractive) {
  if (!isRuntimeInteractive(store.getState())) return;
  const el = document.getElementById('globalSearchResults');
  if (!el) return;
  const state = store.getState();
  const q = String(state.ui.search || '').trim();
  if (!q) { el.classList.add('is-hidden'); el.innerHTML = ''; return; }
  const session = normalizeSessionRecord(state.auth.session);
  void performAiSearch(q, session, state, api).then((results) => {
    if (String(store.getState().ui.search || '').trim() !== q) return;
    renderAiSearchResults(el, results, q);
  });
}

function renderAiSearchResults(el, results, q) {
  const products = (results.products || []).slice(0, 4);
  const customers = (results.customers || []).slice(0, 3);
  const invoices = (results.invoices || []).slice(0, 3);
  const companies = (results.companies || []).slice(0, 3);
  const allMatched = [...products, ...companies, ...customers, ...invoices];
  if (!allMatched.length) { el.classList.add('is-hidden'); el.innerHTML = ''; return; }
  el.classList.remove('is-hidden');
  const productHtml = products.length ? '<div class="header-search__group-label">المنتجات</div>' + products.map((p) => '<div class="header-search__result-item" data-action="global-search-select" data-product-id="' + dom.escape(String(p.id)) + '"><span class="header-search__result-thumb"></span><span class="header-search__result-name">' + dom.escape(p.product_name || '—') + '</span><span class="header-search__result-meta">' + dom.escape(p.company_name || 'منتج') + '</span></div>').join('') : '';
  const companyHtml = companies.length ? '<div class="header-search__group-label">الشركات</div>' + companies.map((c) => '<div class="header-search__result-item" data-action="open-company" data-company-id="' + dom.escape(String(c.id)) + '"><span class="header-search__result-thumb"></span><span class="header-search__result-name">' + dom.escape(c.company_name || '—') + '</span><span class="header-search__result-meta">شركة</span></div>').join('') : '';
  const customerHtml = customers.length ? '<div class="header-search__group-label">العملاء</div>' + customers.map((c) => '<div class="header-search__result-item" data-action="select-customer" data-customer-id="' + dom.escape(String(c.id)) + '"><span class="header-search__result-thumb"></span><span class="header-search__result-name">' + dom.escape(c.name || '—') + '</span><span class="header-search__result-meta">' + dom.escape(c.phone || 'عميل') + '</span></div>').join('') : '';
  const invoiceHtml = invoices.length ? '<div class="header-search__group-label">الفواتير</div>' + invoices.map((inv) => '<div class="header-search__result-item" data-action="view-invoice" data-invoice-id="' + dom.escape(String(inv.id || inv.order_number || inv.invoice_number || '')) + '"><span class="header-search__result-thumb"></span><span class="header-search__result-name">فاتورة #' + dom.escape(String(inv.order_number || inv.invoice_number || inv.id || '')) + '</span><span class="header-search__result-meta">' + (inv.total_amount ? dom.escape(formatMoney(inv.total_amount)) : '') + '</span></div>').join('') : '';
  el.innerHTML = [productHtml, companyHtml, customerHtml, invoiceHtml].join('');
}
