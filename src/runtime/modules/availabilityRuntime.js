export const AVAILABILITY = {
  AVAILABLE: 'available',
  OUT_OF_STOCK: 'out_of_stock',
  PRICE_UNAVAILABLE: 'price_unavailable',
  DISCONTINUED: 'discontinued',
  HIDDEN: 'hidden',
};

const LABEL_MAP = {
  out_of_stock: 'نفذت الكمية',
  price_unavailable: 'السعر غير متاح',
  discontinued: 'غير متاح',
  hidden: '',
  available: '',
};

const BADGE_CLASS_MAP = {
  out_of_stock: 'availability-badge--out-of-stock',
  price_unavailable: 'availability-badge--price-unavailable',
  discontinued: 'availability-badge--discontinued',
  available: '',
  hidden: '',
};

function unitQty(unit) {
  return Number(unit?.available_qty ?? 0);
}

function unitPrice(unit) {
  return Number(unit?.final_price ?? 0);
}

export function unitAvailability(unit) {
  if (!unit) return AVAILABILITY.PRICE_UNAVAILABLE;
  if (unit.unit_active === false || unit.is_sellable === false || unit.runtime_healthy === false) return AVAILABILITY.DISCONTINUED;
  const price = unitPrice(unit);
  if (!Number.isFinite(price) || price <= 0) return AVAILABILITY.PRICE_UNAVAILABLE;
  if (unitQty(unit) <= 0 && !unit.allow_backorder) return AVAILABILITY.OUT_OF_STOCK;
  return AVAILABILITY.AVAILABLE;
}

export function productAvailability(product, unitCode) {
  if (!product) return AVAILABILITY.HIDDEN;
  if (product.visible === false) return AVAILABILITY.HIDDEN;

  const units = product.units || {};
  const targetUnit = unitCode || product.defaultUnit;

  if (targetUnit && units[targetUnit]) {
    return unitAvailability(units[targetUnit]);
  }

  if (Object.keys(units).length > 0) {
    const allStates = Object.values(units).map(unitAvailability);
    if (allStates.includes(AVAILABILITY.AVAILABLE)) return AVAILABILITY.AVAILABLE;
    if (allStates.includes(AVAILABILITY.OUT_OF_STOCK)) return AVAILABILITY.OUT_OF_STOCK;
    if (allStates.includes(AVAILABILITY.PRICE_UNAVAILABLE)) return AVAILABILITY.PRICE_UNAVAILABLE;
    if (allStates.includes(AVAILABILITY.DISCONTINUED)) return AVAILABILITY.DISCONTINUED;
    return AVAILABILITY.PRICE_UNAVAILABLE;
  }

  if (product.can_buy !== undefined) {
    return product.can_buy !== false ? AVAILABILITY.AVAILABLE : AVAILABILITY.PRICE_UNAVAILABLE;
  }

  return AVAILABILITY.PRICE_UNAVAILABLE;
}

export function canAddProductToCart(product, unitCode) {
  const state = productAvailability(product, unitCode);
  return state === AVAILABILITY.AVAILABLE;
}

export function getAvailabilityLabel(state) {
  return LABEL_MAP[state] || '';
}

export function getAvailabilityBadgeClass(state) {
  return BADGE_CLASS_MAP[state] || '';
}

export function isProductVisible(product) {
  if (!product) return false;
  const state = productAvailability(product);
  return state !== AVAILABILITY.HIDDEN;
}
