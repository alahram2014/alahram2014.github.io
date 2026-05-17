function cleanPatchPayload(payload = {}) {
  return Object.fromEntries(Object.entries(payload || {}).filter(([, value]) => value !== undefined));
}

export async function loadCompanies(api) {
  const rows = await api.get('companies', {
    select: 'company_id,company_name,company_logo,visible,allow_discount,region,created_at,updated_at',
    order: 'created_at.desc',
    limit: '100',
  }).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

export async function updateCompany(api, companyId, payload = {}) {
  const id = String(companyId || '').trim();
  if (!id) throw new Error('INVALID_COMPANY_ID');
  const rows = await api.patch('companies', cleanPatchPayload(payload), { company_id: `eq.${id}` });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function toggleCompanyVisibility(api, companyId, visible) {
  return updateCompany(api, companyId, { visible: Boolean(visible) });
}
