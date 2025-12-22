import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Get all active keywords
    const activeKeywords = await sql`SELECT * FROM keywords WHERE is_active = true`;
    
    if (activeKeywords.rows.length === 0) {
      return res.json({ nfts: [], keywords: [] });
    }

    // Get NFTs from all active keywords - NO RANDOM, shuffle client-side
    const keywordIds = activeKeywords.rows.map(k => k.id);
    const nfts = await sql`
      SELECT * FROM nft_cache 
      WHERE keyword_id = ANY(${keywordIds})
    `;

    // Shuffle array using Fisher-Yates
    const shuffled = [...nfts.rows];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return res.json({ 
      nfts: shuffled,
      keywords: activeKeywords.rows.map(k => k.keyword).join(', ')
    });
  } catch (error) {
    console.error('Gallery error:', error);
    return res.status(500).json({ error: error.message });
  }
}
