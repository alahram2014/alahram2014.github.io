function toRad(deg) {
  return deg * (Math.PI / 180);
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  var R = 6371000;
  var dLat = toRad(lat2 - lat1);
  var dLng = toRad(lng2 - lng1);
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function normalizeId(value) {
  return String(value ?? '').trim();
}

export function computeVisitDistance(repLat, repLng, customer) {
  var cLat = customer.location_lat || customer.lat || customer.latitude || null;
  var cLng = customer.location_lng || customer.lng || customer.longitude || null;
  if (repLat == null || repLng == null || cLat == null || cLng == null) {
    return { meters: null, status: 'unknown' };
  }
  if (!isFinite(Number(repLat)) || !isFinite(Number(repLng)) || !isFinite(Number(cLat)) || !isFinite(Number(cLng))) {
    return { meters: null, status: 'unknown' };
  }
  var meters = Math.round(haversineDistance(Number(repLat), Number(repLng), Number(cLat), Number(cLng)));
  var status;
  if (meters < 100) status = 'trusted';
  else if (meters <= 300) status = 'warning';
  else status = 'suspicious';
  return { meters: meters, status: status };
}

export function computeVisitDuration(startedAt, endedAt) {
  if (!startedAt || !endedAt) return { minutes: null, classification: 'unknown' };
  var start = new Date(startedAt);
  var end = new Date(endedAt);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return { minutes: null, classification: 'unknown' };
  var diffMs = end.getTime() - start.getTime();
  var minutes = Math.round(diffMs / 60000);
  var classification;
  if (minutes < 1) classification = 'very_low';
  else if (minutes <= 3) classification = 'weak';
  else if (minutes <= 10) classification = 'normal';
  else classification = 'strong';
  return { minutes: minutes, classification: classification };
}

export function computeVisitConfidence(distanceInfo, durationInfo, hasOrder, suspiciousFlags) {
  var distanceScore = 0;
  if (distanceInfo.status === 'trusted') distanceScore = 40;
  else if (distanceInfo.status === 'warning') distanceScore = 20;
  else if (distanceInfo.status === 'suspicious') distanceScore = 5;
  else distanceScore = 15;

  var durationScore = 0;
  if (durationInfo.classification === 'strong') durationScore = 35;
  else if (durationInfo.classification === 'normal') durationScore = 25;
  else if (durationInfo.classification === 'weak') durationScore = 10;
  else if (durationInfo.classification === 'very_low') durationScore = 2;
  else durationScore = 15;

  var orderScore = hasOrder ? 15 : 0;

  var flagPenalty = (Array.isArray(suspiciousFlags) ? suspiciousFlags : []).length * 5;
  flagPenalty = Math.min(flagPenalty, 10);

  var score = distanceScore + durationScore + orderScore - flagPenalty;
  score = Math.max(0, Math.min(100, Math.round(score)));
  return score;
}

export function computeSuspiciousFlags(visits, currentVisit, customer) {
  var flags = [];
  if (!currentVisit) return flags;

  var duration = computeVisitDuration(currentVisit.started_at, currentVisit.ended_at);
  if (duration.classification === 'very_low') flags.push({ key: 'short_visit', label: 'زيارة قصيرة جدًا', hint: 'مدة الزيارة أقل من دقيقة' });
  if (duration.classification === 'weak') flags.push({ key: 'short_visit', label: 'زيارة قصيرة', hint: 'مدة الزيارة أقل من ٣ دقائق' });

  var distanceInfo = computeVisitDistance(
    currentVisit.visit_lat, currentVisit.visit_lng, customer || {}
  );
  if (distanceInfo.status === 'suspicious' && distanceInfo.meters > 500) {
    flags.push({ key: 'far_from_customer', label: 'مسافة بعيدة', hint: 'المسافة بين الموقع وموقع العميل أكثر من ٥٠٠ متر' });
  }
  if (distanceInfo.status === 'unknown') {
    var cHasLocation = customer && (customer.location_lat || customer.lat || customer.latitude);
    if (!cHasLocation) {
      flags.push({ key: 'no_customer_location', label: 'العميل بدون موقع', hint: 'هذا العميل ليس لديه موقع مسجل' });
    }
  }

  var recentVisits = (Array.isArray(visits) ? visits : []).filter(function(v) {
    if (!v.started_at || !currentVisit.started_at) return false;
    if (normalizeId(v.id) === normalizeId(currentVisit.id)) return false;
    var vTime = new Date(v.started_at).getTime();
    var cTime = new Date(currentVisit.started_at).getTime();
    return !isNaN(vTime) && !isNaN(cTime) && Math.abs(cTime - vTime) < 3600000;
  });
  if (recentVisits.length >= 5) {
    flags.push({ key: 'rapid_visits', label: 'زيارات سريعة', hint: 'أكثر من ٥ زيارات خلال ساعة' });
  }

  return flags;
}

export function getConfidenceLevel(score) {
  if (score >= 80) return { key: 'trusted', label: 'موثوقة', cls: 'chip--success' };
  if (score >= 50) return { key: 'medium', label: 'متوسطة', cls: 'chip--warning' };
  return { key: 'low', label: 'منخفضة', cls: 'chip--error' };
}

export function hasCustomerLocation(customer) {
  return !!(customer && (
    customer.location_lat || customer.lat || customer.latitude || customer.location_lng || customer.lng || customer.longitude
  ));
}
