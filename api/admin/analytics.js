import { sql } from '@vercel/postgres';

function checkAuth(req) {
  const auth = req.headers.authorization;
  if (!auth) return false;
  const [, credentials] = auth.split(' ');
  const [username, password] = Buffer.from(credentials, 'base64').toString().split(':');
  return username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!checkAuth(req)) {
    res.setHeader('WWW-Authenticate', 'Basic');
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const result = await sql`
      SELECT 
        n.id,
        n.title,
        n.creator_name,
        COUNT(CASE WHEN a.event_type = 'view' THEN 1 END) as views,
        COUNT(CASE WHEN a.event_type = 'click' THEN 1 END) as clicks,
        MAX(a.created_at) as last_interaction
      FROM nft_cache n
      LEFT JOIN analytics a ON n.id = a.nft_id
      GROUP BY n.id, n.title, n.creator_name
      ORDER BY last_interaction DESC NULLS LAST
      LIMIT 50
    `;

    return res.json(result.rows);
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({ error: error.message });
  }
}
