import { storageKeys, saveJSON, removeValue, loadJSON } from '../core/storage.js';
import { publishDomainEvent } from './domainEventService.js';

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeIdentifier(identifier) {
  return normalizeText(identifier);
}

export function normalizeUserType(value, fallback = null) {
  const raw = normalizeText(value).toLowerCase();
  if (!raw) return fallback;
  if (['rep', 'sales_rep', 'sales rep', 'sales-rep', 'salesrep'].includes(raw)) return 'sales_rep';
  if (['sales_manager', 'sales manager', 'sales-manager'].includes(raw)) return 'sales_manager';
  if (['admin', 'administrator'].includes(raw)) return 'admin';
  if (['customer', 'direct'].includes(raw)) return 'customer';
  if (['sales_operator', 'sales operator'].includes(raw)) return 'sales_operator';
  if (['hybrid_operator', 'hybrid operator'].includes(raw)) return 'hybrid_operator';
  if (['warehouse_operator', 'warehouse operator'].includes(raw)) return 'warehouse_operator';
  if (['operations_manager', 'operations manager'].includes(raw)) return 'operations_manager';
  return fallback;
}

function mergeUniqueStrings(...lists) {
  const output = [];
  for (const list of lists) {
    const values = Array.isArray(list) ? list : typeof list === 'string' ? [list] : [];
    for (const value of values) {
      const token = normalizeText(value);
      if (token && !output.includes(token)) output.push(token);
    }
  }
  return output;
}

export function normalizeCapabilityList(capabilities = []) {
  return mergeUniqueStrings(capabilities);
}

export function hasCapability(session, requiredCaps) {
  const normalized = normalizeSessionRecord(session);
  if (!normalized || !requiredCaps) return false;
  const caps = normalized.capabilities || [];
  const required = Array.isArray(requiredCaps) ? requiredCaps : [requiredCaps];
  if (!required.length) return false;
  return required.some((key) => caps.includes(normalizeText(key)));
}

export function isSalesRepSession(session) {
  const normalized = normalizeSessionRecord(session);
  return normalizeUserType(normalized?.userType || normalized?.user_type || normalized?.role || null, null) === 'sales_rep';
}

export function isAdminOnlySession(session) {
  const normalized = normalizeSessionRecord(session);
  if (!normalized) return false;
  if (!hasOperationalAccess(normalized)) return false;
  return !isSalesRepSession(normalized);
}

export function hasOperationalAccess(session) {
  const normalized = normalizeSessionRecord(session);
  if (!normalized) return false;
  const operationalTypes = ['sales_rep', 'sales_manager', 'admin', 'sales_operator', 'hybrid_operator', 'warehouse_operator', 'operations_manager'];
  if (operationalTypes.includes(normalized.userType)) return true;
  const caps = normalized.capabilities || [];
  return caps.some((c) => {
    const key = normalizeText(c);
    return key.startsWith('ops.') || key.startsWith('admin.') || key.startsWith('dashboard.');
  });
}

export function getOwnershipActorId(session) {
  const normalized = normalizeSessionRecord(session);
  const actorId = normalizeIdentifier(
    normalized?.sales_rep_id
      || normalized?.rep_id
      || normalized?.id
      || '',
  );
  return actorId || null;
}

export function normalizeSessionRecord(session) {
  if (!session || typeof session !== 'object') return null;

  const userType = normalizeUserType(session.userType || session.user_type || session.role || null, null);
  const salesRepId = normalizeIdentifier(session.sales_rep_id || session.rep_id || session.created_by_rep_id || '');
  const capabilities = mergeUniqueStrings(session.capabilities, session.permissions);
  const domains = mergeUniqueStrings(session.domains);

  return {
    ...session,
    userType,
    user_type: userType,
    role: userType,
    sales_rep_id: salesRepId || null,
    rep_id: session.rep_id ?? null,
    created_by_rep_id: session.created_by_rep_id ?? null,
    capabilities,
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
  const type = normalizeUserType(session?.userType || session?.user_type || session?.role || null, null);
  return ['sales_rep', 'sales_manager', 'admin', 'sales_operator', 'hybrid_operator', 'warehouse_operator', 'operations_manager'].includes(type);
}

export function canAccessOperationalDashboard(session) {
  const normalized = normalizeSessionRecord(session);
  if (!normalized) return false;
  const dashboardTypes = ['admin', 'sales_manager', 'operations_manager', 'sales_operator', 'hybrid_operator'];
  if (dashboardTypes.includes(normalized.userType)) return true;
  const caps = normalized.capabilities || [];
  return caps.some((c) => {
    const key = normalizeText(c);
    return key.startsWith('dashboard.') || key === 'dashboard.admin' || key === 'dashboard.sales_manager';
  });
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

/**
 * Load capabilities for a user from the backend projection view.
 * Uses v_system_users_capabilities view (pre-joined, pre-resolved).
 * Falls back to get_user_capabilities(uuid) RPC if view not available.
 */
export async function loadUserCapabilities(api, userId) {
  if (!userId) return [];
  try {
    const rows = await api.get('v_system_users_capabilities', {
      select: 'capability_key,domain_key,display_name',
      system_user_id: `eq.${userId}`,
    });
    if (Array.isArray(rows) && rows.length) {
      return rows.map((r) => r.capability_key);
    }
  } catch {
    // fall through to RPC
  }
  try {
    const result = await api.post('rpc/get_user_capabilities', { p_system_user_id: userId });
    if (Array.isArray(result) && result.length) {
      return result.map((r) => r.capability_key);
    }
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      return [result.capability_key].filter(Boolean);
    }
  } catch {
    // fall through — return empty
  }
  return [];
}

/**
 * Enrich a session with capabilities from the backend capability projection.
 * Called during login and session refresh.
 */
export async function enrichSessionCapabilities(api, session) {
  const normalized = normalizeSessionRecord(session);
  if (!normalized || !normalized.id) return normalized;
  const caps = await loadUserCapabilities(api, normalized.id);
  if (caps.length) {
    return normalizeSessionRecord({
      ...normalized,
      capabilities: mergeUniqueStrings(normalized.capabilities, caps),
    });
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
  });

  const enrichedSession = await enrichOperationalSession(api, session);

  // Enrich with capabilities from backend projection
  const sessionWithCaps = await enrichSessionCapabilities(api, enrichedSession);

  persistSessionRecord(sessionWithCaps);
  publishDomainEvent('auth.login.success', {
    user_id: sessionWithCaps.id,
    user_type: sessionWithCaps.userType,
    username: sessionWithCaps.username || sessionWithCaps.phone || '',
  });

  return sessionWithCaps;
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
