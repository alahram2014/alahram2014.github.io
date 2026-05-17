function cleanPatchPayload(payload = {}) {
  return Object.fromEntries(Object.entries(payload || {}).filter(([, value]) => value !== undefined));
}

export async function loadSalesReps(api) {
  const rows = await api.get('sales_reps', {
    select: 'id,name,phone,username,region,default_tier_name,is_active,is_blocked,blocked_reason,created_at,updated_at',
    order: 'created_at.desc',
    limit: '100',
  }).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

export async function updateSalesRep(api, repId, payload = {}) {
  const id = String(repId || '').trim();
  if (!id) throw new Error('INVALID_REP_ID');
  const rows = await api.patch('sales_reps', cleanPatchPayload(payload), { id: `eq.${id}` });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function toggleSalesRepActive(api, repId, isActive) {
  return updateSalesRep(api, repId, { is_active: Boolean(isActive) });
}

export async function blockSalesRep(api, repId, blockedReason = 'blocked') {
  return updateSalesRep(api, repId, { is_blocked: true, blocked_reason: blockedReason });
}

export async function unblockSalesRep(api, repId) {
  return updateSalesRep(api, repId, { is_blocked: false, blocked_reason: null });
}
