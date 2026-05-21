import { normalizeSessionRecord, isSalesRepSession, hasOperationalAccess } from './authService.js';
import { canViewCustomer, canViewInvoice, buildOwnershipFilter } from './ownershipService.js';
import { productAvailability, getAvailabilityLabel, getAvailabilityBadgeClass } from '../runtime/modules/availabilityRuntime.js';

const AI_SEARCH_ENDPOINT = '/api/ai-search';
const AI_SEARCH_TIMEOUT = 10000;
let searchCache = {};
let activeController = null;

function normalize(value) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function fuzzyMatch(text, query) {
  const t = normalize(text);
  const q = normalize(query);
  if (!t || !q) return false;
  if (t.includes(q)) return true;
  const qWords = q.split(/\s+/);
  return qWords.some((word) => word.length > 1 && t.includes(word));
}

function hasAnyResults(results) {
  return results && (results.products.length > 0 || results.companies.length > 0 || results.customers.length > 0 || results.invoices.length > 0);
}

function collectLocalCandidates(query, session, state) {
  const q = String(query || '').trim();
  if (!q) return { products: [], companies: [], customers: [], invoices: [] };
  const filtered = { products: [], companies: [], customers: [], invoices: [] };

  const allProducts = Object.values(state.commerce?.catalog?.productIndex || {});
  for (const p of allProducts) {
    if (fuzzyMatch(p.product_name, q) || fuzzyMatch(p.company_name, q) || fuzzyMatch(p.product_id, q)) {
      const availState = productAvailability(p);
      filtered.products.push({
        id: p.product_id, product_name: p.product_name, company_name: p.company_name,
        product_image: p.product_image, _type: 'product',
        _availability: availState,
        _availabilityLabel: getAvailabilityLabel(availState),
        _availabilityBadgeClass: getAvailabilityBadgeClass(availState),
      });
    }
  }

  const allCompanies = state.commerce?.catalog?.companies || [];
  for (const c of allCompanies) {
    if (fuzzyMatch(c.company_name, q) || fuzzyMatch(c.company_id, q)) {
      filtered.companies.push({ id: c.company_id, company_name: c.company_name, company_logo: c.company_logo, _type: 'company' });
    }
  }

  const allCustomers = state.commerce?.customers || [];
  for (const c of allCustomers) {
    if (!session || !canViewCustomer(session, c)) continue;
    if (fuzzyMatch(c.name, q) || fuzzyMatch(c.business_name, q) || fuzzyMatch(c.phone, q)) {
      filtered.customers.push({ id: c.id, name: c.name || c.business_name || '', phone: c.phone || '', _type: 'customer' });
    }
  }

  const allInvoices = state.commerce?.invoices || [];
  for (const inv of allInvoices) {
    if (!session || !canViewInvoice(session, inv)) continue;
    if (fuzzyMatch(inv.order_number, q) || fuzzyMatch(inv.invoice_number, q) || fuzzyMatch(inv.id, q) || fuzzyMatch(inv.customer_name, q)) {
      filtered.invoices.push({ id: inv.id, order_number: inv.order_number || inv.invoice_number || inv.id, customer_name: inv.customer_name || '', total_amount: inv.total_amount, _type: 'invoice' });
    }
  }

  return filtered;
}

async function fetchDBCandidates(api, query, session) {
  const q = String(query || '').trim();
  if (!q) return { products: [], companies: [], customers: [], invoices: [] };

  const escaped = q.replace(/'/g, "''");
  const likePattern = `*${escaped}*`;
  const results = { products: [], companies: [], customers: [], invoices: [] };
  const normalized = normalizeSessionRecord(session);

  try {
    const products = await api.get('products', {
      or: `(product_name.ilike.${likePattern},company_name.ilike.${likePattern})`,
      limit: '10',
      select: '*',
    }).catch(() => []);
    const list = Array.isArray(products) ? products : [];
    for (const p of list) {
      const availState = productAvailability(p);
      results.products.push({
        id: p.product_id, product_name: p.product_name, company_name: p.company_name,
        product_image: p.product_image, _type: 'product',
        _availability: availState,
        _availabilityLabel: getAvailabilityLabel(availState),
        _availabilityBadgeClass: getAvailabilityBadgeClass(availState),
      });
    }
  } catch (_) { /* fall through */ }

  try {
    const companies = await api.get('companies', {
      company_name: `ilike.${likePattern}`,
      limit: '5',
      select: '*',
    }).catch(() => []);
    const list = Array.isArray(companies) ? companies : [];
    for (const c of list) {
      results.companies.push({
        id: c.company_id, company_name: c.company_name, company_logo: c.company_logo, _type: 'company',
      });
    }
  } catch (_) { /* fall through */ }

  try {
    const ownership = buildOwnershipFilter(normalized, { table: 'customers' });
    const searchOr = `(name.ilike.${likePattern},phone.ilike.${likePattern},business_name.ilike.${likePattern})`;
    const params = { limit: '10', select: '*' };
    if (ownership.or) {
      params.and = `(${searchOr},${ownership.or})`;
    } else if (ownership.customer_id) {
      params.or = searchOr;
      params.customer_id = ownership.customer_id;
    } else {
      params.or = searchOr;
    }
    const customers = await api.get('customers', params).catch(() => []);
    const list = Array.isArray(customers) ? customers : [];
    for (const c of list) {
      if (normalized && !canViewCustomer(normalized, c)) continue;
      results.customers.push({
        id: c.id, name: c.name || c.business_name || '', phone: c.phone || '', _type: 'customer',
      });
    }
  } catch (_) { /* fall through */ }

  try {
    const ownership = buildOwnershipFilter(normalized);
    const searchOr = `(order_number.ilike.${likePattern},invoice_number.ilike.${likePattern},customer_name.ilike.${likePattern})`;
    const params = { limit: '10', select: '*' };
    if (ownership.or) {
      params.and = `(${searchOr},${ownership.or})`;
    } else if (ownership.customer_id) {
      params.or = searchOr;
      params.customer_id = ownership.customer_id;
    } else {
      params.or = searchOr;
    }
    const invoices = await api.get('orders', params).catch(() => []);
    const list = Array.isArray(invoices) ? invoices : [];
    for (const inv of list) {
      if (normalized && !canViewInvoice(normalized, inv)) continue;
      results.invoices.push({
        id: inv.id, order_number: inv.order_number || inv.invoice_number || inv.id,
        customer_name: inv.customer_name || '', total_amount: inv.total_amount, _type: 'invoice',
      });
    }
  } catch (_) { /* fall through */ }

  return results;
}

function groupRankedResults(ranked) {
  const grouped = { products: [], companies: [], customers: [], invoices: [] };
  for (const r of ranked) {
    const t = r._type;
    if (t === 'product') grouped.products.push(r);
    else if (t === 'company') grouped.companies.push(r);
    else if (t === 'customer') grouped.customers.push(r);
    else if (t === 'invoice') grouped.invoices.push(r);
  }
  return grouped;
}

export async function performAiSearch(query, session, state, api) {
  const q = String(query || '').trim();
  if (!q) return { products: [], companies: [], customers: [], invoices: [], ranked: false };

  const cacheKey = q + ':' + (session?.id || 'anon');
  const cached = searchCache[cacheKey];
  if (cached && Date.now() - cached.ts < 15000) {
    return cached.data;
  }

  if (activeController) {
    activeController.abort();
  }
  activeController = new AbortController();
  const signal = activeController.signal;

  let dbResults = null;
  if (api) {
    try {
      dbResults = await fetchDBCandidates(api, q, session);
    } catch (_) { /* fall through */ }
  }

  const local = dbResults && hasAnyResults(dbResults) ? dbResults : collectLocalCandidates(q, session, state);

  const allCandidates = [
    ...local.products.map(function(c) { return { ...c, _type: 'product' }; }),
    ...local.companies.map(function(c) { return { ...c, _type: 'company' }; }),
    ...local.customers.map(function(c) { return { ...c, _type: 'customer' }; }),
    ...local.invoices.map(function(c) { return { ...c, _type: 'invoice' }; }),
  ];

  if (!allCandidates.length) {
    return { products: [], companies: [], customers: [], invoices: [], ranked: false };
  }

  const totalCount = local.products.length + local.companies.length + local.customers.length + local.invoices.length;
  if (totalCount <= 6) {
    const result = { products: local.products, companies: local.companies, customers: local.customers, invoices: local.invoices, ranked: false };
    searchCache[cacheKey] = { ts: Date.now(), data: result };
    return result;
  }

  const body = { query: q, candidates: allCandidates.slice(0, 30) };
  const timeoutPromise = new Promise(function(_, reject) { setTimeout(function() { reject(new Error('TIMEOUT')); }, AI_SEARCH_TIMEOUT); });

  try {
    const response = await Promise.race([
      fetch(AI_SEARCH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: signal,
      }),
      timeoutPromise,
    ]);

    if (!response.ok) throw new Error('STATUS_' + response.status);

    const data = await response.json();
    const ranked = Array.isArray(data?.results) ? data.results : [];
    const grouped = groupRankedResults(ranked);
    const result = { ...grouped, ranked: true };
    searchCache[cacheKey] = { ts: Date.now(), data: result };
    return result;
  } catch (err) {
    if (err.name === 'AbortError') return { products: local.products, companies: local.companies, customers: local.customers, invoices: local.invoices, ranked: false };
    searchCache[cacheKey] = { ts: Date.now(), data: { products: local.products, companies: local.companies, customers: local.customers, invoices: local.invoices, ranked: false } };
    return { products: local.products, companies: local.companies, customers: local.customers, invoices: local.invoices, ranked: false };
  } finally {
    if (activeController && activeController.signal === signal) activeController = null;
  }
}
