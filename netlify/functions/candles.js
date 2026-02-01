const SUPABASE_URL = 'https://znigtcsnkfghvzyggzgk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_P2yUXF3ICRzdsvAkiYomjQ_WhQRAnPl';

const headers = {
  'Content-Type': 'application/json',
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  // GET — return candles from last 7 days
  if (event.httpMethod === 'GET') {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const url = `${SUPABASE_URL}/rest/v1/candles?created_at=gte.${since}&order=created_at.desc&limit=100`;
    const res = await fetch(url, { headers });
    const data = await res.json();
    return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };
  }

  // POST — create a candle
  if (event.httpMethod === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const name = String(body.name || '').trim().slice(0, 30);
    const comment = String(body.comment || '').trim().slice(0, 200);
    if (!name || !comment) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Name and comment required' }) };
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/candles`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ name, comment }),
    });
    const data = await res.json();
    return { statusCode: 201, headers: CORS, body: JSON.stringify(data) };
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
};
