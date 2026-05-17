import { firstRow, normalizeId, paginateAll, toBoolean, toNumber } from './_utils.js';

function normalizeProductRow(row) {
  const productId = normalizeId(row?.product_id ?? row?.id ?? '');
  return {
    id: productId,
    product_id: productId,
    product_name: normalizeId(row?.product_name ?? row?.name ?? ''),
    description: normalizeId(row?.description ?? ''),
    sku: normalizeId(row?.sku ?? ''),
    category: normalizeId(row?.category ?? ''),
    company_id: normalizeId(row?.company_id ?? ''),
    company_name: normalizeId(row?.company_name ?? ''),
    operational_notes: normalizeId(row?.operational_notes ?? row?.notes ?? ''),
    stock_quantity: toNumber(row?.stock_quantity ?? row?.available_qty ?? 0),
    stock_status: normalizeId(row?.stock_status ?? row?.status ?? ''),
    inventory_notes: normalizeId(row?.inventory_notes ?? ''),
    unit_inventory_control: toBoolean(row?.unit_inventory_control ?? true, true),
    availability_state: normalizeId(row?.availability_state ?? row?.visibility_state ?? ''),
    base_price: toNumber(row?.base_price ?? row?.final_price ?? 0),
    unit_price: toNumber(row?.unit_price ?? row?.price ?? row?.final_price ?? 0),
    tier_price: toNumber(row?.tier_price ?? 0),
    emergency_price: toNumber(row?.emergency_price ?? 0),
    operational_price_override: toNumber(row?.operational_price_override ?? 0),
    price_locked: toBoolean(row?.price_locked ?? false, false),
    images: Array.isArray(row?.images) ? row.images : [],
    primary_image: normalizeId(row?.primary_image ?? row?.product_image ?? ''),
    visibility: normalizeId(row?.visibility ?? row?.status ?? 'active'),
    active: toBoolean(row?.active ?? row?.visible ?? true, true),
    hidden: toBoolean(row?.hidden ?? false, false),
    archived: toBoolean(row?.archived ?? false, false),
    out_of_stock: toBoolean(row?.out_of_stock ?? false, false),
    flash_offer: toBoolean(row?.flash_offer ?? false, false),
    daily_deal: toBoolean(row?.daily_deal ?? false, false),
    raw: row,
  };
}

async function loadCatalogRows(api, params = {}) {
  const rows = await paginateAll(api, 'v_catalog_products', {
    select: '*',
    order: 'product_name.asc',
    ...params,
  }, 250);
  return rows.map(normalizeProductRow);
}

export async function getProducts(api, params = {}) {
  return loadCatalogRows(api, params);
}

export async function getProduct(api, productId) {
  const id = normalizeId(productId);
  if (!id) return null;
  const rows = await loadCatalogRows(api, { product_id: `eq.${id}`, limit: '1' }).catch(() => []);
  return firstRow(rows);
}

export async function createProduct(api, payload = {}) {
  const rows = await api.post('products', payload).catch((error) => { throw error; });
  return firstRow(Array.isArray(rows) ? rows : [rows]);
}

export async function updateProduct(api, productId, payload = {}) {
  const id = normalizeId(productId);
  if (!id) throw new Error('INVALID_PRODUCT_ID');
  const rows = await api.patch('products', payload, { product_id: `eq.${id}` }).catch((error) => { throw error; });
  return firstRow(Array.isArray(rows) ? rows : [rows]);
}

export async function updateInventory(api, productId, payload = {}) {
  const id = normalizeId(productId);
  if (!id) throw new Error('INVALID_PRODUCT_ID');
  const rows = await api.patch('product_inventory', payload, { product_id: `eq.${id}` }).catch((error) => { throw error; });
  return firstRow(Array.isArray(rows) ? rows : [rows]);
}

export async function updatePricing(api, productId, payload = {}) {
  const id = normalizeId(productId);
  if (!id) throw new Error('INVALID_PRODUCT_ID');
  const rows = await api.patch('product_pricing', payload, { product_id: `eq.${id}` }).catch((error) => { throw error; });
  return firstRow(Array.isArray(rows) ? rows : [rows]);
}

export async function updateTierPricing(api, productId, payload = {}) {
  const id = normalizeId(productId);
  if (!id) throw new Error('INVALID_PRODUCT_ID');
  const rows = await api.patch('product_tier_pricing', payload, { product_id: `eq.${id}` }).catch((error) => { throw error; });
  return firstRow(Array.isArray(rows) ? rows : [rows]);
}

export async function updateVisibility(api, productId, payload = {}) {
  const id = normalizeId(productId);
  if (!id) throw new Error('INVALID_PRODUCT_ID');
  const rows = await api.patch('products', payload, { product_id: `eq.${id}` }).catch((error) => { throw error; });
  return firstRow(Array.isArray(rows) ? rows : [rows]);
}

export async function archiveProduct(api, productId) {
  return updateVisibility(api, productId, { archived: true, active: false, visibility: 'archived' });
}
