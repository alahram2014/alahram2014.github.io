function normalizeText(value) {
  return String(value ?? '').trim();
}

export function normalizeId(value) {
  return normalizeText(value);
}

export function firstRow(rows) {
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export async function paginateAll(api, path, params = {}, pageSize = 250) {
  const rows = [];
  let offset = 0;

  while (true) {
    const page = await api.get(path, {
      ...params,
      limit: String(pageSize),
      offset: String(offset),
    }).catch(() => []);
    const batch = Array.isArray(page) ? page : Array.isArray(page?.data) ? page.data : [];
    if (!batch.length) break;
    rows.push(...batch);
    offset += batch.length;
    if (batch.length < pageSize) break;
  }

  return rows;
}

export function toBoolean(value, fallback = false) {
  if (value === true) return true;
  if (value === false) return false;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  return fallback;
}

export function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function normalizeMaybeList(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return [];
  return [value];
}
