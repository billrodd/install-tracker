// st-test.cjs
// Run with: node st-test.cjs
// Purpose: Sanity-check your ServiceTitan technicians endpoint & headers.

// 1) Load .env (ST_* vars). If you don't have dotenv installed, run: npm i dotenv
require('dotenv').config();

// 2) Use Node 18+ built-in fetch. If you're on older Node, uncomment the next 2 lines:
// const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
// // npm i node-fetch

// ---- Config from .env ----
const ST_BASE_URL  = (process.env.ST_BASE_URL || 'https://api.servicetitan.io').replace(/\/$/, '');
const ST_TENANT_ID = process.env.ST_TENANT_ID;
const ST_API_TOKEN = process.env.ST_API_TOKEN;       // Bearer token (or your token as required by your account)
const ST_APP_KEY   = process.env.ST_APP_KEY || '';   // Only if your account requires it

// You can override the technicians path via .env if needed:
//   ST_TECH_PATH=/tenant/{id}/technicians
//   ST_TECH_PATH=/v1/tenant/{id}/technicians
//   ST_TECH_PATH=/v2/tenant/{id}/technicians   (common)
const ST_TECH_PATH = (process.env.ST_TECH_PATH || '/v2/tenant/{id}/technicians')
  .replace('{id}', encodeURIComponent(String(ST_TENANT_ID)));

// Query params (tweak as needed)
const params = new URLSearchParams({
  active: 'true',
  page: '1',
  pageSize: '200',
});

// Build final URL
const url = `${ST_BASE_URL}${ST_TECH_PATH}?${params.toString()}`;

// Headers — mirror what your account expects.
// Most tenants use Authorization: Bearer <token> plus optional ST-App-Key.
const headers = {
  'content-type': 'application/json',
  'Authorization': `Bearer ${ST_API_TOKEN}`,
  ...(ST_APP_KEY ? { 'ST-App-Key': ST_APP_KEY } : {}),
};

// Minimal validation before we call
function assertEnv(name, val) {
  if (!val) {
    console.error(`❌ Missing required env var: ${name}`);
    process.exit(1);
  }
}
assertEnv('ST_BASE_URL', ST_BASE_URL);
assertEnv('ST_TENANT_ID', ST_TENANT_ID);
assertEnv('ST_API_TOKEN', ST_API_TOKEN);

(async () => {
  console.log('➡️  Testing ServiceTitan technicians endpoint…');
  console.log('URL:', url);
  console.log('Headers:', {
    ...headers,
    Authorization: headers.Authorization ? 'Bearer ********' : undefined, // don’t print the token
  });

  try {
    const res = await fetch(url, { headers });
    const text = await res.text();

    console.log('HTTP Status:', res.status);

    // Try to parse JSON, but still show raw text if not JSON
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }

    if (!res.ok) {
      console.error('❌ Request failed.');
      console.error('Response body:', text);
      process.exit(1);
    }

    // Normalize to an array in case API returns { data: [...] }
    const list = Array.isArray(data) ? data : (data && data.data ? data.data : []);
    console.log(`✅ Success. Technicians returned: ${Array.isArray(list) ? list.length : 'unknown'}`);

    // Print first few names so you can verify quickly
    if (Array.isArray(list)) {
      const preview = list.slice(0, 5).map(t => {
        const name = [t.firstName, t.lastName].filter(Boolean).join(' ') || t.name || t.displayName || 'Unknown';
        return `${t.id ?? t.technicianId ?? t.TechnicianId ?? '?'} — ${name}`;
      });
      console.log('Preview:', preview);
    } else {
      console.log('Raw response (not an array):', data);
    }
  } catch (err) {
    console.error('❌ Error calling ServiceTitan:', err?.message || err);
    process.exit(1);
  }
})();
