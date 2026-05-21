const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;
const AI_API_KEY = process.env.OPENCODE_API_KEY || '';
const AI_MODEL = process.env.AI_SEARCH_MODEL || 'gpt-4o-mini';
const AI_ENDPOINT = process.env.AI_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
const AI_TIMEOUT = parseInt(process.env.AI_SEARCH_TIMEOUT || '8000', 10);
const AI_MAX_TOKENS = parseInt(process.env.AI_SEARCH_MAX_TOKENS || '1024', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.webmanifest': 'application/manifest+json',
};

function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(new Error('INVALID_JSON')); }
    });
    req.on('error', reject);
  });
}

async function handleAiSearch(req, res) {
  if (!AI_API_KEY) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'AI_SEARCH_NOT_CONFIGURED', message: 'AI search requires OPENCODE_API_KEY' }));
    return;
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'INVALID_JSON' }));
    return;
  }
  const query = String(body?.query || '').trim();
  const candidates = Array.isArray(body?.candidates) ? body.candidates : [];
  if (!query || !candidates.length) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'MISSING_QUERY_OR_CANDIDATES' }));
    return;
  }
  try {
    const ranked = await rankCandidates(query, candidates);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ results: ranked, ranked: true }));
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: 'AI_RANKING_FAILED', message: err.message }));
  }
}

async function rankCandidates(query, candidates) {
  const systemPrompt = 'أنت مساعد بحث تشغيلي لنظام توزيع B2B. مهمتك ترتيب النتائج حسب الصلة بالاستعلام. أعد JSON فقط.';
  const candidateText = candidates.map((c, i) => {
    const parts = [];
    parts.push(`[${i}] id:${c.id}`);
    if (c.name) parts.push(`name:${c.name}`);
    if (c.phone) parts.push(`phone:${c.phone}`);
    if (c.product_name) parts.push(`product:${c.product_name}`);
    if (c.company_name) parts.push(`company:${c.company_name}`);
    if (c.customer_name) parts.push(`customer:${c.customer_name}`);
    if (c.order_number) parts.push(`order:${c.order_number}`);
    if (c.total_amount) parts.push(`total:${c.total_amount}`);
    if (c.created_at) parts.push(`date:${c.created_at}`);
    return parts.join(' ');
  }).join('\n');
  const userPrompt = `الاستعلام: ${query}\n\nالمرشحون:\n${candidateText}\n\nأعد مصفوفة JSON مرتبة حسب الصلة: [{"index":0,"score":0.95,"reason":"..."}]`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT);
  let response;
  try {
    response = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: AI_MAX_TOKENS,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    throw new Error(`AI_PROVIDER_ERROR: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI_PROVIDER_STATUS_${response.status}: ${text.slice(0, 200)}`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || '[]';
  let ranked;
  try {
    ranked = JSON.parse(content);
    if (!Array.isArray(ranked)) ranked = [];
  } catch {
    ranked = [];
  }
  const scores = {};
  for (const r of ranked) {
    const idx = parseInt(r.index, 10);
    if (!isNaN(idx) && idx >= 0 && idx < candidates.length) {
      scores[idx] = { score: Math.min(1, Math.max(0, parseFloat(r.score) || 0)), reason: String(r.reason || '').slice(0, 80) };
    }
  }
  return candidates.map((c, i) => ({ ...c, aiScore: scores[i]?.score ?? 0, aiReason: scores[i]?.reason ?? '' }))
    .sort((a, b) => b.aiScore - a.aiScore);
}

const AI_SEARCH_PATH = '/api/ai-search';

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  const reqPath = parsed.pathname;

  if (reqPath === AI_SEARCH_PATH && req.method === 'POST') {
    return handleAiSearch(req, res);
  }

  let filePath = reqPath === '/' ? '/index.html' : reqPath;
  filePath = path.join(ROOT, filePath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  serveFile(res, filePath);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Joker Smart System runtime server running at:`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  http://127.0.0.1:${PORT}`);
  console.log(`  http://<your-ip>:${PORT}`);
  console.log(`AI search: ${AI_API_KEY ? 'ENABLED' : 'DISABLED (set OPENCODE_API_KEY)'}`);
  console.log(`AI model: ${AI_MODEL}`);
  console.log(`AI endpoint: ${AI_ENDPOINT}`);
});
