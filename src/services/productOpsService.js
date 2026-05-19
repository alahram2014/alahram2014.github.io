import { normalizeTierName } from './pricingService.js';

function normalizeSpacing(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeOpsProductRow(row) {
  return {
    product_id: normalizeSpacing(row.product_id ?? ''),
    product_name: normalizeSpacing(row.product_name ?? ''),
    company_id: normalizeSpacing(row.company_id ?? ''),
    company_name: normalizeSpacing(row.company_name ?? ''),
    company_logo: String(row.company_logo ?? '').trim() || '',
    category: normalizeSpacing(row.category ?? ''),
    product_image: String(row.product_image ?? '').trim() || '',
    status: normalizeSpacing(row.status ?? '') || 'active',
    visible: row.visible !== false,
    unit_code: normalizeSpacing(row.unit_code ?? ''),
    tier_name: normalizeTierName(row.tier_name),
    final_price: Number(row.final_price ?? 0),
    available_qty: Number(row.available_qty ?? 0),
    reserved_qty: Number(row.reserved_qty ?? 0),
    allow_backorder: row.allow_backorder === true,
    is_sellable: row.is_sellable !== false,
    unit_active: row.unit_active !== false,
    min_qty: Number(row.min_qty ?? 1),
    display_order: Number(row.display_order ?? 0),
  };
}

function aggregateOpsProducts(rows) {
  const products = new Map();
  for (const rawRow of Array.isArray(rows) ? rows : []) {
    const row = normalizeOpsProductRow(rawRow);
    if (!row.product_id || !row.unit_code) continue;
    if (!products.has(row.product_id)) {
      products.set(row.product_id, {
        product_id: row.product_id,
        product_name: row.product_name,
        company_id: row.company_id,
        company_name: row.company_name,
        company_logo: row.company_logo,
        category: row.category,
        product_image: row.product_image,
        status: row.status,
        visible: row.visible,
        unitMap: new Map(),
      });
    }
    const current = products.get(row.product_id);
    current.product_name = current.product_name || row.product_name;
    current.company_name = current.company_name || row.company_name;
    current.company_logo = current.company_logo || row.company_logo;
    current.category = current.category || row.category;
    current.product_image = current.product_image || row.product_image;
    if (row.status) current.status = row.status;
    const unitKey = `${row.unit_code}::${row.tier_name}`;
    if (!current.unitMap.has(unitKey)) {
      current.unitMap.set(unitKey, []);
    }
    current.unitMap.get(unitKey).push(row);
  }
  return products;
}

function buildOpsProductList(aggregated) {
  const list = [];
  for (const product of aggregated.values()) {
    const units = {};
    const tierPrices = new Map();
    let totalStock = 0;
    let sellableCount = 0;
    let hasLowStock = false;

    for (const [unitKey, variants] of product.unitMap) {
      const [unitCode, tierName] = unitKey.split('::');
      const best = variants.find((v) => v.is_sellable && v.unit_active && v.final_price > 0) || variants[0];
      if (!best) continue;

      if (!units[unitCode]) {
        units[unitCode] = { unit_code: unitCode, prices: {}, stock: 0, active: best.unit_active, min_qty: best.min_qty, display_order: best.display_order, allow_backorder: best.allow_backorder };
      }
      units[unitCode].prices[tierName] = best.final_price;
      units[unitCode].stock += best.available_qty;
      totalStock += best.available_qty;
      if (best.is_sellable && best.unit_active) sellableCount++;

      const priceKey = `${unitCode}:${tierName}`;
      if (!tierPrices.has(priceKey)) {
        tierPrices.set(priceKey, { unit_code: unitCode, tier_name: tierName, price: best.final_price, stock: best.available_qty });
      }
    }

    const unitOrder = Object.keys(units).sort((a, b) => {
      const rank = { carton: 1, pack: 2, half_pack: 3, piece: 4 };
      return (rank[a] ?? 99) - (rank[b] ?? 99);
    });
    const lowStockThreshold = 10;
    hasLowStock = Object.values(units).some((u) => u.stock > 0 && u.stock < lowStockThreshold);
    const isActive = product.status !== 'inactive';
    const isVisible = product.visible !== false;

    list.push({
      product_id: product.product_id,
      product_name: product.product_name,
      company_id: product.company_id,
      company_name: product.company_name,
      company_logo: product.company_logo,
      category: product.category,
      product_image: product.product_image,
      status: product.status,
      isActive,
      isVisible,
      units,
      unitOrder,
      tierPrices: Array.from(tierPrices.values()),
      totalStock,
      sellableCount,
      hasLowStock,
    });
  }

  list.sort((a, b) => String(a.product_name).localeCompare(String(b.product_name), 'ar'));
  return list;
}

async function loadPagedRows(api, path, params = {}, pageSize = 200) {
  const rows = [];
  let offset = 0;
  while (true) {
    const page = await api.get(path, { ...params, limit: String(pageSize), offset: String(offset) }).catch(() => []);
    const batch = Array.isArray(page) ? page : [];
    if (!batch.length) break;
    rows.push(...batch);
    offset += batch.length;
    if (batch.length < pageSize) break;
  }
  return rows;
}

export async function loadOpsProducts(api) {
  const rows = await loadPagedRows(api, 'v_runtime_products_mobile', {
    select: 'product_id,product_name,company_id,company_name,company_logo,category,product_image,status,visible,unit_code,tier_name,final_price,available_qty,reserved_qty,allow_backorder,is_sellable,unit_active,min_qty,display_order',
    order: 'product_id.asc,unit_code.asc,display_order.asc',
  }, 200);
  const aggregated = aggregateOpsProducts(rows);
  return buildOpsProductList(aggregated);
}

export async function createOpsProduct(api, payload) {
  const result = await api.post('products', {
    product_name: normalizeSpacing(payload.product_name),
    company_id: normalizeSpacing(payload.company_id),
    category: normalizeSpacing(payload.category) || null,
    product_image: String(payload.product_image ?? '').trim() || null,
    status: payload.status || 'active',
    visible: payload.visible !== false,
  });
  if (!Array.isArray(result) || !result.length) throw new Error('CREATE_FAILED');
  return result[0];
}

export async function updateOpsProduct(api, productId, payload) {
  const updates = {};
  if (payload.product_name !== undefined) updates.product_name = normalizeSpacing(payload.product_name);
  if (payload.company_id !== undefined) updates.company_id = normalizeSpacing(payload.company_id);
  if (payload.category !== undefined) updates.category = normalizeSpacing(payload.category) || null;
  if (payload.product_image !== undefined) updates.product_image = String(payload.product_image).trim() || null;
  if (payload.status !== undefined) updates.status = payload.status;
  if (payload.visible !== undefined) updates.visible = payload.visible !== false;
  if (!Object.keys(updates).length) return null;
  const result = await api.patch('products', updates, { product_id: `eq.${productId}` });
  return Array.isArray(result) ? result[0] : result;
}

export async function deleteOpsProduct(api, productId) {
  await api.del('products', { product_id: `eq.${productId}` });
}

export async function toggleOpsProductActive(api, productId, currentStatus) {
  const nextStatus = currentStatus === 'inactive' ? 'active' : 'inactive';
  return updateOpsProduct(api, productId, { status: nextStatus });
}

export async function toggleOpsProductVisibility(api, productId, currentVisible) {
  return updateOpsProduct(api, productId, { visible: !currentVisible });
}
