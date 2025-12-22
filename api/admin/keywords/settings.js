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
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!checkAuth(req)) {
    res.setHeader('WWW-Authenticate', 'Basic');
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.method === 'GET') {
    try {
      const result = await sql`SELECT key, value FROM settings`;
      const settings = {};
      result.rows.forEach(row => {
        settings[row.key] = row.value;
      });
      return res.json(settings);
    } catch (error) {
      console.error('Settings GET error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'PUT') {
    try {
      const updates = req.body;
      
      for (const [key, value] of Object.entries(updates)) {
        await sql`
          INSERT INTO settings (key, value) 
          VALUES (${key}, ${value})
          ON CONFLICT (key) 
          DO UPDATE SET value = ${value}
        `;
      }

      return res.json({ success: true });
    } catch (error) {
      console.error('Settings PUT error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
