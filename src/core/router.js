export function parseRoute(hash = location.hash || "#home") {
  const raw = String(hash).replace(/^#/, '');
  const [path, ...rest] = raw.split('/').filter(Boolean);

  if (!path || path === 'home') return { name: 'home', params: {} };
  if (path === 'companies') return { name: 'companies', params: {} };
  if (path === 'company') return { name: 'company', params: { companyId: rest[0] || '' } };
  if (path === 'offers') return { name: 'offers', params: {} };
  if (path === 'tiers') return { name: 'tiers', params: {} };
  if (path === 'cart') return { name: 'cart', params: {} };
  if (path === 'checkout') return { name: 'checkout', params: {} };
  if (path === 'invoice') return { name: 'invoice', params: { invoiceId: rest[0] || '' } };
  if (path === 'login') return { name: 'login', params: {} };
  if (path === 'register') return { name: 'register', params: {} };
  if (path === 'customers') return { name: 'customers', params: {} };
  if (path === 'invoices') return { name: 'invoices', params: {} };
  if (path === 'account') return { name: 'account', params: {} };
  if (path === 'search') return { name: 'search', params: {} };
  if (path === 'ops') {
    const section = rest[0] || 'dashboard';
    return { name: 'ops', params: { section, id: rest[1] || '' } };
  }
  if (path === 'sales-manager') return { name: 'ops', params: { section: 'sales-manager', id: '' } };
  return { name: 'home', params: {} };
}

export function toHash(routeName, params = {}) {
  if (routeName === 'company') return `#company/${encodeURIComponent(params.companyId || '')}`;
  if (routeName === 'invoice') return `#invoice/${encodeURIComponent(params.invoiceId || '')}`;
  if (routeName === 'ops') {
    const section = encodeURIComponent(params.section || params.module || 'dashboard');
    const id = params.id ? `/${encodeURIComponent(params.id)}` : '';
    return `#ops/${section}${id}`;
  }
  if (routeName === 'sales-manager') return '#ops/sales-manager';
  return `#${routeName}`;
}

export function navigate(routeName, params = {}) {
  const next = toHash(routeName, params);
  if (location.hash === next) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  location.hash = next;
}
