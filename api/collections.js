import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Get active collections only - no auth required
    const collections = await sql`
      SELECT id, name, slug, description, is_active 
      FROM curated_collections 
      WHERE is_active = true
      ORDER BY sort_order ASC
    `;
    
    return res.json(collections.rows);
  } catch (error) {
    console.error('Error fetching collections:', error);
    return res.status(500).json({ error: error.message });
  }
}
