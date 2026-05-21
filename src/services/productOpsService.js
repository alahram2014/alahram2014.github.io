import { normalizeTierName } from './pricingService.js';

let _opsActorId = null;

export function setOpsActorId(userId) {
  _opsActorId = userId || null;
}

function normalizeSpacing(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeOpsProductRow(row) {
  return {
    product_id: normalizeSpacing(row.product_id ?? ''),
    product_code: normalizeSpacing(row.product_code ?? ''),
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
      product_code: product.product_code,
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
  await patchProductUuid(api, rows);
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
  const result = await api.post('rpc/update_product_info', {
    p_product_id: productId,
    p_product_name: payload.product_name ?? null,
    p_company_id: payload.company_id ?? null,
    p_category: payload.category ?? null,
    p_product_image: payload.product_image ?? null,
    p_status: payload.status ?? null,
    p_visible: payload.visible !== undefined ? (payload.visible !== false) : null,
    p_system_user_id: _opsActorId,
  });
  return result;
}

export async function deleteOpsProduct(api, productId) {
  await api.post('rpc/soft_delete_product', {
    p_product_id: productId,
    p_system_user_id: _opsActorId,
  });
}

export async function updateOpsProductUnitStock(api, productId, unitCode, availableQty) {
  const qty = Math.max(0, Number(availableQty || 0));
  const result = await api.post('rpc/update_product_unit_stock', {
    p_product_id: productId,
    p_unit_code: unitCode,
    p_quantity: qty,
    p_operation: 'set',
    p_system_user_id: _opsActorId,
  });
  return result;
}

export async function updateOpsProductUnitPrice(api, productId, unitCode, tierName, price) {
  const finalPrice = Math.max(0, Number(price || 0));
  const result = await api.post('rpc/update_product_unit_price', {
    p_product_id: productId,
    p_unit_code: unitCode,
    p_tier_name: tierName,
    p_price: finalPrice,
    p_system_user_id: _opsActorId,
  });
  return result;
}

export async function toggleOpsProductActive(api, productId, currentStatus) {
  const nextStatus = currentStatus === 'inactive' ? 'active' : 'inactive';
  return updateOpsProduct(api, productId, { status: nextStatus });
}

export async function toggleOpsProductVisibility(api, productId, currentVisible) {
  return updateOpsProduct(api, productId, { visible: !currentVisible });
}

async function patchProductUuid(api, rows) {
  const productMeta = await api.get('products', {
    select: 'id,product_id,product_code',
  }).catch(() => []);
  if (Array.isArray(productMeta) && productMeta.length) {
    const uuidByCode = {};
    for (const pr of productMeta) {
      const code = normalizeSpacing(pr.product_code ?? pr.product_id ?? pr.id ?? '');
      const uuid = pr.product_id || pr.id;
      if (code && uuid) uuidByCode[code] = uuid;
    }
    for (const row of rows) {
      const code = normalizeSpacing(row.product_id ?? '');
      const uuid = uuidByCode[code];
      if (uuid) row.product_id = uuid;
      row.product_code = code || row.product_id;
    }
  } else {
    for (const row of rows) {
      row.product_code = normalizeSpacing(row.product_id ?? '');
    }
  }
  return rows;
}

export async function searchOpsProducts(api, query) {
  const q = String(query || '').trim();
  if (!q) return loadOpsProducts(api);
  const escaped = q.replace(/'/g, "''");
  const likePattern = `*${escaped}*`;
  const rows = await loadPagedRows(api, 'v_runtime_products_mobile', {
    select: 'product_id,product_name,company_id,company_name,company_logo,category,product_image,status,visible,unit_code,tier_name,final_price,available_qty,reserved_qty,allow_backorder,is_sellable,unit_active,min_qty,display_order',
    or: `(product_name.ilike.${likePattern},company_name.ilike.${likePattern},product_id.ilike.${likePattern})`,
    order: 'product_id.asc,unit_code.asc,display_order.asc',
  }, 200);
  await patchProductUuid(api, rows);
  const aggregated = aggregateOpsProducts(rows);
  return buildOpsProductList(aggregated);
}

export async function addProductUnit(api, productId, unitCode, tierName, price, stock) {
  const result = await api.post('product_unit_prices', {
    product_id: productId,
    unit_code: unitCode,
    tier_name: tierName || 'base',
    final_price: Math.max(0, Number(price || 0)),
    available_qty: Math.max(0, Number(stock || 0)),
    is_sellable: true,
    unit_active: true,
  });
  return result;
}
