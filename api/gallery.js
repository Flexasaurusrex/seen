import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const activeKeyword = await sql`SELECT * FROM keywords WHERE is_active = true LIMIT 1`;
    
    if (activeKeyword.rows.length === 0) {
      return res.json({ keyword: 'none', nfts: [] });
    }

    const nfts = await sql`SELECT * FROM nft_cache WHERE keyword_id = ${activeKeyword.rows[0].id} ORDER BY RANDOM()`;

    return res.json({
      keyword: activeKeyword.rows[0].keyword,
      nfts: nfts.rows.map(nft => ({
        id: nft.id,
        contract_address: nft.contract_address,
        token_id: nft.token_id,
        title: nft.title,
        description: nft.description,
        image_url: nft.image_url,
        external_url: nft.external_url,
        creator_name: nft.creator_name
      }))
    });
  } catch (error) {
    console.error('Gallery error:', error);
    return res.status(500).json({ error: error.message });
  }
}
