import { storageKeys, saveJSON, removeValue, loadJSON } from '../core/storage.js';
import { publishDomainEvent } from './domainEventService.js';

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeIdentifier(identifier) {
  return normalizeText(identifier);
}

function uniqueStrings(values = []) {
  const output = [];
  for (const value of Array.isArray(values) ? values : [values]) {
    const token = normalizeText(value);
    if (token && !output.includes(token)) output.push(token);
  }
  return output;
}

const OPERATIONAL_USER_TYPES = new Set([
  'admin',
  'sales_manager',
  'sales_operator',
  'hybrid_operator',
  'warehouse_operator',
  'operations_manager',
]);

const CUSTOMER_ACCESS_TYPES = new Set([
  'sales_rep',
  'sales_manager',
  'admin',
  'sales_operator',
  'hybrid_operator',
  'warehouse_operator',
  'operations_manager',
]);

export function normalizeUserType(value, fallback = null) {
  const raw = normalizeText(value).toLowerCase();
  if (!raw) return fallback;
  if (['rep', 'sales_rep', 'sales rep', 'sales-rep', 'salesrep'].includes(raw)) return 'sales_rep';
  if (['sales_manager', 'sales manager', 'sales-manager'].includes(raw)) return 'sales_manager';
  if (['admin', 'administrator'].includes(raw)) return 'admin';
  if (['customer', 'direct'].includes(raw)) return 'customer';
  if (['sales_operator', 'sales operator', 'salesoperator'].includes(raw)) return 'sales_operator';
  if (['hybrid_operator', 'hybrid operator', 'hybridoperator'].includes(raw)) return 'hybrid_operator';
  if (['warehouse_operator', 'warehouse operator', 'warehouseoperator'].includes(raw)) return 'warehouse_operator';
  if (['operations_manager', 'operations manager', 'operationsmanager'].includes(raw)) return 'operations_manager';
  return fallback;
}

export function normalizeCapabilityList(userCapabilities = []) {
  const list = Array.isArray(userCapabilities)
    ? userCapabilities
    : typeof userCapabilities === 'string'
      ? userCapabilities.split(',').map((value) => value.trim()).filter(Boolean)
      : [];

  return uniqueStrings(list.map((value) => {
    if (!value) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'object') return normalizeText(value.capability_key || value.key || value.name);
    return '';
  })).filter(Boolean);
}

export function hasCapability(session, required = []) {
  const list = normalizeCapabilityList(session?.capabilities || session?.permissions || session?.system_user?.capabilities || []);
  const requiredList = normalizeCapabilityList(required);
  if (!requiredList.length) return false;
  return requiredList.some((capability) => list.includes(capability));
}

export function isSalesRepSession(session) {
  const normalized = normalizeSessionRecord(session);
  return normalizeUserType(normalized?.userType || normalized?.user_type || normalized?.role || null, null) === 'sales_rep';
}

function getSessionType(session) {
  return normalizeUserType(session?.userType || session?.user_type || session?.role || null, null);
}

export function hasOperationalAccess(session = {}) {
  const type = getSessionType(normalizeSessionRecord(session));
  if (OPERATIONAL_USER_TYPES.has(type)) return true;
  return hasCapability(session, [
    'dashboard.admin',
    'dashboard.sales_manager',
    'sales_manager.access',
    'sales_manager.manage_reps',
    'orders.manage',
    'orders.update',
    'orders.review',
    'customers.manage',
    'products.manage',
    'companies.manage',
    'workflow.manage',
    'reports.view',
  ]);
}

export function getOwnershipActorId(session) {
  const normalized = normalizeSessionRecord(session);
  const actorId = normalizeIdentifier(
    normalized?.sales_rep_id
      || normalized?.rep_id
      || normalized?.created_by_rep_id
      || normalized?.id
      || '',
  );
  return actorId || null;
}

export function normalizeSessionRecord(session) {
  if (!session || typeof session !== 'object') return null;

  const userType = normalizeUserType(session.userType || session.user_type || session.role || null, null);
  const salesRepId = normalizeIdentifier(session.sales_rep_id || session.rep_id || session.created_by_rep_id || '');
  const capabilities = normalizeCapabilityList(session.capabilities || session.permissions || session.system_user?.capabilities || []);
  const domains = uniqueStrings(session.domains || session.system_user?.domains || []);

  return {
    ...session,
    userType,
    user_type: userType,
    role: userType,
    sales_rep_id: salesRepId || null,
    rep_id: session.rep_id ?? null,
    created_by_rep_id: session.created_by_rep_id ?? null,
    capabilities,
    permissions: capabilities,
    domains,
  };
}

const SESSION_STORAGE_KEYS = [storageKeys.session, 'session'];

export function persistSessionRecord(session) {
  const normalized = normalizeSessionRecord(session);
  if (!normalized) return null;
  for (const key of SESSION_STORAGE_KEYS) {
    saveJSON(key, normalized);
  }
  return normalized;
}

export function clearPersistedSession() {
  for (const key of SESSION_STORAGE_KEYS) {
    removeValue(key);
  }
}

export function readPersistedSession() {
  for (const key of SESSION_STORAGE_KEYS) {
    const value = loadJSON(key, null);
    if (value) {
      const normalized = normalizeSessionRecord(value);
      persistSessionRecord(normalized);
      return normalized;
    }
  }
  return null;
}

export function canAccessCustomerManagement(session) {
  const type = getSessionType(session);
  return CUSTOMER_ACCESS_TYPES.has(type) || hasCapability(session, ['customers.view', 'customers.manage', 'customers.create', 'sales_manager.assign_customers']);
}

export function canAccessOperationalDashboard(session = {}) {
  return hasOperationalAccess(session);
}

async function authenticateWithServer(api, identifier, password) {
  const endpoints = [
    'rpc/authenticate_user',
    'rpc/login_user',
    'rpc/auth_login',
  ];
  for (const endpoint of endpoints) {
    try {
      const rows = await api.post(endpoint, { identifier, user_password: password });
      if (Array.isArray(rows) && rows.length) return rows[0];
      if (rows && typeof rows === 'object') return rows;
    } catch {
      // try next endpoint
    }
  }
  throw new Error('AUTH_BACKEND_REQUIRED');
}

const USER_TYPE_TO_TABLE = {
  admin: 'admins',
  sales_rep: 'sales_reps',
  customer: 'customers',
};

async function fetchUserProfile(api, table, identifier) {
  const trimmed = normalizeIdentifier(identifier);
  if (!trimmed) return null;
  const rows = await api.get(table, {
    select: '*',
    or: `(phone.eq.${trimmed},username.eq.${trimmed})`,
    limit: '1',
  }).catch(async () => {
    const phone = await api.get(table, { select: '*', phone: `eq.${trimmed}`, limit: '1' }).catch(() => []);
    if (phone?.length) return phone;
    return await api.get(table, { select: '*', username: `eq.${trimmed}`, limit: '1' }).catch(() => []);
  });
  return rows?.[0] || null;
}

async function fetchIdentityProfiles(api, identifier) {
  const tables = ['admins', 'sales_reps', 'customers'];
  const results = await Promise.allSettled(tables.map((table) => fetchUserProfile(api, table, identifier)));
  return tables.map((table, index) => ({
    table,
    row: results[index].status === 'fulfilled' ? results[index].value : null,
  })).filter((entry) => entry.row);
}

function resolveAuthoritativeUserType(authenticated) {
  return normalizeUserType(authenticated?.userType || authenticated?.user_type || authenticated?.role || null, null);
}

async function enrichOperationalSession(api, session) {
  const normalizedSession = normalizeSessionRecord(session);
  if (!normalizedSession) return null;

  if (normalizedSession.userType === 'sales_rep' && !normalizedSession.sales_rep_name) {
    const identifier = normalizeIdentifier(
      normalizedSession.username
        || normalizedSession.phone
        || normalizedSession.sales_rep_id
        || normalizedSession.id
        || '',
    );
    if (identifier) {
      const profile = await fetchUserProfile(api, 'sales_reps', identifier).catch(() => null);
      if (profile) {
        return normalizeSessionRecord({
          ...normalizedSession,
          sales_rep_id: profile.id || normalizedSession.sales_rep_id || null,
          sales_rep_name: profile.name || normalizedSession.sales_rep_name || null,
          sales_rep_phone: profile.phone || normalizedSession.sales_rep_phone || null,
          name: profile.name || normalizedSession.name || null,
          phone: profile.phone || normalizedSession.phone || null,
          username: profile.username || normalizedSession.username || normalizedSession.phone || null,
        });
      }
    }
  }

  return normalizedSession;
}

export async function refreshSessionProjection(api, session = null, { persist = true } = {}) {
  const baseSession = normalizeSessionRecord(session || readPersistedSession() || null);
  if (!baseSession) return null;
  const projected = await enrichOperationalSession(api, baseSession);
  const normalized = normalizeSessionRecord(projected);
  if (persist && normalized) {
    persistSessionRecord(normalized);
  }
  return normalized;
}

export async function login(api, identifier, password) {
  const trimmedIdentifier = normalizeIdentifier(identifier);
  const trimmedPassword = normalizeIdentifier(password);
  if (!trimmedIdentifier || !trimmedPassword) throw new Error('INVALID_CREDENTIALS');

  const authenticated = normalizeSessionRecord(await authenticateWithServer(api, trimmedIdentifier, trimmedPassword));
  const profiles = await fetchIdentityProfiles(api, trimmedIdentifier);
  const profileMap = Object.fromEntries(profiles.map((entry) => [entry.table, entry.row]));
  const authoritativeType = resolveAuthoritativeUserType(authenticated);
  if (!authoritativeType) throw new Error('AUTH_ROLE_UNRESOLVED');

  const authoritativeTable = USER_TYPE_TO_TABLE[authoritativeType];
  const authoritativeProfile = authoritativeTable ? profileMap[authoritativeTable] || null : null;
  if (!authoritativeProfile) throw new Error('AUTH_PROFILE_MISSING');

  const session = normalizeSessionRecord({
    ...authenticated,
    ...authoritativeProfile,
    userType: authoritativeType,
    user_type: authoritativeType,
    role: authoritativeType,
    sales_rep_id: authoritativeType === 'sales_rep' ? (authoritativeProfile.id || authenticated.sales_rep_id || authenticated.rep_id || authenticated.id || null) : (authenticated.sales_rep_id || authenticated.rep_id || null),
    capabilities: authoritativeProfile.capabilities || authenticated.capabilities || [],
    domains: authoritativeProfile.domains || authenticated.domains || [],
  });

  const enrichedSession = await enrichOperationalSession(api, session);

  persistSessionRecord(enrichedSession);
  publishDomainEvent('auth.login.success', {
    user_id: enrichedSession.id,
    user_type: enrichedSession.userType,
    username: enrichedSession.username || enrichedSession.phone || '',
  });

  return enrichedSession;
}

export function logout() {
  clearPersistedSession();
  removeValue(storageKeys.selectedCustomer);
  publishDomainEvent('auth.logout', {});
}

export function currentSession() {
  return readPersistedSession();
}

export async function registerCustomer(api, payload) {
  const exists = await api.get('customers', { phone: `eq.${payload.phone}`, select: 'id', limit: '1' }).catch(() => []);
  if (Array.isArray(exists) && exists.length) throw new Error('DUPLICATE_PHONE');
  const rows = await api.post('customers', {
    name: payload.name,
    phone: payload.phone,
    password: payload.password,
    address: payload.address,
    location: payload.location || null,
    username: payload.username || null,
    customer_type: 'direct',
    sales_rep_id: null,
    created_by: null,
    created_by_rep_id: null,
  });
  const created = Array.isArray(rows) ? rows[0] : rows;
  const session = normalizeSessionRecord({ ...created, userType: 'customer', user_type: 'customer', role: 'customer' });
  persistSessionRecord(session);
  publishDomainEvent('customer.register', {
    customer_id: session.id,
    username: session.username || session.phone || '',
  });
  return session;
}
