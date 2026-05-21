import { computeVisitDistance, computeVisitDuration, computeVisitConfidence, computeSuspiciousFlags } from './integrityService.js';

function normalizeId(value) {
  return String(value ?? '').trim();
}

function captureVisitLocation() {
  return new Promise(function(resolve) {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      function(pos) {
        try {
          var lat = Number(pos.coords.latitude);
          var lng = Number(pos.coords.longitude);
          if (isFinite(lat) && isFinite(lng)) {
            resolve({ lat: lat, lng: lng, mapsUrl: 'https://maps.google.com/?q=' + lat + ',' + lng });
          } else { resolve(null); }
        } catch (e) { resolve(null); }
      },
      function() { resolve(null); },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
    );
  });
}

function getCustomerById(customers, customerId) {
  return (Array.isArray(customers) ? customers : []).find(function(c) { return normalizeId(c.id) === normalizeId(customerId); }) || null;
}

export async function startVisit(api, repId, customerId, customers) {
  if (!repId || !customerId) throw new Error('INVALID_VISIT_PARAMS');

  var location = await captureVisitLocation();
  var distanceInfo = { meters: null, status: 'unknown' };
  if (location && Array.isArray(customers)) {
    var customer = getCustomerById(customers, customerId);
    if (customer) {
      distanceInfo = computeVisitDistance(location.lat, location.lng, customer);
    }
  }

  var payload = {
    rep_id: repId,
    customer_id: customerId,
    started_at: new Date().toISOString(),
    visit_status: 'in_progress',
    visit_lat: location ? location.lat : null,
    visit_lng: location ? location.lng : null,
    visit_maps_url: location ? location.mapsUrl : null,
    visit_distance_meters: distanceInfo.meters,
    visit_distance_status: distanceInfo.status,
  };

  var rows = await api.post('customer_visits', payload);
  var visit = Array.isArray(rows) ? rows[0] : rows;
  if (!visit?.id) throw new Error('VISIT_CREATE_FAILED');
  return visit;
}

export async function endVisit(api, visitId, status, notes, orderId, visits, customer) {
  if (!visitId) throw new Error('INVALID_VISIT_ID');
  var endedAt = new Date().toISOString();
  var currentVisit = null;
  if (Array.isArray(visits)) {
    currentVisit = visits.find(function(v) { return normalizeId(v.id) === normalizeId(visitId); });
  }

  var durationInfo = currentVisit ? computeVisitDuration(currentVisit.started_at, endedAt) : { minutes: null, classification: 'unknown' };

  var suspiciousFlags = computeSuspiciousFlags(visits, currentVisit || { id: visitId, started_at: null, ended_at: null, visit_lat: null, visit_lng: null }, customer || {});

  var hasOrder = Boolean(orderId);
  var distanceInfo = {
    status: (currentVisit && currentVisit.visit_distance_status) || 'unknown',
    meters: (currentVisit && currentVisit.visit_distance_meters) || null,
  };
  var confidence = computeVisitConfidence(distanceInfo, durationInfo, hasOrder, suspiciousFlags);

  var flagStrings = suspiciousFlags.map(function(f) { return f.key; });

  var payload = {
    ended_at: endedAt,
    duration_minutes: durationInfo.minutes,
    visit_status: status || 'completed',
    visit_notes: notes || null,
    visit_confidence_score: confidence,
    visit_flags: flagStrings.length ? flagStrings.join(',') : null,
  };
  if (orderId) payload.order_id = orderId;

  var rows = await api.patch('customer_visits', payload, { id: 'eq.' + visitId });
  var visit = Array.isArray(rows) ? rows[0] : rows;
  return visit || { id: visitId, ended_at: endedAt, visit_status: status || 'completed' };
}

export async function loadRepVisits(api, repId) {
  if (!repId) return [];
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var rows = await api.get('customer_visits', {
    rep_id: 'eq.' + repId,
    started_at: 'gte.' + today.toISOString(),
    order: 'started_at.desc',
  }).catch(function() { return []; });
  return Array.isArray(rows) ? rows : [];
}

export async function findActiveVisit(api, repId, customerId) {
  if (!repId) return null;
  var params = {
    rep_id: 'eq.' + repId,
    visit_status: 'eq.in_progress',
    limit: '1',
    order: 'started_at.desc',
  };
  if (customerId) params.customer_id = 'eq.' + customerId;
  var rows = await api.get('customer_visits', params).catch(function() { return []; });
  var list = Array.isArray(rows) ? rows : [];
  return list.length ? list[0] : null;
}

export async function getVisitTimeline(api, repId) {
  var visits = await loadRepVisits(api, repId);
  var orderIds = visits.filter(function(v) { return v.order_id; }).map(function(v) { return v.order_id; });
  var orders = [];
  if (orderIds.length) {
    orders = await api.get('orders', {
      id: 'in.(' + orderIds.join(',') + ')',
      select: 'id,order_number,invoice_number,total_amount,created_at',
    }).catch(function() { return []; });
    orders = Array.isArray(orders) ? orders : [];
  }
  var orderMap = {};
  for (var i = 0; i < orders.length; i++) {
    orderMap[normalizeId(orders[i].id)] = orders[i];
  }

  var timeline = [];
  for (var j = 0; j < visits.length; j++) {
    var v = visits[j];
    timeline.push({ type: 'visit_start', at: v.started_at, visit: v });
    if (v.order_id && orderMap[normalizeId(v.order_id)]) {
      timeline.push({ type: 'order_created', at: v.created_at, order: orderMap[normalizeId(v.order_id)] });
    }
    if (v.ended_at) {
      timeline.push({ type: 'visit_end', at: v.ended_at, visit: v });
    }
  }
  timeline.sort(function(a, b) { return String(a.at || '').localeCompare(String(b.at || '')); });
  return timeline;
}

export function computeVisitStats(visits, orders) {
  var completed = 0;
  var ordered = 0;
  var noOrder = 0;
  var closed = 0;
  var followUp = 0;
  var cancelled = 0;
  var inProgress = 0;
  var totalOrderValue = 0;

  for (var i = 0; i < visits.length; i++) {
    var status = (visits[i].visit_status || '').toLowerCase();
    if (status === 'completed') completed++;
    else if (status === 'ordered') ordered++;
    else if (status === 'no_order') noOrder++;
    else if (status === 'customer_closed') closed++;
    else if (status === 'follow_up_required') followUp++;
    else if (status === 'cancelled') cancelled++;
    else if (status === 'in_progress') inProgress++;
    else completed++;
  }

  var totalValue = 0;
  var orderList = Array.isArray(orders) ? orders : [];
  for (var j = 0; j < orderList.length; j++) {
    totalValue += Number(orderList[j].total_amount || 0);
  }

  return {
    total: visits.length,
    completed: completed + ordered,
    ordered: ordered,
    noOrder: noOrder,
    closed: closed,
    followUp: followUp,
    cancelled: cancelled,
    inProgress: inProgress,
    totalOrderValue: totalValue,
    visitsRemaining: Math.max(0, (Array.isArray(orders) ? orders.length : 0) > 0 ? 0 : visits.length - completed),
  };
}

export function updateActiveVisitOrder(api, visitId, orderId) {
  if (!visitId || !orderId) return;
  return api.patch('customer_visits', { order_id: orderId, visit_status: 'ordered' }, { id: 'eq.' + visitId }).catch(function() {});
}

export async function loadTeamVisits(api, repIds) {
  if (!Array.isArray(repIds) || !repIds.length) return [];
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var ids = repIds.filter(Boolean).map(function(id) { return String(id).trim(); });
  if (!ids.length) return [];
  var rows = await api.get('customer_visits', {
    rep_id: 'in.(' + ids.join(',') + ')',
    started_at: 'gte.' + today.toISOString(),
    order: 'started_at.desc',
  }).catch(function() { return []; });
  return Array.isArray(rows) ? rows : [];
}
