import { firstRow, normalizeId, paginateAll, toBoolean } from './_utils.js';

function normalizeCompanyRow(row) {
  const companyId = normalizeId(row?.company_id ?? row?.id ?? '');
  return {
    id: companyId,
    company_id: companyId,
    company_name: normalizeId(row?.company_name ?? row?.name ?? ''),
    company_logo: normalizeId(row?.company_logo ?? ''),
    visible: toBoolean(row?.visible ?? true, true),
    allow_discount: toBoolean(row?.allow_discount ?? true, true),
    notes: normalizeId(row?.notes ?? ''),
    raw: row,
  };
}

export async function getCompanies(api, params = {}) {
  const rows = await paginateAll(api, 'companies', {
    select: '*',
    order: 'company_name.asc',
    ...params,
  }, 200);
  return rows.map(normalizeCompanyRow);
}

export async function getCompany(api, companyId) {
  const id = normalizeId(companyId);
  if (!id) return null;
  const rows = await paginateAll(api, 'companies', { select: '*', company_id: `eq.${id}`, limit: '1' }, 50).catch(() => []);
  return firstRow(rows.map(normalizeCompanyRow));
}

export async function createCompany(api, payload = {}) {
  const rows = await api.post('companies', payload).catch((error) => { throw error; });
  return firstRow(Array.isArray(rows) ? rows : [rows]);
}

export async function updateCompany(api, companyId, payload = {}) {
  const id = normalizeId(companyId);
  if (!id) throw new Error('INVALID_COMPANY_ID');
  const rows = await api.patch('companies', payload, { company_id: `eq.${id}` }).catch((error) => { throw error; });
  return firstRow(Array.isArray(rows) ? rows : [rows]);
}
