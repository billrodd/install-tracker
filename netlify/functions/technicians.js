const fetch = require("node-fetch");

exports.handler = async function (event, context) {
  try {
    const baseUrl = process.env.ST_BASE_URL;
    const tenantId = process.env.ST_TENANT_ID;
    const appKey = process.env.ST_APP_KEY;
    const clientId = process.env.SERVICETITAN_CLIENT_ID;
    const clientSecret = process.env.SERVICETITAN_CLIENT_SECRET;

    if (!baseUrl || !tenantId || !appKey || !clientId || !clientSecret) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Missing env vars. Need ST_BASE_URL, ST_TENANT_ID, ST_APP_KEY, SERVICETITAN_CLIENT_ID, SERVICETITAN_CLIENT_SECRET."
        }),
      };
    }

    // 🔑 Step 1: Fetch a fresh OAuth token
    const tokenResp = await fetch("https://auth.servicetitan.io/connect/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`,
    });

    if (!tokenResp.ok) {
      const err = await tokenResp.text();
      return { statusCode: tokenResp.status, body: err };
    }

    const tokenJson = await tokenResp.json();
    const token = tokenJson.access_token;

    // 🔧 Step 2: Call ServiceTitan API with Bearer + App Key
    const url = `${baseUrl}/settings/v2/tenant/${tenantId}/technicians?active=true&page=1&pageSize=200`;

    const resp = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "ST-App-Key": appKey,
      },
    });

    if (!resp.ok) {
      const err = await resp.text();
      return { statusCode: resp.status, body: err };
    }

    const data = await resp.json();

    return {
      statusCode: 200,
      body: JSON.stringify({
        pathUsed: `/settings/v2/tenant/${tenantId}/technicians`,
        authMode: "bearer+appkey",
        count: data?.data?.length || 0,
        technicians: data?.data || [],
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
