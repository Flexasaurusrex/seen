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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  if (!checkAuth(req)) {
    res.setHeader('WWW-Authenticate', 'Basic');
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    if (req.method === 'GET') {
      const keywords = await sql`SELECT * FROM keywords ORDER BY created_at DESC`;
      return res.json(keywords.rows);
    }

    if (req.method === 'POST') {
      const { keyword } = req.body;
      const result = await sql`INSERT INTO keywords (keyword) VALUES (${keyword}) RETURNING *`;
      return res.json(result.rows[0]);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Missing keyword ID' });
      
      await sql`DELETE FROM nft_cache WHERE keyword_id = ${id}`;
      const result = await sql`DELETE FROM keywords WHERE id = ${id} RETURNING *`;
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Keyword not found' });
      }
      
      return res.json({ success: true, deleted: result.rows[0] });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Keywords error:', error);
    return res.status(500).json({ error: error.message });
  }
}
