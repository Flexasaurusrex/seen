import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const activeKeyword = await sql`
      SELECT * FROM keywords WHERE is_active = true LIMIT 1
    `;

    if (activeKeyword.rows.length === 0) {
      return res.json({ keyword: 'none', nfts: [] });
    }

    const nfts = await sql`
      SELECT * FROM nft_cache 
      WHERE keyword_id = ${activeKeyword.rows[0].id}
      ORDER BY RANDOM()
    `;

    return res.json({
      keyword: activeKeyword.rows[0].keyword,
      nfts: nfts.rows
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
