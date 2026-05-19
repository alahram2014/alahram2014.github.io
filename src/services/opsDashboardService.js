import { canAccessCustomerManagement, canAccessOperationalDashboard, hasCapability, normalizeCapabilityList } from './authService.js';
import { formatMoney } from './invoiceService.js';
import { getDefaultOperationalModule, getOperationalModules, getOperationalModuleByKey, getOperationalQuickActions, getOperationalRouteForModule, getOperationalModuleLabel, hasOperationalAccess, isOperationalModuleReady } from './managerService.js';
import { getWorkflowStateLabel, normalizeWorkflowStateKey, resolveWorkflowActions } from './workflowService.js';

const PRIORITY_BUCKETS = [
  { key: 'review', title: 'مراجعة', states: ['pending', 'reviewing'] },
  { key: 'prepare', title: 'تحضير', states: ['preparing'] },
  { key: 'dispatch', title: 'شحن', states: ['dispatched'] },
  { key: 'complete', title: 'إغلاق', states: ['delivered', 'collected'] },
  { key: 'returns', title: 'مرتجعات', states: ['returned'] },
  { key: 'cancelled', title: 'ملغاة', states: ['cancelled'] },
];

function normalizeId(value) {
  return String(value || '').trim();
}

function sameDay(left, right) {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  const l = new Date(left);
  const r = new Date(right);
  return l.getFullYear() === r.getFullYear()
    && l.getMonth() === r.getMonth()
    && l.getDate() === r.getDate();
}

function ageHours(timestamp) {
  const value = new Date(timestamp || 0).getTime();
  if (!Number.isFinite(value) || value <= 0) return null;
  return (Date.now() - value) / 36e5;
}

function dedupeById(rows = []) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const key = normalizeId(row?.id || row?.order_number || row?.invoice_number || row?.customer_id || '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getOrders(state) {
  const managerScope = state?.runtime?.manager || {};
  const priorityOrders = Array.isArray(managerScope.priorityOrders) && managerScope.priorityOrders.length
    ? managerScope.priorityOrders
    : [];
  const teamOrders = Array.isArray(managerScope.teamOrders) ? managerScope.teamOrders : [];
  const invoiceOrders = Array.isArray(state?.commerce?.invoices) ? state.commerce.invoices : [];
  return dedupeById([...priorityOrders, ...teamOrders, ...invoiceOrders]);
}

function getCustomers(state) {
  const managerScope = state?.runtime?.manager || {};
  const teamCustomers = Array.isArray(managerScope.teamCustomers) ? managerScope.teamCustomers : [];
  const commerceCustomers = Array.isArray(state?.commerce?.customers) ? state.commerce.customers : [];
  return dedupeById([...teamCustomers, ...commerceCustomers]);
}

function getTeamReps(state) {
  return Array.isArray(state?.runtime?.manager?.teamReps) ? state.runtime.manager.teamReps : [];
}

function getRepName(order, teamReps) {
  const repId = order?.rep_id || order?.sales_rep_id || order?.created_by_rep_id || null;
  if (!repId || !Array.isArray(teamReps) || !teamReps.length) return null;
  const rep = teamReps.find((r) => String(r.id) === String(repId));
  return rep?.name || rep?.username || null;
}

function formatAgeLabel(timestamp) {
  if (!timestamp) return null;
  const hours = ageHours(timestamp);
  if (hours === null) return null;
  if (hours < 1) return 'حديث';
  if (hours < 24) return `${Math.floor(hours)} س`;
  const days = Math.floor(hours / 24);
  return `${days} ي`;
}

function getPriorityLevel(order, bucket) {
  const hours = ageHours(getOrderDate(order));
  if (hours === null) return 'normal';
  if (bucket?.key === 'returns') return 'high';
  if (hours >= 48) return 'critical';
  if (hours >= 24) return 'high';
  if (hours >= 4) return 'medium';
  return 'normal';
}

function getNoActionReason(workflow, session) {
  if (!workflow) return 'بيانات سير العمل غير متوفرة';
  if (workflow.isTerminal) return 'حالة نهائية - لا يمكن التنفيذ';
  if (workflow.currentStateKey && !workflow.allowedTransitions?.length) return 'لا توجد انتقالات من هذه الحالة';
  if (Array.isArray(workflow.allowedTransitions) && workflow.allowedTransitions.length > 0 && !workflow.executableTransitions?.length) {
    const missingCaps = [];
    for (const t of workflow.allowedTransitions) {
      if (!t.canExecute && Array.isArray(t.capability_keys) && t.capability_keys.length) {
        missingCaps.push(...t.capability_keys);
      }
    }
    if (missingCaps.length) {
      const unique = [...new Set(missingCaps)];
      return `تحتاج صلاحية: ${unique.slice(0, 3).join('، ')}${unique.length > 3 ? '...' : ''}`;
    }
    if (session && !session.userType) return 'صلاحية غير كافية';
    return 'لا تملك الصلاحية الكافية';
  }
  return null;
}

function getCustomerName(order, customerMap) {
  const customer = customerMap[normalizeId(order?.customer_id)];
  return customer?.name || order?.customer_name || order?.name || `عميل #${(normalizeId(order?.customer_id) || '').slice(0, 6) || '—'}`;
}

function getOrderItemCount(order) {
  return order?.item_count || order?.items_count || order?.line_count || (Array.isArray(order?.items) ? order.items.length : null) || 0;
}

function getSessionCapabilities(session) {
  return normalizeCapabilityList(session?.capabilities || session?.system_user?.capabilities || []);
}

function getOrderState(order) {
  return normalizeWorkflowStateKey(order?.workflow_state_key || order?.workflow_status || order?.status) || 'pending';
}

function getOrderDate(order) {
  return order?.updated_at || order?.created_at || order?.order_date || order?.date || null;
}

function hasDispatchCapability(session) {
  return hasCapability(session, ['delivery.execute', 'shipment.dispatch', 'warehouse.prepare', 'orders.manage', 'orders.update']);
}

function hasReviewCapability(session) {
  return hasCapability(session, ['orders.review', 'orders.manage', 'orders.update', 'sales_manager.manage_reps', 'dashboard.sales_manager']);
}

function hasFollowUpCapability(session) {
  return hasCapability(session, ['customers.manage', 'customers.create', 'sales_manager.access', 'dashboard.sales_manager', 'orders.view']);
}

function buildCounters(state) {
  const orders = getOrders(state);
  const customers = getCustomers(state);
  const pendingReview = orders.filter((order) => ['pending', 'reviewing'].includes(getOrderState(order))).length;
  const preparing = orders.filter((order) => getOrderState(order) === 'preparing').length;
  const dispatchedToday = orders.filter((order) => getOrderState(order) === 'dispatched' && sameDay(new Date(getOrderDate(order) || 0).getTime(), Date.now())).length;
  const delayed = orders.filter((order) => {
    const stateKey = getOrderState(order);
    if (!['pending', 'reviewing', 'preparing'].includes(stateKey)) return false;
    const hours = ageHours(getOrderDate(order));
    return hours !== null && hours >= 48;
  }).length;
  const returnsPending = orders.filter((order) => getOrderState(order) === 'returned').length;
  const followUpCustomers = customers.filter((customer) => {
    const latest = getLatestCustomerOrder(customer, orders);
    if (!latest) return true;
    const hours = ageHours(getOrderDate(latest));
    return hours !== null && hours >= (24 * 30);
  }).length;
  const newOrders = orders.filter((order) => getOrderState(order) === 'pending').length;

  return [
    { key: 'new-orders', label: 'طلبات جديدة', value: newOrders, hint: 'من workflow_state_key' },
    { key: 'pending-review', label: 'تحتاج مراجعة', value: pendingReview, hint: 'محتجزة للتنفيذ' },
    { key: 'preparing', label: 'جاري التحضير', value: preparing, hint: 'في المسار التشغيلي' },
    { key: 'dispatched-today', label: 'خرج للشحن اليوم', value: dispatchedToday, hint: 'حركة يومية' },
    { key: 'delayed', label: 'متأخرة', value: delayed, hint: 'أكثر من 48 ساعة' },
    { key: 'returns', label: 'مرتجعات', value: returnsPending, hint: 'بحاجة إجراء' },
    { key: 'follow-up', label: 'عملاء متابعة', value: followUpCustomers, hint: 'لا يوجد نشاط حديث' },
    { key: 'total-orders', label: 'إجمالي الطلبات', value: orders.length, hint: 'السجل التشغيلي' },
  ];
}

function getLatestCustomerOrder(customer, orders) {
  const customerId = normalizeId(customer?.id);
  if (!customerId || !Array.isArray(orders)) return null;
  return orders
    .filter((order) => normalizeId(order?.customer_id) === customerId)
    .sort((left, right) => new Date(right.updated_at || right.created_at || 0).getTime() - new Date(left.updated_at || left.created_at || 0).getTime())[0] || null;
}

function buildQueueItems(state, bucket) {
  const session = state?.auth?.session || {};
  const customerMap = Object.fromEntries(getCustomers(state).map((customer) => [normalizeId(customer.id), customer]));
  const teamReps = getTeamReps(state);
  const orders = getOrders(state)
    .map((order) => {
      const stateKey = getOrderState(order);
      const workflow = resolveWorkflowActions(order, session);
      return {
        ...order,
        workflowStateKey: stateKey,
        workflowStateLabel: workflow.currentStateLabel || getWorkflowStateLabel(stateKey),
        workflowActions: workflow,
        customerName: getCustomerName(order, customerMap),
        repName: getRepName(order, teamReps),
        orderAgeLabel: formatAgeLabel(getOrderDate(order)),
        orderAgeHours: ageHours(getOrderDate(order)),
        itemCount: getOrderItemCount(order),
        priorityLevel: getPriorityLevel(order, bucket),
        noActionReason: getNoActionReason(workflow, session),
      };
    })
    .filter((order) => bucket.states.includes(order.workflowStateKey));

  const sorted = orders.sort((left, right) => {
    const leftPriority = bucket.key === 'returns' ? 1 : bucket.states.indexOf(left.workflowStateKey);
    const rightPriority = bucket.key === 'returns' ? 1 : bucket.states.indexOf(right.workflowStateKey);
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    const leftDate = new Date(getOrderDate(left) || 0).getTime();
    const rightDate = new Date(getOrderDate(right) || 0).getTime();
    return rightDate - leftDate;
  });

  return sorted.slice(0, 8);
}

function buildQueues(state) {
  return PRIORITY_BUCKETS.map((bucket) => {
    const items = buildQueueItems(state, bucket);
    const count = (getOrders(state) || []).filter((order) => bucket.states.includes(getOrderState(order))).length;
    return {
      ...bucket,
      count,
      items,
      emptyLabel: 'لا توجد عناصر',
    };
  });
}

function buildQuickActions(session, moduleKey = 'sales-manager') {
  const shared = getOperationalQuickActions(session);
  const capabilities = getSessionCapabilities(session);
  const primaryActionsByRole = [];
  const hasOpsAuthority = hasOperationalAccess(session) || canAccessOperationalDashboard(session) || hasCapability(session, ['dashboard.admin', 'system.manage_users', 'system.manage_capabilities']);

  if (hasOpsAuthority) {
    primaryActionsByRole.push(
      { action: 'go-checkout', label: 'إنشاء طلب', icon: '🛒', description: 'فتح مسار الطلب مباشرة', enabled: true },
      { action: 'go-customers', label: 'العملاء', icon: '👥', description: 'إدارة العملاء المرتبطين بالحساب', enabled: true },
      { action: 'go-companies', label: 'الشركات', icon: '🏢', description: 'تصفح شبكة الشركات', enabled: true },
      { action: 'go-invoices', label: 'فواتير اليوم', icon: '📦', description: 'الفواتير والطلبات السابقة', enabled: true },
      { action: 'go-ops', label: 'طلبات تحتاج متابعة', icon: '⚠️', description: 'الطلبات المتأخرة أو المعلقة', enabled: true },
    );
  } else {
    primaryActionsByRole.push(
      { action: 'go-ops', label: 'طلبات تحتاج متابعة', icon: '⚠️', description: 'الطلبات المتأخرة أو المعلقة', enabled: hasOperationalAccess(session) || canAccessOperationalDashboard(session) },
      { action: 'go-invoices', label: 'فواتير اليوم', icon: '📦', description: 'مراجعة المحفظة الجارية', enabled: true },
    );
  }

  if (moduleKey === 'warehouse' || capabilities.includes('warehouse.prepare')) {
    primaryActionsByRole.push(
      { action: 'go-ops-module', module: 'warehouse', label: 'تجهيز الطلبات', icon: '📦', description: 'مراجعة أوامر التحضير', enabled: isOperationalModuleReady('warehouse') },
      { action: 'go-ops-module', module: 'warehouse', label: 'النواقص', icon: '📉', description: 'العناصر غير الجاهزة', enabled: isOperationalModuleReady('warehouse') },
    );
  }

  if (moduleKey === 'delivery' || capabilities.includes('delivery.execute') || capabilities.includes('shipment.dispatch')) {
    primaryActionsByRole.push(
      { action: 'go-ops-module', module: 'delivery', label: 'شحنات اليوم', icon: '🚚', description: 'خطة التسليم الحالية', enabled: isOperationalModuleReady('delivery') },
      { action: 'go-ops-module', module: 'delivery', label: 'المرتجعات', icon: '↩️', description: 'الشحنات الراجعة', enabled: isOperationalModuleReady('delivery') },
    );
  }

  if (moduleKey === 'sales-manager' || hasReviewCapability(session) || canAccessOperationalDashboard(session)) {
    primaryActionsByRole.push(
      { action: 'go-ops', label: 'مراجعات معلقة', icon: '📝', description: 'الطلبات التي تحتاج قرارًا', enabled: true },
      { action: 'go-ops', label: 'متابعة الفريق', icon: '👥', description: 'متابعة المندوبين والعملاء', enabled: true },
    );
  }

  const merged = [...primaryActionsByRole, ...shared];
  const seen = new Set();
  return merged.filter((item) => {
    const key = `${item.action}:${item.module || ''}:${item.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildModuleRail(session) {
  return getOperationalModules(session).map((module) => ({
    ...module,
    disabled: !module.isReady,
    ctaLabel: module.isReady ? 'فتح' : 'قريبًا',
  }));
}

function buildExecutionCards(state) {
  const session = state?.auth?.session || {};
  const orders = getOrders(state);
  const customerMap = Object.fromEntries(getCustomers(state).map((customer) => [normalizeId(customer.id), customer]));
  const teamReps = getTeamReps(state);
  return orders.slice(0, 8).map((order) => {
    const workflow = resolveWorkflowActions(order, session);
    const transitions = Array.isArray(workflow.executableTransitions) ? workflow.executableTransitions : [];
    const firstTransition = transitions[0] || null;
    return {
      id: normalizeId(order.id),
      orderNumber: order.order_number || order.invoice_number || order.id,
      customerName: getCustomerName(order, customerMap),
      repName: getRepName(order, teamReps),
      total: formatMoney(Number(order.total_amount || 0)),
      stateLabel: workflow.currentStateLabel || getWorkflowStateLabel(workflow.currentStateKey),
      actionLabel: firstTransition?.to_state_label || 'تنفيذ',
      canExecute: Boolean(firstTransition),
      nextStateKey: firstTransition?.to_state_key || null,
      executableCount: transitions.length,
      executableTransitions: transitions,
      workflowActions: workflow,
      workflowStateKey: workflow.currentStateKey,
      itemCount: getOrderItemCount(order),
      orderAgeLabel: formatAgeLabel(getOrderDate(order)),
      orderAgeHours: ageHours(getOrderDate(order)),
      noActionReason: getNoActionReason(workflow, session),
    };
  });
}

export function canOpenOpsWorkspace(session = {}) {
  return hasOperationalAccess(session) || canAccessOperationalDashboard(session) || hasCapability(session, ['dashboard.sales_manager', 'dashboard.admin', 'sales_manager.access']);
}

export function getOpsWorkspaceModule(session = {}, requestedModule = null) {
  const defaultModule = getDefaultOperationalModule(session);
  const moduleKey = normalizeId(requestedModule) || defaultModule;
  const module = getOperationalModuleByKey(moduleKey);
  if (!module) return getOperationalModuleByKey(defaultModule) || null;
  if (module.isReady || module.runtimeReady) return module;
  if (isOperationalModuleReady(defaultModule)) return getOperationalModuleByKey(defaultModule) || module;
  return module;
}

export function createOpsDashboardModel(state) {
  const session = state?.auth?.session || null;
  const routeModule = normalizeId(state?.app?.route?.params?.module || '');
  const module = getOpsWorkspaceModule(session, routeModule);
  const moduleKey = module?.key || getDefaultOperationalModule(session);
  const counters = buildCounters(state);
  const queues = buildQueues(state);
  const quickActions = buildQuickActions(session, moduleKey);
  const moduleRail = buildModuleRail(session);
  const executionCards = buildExecutionCards(state);

  return {
    session,
    canOpen: canOpenOpsWorkspace(session),
    moduleKey,
    module,
    moduleLabel: getOperationalModuleLabel(moduleKey),
    moduleRoute: getOperationalRouteForModule(moduleKey),
    counters,
    queues,
    quickActions,
    moduleRail,
    executionCards,
    priorityOrders: executionCards,
    workflowSummary: state?.runtime?.manager?.summary || {},
    teamCustomers: getCustomers(state),
    teamOrders: getOrders(state),
    teamReps: Array.isArray(state?.runtime?.manager?.teamReps) ? state.runtime.manager.teamReps : [],
  };
}
